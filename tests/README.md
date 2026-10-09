# Performance tests (k6)

Everything runs **inside the docker compose network** through the `k6` service (profile `tests`, so it never starts with
`docker compose up`). k6 streams its metrics to Prometheus while it runs, so you watch the test live in Grafana next to the
server-side metrics (latency, CPU, JVM, Postgres, Kafka lag):

> **http://localhost:3001/d/pm-k6** - "Patient Management - Performance tests (k6)"
> plus the [PostgreSQL](http://localhost:3001/d/pm-postgres) and [Kafka](http://localhost:3001/d/pm-kafka) dashboards.

```bash
docker compose up -d --build        # platform must be running and healthy
tests/run.sh smoke                  # 1 min - run this first
tests/run.sh load                   # then the rest
tests/cleanup.sh                    # remove the test patients when you are done
```

Without the wrapper (Windows / CI):

```bash
docker compose --profile tests run --rm -e TEST_ID=$(date +%s) k6 run /scripts/smoke.js
# or with a locally installed k6, straight at the gateway:
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw -e BASE_URL=http://localhost:4004 tests/k6/smoke.js
```

## The tests

| Script | Kind | What it answers | Default shape | Pass / fail |
|---|---|---|---|---|
| `smoke.js` | Smoke | Is it alive? Do CRUD, validation (400/404), auth (401) and the DELETE-needs-ADMIN rule behave? | 2 VUs, 1 min | every check green, p95 < 1.5 s |
| `load.js` | Load | Does it meet the SLOs at expected traffic? | ramp to 20 VUs (2 m), hold 5 m, down 1 m | errors < 1 %, p95 < 800 ms, p99 < 1.5 s |
| `stress.js` | Stress | Where does it degrade, and does it recover? | 5 plateaus up to 100 VUs, then 0 | loose (errors < 10 %) - read the graphs |
| `spike.js` | Spike | Sudden 5 -> 120 -> 5 VUs: survives? recovers? | 20 s spike, 1 min hold, 3 min recovery | errors < 5 %, p95 < 4 s |
| `soak.js` | Soak / endurance | Leaks, lag creep, DB bloat over time | 10 VUs for `DURATION` (1 h) | errors < 1 %, p95 < 1 s |
| `breakpoint.js` | Capacity | Max throughput before SLOs break | arrival rate 5 -> 200 it/s over 15 min, **self-aborts** at p95 > 2 s or errors > 5 % | the abort point *is* the result |
| `pipeline-burst.js` | gRPC + Kafka chain | How big does the analytics lag get, how long to drain, is every registration persisted? | 30 registrations/s for 2 min, then waits for lag = 0 | create p95 < 2.5 s, **lag drains to 0** |
| `read-heavy.js` | DB read path | Read capacity of gateway -> patient-service -> Postgres; effect of table size | 40 VUs, list only | p95 < 600 ms |

`tests/run.sh suite` runs smoke -> load -> spike -> burst and stops at the first failure (non-zero exit code, CI-friendly).

### The traffic mix (`k6/lib/journeys.js`)

55 % list patients - 20 % register a patient (DB write + gRPC to billing + Kafka event) - 10 % edit - 8 % delete one of its own - 5 % sign in
(bcrypt) - 2 % unauthenticated request (must be 401). All VUs share one admin JWT (valid 10 h).
Every request passes through the gateway, which calls the auth-service to validate the token, so auth-service load scales with total traffic.

### Tuning

Set env vars before the command: `LOAD_VUS=50 HOLD=10m tests/run.sh load`.

| Variable | Used by | Default |
|---|---|---|
| `SEED` | all | 10 (patients created in `setup()`; 100 for read-heavy) |
| `LOAD_VUS`, `RAMP_UP`, `HOLD`, `RAMP_DOWN` | load | 20, 2m, 5m, 1m |
| `PEAK_VUS` | stress | 100 |
| `BASE_VUS`, `SPIKE_VUS` | spike | 5, 120 |
| `SOAK_VUS`, `DURATION` | soak | 10, 1h |
| `MAX_RATE`, `RAMP`, `MAX_VUS` | breakpoint | 200, 15m, 1500 |
| `VUS`, `DURATION` | smoke | 2, 1m |
| `RATE`, `DURATION`, `DRAIN_TIMEOUT`, `DRAIN_SECONDS` | burst | 30, 2m, 300, 20 |
| `READ_VUS`, `HOLD` | read-heavy | 40, 4m |
| `THINK_TIME` | closed-model tests | 1 (seconds; 0 = max throughput) |
| `BASE_URL`, `PROM_URL` | all / burst | `http://api-gateway:4004`, `http://prometheus:9090` |

## How a run works

1. `setup()` logs in as the seeded admin and creates `SEED` patients (`perf+...@example.com`). That traffic is tagged `ep=setup`
   and excluded from the dashboards.
2. The scenario drives the mix above. k6 pushes metrics to Prometheus every 5 s, tagged `testid=<test>-<timestamp>`; pick runs in the
   dashboard's *Test run* variable. A JSON summary lands in `tests/results/`.
3. Every registration is real data: a patient row, a gRPC call, a Kafka message. Remove the rows with `tests/cleanup.sh`
   (deletes `perf+%@example.com` patients).

## Reading the results

* **k6 dashboard** - VUs, req/s, error rate, latency per endpoint, plus server-side p95, 5xx, container CPU, Postgres connections,
  Kafka lag and JVM heap on one time axis. k6 exports one percentile series per tag-set, so the headline p95/p99 tiles show the *worst
  endpoint*, not a global percentile.
* **Where is the bottleneck?** Latency up + a service at its CPU limit -> scale that service. Every endpoint slow together -> look at the
  auth-service (token validation) or Postgres. `create` much slower than `list` -> billing gRPC or Kafka publish (open a slow trace from the
  overview dashboard). Lag rising -> analytics consumer. `login` dominating CPU -> bcrypt.
* **One request, end to end** - overview dashboard -> *Slowest traces* -> pick a `POST /api/patients` trace: gateway -> auth-service
  `/validate` -> patient-service -> PostgreSQL + gRPC billing-service + Kafka publish -> analytics-service consumer, then jump to its logs.
* The CPU/memory alerts (> 50 %) will fire during stress, spike and breakpoint runs; the e-mails appear in Mailpit (http://localhost:8025).

## Caveats

* The list endpoint is unpaginated, so it returns every patient; with thousands of rows it becomes the bottleneck (try `SEED=2000`).
* Numbers from a laptop under Docker Desktop are only meaningful relative to each other (before / after a change).
* Services run with `cpus: 1.0` and 1.5 GB in `docker-compose.yml`; raise the limits to see how the platform scales.
* The scripts could not be executed in the environment they were written in; tune thresholds in each script's `options` if needed.

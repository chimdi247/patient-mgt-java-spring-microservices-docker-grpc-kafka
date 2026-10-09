# Patient Management platform - one command

```bash
docker compose up -d --build      # .env is already provided (copy of .env.example); first build takes several minutes
```

Give Docker **at least 8 GB RAM**. Sign in at **http://localhost:3000** with `admin@example.com` / `password123`.

| What | URL | Login |
|---|---|---|
| **CareDesk UI** (React + shadcn/ui) | http://localhost:3000 | `admin@example.com` / `password123` |
| API gateway | http://localhost:4004 (`POST /auth/login`, `/api/patients`) | JWT |
| **Grafana** | http://localhost:3001 | `admin` / `admin` (anonymous viewer enabled) |
| Grafana dashboards | [overview](http://localhost:3001/d/pm-overview) - [PostgreSQL](http://localhost:3001/d/pm-postgres) - [Kafka](http://localhost:3001/d/pm-kafka) - [k6](http://localhost:3001/d/pm-k6) | |
| **Kafka UI** | http://localhost:8090 | - |
| Mailpit (Grafana alert e-mails) | http://localhost:8025 | - |
| Prometheus / Loki / Tempo | :9090 / :3100 / :3200 | - |

Only the gateway (4004) and the frontend (3000) are published for the application; auth, patient, billing and analytics services are internal.

## Layout

```
docker-compose.yml            the whole platform (22 containers + the opt-in k6 runner)
.env / .env.example           DB credentials, base64 JWT secret, Grafana + SMTP (alerts) settings
docker/
  postgres/01-create-databases-and-tables.sql   databases auth_db + patient_db and their tables
  postgres/02-seed-users.sql                    admin@example.com (BCrypt hash of password123) + testuser@test.com (integration tests)
  postgres/03-seed-patients.sql                 12 sample patients
  kafka/create-topics.sh                        topic "patient" (one-shot kafka-init container)
observability/                                  OTel Collector, Prometheus, Loki, Tempo, Grafana (datasources, dashboards, alerts) - mounted as volumes
tests/                                          k6: smoke, load, stress, spike, soak, breakpoint, pipeline burst, read-heavy (tests/README.md)
patient-frontend/                               React 18 + Vite + TypeScript + Tailwind + shadcn/ui, served by nginx
api-gateway/ auth-service/ patient-service/ billing-service/ analytics-service/   the Spring Boot services (Dockerfiles + OTel agent)
infrastructure/ integration-tests/ api-requests/ grpc-requests/                   original course material (untouched)
```

## How it fits together

```
browser -> nginx (frontend :3000) --/auth/* /api/*--> api-gateway :4004 --JwtValidation--> auth-service /validate
                                                                          \--> auth-service /login
                                                                          \--> patient-service /patients --JDBC--> postgres patient_db
                                                                                                         --gRPC--> billing-service :9001
                                                                                                         --Kafka "patient" (protobuf)--> analytics-service
```

* The login flow returns only a JWT; the UI decodes it (`sub` = e-mail, `role` = ADMIN | USER).
* Schema and seed data come from `docker/postgres/*.sql`; the services run with `ddl-auto=none` and `sql.init.mode=never`.
  The scripts run once, on an empty `postgres-data` volume. To re-run: `docker compose down -v`.

## Telemetry (OpenTelemetry)

* Every Java container starts with `-javaagent:/opt/otel/opentelemetry-javaagent.jar` (downloaded in the Dockerfile; version = `OTEL_AGENT_VERSION`).
  It auto-instruments HTTP (servlet + Netty gateway + WebClient), **gRPC**, JDBC, **Kafka** (producer + consumer), logging and JVM metrics. All config is `OTEL_*` env vars in `docker-compose.yml`.
* Context propagation (W3C `traceparent`): browser/nginx -> gateway -> auth-service (token check) -> patient-service -> PostgreSQL / gRPC billing-service / Kafka -> analytics-service. One `POST /api/patients` = one trace across all five services.
* Logs carry `trace_id`/`span_id`. In Grafana (Explore -> Loki, or the Logs panel of the overview dashboard) expand a line and click **Open trace in Tempo**; in a trace each span has a **Logs** button back to Loki.
* `opentelemetry-api` is a dependency of auth, patient, billing and analytics services for **business metrics**: `pm_patients_current`, `pm_users_current`, `pm_patient_operations_total{operation,outcome}`,
  `pm_logins_total{outcome}`, `pm_billing_calls_total`, `pm_billing_accounts_created_total`, `pm_patient_events_published_total`, `pm_analytics_events_total`.

## Dashboards and alerts

* **Platform overview** - uptime, availability / success-rate / latency SLIs with SLO targets and error budgets, RED metrics per service, successful vs failed HTTP requests, business KPIs
  (patients, registrations, logins, the registration pipeline billing -> Kafka -> analytics), container and node CPU / memory, JVM, logs, error and slow traces, service map.
* **PostgreSQL** (postgres-exporter) and **Kafka** (kafka-exporter) dashboards; **k6** dashboard for test runs next to server-side metrics.
* **Grafana-managed alerts**, e-mailed over SMTP (default: Mailpit; set `SMTP_*` and `ALERT_EMAIL_TO` in `.env`): container CPU > 50 %, container memory > 50 %, node CPU > 50 %, node memory > 50 %,
  PostgreSQL down, Postgres connections > 80 %, Kafka broker down, Kafka consumer lag > 100.
* Limits: no broker-internal Kafka JMX metrics, no `pg_stat_statements`; postgres-exporter uses the compose superuser (fine locally; use a `pg_monitor` role elsewhere).

## Changes made to the services

**Bug fixes**
* api-gateway: an invalid/expired token produced HTTP **500** (the `@RestControllerAdvice` never applies to gateway filters) - now a clean **401**; an unreachable auth-service is a 503.
  `auth.service.url` had no default (the gateway would not start without `AUTH_SERVICE_URL`) - now defined; a typo in the dev routes (`http:/host...`) fixed; CORS added for `npm run dev`.
* patient-service: unknown id -> **404** (was 400, and delete of an unknown id silently succeeded); malformed dates / UUIDs / JSON -> **400** (was 500); `registeredDate` is now returned by the API.
* analytics-service had no `server.port` (listened on 8080 while the image exposed 4002) and `auto-offset-reset=earliest` so a new consumer group does not miss events.
* Dockerfiles ran `mvn clean package` **with tests** (they need a DB and Kafka, so the image build failed) and used the deprecated `openjdk` image; now `-DskipTests` and `eclipse-temurin:21-jre`.

**Additions**
* `spring-boot-starter-actuator` in all five services (health checks, metrics); `opentelemetry-api` in four.
* Role rule enforced at the gateway: auth-service `/validate` returns `X-User-Email` / `X-User-Role`, the gateway forwards them (client-supplied copies are stripped) and **only ADMIN may DELETE** (403 otherwise). The UI hides the delete button for non-admins.
* Log pattern with trace/span ids, business metrics classes (see above).

## Notes

* The compose file, SQL, Dockerfiles, Grafana provisioning, frontend and k6 scripts were validated statically (YAML / JSON / TS / JS parse, Java compiled to the parser level, bind-mount and dependency resolution).
  They could **not** be built or run where they were written (no Docker / Maven / npm registry), so expect to iterate once on first boot: `docker compose logs <service>`.
* Rotate the seeded passwords and the `.env` JWT secret for anything but local use (`openssl rand -base64 64`). The original data.sql users are not used by docker compose.
* The CPU/memory alerts at 50 % will legitimately fire during stress / spike / breakpoint tests.

#!/usr/bin/env bash
# Runs a k6 performance test inside the docker compose network and streams its metrics to Prometheus,
# so you can watch it live in Grafana:  http://localhost:3001/d/pm-k6
#
#   tests/run.sh <test> [extra k6 args]
#
#   smoke        1 min, 2 VUs: full patient lifecycle + auth / validation / security negatives   (CI gate)
#   load         ~8 min, ramp to LOAD_VUS (20)                                                    (SLO check)
#   stress       ~20 min, steps up to PEAK_VUS (100), then recovery
#   spike        ~6 min, 5 -> 120 -> 5 VUs
#   soak         1 h (DURATION=4h ...), constant SOAK_VUS (10)
#   breakpoint   ~15 min, rising arrival rate until the SLOs break (self-aborting)
#   burst        2 min + drain: patient registrations -> gRPC billing -> Kafka -> analytics lag
#   read-heavy   ~6 min, read-only workload (SEED=2000 for a big table)
#   suite        smoke -> load -> spike -> burst (about 20 min, stops at the first failure)
#
# Tune with environment variables, e.g.   LOAD_VUS=50 HOLD=10m tests/run.sh load
set -euo pipefail
cd "$(dirname "$0")/.."

declare -A FILE=(
  [smoke]=smoke.js [load]=load.js [stress]=stress.js [spike]=spike.js [soak]=soak.js
  [breakpoint]=breakpoint.js [burst]=pipeline-burst.js [read-heavy]=read-heavy.js
)

# environment variables forwarded into the k6 container when set
FORWARD=(SEED VUS LOAD_VUS PEAK_VUS BASE_VUS SPIKE_VUS SOAK_VUS READ_VUS DURATION HOLD RAMP RAMP_UP RAMP_DOWN
         RATE MAX_RATE MAX_VUS THINK_TIME DRAIN_TIMEOUT DRAIN_SECONDS BASE_URL PROM_URL ADMIN_EMAIL ADMIN_PASSWORD)

run_one() {
  local name="$1"; shift
  local file="${FILE[$name]:-}"
  if [[ -z "$file" ]]; then echo "unknown test '$name'. Choose one of: ${!FILE[*]} suite" >&2; exit 2; fi

  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local args=(--profile tests run --rm -e "TEST_ID=$ts")
  for v in "${FORWARD[@]}"; do [[ -n "${!v:-}" ]] && args+=(-e "$v=${!v}"); done

  echo "==> k6 $name  (run id: ${name}-${ts})"
  echo "    live results: http://localhost:3001/d/pm-k6"
  docker compose "${args[@]}" k6 run \
    --summary-export "/results/${name}-${ts}.json" \
    "/scripts/${file}" "$@"
}

[[ $# -ge 1 ]] || { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
test_name="$1"; shift

if [[ "$test_name" == "suite" ]]; then
  for t in smoke load spike burst; do run_one "$t" "$@"; done
else
  run_one "$test_name" "$@"
fi

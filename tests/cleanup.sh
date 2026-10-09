#!/usr/bin/env bash
# Deletes all patients created by the performance tests. Seed data, users and real patients are untouched.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [[ -f .env ]] && . ./.env; set +a
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-pm_admin}" -d postgres < tests/sql/cleanup-perf-data.sql
echo "performance-test data removed"

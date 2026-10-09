/**
 * SOAK (ENDURANCE) TEST - "does it stay healthy for hours?" Finds memory leaks, connection-pool leaks,
 * Kafka lag creep, database bloat and disk growth.
 * Constant moderate load (SOAK_VUS, default 10) for DURATION (default 1h; use 4h - 8h for a real soak).
 * The shared admin JWT lives 10 hours, so keep DURATION below that.
 * Watch: JVM heap (should saw-tooth, not climb), Postgres connections / dead tuples / DB size, Kafka lag, p95 drift.
 *
 *   tests/run.sh soak
 *   DURATION=4h SOAK_VUS=15 tests/run.sh soak
 */
import { int, testId } from './lib/config.js';
import * as api from './lib/api.js';
import { staffIteration } from './lib/journeys.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: int('SOAK_VUS', 10) },
        { duration: __ENV.DURATION || '1h', target: int('SOAK_VUS', 10) },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  tags: { testid: testId('soak') },
  setupTimeout: '180s',
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'], checks: ['rate>0.99'] },
};

export const setup = () => api.provision(int('SEED', 10));
export default staffIteration;

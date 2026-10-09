/**
 * STRESS TEST - "how does the platform behave beyond normal load, and does it recover?"
 * Steps the load up in 5 plateaus to PEAK_VUS (default 100), then drops to 0 (recovery).
 * Thresholds are deliberately loose: the goal is to *see* where latency / errors start to climb
 * (k6 dashboard + service, Postgres and Kafka dashboards), not to pass or fail.
 *
 *   tests/run.sh stress
 *   PEAK_VUS=200 tests/run.sh stress
 */
import { int, testId } from './lib/config.js';
import * as api from './lib/api.js';
import { staffIteration } from './lib/journeys.js';

const PEAK = int('PEAK_VUS', 100);
const step = (f) => Math.max(1, Math.round(PEAK * f));

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: step(0.1) }, { duration: '2m', target: step(0.1) },
        { duration: '1m', target: step(0.25) }, { duration: '2m', target: step(0.25) },
        { duration: '1m', target: step(0.5) }, { duration: '2m', target: step(0.5) },
        { duration: '1m', target: step(0.75) }, { duration: '2m', target: step(0.75) },
        { duration: '1m', target: PEAK }, { duration: '3m', target: PEAK },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },
  tags: { testid: testId('stress') },
  setupTimeout: '180s',
  thresholds: { http_req_failed: ['rate<0.10'], http_req_duration: ['p(95)<3000'] },
};

export const setup = () => api.provision(int('SEED', 10));
export default staffIteration;

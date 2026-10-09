/**
 * LOAD TEST - "does the platform meet its SLOs at the expected traffic?"
 * Ramp to LOAD_VUS (default 20), hold, ramp down. Realistic staff mix (see lib/journeys.js).
 * Thresholds mirror the SLOs on the Grafana dashboard: p95 < 800 ms, errors < 1 %.
 *
 *   tests/run.sh load
 *   LOAD_VUS=50 HOLD=10m tests/run.sh load
 */
import { int, testId } from './lib/config.js';
import * as api from './lib/api.js';
import { staffIteration, standardThresholds } from './lib/journeys.js';

const VUS = int('LOAD_VUS', 20);

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '2m', target: VUS },
        { duration: __ENV.HOLD || '5m', target: VUS },
        { duration: __ENV.RAMP_DOWN || '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  tags: { testid: testId('load') },
  setupTimeout: '180s',
  thresholds: standardThresholds(800, 1500),
};

export const setup = () => api.provision(int('SEED', 10));
export default staffIteration;

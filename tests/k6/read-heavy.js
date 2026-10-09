/**
 * READ-HEAVY TEST - only GET /api/patients (and the 401 path). Isolates the read path:
 * gateway (JWT check against auth-service) -> patient-service -> PostgreSQL, with no gRPC and no Kafka.
 * The list endpoint returns every patient (no pagination), so latency grows with table size:
 * run `SEED=2000 tests/run.sh read-heavy` to see it.
 * Watch: Postgres cache-hit ratio, rows read/s, connections; gateway -> auth-service latency.
 *
 *   tests/run.sh read-heavy
 *   READ_VUS=80 SEED=1000 tests/run.sh read-heavy
 */
import { int, testId } from './lib/config.js';
import * as api from './lib/api.js';
import { browse, think, unauthenticated } from './lib/journeys.js';

const VUS = int('READ_VUS', 40);

export const options = {
  scenarios: {
    reads: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: VUS },
        { duration: __ENV.HOLD || '4m', target: VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  tags: { testid: testId('read-heavy') },
  setupTimeout: '900s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600'],
    'http_req_duration{ep:list}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

export const setup = () => api.provision(int('SEED', 100));

export default function (d) {
  if (Math.random() < 0.97) browse(d); else unauthenticated();
  think();
}

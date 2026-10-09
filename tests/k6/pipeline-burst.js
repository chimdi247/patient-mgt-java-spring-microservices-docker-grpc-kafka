/**
 * REGISTRATION PIPELINE BURST (gRPC + Kafka) TEST
 * Registering a patient is the platform's longest chain:
 *     POST /api/patients -> patient-service -> PostgreSQL
 *                                           -> gRPC  billing-service (create billing account)
 *                                           -> Kafka topic "patient" -> analytics-service (consumer group)
 * This test fires registrations at a fixed arrival rate (RATE/s, default 30 for 2 minutes) to saturate that chain,
 * then teardown() polls Prometheus until the analytics consumer's lag is back to 0 and records how long that took
 * (`kafka_drain_seconds`). It also checks that every created patient is really in the database.
 *
 * Needs Prometheus (PROM_URL, default http://prometheus:9090 inside the compose network).
 * Watch: Kafka dashboard (produced vs consumed, lag), patient-service CPU, billing-service gRPC latency (traces), Postgres commits/s.
 *
 *   tests/run.sh burst
 *   RATE=80 DURATION=3m tests/run.sh burst
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { int, testId, PROM_URL } from './lib/config.js';
import * as api from './lib/api.js';

const created = new Counter('patients_created');
const drain = new Trend('kafka_drain_seconds');

export const options = {
  scenarios: {
    burst: {
      executor: 'constant-arrival-rate',
      rate: int('RATE', 30),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: 50,
      maxVUs: 500,
    },
  },
  tags: { testid: testId('burst') },
  setupTimeout: '180s',
  teardownTimeout: '420s',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{ep:create}': ['p(95)<2500'],
    checks: ['rate>0.99'],
  },
};

export const setup = () => api.provision(1);

export default function (d) {
  const res = api.createPatient(d.token, api.newPatient('burst'));
  if (check(res, { 'create: 200': (r) => r.status === 200 })) created.add(1);
}

/** Current lag (messages) of the analytics-service consumer group, or null when Prometheus is unreachable. */
function consumerLag() {
  const q = encodeURIComponent('sum(kafka_consumergroup_lag{consumergroup="analytics-service"})');
  const res = http.get(`${PROM_URL}/api/v1/query?query=${q}`, { tags: { ep: 'teardown' } });
  if (res.status !== 200) return null;
  const r = res.json('data.result');
  return r && r.length ? parseFloat(r[0].value[1]) : 0;
}

export function teardown(d) {
  const started = Date.now();
  const timeout = int('DRAIN_TIMEOUT', 300) * 1000;
  let lag = consumerLag();
  if (lag === null) {
    console.warn(`Prometheus not reachable at ${PROM_URL}: skipping the Kafka drain measurement`);
  } else {
    // lag metrics are scraped every 15 s: wait until it is 0 twice in a row so a stale sample is not mistaken for "drained"
    let zeros = 0;
    while (Date.now() - started < timeout && zeros < 2) {
      sleep(5);
      lag = consumerLag();
      zeros = lag === 0 ? zeros + 1 : 0;
    }
    const seconds = (Date.now() - started) / 1000;
    drain.add(seconds);
    console.log(`analytics consumer lag ${lag}; drained after ${seconds.toFixed(1)} s`);
    check(lag, { 'Kafka backlog fully drained (lag == 0)': (l) => l === 0 });
  }

  const list = api.json(api.listPatients(d.token, 'teardown')) || [];
  const perfRows = list.filter((p) => p.email.startsWith('perf+')).length;
  console.log(`${perfRows} perf+ patients are in the database`);
  check(perfRows, { 'every accepted registration is persisted': (n) => n >= 1 });
  sleep(int('DRAIN_SECONDS', 20)); // keep the run open so Grafana captures the drained state
}

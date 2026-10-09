import { check, sleep } from 'k6';
import { THINK_TIME } from './config.js';
import * as api from './api.js';

/** Random pause around THINK_TIME seconds (0.5x - 1.5x). THINK_TIME=0 gives a pure throughput test. */
export const think = () => { if (THINK_TIME > 0) sleep(THINK_TIME * (0.5 + Math.random())); };

// per-VU state: patients this VU created itself (so it can later update / delete them)
const mine = [];

export function browse(d) {
  const res = api.listPatients(d.token);
  check(res, { 'list: 200 + array': (r) => r.status === 200 && Array.isArray(api.json(r)) });
}

/** POST /api/patients = DB write + gRPC call to billing-service + Kafka publish (consumed by analytics-service). */
export function register(d) {
  const p = api.newPatient('load');
  const res = api.createPatient(d.token, p);
  const ok = check(res, { 'create: 200 + id': (r) => r.status === 200 && !!(api.json(r) && api.json(r).id) });
  if (ok) mine.push({ id: api.json(res).id, email: p.email });
}

export function edit(d) {
  const target = mine.length ? mine[Math.floor(Math.random() * mine.length)] : d.seeded[Math.floor(Math.random() * d.seeded.length)];
  const res = api.updatePatient(d.token, target.id, { ...api.newPatient('edited'), email: target.email });
  api.okStatus(res, 'update');
}

export function remove(d) {
  if (!mine.length) return register(d);
  const target = mine.splice(Math.floor(Math.random() * mine.length), 1)[0];
  api.okStatus(api.deletePatient(d.token, target.id), 'delete', 204);
}

/** Login is bcrypt (CPU-heavy by design) - a small share of the mix. */
export function signIn() {
  const res = api.login();
  check(res, { 'login: 200 + token': (r) => r.status === 200 && !!(api.json(r) && api.json(r).token) });
}

export function unauthenticated() {
  const res = api.call('GET', '/api/patients', { ep: 'unauth', expected: [401] });
  check(res, { 'no token -> 401': (r) => r.status === 401 });
}

/**
 * Staff traffic mix:
 *   55 % open the patient list      (read; payload grows with the table)
 *   20 % register a patient         (write + gRPC + Kafka)
 *   10 % edit a patient
 *    8 % delete one of its own patients
 *    5 % sign in (bcrypt)
 *    2 % unauthenticated request (must be 401)
 */
export function staffIteration(d, withThinkTime = true) {
  const r = Math.random();
  if (r < 0.55) browse(d);
  else if (r < 0.75) register(d);
  else if (r < 0.85) edit(d);
  else if (r < 0.93) remove(d);
  else if (r < 0.98) signIn();
  else unauthenticated();
  if (withThinkTime) think();
}

/** Standard thresholds for tests that must pass (smoke / load). */
export const standardThresholds = (p95 = 800, p99 = 1500) => ({
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  http_req_duration: [`p(95)<${p95}`, `p(99)<${p99}`],
  'http_req_duration{ep:create}': [`p(95)<${p95 * 2}`],   // includes the gRPC hop to billing-service
  'http_req_duration{ep:list}': [`p(95)<${p95}`],
});

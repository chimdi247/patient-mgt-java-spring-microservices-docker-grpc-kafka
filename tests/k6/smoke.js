/**
 * SMOKE TEST - "is the platform alive and are the main flows and security rules correct?"
 * 2 VUs for 1 minute. Every iteration walks the whole patient lifecycle plus negative tests.
 * Run it after every deploy; it is the test meant for CI.
 *
 *   tests/run.sh smoke
 */
import { check, group, sleep } from 'k6';
import { int, testId } from './lib/config.js';
import * as api from './lib/api.js';

export const options = {
  scenarios: { smoke: { executor: 'constant-vus', vus: int('VUS', 2), duration: __ENV.DURATION || '1m' } },
  tags: { testid: testId('smoke') },
  setupTimeout: '120s',
  thresholds: {
    http_req_failed: ['rate<0.01'],           // negative tests declare their 400/401/404 as expected
    checks: ['rate==1'],                       // a smoke test must be 100 % green
    http_req_duration: ['p(95)<1500'],
  },
};

export const setup = () => api.provision(2);

export default function (d) {
  const t = d.token;

  group('platform', () => {
    check(api.health(), { 'gateway health 200': (r) => r.status === 200 });
    check(api.apiDocs(), { 'patient OpenAPI doc reachable through the gateway': (r) => r.status === 200 });
  });

  group('auth', () => {
    const ok = api.login();
    check(ok, { 'login 200 + token': (r) => r.status === 200 && !!api.json(r).token });
    const bad = api.login('admin@example.com', 'wrong-password', { ep: 'login_bad', expected: [401] });
    check(bad, { 'wrong password -> 401': (r) => r.status === 401 });
    const unknown = api.login('nobody@example.com', 'password123', { ep: 'login_bad', expected: [401] });
    check(unknown, { 'unknown user -> 401': (r) => r.status === 401 });
    check(api.call('GET', '/api/patients', { ep: 'unauth', expected: [401] }), { 'no token -> 401': (r) => r.status === 401 });
    check(api.call('GET', '/api/patients', { token: 'not.a.jwt', ep: 'unauth', expected: [401] }), { 'invalid token -> 401 (not 500)': (r) => r.status === 401 });
  });

  group('patient lifecycle', () => {
    const p = api.newPatient('smoke');
    const created = api.createPatient(t, p);
    check(created, { 'create: 200': (r) => r.status === 200, 'create: returns id + registeredDate': (r) => !!api.json(r).id && !!api.json(r).registeredDate });
    const id = api.json(created).id;

    const list = api.listPatients(t);
    check(list, { 'list: contains the new patient': (r) => api.json(r).some((x) => x.id === id) });

    const updated = api.updatePatient(t, id, { ...p, name: 'Perf Patient smoke (edited)' });
    check(updated, { 'update: 200 + new name': (r) => r.status === 200 && api.json(r).name.includes('edited') });

    check(api.deletePatient(t, id), { 'delete: 204': (r) => r.status === 204 });
    check(api.deletePatient(t, id, { ep: 'delete_missing', expected: [404] }), { 'delete again: 404': (r) => r.status === 404 });
  });

  group('validation & business rules', () => {
    const invalid = api.createPatient(t, { name: '', email: 'not-an-email' }, { ep: 'create_invalid', expected: [400] });
    check(invalid, { 'invalid body -> 400': (r) => r.status === 400 });

    const badDate = api.createPatient(t, { ...api.newPatient('smoke'), dateOfBirth: '15/01/1990' }, { ep: 'create_invalid', expected: [400] });
    check(badDate, { 'malformed date -> 400 (not 500)': (r) => r.status === 400 });

    const p = api.newPatient('smoke');
    api.createPatient(t, p);
    const dup = api.createPatient(t, p, { ep: 'create_duplicate', expected: [400] });
    check(dup, { 'duplicate e-mail -> 400': (r) => r.status === 400 });

    const missing = api.updatePatient(t, '00000000-0000-4000-8000-000000000000', api.newPatient('smoke'), { ep: 'update_missing', expected: [404] });
    check(missing, { 'update unknown id -> 404': (r) => r.status === 404 });
  });

  sleep(1);
}

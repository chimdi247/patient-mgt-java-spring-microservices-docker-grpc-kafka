import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from './config.js';

/**
 * Thin wrapper around k6/http.
 *  - `ep`       short endpoint label used in thresholds, e.g. 'http_req_duration{ep:create}'
 *  - `name`     constant URL name, so /api/patients/<uuid> is ONE series instead of one per patient
 *  - `expected` HTTP statuses that are *not* failures (negative tests pass [400] / [401] / [404] ...)
 */
export function call(method, path, { body, token, ep, name, expected = [200] } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const params = {
    headers,
    tags: { name: name || `${method} ${path}`, ep: ep || 'other' },
    responseCallback: http.expectedStatuses(...expected),
  };
  const url = `${BASE_URL}${path}`;
  if (method === 'GET') return http.get(url, params);
  if (method === 'DELETE') return http.del(url, null, params);
  return http.request(method, url, body === undefined ? null : JSON.stringify(body), params);
}

export function json(res) {
  try { return res.json(); } catch (e) { return null; }
}

// ----------------------------------------------------------------------------- endpoints
export const health = () => call('GET', '/actuator/health', { ep: 'health' });
export const apiDocs = () => call('GET', '/api-docs/patients', { ep: 'docs' });

export const login = (email = ADMIN_EMAIL, password = ADMIN_PASSWORD, opts = {}) =>
  call('POST', '/auth/login', { ep: opts.ep || 'login', expected: opts.expected, body: { email, password } });

export const listPatients = (token, ep = 'list') => call('GET', '/api/patients', { token, ep });

export const createPatient = (token, p, opts = {}) =>
  call('POST', '/api/patients', { token, ep: opts.ep || 'create', expected: opts.expected, body: p });

export const updatePatient = (token, id, p, opts = {}) =>
  call('PUT', `/api/patients/${id}`, { token, ep: opts.ep || 'update', name: 'PUT /api/patients/{id}', expected: opts.expected, body: p });

export const deletePatient = (token, id, opts = {}) =>
  call('DELETE', `/api/patients/${id}`, { token, ep: opts.ep || 'delete', name: 'DELETE /api/patients/{id}', expected: opts.expected || [204] });

// ----------------------------------------------------------------------------- data generation
/** A valid, unique patient. The perf+ e-mail prefix lets tests/cleanup.sh remove it afterwards. */
export function newPatient(tag = 'x') {
  const uniq = `${Date.now().toString(36)}-${__VU}-${__ITER}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    name: `Perf Patient ${tag}`,
    email: `perf+${uniq}@example.com`,
    address: '1 Load Test Street, Benchmark City',
    dateOfBirth: '1990-01-15',
    registeredDate: new Date().toISOString().slice(0, 10),
  };
}

// ----------------------------------------------------------------------------- setup()
/**
 * Runs in setup(): logs in as the seeded admin (a single token is shared by all VUs; it is valid for 10 hours)
 * and creates `patients` records the update / read scenarios can work with. Tagged ep=setup and excluded
 * from the dashboards. Remove the data afterwards with tests/cleanup.sh.
 */
export function provision(patients = 10) {
  const res = login(ADMIN_EMAIL, ADMIN_PASSWORD, { ep: 'setup' });
  const token = json(res) && json(res).token;
  if (!token) fail(`admin login failed (${res.status}). Is the platform up and is ${ADMIN_EMAIL} seeded?`);

  const created = [];
  for (let i = 0; i < patients; i++) {
    const p = newPatient(`seed${i}`);
    const r = createPatient(token, p, { ep: 'setup' });
    if (r.status !== 200) fail(`seeding patient failed: ${r.status} ${r.body}`);
    created.push({ id: json(r).id, email: p.email });
  }
  return { token, seeded: created };
}

export const okStatus = (res, label, status = 200) =>
  check(res, { [`${label}: ${status}`]: (r) => r.status === status });

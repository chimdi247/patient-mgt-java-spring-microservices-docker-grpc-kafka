// Shared configuration. Every value can be overridden with `-e NAME=value` (k6) or an env var (tests/run.sh).
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4004').replace(/\/$/, ''); // the api-gateway
export const PROM_URL = (__ENV.PROM_URL || 'http://prometheus:9090').replace(/\/$/, '');
export const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'password123';
export const THINK_TIME = parseFloat(__ENV.THINK_TIME || '1'); // average seconds between user actions

export const int = (name, fallback) => parseInt(__ENV[name] || String(fallback), 10);

/**
 * Tag put on every metric of a run. tests/run.sh passes TEST_ID=<timestamp>, so each run is a separate
 * series in the "Patient Management - Performance tests (k6)" dashboard.
 */
export const testId = (name) => (__ENV.TEST_ID ? `${name}-${__ENV.TEST_ID}` : name);

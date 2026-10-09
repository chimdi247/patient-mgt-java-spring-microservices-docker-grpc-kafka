-- Removes everything the k6 tests created. Run through tests/cleanup.sh (or psql -f).
-- Test patients have an e-mail like perf+<run>-<vu>-<iter>-<rand>@example.com.
\connect patient_db
DELETE FROM patient WHERE email LIKE 'perf+%@example.com';

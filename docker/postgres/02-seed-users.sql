-- =============================================================================
-- Default users (idempotent)
--
--   admin@example.com / password123   role ADMIN   <- use this one to sign in
--   testuser@test.com / password123   role ADMIN   <- used by integration-tests/ (kept from the original data.sql)
--
-- Passwords are stored as BCrypt hashes (the format Spring Security's BCryptPasswordEncoder verifies).
-- CHANGE THESE PASSWORDS before exposing the stack anywhere other than your machine.
-- =============================================================================
\connect auth_db

INSERT INTO users (id, email, password, role)
VALUES ('11111111-1111-4111-8111-111111111111',
        'admin@example.com',
        '$2a$10$U0LFzhRNjqDXrMqMYDvMNOUWX.4WG4LpVXU68ARb/mzJCOyT.CwdC',
        'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, email, password, role)
VALUES ('223e4567-e89b-12d3-a456-426614174006',
        'testuser@test.com',
        '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
        'ADMIN')
ON CONFLICT (email) DO NOTHING;

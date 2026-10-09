-- =============================================================================
-- Patient Management - databases and tables
--
-- Executed automatically by the official postgres image the FIRST time the `postgres-data` volume is
-- created (files in /docker-entrypoint-initdb.d run in alphabetical order through psql, so \connect works).
-- To re-run:  docker compose down -v && docker compose up -d --build
--
-- Table / column names match the JPA entities (Spring Boot's camelCase -> snake_case naming).
-- The services run with ddl-auto=none and spring.sql.init.mode=never in docker compose: this file is
-- the only source of the schema.
-- =============================================================================

CREATE DATABASE auth_db;
CREATE DATABASE patient_db;


-- =============================================================================
-- auth-service  ->  auth_db
-- =============================================================================
\connect auth_db

CREATE TABLE IF NOT EXISTS users (
    id        UUID         PRIMARY KEY,
    email     VARCHAR(255) NOT NULL,
    password  VARCHAR(255) NOT NULL,           -- BCrypt hash, never plain text
    role      VARCHAR(50)  NOT NULL,           -- ADMIN | USER
    CONSTRAINT uk_users_email UNIQUE (email)
);


-- =============================================================================
-- patient-service  ->  patient_db
-- =============================================================================
\connect patient_db

CREATE TABLE IF NOT EXISTS patient (
    id               UUID         PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    address          VARCHAR(255) NOT NULL,
    date_of_birth    DATE         NOT NULL,
    registered_date  DATE         NOT NULL,
    CONSTRAINT uk_patient_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_patient_name            ON patient (name);
CREATE INDEX IF NOT EXISTS idx_patient_registered_date ON patient (registered_date DESC);

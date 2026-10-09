-- =============================================================================
-- Sample patients so the UI is not empty on first start (idempotent; from the original data.sql)
-- =============================================================================
\connect patient_db

INSERT INTO patient (id, name, email, address, date_of_birth, registered_date) VALUES
 ('123e4567-e89b-12d3-a456-426614174000', 'John Doe',        'john.doe@example.com',        '123 Main St, Springfield',   '1985-06-15', '2024-01-10'),
 ('123e4567-e89b-12d3-a456-426614174001', 'Jane Smith',      'jane.smith@example.com',      '456 Elm St, Shelbyville',    '1990-09-23', '2023-12-01'),
 ('123e4567-e89b-12d3-a456-426614174002', 'Alice Johnson',   'alice.johnson@example.com',   '789 Oak St, Capital City',   '1978-03-12', '2022-06-20'),
 ('123e4567-e89b-12d3-a456-426614174003', 'Bob Brown',       'bob.brown@example.com',       '321 Pine St, Springfield',   '1982-11-30', '2023-05-14'),
 ('123e4567-e89b-12d3-a456-426614174004', 'Emily Davis',     'emily.davis@example.com',     '654 Maple St, Shelbyville',  '1995-02-05', '2024-03-01'),
 ('123e4567-e89b-12d3-a456-426614174005', 'Michael Green',   'michael.green@example.com',   '987 Cedar St, Springfield',  '1988-07-25', '2024-02-15'),
 ('123e4567-e89b-12d3-a456-426614174007', 'Sarah Taylor',    'sarah.taylor@example.com',    '123 Birch St, Shelbyville',  '1992-04-18', '2023-08-25'),
 ('123e4567-e89b-12d3-a456-426614174008', 'David Wilson',    'david.wilson@example.com',    '456 Ash St, Capital City',   '1975-01-11', '2022-10-10'),
 ('123e4567-e89b-12d3-a456-426614174009', 'Laura White',     'laura.white@example.com',     '789 Palm St, Springfield',   '1989-09-02', '2024-04-20'),
 ('123e4567-e89b-12d3-a456-426614174010', 'James Harris',    'james.harris@example.com',    '321 Cherry St, Shelbyville', '1993-11-15', '2023-06-30'),
 ('123e4567-e89b-12d3-a456-426614174011', 'Emma Moore',      'emma.moore@example.com',      '654 Spruce St, Capital City','1980-08-09', '2023-01-22'),
 ('123e4567-e89b-12d3-a456-426614174012', 'Ethan Martinez',  'ethan.martinez@example.com',  '987 Redwood St, Springfield','1984-05-03', '2024-05-12')
ON CONFLICT (email) DO NOTHING;

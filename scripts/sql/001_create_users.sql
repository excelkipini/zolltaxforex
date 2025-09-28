-- Create users table (no extension required; id provided by app)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate')),
  agency TEXT NOT NULL,
  last_login TIMESTAMPTZ
);

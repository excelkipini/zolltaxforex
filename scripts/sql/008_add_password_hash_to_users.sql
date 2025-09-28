-- Add password hash column for credentials auth
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

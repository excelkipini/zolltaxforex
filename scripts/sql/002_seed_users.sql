-- Optional seed data
INSERT INTO users (id, name, email, role, agency, last_login) VALUES
  (gen_random_uuid(), 'Admin User', 'admin@example.com', 'super_admin', 'Agence Centrale', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'DG', 'dg@example.com', 'director', 'Agence Centrale', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'Comptable', 'compta@example.com', 'accounting', 'Agence Centrale', NOW() - INTERVAL '3 hours')
ON CONFLICT (email) DO NOTHING;

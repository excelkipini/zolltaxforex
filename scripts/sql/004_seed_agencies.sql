-- Optional seed data (uses fixed UUID literals to avoid requiring extensions)
INSERT INTO agencies (id, name, country, address, status, users) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Agence Centrale', 'Cameroun', '123 Avenue Centrale, Yaoundé', 'active', 5),
  ('22222222-2222-2222-2222-222222222222', 'Agence Nord', 'Cameroun', '456 Rue du Nord, Garoua', 'active', 1),
  ('33333333-3333-3333-3333-333333333333', 'Agence Sud', 'Cameroun', '789 Boulevard Sud, Douala', 'active', 1)
ON CONFLICT (name) DO NOTHING;

-- Optional backfill: map legacy users.agency (text) to an agency by name when possible
INSERT INTO user_agencies (user_id, agency_id)
SELECT u.id, a.id
FROM users u
JOIN agencies a ON a.name = u.agency
ON CONFLICT DO NOTHING;

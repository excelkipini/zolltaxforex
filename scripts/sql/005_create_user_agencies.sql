-- Create many-to-many relation between users and agencies
CREATE TABLE IF NOT EXISTS user_agencies (
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  PRIMARY KEY (user_id, agency_id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_agency FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

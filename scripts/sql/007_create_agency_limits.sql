-- Per-agency overrides for limits and commissions
CREATE TABLE IF NOT EXISTS agency_limits (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  daily_limit BIGINT,
  transfer_limit BIGINT,
  card_limit BIGINT,
  commission NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

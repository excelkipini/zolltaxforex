import "server-only"
import { sql } from "./db"
import { getSettings } from "./settings-queries"

/* Ensure table exists */
async function ensureAgencyLimitsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agency_limits (
      agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
      daily_limit BIGINT,
      transfer_limit BIGINT,
      card_limit BIGINT,
      commission NUMERIC,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
}

export type EffectiveSettings = {
  usd: number
  eur: number
  gbp: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
}

/**
 * Try to find a default agency id:
 * 1) "Agence Centrale" by name
 * 2) otherwise the first agency by name
 * 3) otherwise null if agencies table doesn't exist/empty
 */
export async function getDefaultAgencyId(): Promise<string | null> {
  try {
    const central = await sql<{ id: string }[]>`
      SELECT id::text AS id
      FROM agencies
      WHERE name = 'Agence Centrale'
      LIMIT 1;
    `
    if (central.length) return central[0].id
    const first = await sql<{ id: string }[]>`
      SELECT id::text AS id
      FROM agencies
      ORDER BY name ASC
      LIMIT 1;
    `
    if (first.length) return first[0].id
    return null
  } catch {
    // agencies table might not exist yet
    return null
  }
}

/**
 * Compute effective settings for an agency (fallback to global settings when no overrides).
 * If agencyId is not provided or agency_limits table/row is missing, returns global settings.
 */
export async function getEffectiveSettings(agencyId?: string | null): Promise<EffectiveSettings> {
  const s = await getSettings()

  const base: EffectiveSettings = {
    usd: Number(s.usd),
    eur: Number(s.eur),
    gbp: Number(s.gbp),
    transfer_limit: Number(s.transfer_limit),
    daily_limit: Number(s.daily_limit),
    card_limit: Number(s.card_limit),
    commission: Number(s.commission),
  }

  if (!agencyId) return base

  try {
    await ensureAgencyLimitsTable()
    const rows = await sql<
      {
        daily_limit: string | null
        transfer_limit: string | null
        card_limit: string | null
        commission: number | null
      }[]
    >`
      SELECT daily_limit, transfer_limit, card_limit, commission::float AS commission
      FROM agency_limits
      WHERE agency_id = ${agencyId}::uuid
      LIMIT 1;
    `
    if (!rows.length) return base
    const r = rows[0]
    return {
      usd: Number(s.usd),
      eur: Number(s.eur),
      gbp: Number(s.gbp),
      transfer_limit: r.transfer_limit === null ? Number(s.transfer_limit) : Number(r.transfer_limit),
      daily_limit: r.daily_limit === null ? Number(s.daily_limit) : Number(r.daily_limit),
      card_limit: r.card_limit === null ? Number(s.card_limit) : Number(r.card_limit),
      commission: r.commission === null || r.commission === undefined ? Number(s.commission) : Number(r.commission),
    }
  } catch {
    // agency_limits or agencies may not exist yet
    return base
  }
}

/* New: API used by /rates */

export type AgencyLimitEffective = {
  agency_id: string
  agency_name: string
  daily_limit: number | null
  transfer_limit: number | null
  card_limit: number | null
  commission: number | null
  updated_at: string | null
  effective_daily_limit: number
  effective_transfer_limit: number
  effective_card_limit: number
  effective_commission: number
}

/**
 * List all agencies with their overrides and computed effective values.
 * If agencies table is missing, returns an empty list (so UI can render gracefully).
 */
export async function listAgencyLimitsEffective(): Promise<AgencyLimitEffective[]> {
  const s = await getSettings()
  try {
    await ensureAgencyLimitsTable()
    const rows = await sql<
      {
        agency_id: string
        agency_name: string
        daily_limit: string | null
        transfer_limit: string | null
        card_limit: string | null
        commission: number | null
        updated_at: string | null
      }[]
    >`
      SELECT
        a.id::text AS agency_id,
        a.name AS agency_name,
        al.daily_limit,
        al.transfer_limit,
        al.card_limit,
        al.commission::float AS commission,
        al.updated_at
      FROM agencies a
      LEFT JOIN agency_limits al ON al.agency_id = a.id
      ORDER BY a.name ASC;
    `

    return rows.map((r) => {
      const effDaily = r.daily_limit === null ? s.daily_limit : Number(r.daily_limit)
      const effTransfer = r.transfer_limit === null ? s.transfer_limit : Number(r.transfer_limit)
      const effCard = r.card_limit === null ? s.card_limit : Number(r.card_limit)
      const effCommission = r.commission === null || r.commission === undefined ? s.commission : Number(r.commission)
      return {
        agency_id: r.agency_id,
        agency_name: r.agency_name,
        daily_limit: r.daily_limit === null ? null : Number(r.daily_limit),
        transfer_limit: r.transfer_limit === null ? null : Number(r.transfer_limit),
        card_limit: r.card_limit === null ? null : Number(r.card_limit),
        commission: r.commission === null || r.commission === undefined ? null : Number(r.commission),
        updated_at: r.updated_at,
        effective_daily_limit: effDaily,
        effective_transfer_limit: effTransfer,
        effective_card_limit: effCard,
        effective_commission: effCommission,
      }
    })
  } catch {
    // agencies table might not exist yet
    return []
  }
}

export type UpsertAgencyLimitInput = {
  agency_id: string
  daily_limit: number | null
  transfer_limit: number | null
  card_limit: number | null
  commission: number | null
}

/**
 * Upsert overrides for a given agency and return the row with effective values.
 */
export async function upsertAgencyLimit(input: UpsertAgencyLimitInput): Promise<AgencyLimitEffective> {
  await ensureAgencyLimitsTable()
  // Validate agency existence; if not present, raise
  const exists = await sql<{ ok: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM agencies WHERE id = ${input.agency_id}::uuid) AS ok;
  `
  if (!exists[0]?.ok) {
    throw new Error("Agence introuvable")
  }

  // Upsert row
  await sql`
    INSERT INTO agency_limits (agency_id, daily_limit, transfer_limit, card_limit, commission, updated_at)
    VALUES (${input.agency_id}::uuid, ${input.daily_limit}, ${input.transfer_limit}, ${input.card_limit}, ${input.commission}, NOW())
    ON CONFLICT (agency_id) DO UPDATE SET
      daily_limit = EXCLUDED.daily_limit,
      transfer_limit = EXCLUDED.transfer_limit,
      card_limit = EXCLUDED.card_limit,
      commission = EXCLUDED.commission,
      updated_at = NOW();
  `

  // Read back joined row and compute effective values
  const s = await getSettings()
  const rows = await sql<
    {
      agency_id: string
      agency_name: string
      daily_limit: string | null
      transfer_limit: string | null
      card_limit: string | null
      commission: number | null
      updated_at: string | null
    }[]
  >`
    SELECT
      a.id::text AS agency_id,
      a.name AS agency_name,
      al.daily_limit,
      al.transfer_limit,
      al.card_limit,
      al.commission::float AS commission,
      al.updated_at
    FROM agencies a
    LEFT JOIN agency_limits al ON al.agency_id = a.id
    WHERE a.id = ${input.agency_id}::uuid
    LIMIT 1;
  `
  const r = rows[0]
  const effDaily = r.daily_limit === null ? s.daily_limit : Number(r.daily_limit)
  const effTransfer = r.transfer_limit === null ? s.transfer_limit : Number(r.transfer_limit)
  const effCard = r.card_limit === null ? s.card_limit : Number(r.card_limit)
  const effCommission = r.commission === null || r.commission === undefined ? s.commission : Number(r.commission)

  return {
    agency_id: r.agency_id,
    agency_name: r.agency_name,
    daily_limit: r.daily_limit === null ? null : Number(r.daily_limit),
    transfer_limit: r.transfer_limit === null ? null : Number(r.transfer_limit),
    card_limit: r.card_limit === null ? null : Number(r.card_limit),
    commission: r.commission === null || r.commission === undefined ? null : Number(r.commission),
    updated_at: r.updated_at,
    effective_daily_limit: effDaily,
    effective_transfer_limit: effTransfer,
    effective_card_limit: effCard,
    effective_commission: effCommission,
  }
}

/**
 * Reset (clear) overrides for the given agency to fall back to global settings.
 * Returns the effective row after reset.
 */
export async function resetAgencyLimit(agency_id: string): Promise<AgencyLimitEffective> {
  await ensureAgencyLimitsTable()
  // If row exists, set overrides to NULL; otherwise insert a row with all NULLs
  const hasRow = await sql<{ ok: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM agency_limits WHERE agency_id = ${agency_id}::uuid) AS ok;
  `
  if (hasRow[0]?.ok) {
    await sql`
      UPDATE agency_limits
      SET daily_limit = NULL,
          transfer_limit = NULL,
          card_limit = NULL,
          commission = NULL,
          updated_at = NOW()
      WHERE agency_id = ${agency_id}::uuid;
    `
  } else {
    // Ensure agency exists
    const exists = await sql<{ ok: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM agencies WHERE id = ${agency_id}::uuid) AS ok;
    `
    if (!exists[0]?.ok) throw new Error("Agence introuvable")
    await sql`
      INSERT INTO agency_limits (agency_id, daily_limit, transfer_limit, card_limit, commission, updated_at)
      VALUES (${agency_id}::uuid, NULL, NULL, NULL, NULL, NOW());
    `
  }

  // Compute effective by reading back
  const s = await getSettings()
  const rows = await sql<
    {
      agency_id: string
      agency_name: string
      daily_limit: string | null
      transfer_limit: string | null
      card_limit: string | null
      commission: number | null
      updated_at: string | null
    }[]
  >`
    SELECT
      a.id::text AS agency_id,
      a.name AS agency_name,
      al.daily_limit,
      al.transfer_limit,
      al.card_limit,
      al.commission::float AS commission,
      al.updated_at
    FROM agencies a
    LEFT JOIN agency_limits al ON al.agency_id = a.id
    WHERE a.id = ${agency_id}::uuid
    LIMIT 1;
  `
  const r = rows[0]
  const effDaily = r?.daily_limit === null ? s.daily_limit : Number(r?.daily_limit ?? s.daily_limit)
  const effTransfer = r?.transfer_limit === null ? s.transfer_limit : Number(r?.transfer_limit ?? s.transfer_limit)
  const effCard = r?.card_limit === null ? s.card_limit : Number(r?.card_limit ?? s.card_limit)
  const effCommission = r?.commission === null || r?.commission === undefined ? s.commission : Number(r?.commission)

  return {
    agency_id: r?.agency_id ?? agency_id,
    agency_name: r?.agency_name ?? "",
    daily_limit: r?.daily_limit === null || r?.daily_limit === undefined ? null : Number(r.daily_limit),
    transfer_limit: r?.transfer_limit === null || r?.transfer_limit === undefined ? null : Number(r.transfer_limit),
    card_limit: r?.card_limit === null || r?.card_limit === undefined ? null : Number(r.card_limit),
    commission: r?.commission === null || r?.commission === undefined ? null : Number(r.commission),
    updated_at: r?.updated_at ?? new Date().toISOString(),
    effective_daily_limit: effDaily,
    effective_transfer_limit: effTransfer,
    effective_card_limit: effCard,
    effective_commission: effCommission,
  }
}

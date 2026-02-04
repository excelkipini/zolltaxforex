import "server-only"
import { sql } from "./db"

export type Settings = {
  id: string
  usd: number
  eur: number
  gbp: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
  /** Commission minimum (XAF) pour valider un transfert d'argent */
  transfer_commission_min_xaf: number
  /** Frais par carte (XAF) - transfert d'argent */
  card_fee_xaf: number
  /** Commission (%) - transfert international */
  commission_international_pct: number
  updated_at: string
}

export type SettingsHistory = {
  id: string
  usd: number
  eur: number
  gbp: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
  transfer_commission_min_xaf: number
  card_fee_xaf: number
  commission_international_pct: number
  changed_by?: string
  created_at: string
}

/** Migration: ajouter les colonnes Taux & Plafonds (transfert d'argent, international, bureau de change). */
async function ensureRatesAndFeesColumns(): Promise<void> {
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS transfer_commission_min_xaf BIGINT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS card_fee_xaf BIGINT NOT NULL DEFAULT 14000`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS commission_international_pct NUMERIC NOT NULL DEFAULT 0`
  await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS transfer_commission_min_xaf BIGINT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS card_fee_xaf BIGINT NOT NULL DEFAULT 14000`
  await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS commission_international_pct NUMERIC NOT NULL DEFAULT 0`
}

export async function getSettings(): Promise<Settings> {
  await ensureRatesAndFeesColumns()

  const rows = await sql<Settings[]>`
    SELECT 
      id,
      usd,
      eur,
      gbp,
      transfer_limit,
      daily_limit,
      card_limit,
      commission,
      COALESCE(transfer_commission_min_xaf, 0)::int as transfer_commission_min_xaf,
      COALESCE(card_fee_xaf, 14000)::int as card_fee_xaf,
      COALESCE(commission_international_pct, 0)::float as commission_international_pct,
      updated_at::text as updated_at
    FROM settings
    WHERE id = 'global'
  `
  
  if (rows.length === 0) {
    const defaultSettings = await sql<Settings[]>`
      INSERT INTO settings (id, usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission, transfer_commission_min_xaf, card_fee_xaf, commission_international_pct)
      VALUES ('global', 1.0, 0.85, 0.75, 10000, 50000, 5000, 0.02, 0, 14000, 0)
      RETURNING 
        id,
        usd,
        eur,
        gbp,
        transfer_limit,
        daily_limit,
        card_limit,
        commission,
        transfer_commission_min_xaf::int as transfer_commission_min_xaf,
        card_fee_xaf::int as card_fee_xaf,
        commission_international_pct::float as commission_international_pct,
        updated_at::text as updated_at
    `
    return defaultSettings[0]
  }
  
  return rows[0]
}

export async function updateSettings(
  updates: Partial<Omit<Settings, 'id' | 'updated_at'>>,
  changedBy?: string
): Promise<Settings> {
  const currentSettings = await getSettings()
  await sql`
    INSERT INTO settings_history (usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission, transfer_commission_min_xaf, card_fee_xaf, commission_international_pct, changed_by)
    VALUES (${currentSettings.usd}, ${currentSettings.eur}, ${currentSettings.gbp}, 
            ${currentSettings.transfer_limit}, ${currentSettings.daily_limit}, 
            ${currentSettings.card_limit}, ${currentSettings.commission},
            ${currentSettings.transfer_commission_min_xaf}, ${currentSettings.card_fee_xaf}, ${currentSettings.commission_international_pct},
            ${changedBy || null})
  `
  
  const rows = await sql<Settings[]>`
    UPDATE settings
    SET 
      usd = COALESCE(${updates.usd}, usd),
      eur = COALESCE(${updates.eur}, eur),
      gbp = COALESCE(${updates.gbp}, gbp),
      transfer_limit = COALESCE(${updates.transfer_limit}, transfer_limit),
      daily_limit = COALESCE(${updates.daily_limit}, daily_limit),
      card_limit = COALESCE(${updates.card_limit}, card_limit),
      commission = COALESCE(${updates.commission}, commission),
      transfer_commission_min_xaf = COALESCE(${updates.transfer_commission_min_xaf}, transfer_commission_min_xaf),
      card_fee_xaf = COALESCE(${updates.card_fee_xaf}, card_fee_xaf),
      commission_international_pct = COALESCE(${updates.commission_international_pct}, commission_international_pct),
      updated_at = NOW()
    WHERE id = 'global'
    RETURNING 
      id,
      usd,
      eur,
      gbp,
      transfer_limit,
      daily_limit,
      card_limit,
      commission,
      COALESCE(transfer_commission_min_xaf, 0)::int as transfer_commission_min_xaf,
      COALESCE(card_fee_xaf, 14000)::int as card_fee_xaf,
      COALESCE(commission_international_pct, 0)::float as commission_international_pct,
      updated_at::text as updated_at
  `
  
  return rows[0]
}

export async function getSettingsHistory(limit: number = 50): Promise<SettingsHistory[]> {
  await ensureRatesAndFeesColumns()
  const rows = await sql<SettingsHistory[]>`
    SELECT 
      id::text,
      usd,
      eur,
      gbp,
      transfer_limit,
      daily_limit,
      card_limit,
      commission,
      COALESCE(transfer_commission_min_xaf, 0)::int as transfer_commission_min_xaf,
      COALESCE(card_fee_xaf, 14000)::int as card_fee_xaf,
      COALESCE(commission_international_pct, 0)::float as commission_international_pct,
      changed_by,
      created_at::text as created_at
    FROM settings_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows
}

// Type pour l'historique filtré
export type SettingsHistoryFiltered = {
  id: string
  changed_at: string
  user_name?: string
  field: string
  old_value: string
  new_value: string
}

// Fonction pour récupérer l'historique filtré
export async function getSettingsHistoryFiltered(filters: {
  from?: string
  to?: string
  user?: string
  field?: string
  limit: number
}): Promise<SettingsHistoryFiltered[]> {
  let query = `
    SELECT 
      sh.id::text,
      sh.created_at::text as changed_at,
      sh.changed_by as user_name,
      'usd' as field,
      sh.usd::text as old_value,
      LEAD(sh.usd) OVER (ORDER BY sh.created_at DESC)::text as new_value
    FROM settings_history sh
    WHERE 1=1
  `
  
  const params: any[] = []
  let paramCount = 0
  
  if (filters.from) {
    paramCount++
    query += ` AND sh.created_at >= $${paramCount}`
    params.push(filters.from)
  }
  
  if (filters.to) {
    paramCount++
    query += ` AND sh.created_at <= $${paramCount}`
    params.push(filters.to)
  }
  
  if (filters.user) {
    paramCount++
    query += ` AND sh.changed_by = $${paramCount}`
    params.push(filters.user)
  }
  
  query += ` ORDER BY sh.created_at DESC LIMIT $${paramCount + 1}`
  params.push(filters.limit)
  
  // Pour simplifier, retournons l'historique standard avec les champs mappés
  const rows = await sql<SettingsHistory[]>`
    SELECT 
      id::text,
      usd,
      eur,
      gbp,
      transfer_limit,
      daily_limit,
      card_limit,
      commission,
      changed_by,
      created_at::text as created_at
    FROM settings_history
    WHERE 1=1
    ${filters.from ? sql`AND created_at >= ${filters.from}` : sql``}
    ${filters.to ? sql`AND created_at <= ${filters.to}` : sql``}
    ${filters.user ? sql`AND changed_by = ${filters.user}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${filters.limit}
  `
  
  // Convertir en format filtré (simplifié)
  const filteredRows: SettingsHistoryFiltered[] = []
  
  for (let i = 0; i < rows.length; i++) {
    const current = rows[i]
    const previous = rows[i + 1]
    
    if (previous) {
      // Comparer chaque champ et créer des entrées pour les changements
      const fields = ['usd', 'eur', 'gbp', 'transfer_limit', 'daily_limit', 'card_limit', 'commission'] as const
      
      for (const field of fields) {
        if (filters.field && filters.field !== field) continue
        
        if (current[field] !== previous[field]) {
          filteredRows.push({
            id: `${current.id}_${field}`,
            changed_at: current.created_at,
            user_name: current.changed_by,
            field,
            old_value: String(previous[field]),
            new_value: String(current[field])
          })
        }
      }
    }
  }
  
  return filteredRows
}
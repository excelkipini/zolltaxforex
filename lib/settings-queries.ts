import "server-only"
import { sql } from "./db"

export type Settings = {
  id: string
  usd: number
  eur: number
  gbp: number
  /** Taux d'achat USD (XAF) - Bureau de change */
  usd_buy: number
  /** Taux de vente USD (XAF) - Bureau de change */
  usd_sell: number
  /** Taux d'achat EUR (XAF) - Bureau de change */
  eur_buy: number
  /** Taux de vente EUR (XAF) - Bureau de change */
  eur_sell: number
  /** Taux d'achat GBP (XAF) - Bureau de change */
  gbp_buy: number
  /** Taux de vente GBP (XAF) - Bureau de change */
  gbp_sell: number
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
  usd_buy: number
  usd_sell: number
  eur_buy: number
  eur_sell: number
  gbp_buy: number
  gbp_sell: number
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

// Cache pour éviter de relancer les migrations à chaque requête
let migrationsRan = false

// Verrou pour empêcher les mises à jour concurrentes
let updateInProgress = false
let lastUpdateTime = 0
const MIN_UPDATE_INTERVAL_MS = 2000 // Minimum 2 secondes entre les mises à jour

/** Migration unique: ajouter toutes les colonnes nécessaires */
async function ensureAllColumnsOnce(): Promise<void> {
  if (migrationsRan) return
  
  try {
    // Colonnes Taux & Plafonds
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS transfer_commission_min_xaf BIGINT NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS card_fee_xaf BIGINT NOT NULL DEFAULT 14000`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS commission_international_pct NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS transfer_commission_min_xaf BIGINT NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS card_fee_xaf BIGINT NOT NULL DEFAULT 14000`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS commission_international_pct NUMERIC NOT NULL DEFAULT 0`
    
    // Colonnes taux d'achat/vente
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS usd_buy NUMERIC NOT NULL DEFAULT 569`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS eur_buy NUMERIC NOT NULL DEFAULT 693`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS gbp_buy NUMERIC NOT NULL DEFAULT 800`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS usd_sell NUMERIC NOT NULL DEFAULT 575`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS eur_sell NUMERIC NOT NULL DEFAULT 700`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS gbp_sell NUMERIC NOT NULL DEFAULT 810`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS usd_buy NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS eur_buy NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS gbp_buy NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS usd_sell NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS eur_sell NUMERIC NOT NULL DEFAULT 0`
    await sql`ALTER TABLE settings_history ADD COLUMN IF NOT EXISTS gbp_sell NUMERIC NOT NULL DEFAULT 0`
    
    migrationsRan = true
  } catch (error) {
    // En cas d'erreur, on laisse migrationsRan à false pour réessayer
    console.error("Migration error:", error)
  }
}

export async function getSettings(): Promise<Settings> {
  await ensureAllColumnsOnce()

  const rows = await sql<Settings[]>`
    SELECT 
      id,
      usd,
      eur,
      gbp,
      COALESCE(usd_buy, usd)::float as usd_buy,
      COALESCE(usd_sell, usd)::float as usd_sell,
      COALESCE(eur_buy, eur)::float as eur_buy,
      COALESCE(eur_sell, eur)::float as eur_sell,
      COALESCE(gbp_buy, gbp)::float as gbp_buy,
      COALESCE(gbp_sell, gbp)::float as gbp_sell,
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
      INSERT INTO settings (id, usd, eur, gbp, usd_buy, usd_sell, eur_buy, eur_sell, gbp_buy, gbp_sell, transfer_limit, daily_limit, card_limit, commission, transfer_commission_min_xaf, card_fee_xaf, commission_international_pct)
      VALUES ('global', 569, 693, 800, 569, 575, 693, 700, 800, 810, 10000, 50000, 5000, 0.02, 0, 14000, 0)
      RETURNING 
        id,
        usd,
        eur,
        gbp,
        usd_buy::float as usd_buy,
        usd_sell::float as usd_sell,
        eur_buy::float as eur_buy,
        eur_sell::float as eur_sell,
        gbp_buy::float as gbp_buy,
        gbp_sell::float as gbp_sell,
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
  // Protection contre les mises à jour trop rapides
  const now = Date.now()
  if (updateInProgress || (now - lastUpdateTime) < MIN_UPDATE_INTERVAL_MS) {
    // Retourner les settings actuels sans modification
    return await getSettings()
  }
  
  // Marquer le début de la mise à jour
  updateInProgress = true
  lastUpdateTime = now
  
  try {
    const currentSettings = await getSettings()
    
    // Vérifier si au moins une valeur a changé avant d'insérer dans l'historique
    const hasChanges = 
      (updates.usd !== undefined && updates.usd !== currentSettings.usd) ||
      (updates.eur !== undefined && updates.eur !== currentSettings.eur) ||
      (updates.gbp !== undefined && updates.gbp !== currentSettings.gbp) ||
      (updates.usd_buy !== undefined && updates.usd_buy !== currentSettings.usd_buy) ||
      (updates.usd_sell !== undefined && updates.usd_sell !== currentSettings.usd_sell) ||
      (updates.eur_buy !== undefined && updates.eur_buy !== currentSettings.eur_buy) ||
      (updates.eur_sell !== undefined && updates.eur_sell !== currentSettings.eur_sell) ||
      (updates.gbp_buy !== undefined && updates.gbp_buy !== currentSettings.gbp_buy) ||
      (updates.gbp_sell !== undefined && updates.gbp_sell !== currentSettings.gbp_sell) ||
      (updates.transfer_limit !== undefined && updates.transfer_limit !== currentSettings.transfer_limit) ||
      (updates.daily_limit !== undefined && updates.daily_limit !== currentSettings.daily_limit) ||
      (updates.card_limit !== undefined && updates.card_limit !== currentSettings.card_limit) ||
      (updates.commission !== undefined && updates.commission !== currentSettings.commission) ||
      (updates.transfer_commission_min_xaf !== undefined && updates.transfer_commission_min_xaf !== currentSettings.transfer_commission_min_xaf) ||
      (updates.card_fee_xaf !== undefined && updates.card_fee_xaf !== currentSettings.card_fee_xaf) ||
      (updates.commission_international_pct !== undefined && updates.commission_international_pct !== currentSettings.commission_international_pct)

    // Si aucune valeur n'a changé, retourner les settings actuels sans modifier la DB
    if (!hasChanges) {
      return currentSettings
    }

    // Insérer dans l'historique les anciennes valeurs
    await sql`
      INSERT INTO settings_history (usd, eur, gbp, usd_buy, usd_sell, eur_buy, eur_sell, gbp_buy, gbp_sell, transfer_limit, daily_limit, card_limit, commission, transfer_commission_min_xaf, card_fee_xaf, commission_international_pct, changed_by)
      VALUES (${currentSettings.usd}, ${currentSettings.eur}, ${currentSettings.gbp}, 
              ${currentSettings.usd_buy}, ${currentSettings.usd_sell},
              ${currentSettings.eur_buy}, ${currentSettings.eur_sell},
              ${currentSettings.gbp_buy}, ${currentSettings.gbp_sell},
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
        usd_buy = COALESCE(${updates.usd_buy}, usd_buy),
        usd_sell = COALESCE(${updates.usd_sell}, usd_sell),
        eur_buy = COALESCE(${updates.eur_buy}, eur_buy),
        eur_sell = COALESCE(${updates.eur_sell}, eur_sell),
        gbp_buy = COALESCE(${updates.gbp_buy}, gbp_buy),
        gbp_sell = COALESCE(${updates.gbp_sell}, gbp_sell),
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
        COALESCE(usd_buy, usd)::float as usd_buy,
        COALESCE(usd_sell, usd)::float as usd_sell,
        COALESCE(eur_buy, eur)::float as eur_buy,
        COALESCE(eur_sell, eur)::float as eur_sell,
        COALESCE(gbp_buy, gbp)::float as gbp_buy,
        COALESCE(gbp_sell, gbp)::float as gbp_sell,
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
  } finally {
    // Libérer le verrou
    updateInProgress = false
  }
}

export async function getSettingsHistory(limit: number = 50): Promise<SettingsHistory[]> {
  await ensureAllColumnsOnce()
  const rows = await sql<SettingsHistory[]>`
    SELECT 
      id::text,
      usd,
      eur,
      gbp,
      COALESCE(usd_buy, 0)::float as usd_buy,
      COALESCE(usd_sell, 0)::float as usd_sell,
      COALESCE(eur_buy, 0)::float as eur_buy,
      COALESCE(eur_sell, 0)::float as eur_sell,
      COALESCE(gbp_buy, 0)::float as gbp_buy,
      COALESCE(gbp_sell, 0)::float as gbp_sell,
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
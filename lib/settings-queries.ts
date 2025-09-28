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
  changed_by?: string
  created_at: string
}

export async function getSettings(): Promise<Settings> {
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
      updated_at::text as updated_at
    FROM settings
    WHERE id = 'global'
  `
  
  if (rows.length === 0) {
    // Créer les paramètres par défaut s'ils n'existent pas
    const defaultSettings = await sql<Settings[]>`
      INSERT INTO settings (id, usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission)
      VALUES ('global', 1.0, 0.85, 0.75, 10000, 50000, 5000, 0.02)
      RETURNING 
        id,
        usd,
        eur,
        gbp,
        transfer_limit,
        daily_limit,
        card_limit,
        commission,
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
  // Sauvegarder l'historique avant la mise à jour
  const currentSettings = await getSettings()
  await sql`
    INSERT INTO settings_history (usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission, changed_by)
    VALUES (${currentSettings.usd}, ${currentSettings.eur}, ${currentSettings.gbp}, 
            ${currentSettings.transfer_limit}, ${currentSettings.daily_limit}, 
            ${currentSettings.card_limit}, ${currentSettings.commission}, ${changedBy || null})
  `
  
  // Mettre à jour les paramètres
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
      updated_at::text as updated_at
  `
  
  return rows[0]
}

export async function getSettingsHistory(): Promise<SettingsHistory[]> {
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
    ORDER BY created_at DESC
    LIMIT 50
  `
  return rows
}
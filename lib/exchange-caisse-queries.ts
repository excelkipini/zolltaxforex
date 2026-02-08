import "server-only"
import { sql } from "./db"

export type ExchangeCaisseCurrency = "XAF" | "USD" | "EUR" | "GBP"

export type ExchangeCaisseRow = {
  currency: ExchangeCaisseCurrency
  balance: number
  last_appro_rate: number | null
  last_updated: string
  updated_by: string
  last_manual_motif?: string | null
  agency_id: string | null  // NULL = caisse principale
  agency_name?: string | null
}

export type ExchangeOperationType = "appro" | "vente" | "cession" | "maj_manuelle" | "appro_agence" | "change_achat" | "change_vente"

export type ExchangeOperationRow = {
  id: string
  operation_type: ExchangeOperationType
  payload: Record<string, unknown>
  created_by: string
  created_at: string
  agency_id: string | null
  agency_name?: string | null
}

export type AgencyCaisseInfo = {
  agency_id: string
  agency_name: string
  balances: {
    XAF: number
    USD: number
    EUR: number
    GBP: number
  }
  last_appro_rates: {
    USD: number | null
    EUR: number | null
    GBP: number | null
  }
}

const CURRENCIES: ExchangeCaisseCurrency[] = ["XAF", "USD", "EUR", "GBP"]

/** Arrondit un taux à 2 décimales pour éviter les artefacts flottants (ex: 5.000000000000001). */
function roundRate(n: number): number {
  return Math.round(n * 100) / 100
}

let tablesEnsured = false

export async function ensureExchangeCaisseTables(): Promise<void> {
  if (tablesEnsured) return
  
  // Créer la nouvelle table avec support multi-agences
  await sql`
    CREATE TABLE IF NOT EXISTS exchange_caisse (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      currency TEXT NOT NULL CHECK (currency IN ('XAF', 'USD', 'EUR', 'GBP')),
      balance NUMERIC NOT NULL DEFAULT 0,
      last_appro_rate NUMERIC,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL,
      last_manual_motif TEXT,
      agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
      UNIQUE(currency, agency_id)
    )
  `
  
  // Mettre à jour la contrainte pour inclure GBP
  try {
    await sql`ALTER TABLE exchange_caisse DROP CONSTRAINT IF EXISTS exchange_caisse_currency_check`
    await sql`ALTER TABLE exchange_caisse ADD CONSTRAINT exchange_caisse_currency_check CHECK (currency IN ('XAF', 'USD', 'EUR', 'GBP'))`
  } catch {
    // Contrainte peut déjà être à jour
  }
  
  // Migrer de l'ancienne structure si nécessaire (ajouter agency_id)
  try {
    await sql`ALTER TABLE exchange_caisse ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE`
    await sql`ALTER TABLE exchange_caisse ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()`
    await sql`ALTER TABLE exchange_caisse DROP CONSTRAINT IF EXISTS exchange_caisse_pkey`
    // Créer la contrainte unique sur (currency, agency_id)
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_caisse_currency_agency_unique') THEN
          ALTER TABLE exchange_caisse ADD CONSTRAINT exchange_caisse_currency_agency_unique UNIQUE (currency, agency_id);
        END IF;
      END $$;
    `
  } catch {
    // Structure déjà migrée
  }
  
  await sql`
    CREATE TABLE IF NOT EXISTS exchange_operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type TEXT NOT NULL CHECK (operation_type IN ('appro', 'vente', 'cession', 'maj_manuelle', 'appro_agence', 'change_achat', 'change_vente')),
      payload JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL
    )
  `
  
  // Migrer la table des opérations
  try {
    await sql`ALTER TABLE exchange_operations ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL`
    await sql`ALTER TABLE exchange_operations DROP CONSTRAINT IF EXISTS exchange_operations_operation_type_check`
    await sql`ALTER TABLE exchange_operations ADD CONSTRAINT exchange_operations_operation_type_check CHECK (operation_type IN ('appro', 'vente', 'cession', 'maj_manuelle', 'appro_agence', 'change_achat', 'change_vente'))`
  } catch {
    // Contrainte peut avoir un autre nom selon l'environnement ; ignorer si déjà à jour
  }
  
  // Index partiel unique pour gérer correctement agency_id IS NULL
  // (PostgreSQL considère NULL != NULL dans les contraintes UNIQUE standard)
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS exchange_caisse_currency_null_agency ON exchange_caisse (currency) WHERE agency_id IS NULL`
  } catch {
    // Index existe peut-être déjà
  }
  
  // Nettoyer les doublons éventuels pour agency_id IS NULL
  // Garder la ligne avec le solde le plus élevé (ou la plus récente en cas d'égalité)
  try {
    await sql`
      DELETE FROM exchange_caisse a
      USING exchange_caisse b
      WHERE a.agency_id IS NULL AND b.agency_id IS NULL
        AND a.currency = b.currency
        AND a.id != b.id
        AND (a.balance < b.balance OR (a.balance = b.balance AND a.last_updated < b.last_updated))
    `
  } catch {
    // Pas de doublons à nettoyer
  }
  
  // Initialiser les caisses de la caisse principale (agency_id = NULL)
  for (const currency of CURRENCIES) {
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      SELECT ${currency}, 0, 'system', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL
      )
    `
  }
  
  // Créer automatiquement les caisses pour toutes les agences existantes
  const agencies = await sql<{ id: string }[]>`SELECT id::text FROM agencies WHERE status = 'active'`
  for (const agency of agencies) {
    for (const currency of CURRENCIES) {
      await sql`
        INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
        VALUES (${currency}, 0, 'system', ${agency.id}::uuid)
        ON CONFLICT (currency, agency_id) DO NOTHING
      `
    }
  }
  
  tablesEnsured = true
}

/** Créer les caisses de change pour une nouvelle agence */
export async function createAgencyExchangeCaisse(agencyId: string, createdBy: string = 'system'): Promise<void> {
  await ensureExchangeCaisseTables()
  for (const currency of CURRENCIES) {
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      VALUES (${currency}, 0, ${createdBy}, ${agencyId}::uuid)
      ON CONFLICT (currency, agency_id) DO NOTHING
    `
  }
}

/** Supprimer les caisses de change d'une agence (appelé automatiquement via ON DELETE CASCADE) */
export async function deleteAgencyExchangeCaisse(agencyId: string): Promise<void> {
  await sql`DELETE FROM exchange_caisse WHERE agency_id = ${agencyId}::uuid`
}

/** Récupérer les soldes de la caisse principale ou d'une agence spécifique */
export async function getExchangeCaisseBalances(agencyId?: string | null): Promise<ExchangeCaisseRow[]> {
  await ensureExchangeCaisseTables()
  
  if (agencyId) {
    const rows = await sql<ExchangeCaisseRow[]>`
      SELECT ec.currency, ec.balance::float8 as balance, ec.last_appro_rate::float8 as last_appro_rate,
             ec.last_updated::text as last_updated, ec.updated_by, ec.last_manual_motif,
             ec.agency_id::text as agency_id, a.name as agency_name
      FROM exchange_caisse ec
      LEFT JOIN agencies a ON a.id = ec.agency_id
      WHERE ec.agency_id = ${agencyId}::uuid
      ORDER BY ec.currency
    `
    return rows.map(r => ({ ...r, balance: Number(r.balance) || 0 }))
  }
  
  // Caisse principale (agency_id IS NULL)
  // DISTINCT ON pour ne garder qu'une ligne par devise (celle avec le solde le plus élevé)
  const rows = await sql<ExchangeCaisseRow[]>`
    SELECT DISTINCT ON (currency) currency, balance::float8 as balance, last_appro_rate::float8 as last_appro_rate,
           last_updated::text as last_updated, updated_by, last_manual_motif,
           agency_id::text as agency_id, NULL as agency_name
    FROM exchange_caisse
    WHERE agency_id IS NULL
    ORDER BY currency, balance DESC, last_updated DESC
  `
  return rows.map(r => ({ ...r, balance: Number(r.balance) || 0 }))
}

/** Récupérer toutes les agences avec leurs caisses de change */
export async function getAllAgenciesWithCaisses(): Promise<AgencyCaisseInfo[]> {
  await ensureExchangeCaisseTables()
  
  const rows = await sql<{
    agency_id: string
    agency_name: string
    currency: ExchangeCaisseCurrency
    balance: number
    last_appro_rate: number | null
  }[]>`
    SELECT 
      a.id::text as agency_id,
      a.name as agency_name,
      ec.currency,
      COALESCE(ec.balance, 0)::float8 as balance,
      ec.last_appro_rate::float8 as last_appro_rate
    FROM agencies a
    LEFT JOIN exchange_caisse ec ON ec.agency_id = a.id
    WHERE a.status = 'active'
    ORDER BY a.name, ec.currency
  `
  
  // Grouper par agence
  const agencyMap = new Map<string, AgencyCaisseInfo>()
  
  for (const row of rows) {
    if (!agencyMap.has(row.agency_id)) {
      agencyMap.set(row.agency_id, {
        agency_id: row.agency_id,
        agency_name: row.agency_name,
        balances: { XAF: 0, USD: 0, EUR: 0, GBP: 0 },
        last_appro_rates: { USD: null, EUR: null, GBP: null }
      })
    }
    
    const info = agencyMap.get(row.agency_id)!
    if (row.currency) {
      info.balances[row.currency] = Number(row.balance) || 0
      if (row.currency === 'USD' || row.currency === 'EUR' || row.currency === 'GBP') {
        info.last_appro_rates[row.currency] = row.last_appro_rate != null ? Number(row.last_appro_rate) : null
      }
    }
  }
  
  return Array.from(agencyMap.values())
}

async function getCaisseBalance(currency: ExchangeCaisseCurrency, agencyId?: string | null): Promise<number> {
  if (agencyId) {
    // S'assurer que la ligne existe
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      VALUES (${currency}, 0, 'system', ${agencyId}::uuid)
      ON CONFLICT (currency, agency_id) DO NOTHING
    `
    const rows = await sql<{ balance: string }[]>`
      SELECT balance::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid ORDER BY balance DESC LIMIT 1
    `
    return rows.length ? Number(rows[0].balance) : 0
  }
  
  // Caisse principale: s'assurer que la ligne existe
  await sql`
    INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
    SELECT ${currency}, 0, 'system', NULL
    WHERE NOT EXISTS (SELECT 1 FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL)
  `
  
  // ORDER BY balance DESC pour toujours récupérer la ligne avec le solde le plus élevé (protection anti-doublons NULL)
  const rows = await sql<{ balance: string }[]>`
    SELECT balance::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL ORDER BY balance DESC LIMIT 1
  `
  return rows.length ? Number(rows[0].balance) : 0
}

export async function getLastApproRate(currency: "USD" | "EUR" | "GBP", agencyId?: string | null): Promise<number | null> {
  // 1. D'abord chercher dans la table exchange_caisse
  let rate: number | null = null
  
  if (agencyId) {
    const rows = await sql<{ last_appro_rate: string | null }[]>`
      SELECT last_appro_rate::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid ORDER BY balance DESC LIMIT 1
    `
    rate = rows[0]?.last_appro_rate ? Number(rows[0].last_appro_rate) : null
  } else {
    const rows = await sql<{ last_appro_rate: string | null }[]>`
      SELECT last_appro_rate::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL ORDER BY balance DESC LIMIT 1
    `
    rate = rows[0]?.last_appro_rate ? Number(rows[0].last_appro_rate) : null
  }
  
  if (rate != null && rate > 0) return rate
  
  // 2. Fallback: chercher le taux dans l'historique des opérations
  // D'abord les opérations d'appro pour cette devise et cette caisse
  if (agencyId) {
    const opRows = await sql<{ taux: string }[]>`
      SELECT COALESCE(
        payload->>'taux_reel',
        payload->>'taux_reel_appro'
      )::text as taux
      FROM exchange_operations
      WHERE agency_id = ${agencyId}::uuid
        AND operation_type IN ('appro', 'change_achat', 'change_vente', 'appro_agence')
        AND (payload->>'devise' = ${currency} OR payload->>'devise_achetee' = ${currency} OR payload->>'currency' = ${currency})
        AND COALESCE(payload->>'taux_reel', payload->>'taux_reel_appro') IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `
    if (opRows.length && opRows[0].taux) {
      rate = Number(opRows[0].taux)
      if (rate > 0) return rate
    }
  }
  
  // 3. Fallback global: chercher dans toutes les opérations de la caisse principale
  const globalRows = await sql<{ taux: string }[]>`
    SELECT COALESCE(
      payload->>'taux_reel',
      payload->>'taux_reel_appro'
    )::text as taux
    FROM exchange_operations
    WHERE operation_type IN ('appro', 'change_achat', 'appro_agence')
      AND (payload->>'devise' = ${currency} OR payload->>'devise_achetee' = ${currency} OR payload->>'currency' = ${currency})
      AND COALESCE(payload->>'taux_reel', payload->>'taux_reel_appro') IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
  `
  if (globalRows.length && globalRows[0].taux) {
    rate = Number(globalRows[0].taux)
    if (rate > 0) return rate
  }
  
  return null
}

async function updateCaisseBalance(
  currency: ExchangeCaisseCurrency,
  newBalance: number,
  updatedBy: string,
  lastApproRate?: number | null,
  agencyId?: string | null
): Promise<void> {
  if (agencyId) {
    // S'assurer que la ligne existe
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      VALUES (${currency}, 0, 'system', ${agencyId}::uuid)
      ON CONFLICT (currency, agency_id) DO NOTHING
    `
    
    if (lastApproRate !== undefined) {
      await sql`
        UPDATE exchange_caisse
        SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
            last_appro_rate = ${lastApproRate}
        WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid
      `
    } else {
      await sql`
        UPDATE exchange_caisse
        SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy}
        WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid
      `
    }
    return
  }
  
  // Caisse principale: s'assurer que la ligne existe
  await sql`
    INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
    SELECT ${currency}, 0, 'system', NULL
    WHERE NOT EXISTS (SELECT 1 FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL)
  `
  
  if (lastApproRate !== undefined) {
    await sql`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
          last_appro_rate = ${lastApproRate}
      WHERE currency = ${currency} AND agency_id IS NULL
    `
  } else {
    await sql`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy}
      WHERE currency = ${currency} AND agency_id IS NULL
    `
  }
}

/** Mise à jour manuelle du solde d'une caisse (XAF, USD, EUR). Enregistre un motif et une opération pour le reporting. */
export async function updateExchangeCaisseBalanceManual(
  currency: ExchangeCaisseCurrency,
  newBalance: number,
  updatedBy: string,
  motif?: string | null,
  agencyId?: string | null
): Promise<void> {
  await ensureExchangeCaisseTables()
  
  if (agencyId) {
    // S'assurer que la ligne existe pour cette agence
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      VALUES (${currency}, 0, 'system', ${agencyId}::uuid)
      ON CONFLICT (currency, agency_id) DO NOTHING
    `
    
    const previousRows = await sql<{ balance: string }[]>`
      SELECT balance::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid LIMIT 1
    `
    const previousBalance = previousRows.length ? Number(previousRows[0].balance) : 0
    
    const updated = await sql<{ balance: string }[]>`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
          last_manual_motif = ${motif ?? null}
      WHERE currency = ${currency} AND agency_id = ${agencyId}::uuid
      RETURNING balance::text as balance
    `
    
    if (updated.length === 0) {
      throw new Error(`Échec de la mise à jour: aucune ligne trouvée pour ${currency} (agence ${agencyId})`)
    }
    
    await recordExchangeOperation(
      "maj_manuelle",
      {
        currency,
        previous_balance: previousBalance,
        new_balance: Number(updated[0].balance),
        motif: motif ?? null,
      },
      updatedBy,
      agencyId
    )
  } else {
    // Caisse principale: s'assurer que la ligne existe (agency_id IS NULL)
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by, agency_id)
      SELECT ${currency}, 0, 'system', NULL
      WHERE NOT EXISTS (SELECT 1 FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL)
    `
    
    const previousRows = await sql<{ balance: string }[]>`
      SELECT balance::text FROM exchange_caisse WHERE currency = ${currency} AND agency_id IS NULL ORDER BY balance DESC LIMIT 1
    `
    const previousBalance = previousRows.length ? Number(previousRows[0].balance) : 0
    
    const updated = await sql<{ balance: string }[]>`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
          last_manual_motif = ${motif ?? null}
      WHERE currency = ${currency} AND agency_id IS NULL
      RETURNING balance::text as balance
    `
    
    if (updated.length === 0) {
      throw new Error(`Échec de la mise à jour: aucune ligne trouvée pour ${currency} (caisse principale)`)
    }
    
    await recordExchangeOperation(
      "maj_manuelle",
      {
        currency,
        previous_balance: previousBalance,
        new_balance: Number(updated[0].balance),
        motif: motif ?? null,
      },
      updatedBy,
      null
    )
  }
}

export async function recordExchangeOperation(
  operationType: ExchangeOperationType,
  payload: Record<string, unknown>,
  createdBy: string,
  agencyId?: string | null
): Promise<string> {
  if (agencyId) {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id)
      VALUES (${operationType}, ${JSON.stringify(payload)}, ${createdBy}, ${agencyId}::uuid)
      RETURNING id::text
    `
    return rows[0]?.id ?? ""
  }
  
  const rows = await sql<{ id: string }[]>`
    INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id)
    VALUES (${operationType}, ${JSON.stringify(payload)}, ${createdBy}, NULL)
    RETURNING id::text
  `
  return rows[0]?.id ?? ""
}

/** Achat devise: déduire de la caisse source, ajouter à la caisse de la devise achetée, enregistrer taux réel. 
 * Opération uniquement sur la caisse principale.
 */
export async function executeAchatDevise(
  params: {
    deviseAchat: ExchangeCaisseCurrency  // XAF, USD, EUR ou GBP qu'on paie
    montant: number
    deviseAchetee: "USD" | "EUR" | "GBP"  // devise qu'on achète
    tauxAchat: number
    depensesTransport: number
    depensesBeach: number
    depensesEchangeBillets: number
    deductFromXaf: boolean
    deductFromUsd: boolean
    deductFromEur: boolean
    deductFromGbp: boolean
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string; tauxReel?: number; totalDeviseDisponible?: number }> {
  await ensureExchangeCaisseTables()
  
  const depenses = params.depensesTransport + params.depensesBeach + params.depensesEchangeBillets
  const montantDeviseAchetee = params.montant / params.tauxAchat
  // Les dépenses sont en devise (pas en XAF), donc on les soustrait directement
  const totalDeviseDisponible = Math.max(0, montantDeviseAchetee - depenses)
  // Formule corrigée: Taux réel = Montant payé / Total devise disponible
  const tauxReel = roundRate(
    totalDeviseDisponible > 0
      ? params.montant / totalDeviseDisponible
      : params.tauxAchat
  )

  const amountToDeduct = params.montant
  type SourceType = "xaf" | "usd" | "eur" | "gbp"
  let deductSource: SourceType | null = null
  if (params.deviseAchat === "XAF" && params.deductFromXaf) deductSource = "xaf"
  else if (params.deviseAchat === "USD" && params.deductFromUsd) deductSource = "usd"
  else if (params.deviseAchat === "EUR" && params.deductFromEur) deductSource = "eur"
  else if (params.deviseAchat === "GBP" && params.deductFromGbp) deductSource = "gbp"

  if (!deductSource) {
    return {
      success: false,
      error: `Sélectionnez Caisse ${params.deviseAchat} pour déduire.`,
    }
  }

  let sourceBalance = 0
  if (deductSource === "xaf") sourceBalance = await getCaisseBalance("XAF", null)
  else if (deductSource === "usd") sourceBalance = await getCaisseBalance("USD", null)
  else if (deductSource === "gbp") sourceBalance = await getCaisseBalance("GBP", null)
  else if (deductSource === "eur") sourceBalance = await getCaisseBalance("EUR", null)

  if (sourceBalance < amountToDeduct) {
    return {
      success: false,
      error: `Solde insuffisant (${deductSource.toUpperCase()}). Disponible: ${sourceBalance.toLocaleString("fr-FR")} ${params.deviseAchat}.`,
    }
  }

  try {
    // Déduire de la caisse source
    const sourceMap: Record<SourceType, ExchangeCaisseCurrency> = { xaf: "XAF", usd: "USD", eur: "EUR", gbp: "GBP" }
    await updateCaisseBalance(sourceMap[deductSource], Math.max(0, sourceBalance - amountToDeduct), updatedBy, undefined, null)

    const currentBought = await getCaisseBalance(params.deviseAchetee, null)
    await updateCaisseBalance(
      params.deviseAchetee,
      currentBought + totalDeviseDisponible,
      updatedBy,
      tauxReel,
      null
    )

    await recordExchangeOperation(
      "appro",
      {
        devise_achat: params.deviseAchat,
        montant: params.montant,
        devise_achetee: params.deviseAchetee,
        taux_achat: params.tauxAchat,
        montant_devise_achetee: montantDeviseAchetee,
        depenses_transport: params.depensesTransport,
        depenses_beach: params.depensesBeach,
        depenses_echange_billets: params.depensesEchangeBillets,
        total_devise_disponible: totalDeviseDisponible,
        taux_reel: tauxReel,
        deduct_from_xaf: params.deductFromXaf,
        deduct_from_usd: params.deductFromUsd,
        deduct_from_eur: params.deductFromEur,
        deduct_from_gbp: params.deductFromGbp,
      },
      updatedBy,
      null
    )
    return { success: true, tauxReel, totalDeviseDisponible }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de l'achat devise." }
  }
}

// Alias pour compatibilité
export const executeAppro = executeAchatDevise

/** Appro agence: transférer des devises de la caisse principale vers une ou plusieurs agences */
export async function executeApproAgence(
  params: {
    distributions: Array<{
      agencyId: string
      agencyName: string
      montantXaf: number
      montantUsd: number
      montantEur: number
      montantGbp: number
    }>
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  await ensureExchangeCaisseTables()
  
  // Calculer les totaux nécessaires
  let totalXaf = 0
  let totalUsd = 0
  let totalEur = 0
  let totalGbp = 0
  
  for (const dist of params.distributions) {
    totalXaf += dist.montantXaf || 0
    totalUsd += dist.montantUsd || 0
    totalEur += dist.montantEur || 0
    totalGbp += dist.montantGbp || 0
  }
  
  // Vérifier les soldes de la caisse principale
  const balanceXaf = await getCaisseBalance("XAF", null)
  const balanceUsd = await getCaisseBalance("USD", null)
  const balanceEur = await getCaisseBalance("EUR", null)
  const balanceGbp = await getCaisseBalance("GBP", null)
  
  if (totalXaf > 0 && balanceXaf < totalXaf) {
    return { success: false, error: `Solde XAF insuffisant. Disponible: ${balanceXaf.toLocaleString("fr-FR")}, Requis: ${totalXaf.toLocaleString("fr-FR")}` }
  }
  if (totalUsd > 0 && balanceUsd < totalUsd) {
    return { success: false, error: `Solde USD insuffisant. Disponible: ${balanceUsd.toLocaleString("fr-FR")}, Requis: ${totalUsd.toLocaleString("fr-FR")}` }
  }
  if (totalEur > 0 && balanceEur < totalEur) {
    return { success: false, error: `Solde EUR insuffisant. Disponible: ${balanceEur.toLocaleString("fr-FR")}, Requis: ${totalEur.toLocaleString("fr-FR")}` }
  }
  if (totalGbp > 0 && balanceGbp < totalGbp) {
    return { success: false, error: `Solde GBP insuffisant. Disponible: ${balanceGbp.toLocaleString("fr-FR")}, Requis: ${totalGbp.toLocaleString("fr-FR")}` }
  }
  
  // Récupérer les taux réels actuels de la caisse principale
  const tauxReelUsd = await getLastApproRate("USD", null)
  const tauxReelEur = await getLastApproRate("EUR", null)
  const tauxReelGbp = await getLastApproRate("GBP", null)
  
  try {
    // Déduire de la caisse principale
    if (totalXaf > 0) {
      await updateCaisseBalance("XAF", balanceXaf - totalXaf, updatedBy, undefined, null)
    }
    if (totalUsd > 0) {
      await updateCaisseBalance("USD", balanceUsd - totalUsd, updatedBy, undefined, null)
    }
    if (totalEur > 0) {
      await updateCaisseBalance("EUR", balanceEur - totalEur, updatedBy, undefined, null)
    }
    if (totalGbp > 0) {
      await updateCaisseBalance("GBP", balanceGbp - totalGbp, updatedBy, undefined, null)
    }
    
    // Créditer chaque agence
    for (const dist of params.distributions) {
      if (dist.montantXaf > 0) {
        const agencyXaf = await getCaisseBalance("XAF", dist.agencyId)
        await updateCaisseBalance("XAF", agencyXaf + dist.montantXaf, updatedBy, undefined, dist.agencyId)
      }
      if (dist.montantUsd > 0) {
        const agencyUsd = await getCaisseBalance("USD", dist.agencyId)
        await updateCaisseBalance("USD", agencyUsd + dist.montantUsd, updatedBy, tauxReelUsd, dist.agencyId)
      }
      if (dist.montantEur > 0) {
        const agencyEur = await getCaisseBalance("EUR", dist.agencyId)
        await updateCaisseBalance("EUR", agencyEur + dist.montantEur, updatedBy, tauxReelEur, dist.agencyId)
      }
      if (dist.montantGbp > 0) {
        const agencyGbp = await getCaisseBalance("GBP", dist.agencyId)
        await updateCaisseBalance("GBP", agencyGbp + dist.montantGbp, updatedBy, tauxReelGbp, dist.agencyId)
      }
    }
    
    // Enregistrer l'opération
    await recordExchangeOperation(
      "appro_agence",
      {
        distributions: params.distributions,
        total_xaf: totalXaf,
        total_usd: totalUsd,
        total_eur: totalEur,
        total_gbp: totalGbp,
        taux_reel_usd: tauxReelUsd,
        taux_reel_eur: tauxReelEur,
        taux_reel_gbp: tauxReelGbp,
        solde_restant_xaf: balanceXaf - totalXaf,
        solde_restant_usd: balanceUsd - totalUsd,
        solde_restant_eur: balanceEur - totalEur,
        solde_restant_gbp: balanceGbp - totalGbp,
      },
      updatedBy,
      null
    )
    
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de l'appro agence." }
  }
}

/** Vente de devise: déduire de la caisse de la devise vendue, calculer commission. 
 * Peut être exécuté sur n'importe quelle caisse (principale ou agence).
 */
export async function executeVente(
  params: {
    beneficiaire: string
    idType?: string | null
    idTypeLabel?: string | null
    idNumber?: string | null
    deviseVendu: "USD" | "EUR" | "GBP"
    montantVendu: number
    deviseRecu: string
    tauxDuJour: number
    montantRecu: number
  },
  updatedBy: string,
  agencyId?: string | null
): Promise<{ success: boolean; commission?: number; error?: string }> {
  await ensureExchangeCaisseTables()
  
  const lastApproRate = await getLastApproRate(params.deviseVendu, agencyId) ?? roundRate(params.tauxDuJour)
  
  const prixVente = params.montantVendu * params.tauxDuJour
  const prixAchat = params.montantVendu * lastApproRate
  const commission = Math.max(0, prixVente - prixAchat)

  const balance = await getCaisseBalance(params.deviseVendu, agencyId)
  if (balance < params.montantVendu) {
    return { success: false, error: `Solde insuffisant en ${params.deviseVendu}. Disponible: ${balance.toLocaleString("fr-FR")}.` }
  }

  try {
    // Calculer les nouveaux soldes
    const newBalanceForeign = balance - params.montantVendu
    const balanceXaf = await getCaisseBalance("XAF", agencyId)
    const newBalanceXaf = balanceXaf + params.montantRecu
    
    const payload = JSON.stringify({
      beneficiaire: params.beneficiaire,
      id_type: params.idType || null,
      id_type_label: params.idTypeLabel || null,
      id_number: params.idNumber || null,
      devise_vendu: params.deviseVendu,
      montant_vendu: params.montantVendu,
      devise_recu: params.deviseRecu,
      taux_du_jour: params.tauxDuJour,
      montant_recu: params.montantRecu,
      last_appro_rate: lastApproRate,
      commission,
    })
    
    // Transaction atomique : débiter devise + créditer XAF + enregistrer opération
    if (agencyId) {
      await sql.transaction([
        sql`UPDATE exchange_caisse SET balance = ${newBalanceForeign}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = ${params.deviseVendu} AND agency_id = ${agencyId}::uuid`,
        sql`UPDATE exchange_caisse SET balance = ${newBalanceXaf}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = 'XAF' AND agency_id = ${agencyId}::uuid`,
        sql`INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id) VALUES ('vente', ${payload}::jsonb, ${updatedBy}, ${agencyId}::uuid)`,
      ])
    } else {
      await sql.transaction([
        sql`UPDATE exchange_caisse SET balance = ${newBalanceForeign}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = ${params.deviseVendu} AND agency_id IS NULL`,
        sql`UPDATE exchange_caisse SET balance = ${newBalanceXaf}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = 'XAF' AND agency_id IS NULL`,
        sql`INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id) VALUES ('vente', ${payload}::jsonb, ${updatedBy}, NULL)`,
      ])
    }
    
    return { success: true, commission }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de la vente." }
  }
}

/** Cession de devise: déduire du montant de la caisse. Renommé en "Appro agence" dans l'UI pour la caisse principale. */
export async function executeCession(
  params: {
    devise: ExchangeCaisseCurrency
    montant: number
    beneficiaire: string
  },
  updatedBy: string,
  agencyId?: string | null
): Promise<{ success: boolean; error?: string }> {
  await ensureExchangeCaisseTables()
  
  const balance = await getCaisseBalance(params.devise, agencyId)
  if (balance < params.montant) {
    return { success: false, error: `Solde insuffisant en ${params.devise}. Disponible: ${balance.toLocaleString("fr-FR")}.` }
  }
  try {
    await updateCaisseBalance(params.devise, balance - params.montant, updatedBy, undefined, agencyId)
    await recordExchangeOperation(
      "cession",
      { devise: params.devise, montant: params.montant, beneficiaire: params.beneficiaire },
      updatedBy,
      agencyId
    )
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de la cession." }
  }
}

/** Récupérer les opérations. 
 * - Si agencyId = null: toutes les opérations (pour la caisse principale)
 * - Si agencyId spécifié: opérations de cette agence uniquement
 * - Si includeAll = true: inclure toutes les opérations de toutes les caisses
 */
export async function getExchangeOperations(
  limit: number = 50,
  agencyId?: string | null,
  includeAll: boolean = false
): Promise<ExchangeOperationRow[]> {
  await ensureExchangeCaisseTables()
  
  let rows: (ExchangeOperationRow & { payload: string })[]
  
  if (includeAll) {
    // Toutes les opérations de toutes les caisses
    rows = await sql<(ExchangeOperationRow & { payload: string })[]>`
      SELECT eo.id::text, eo.operation_type, eo.payload::text as payload, 
             eo.created_by, eo.created_at::text as created_at,
             eo.agency_id::text as agency_id, a.name as agency_name
      FROM exchange_operations eo
      LEFT JOIN agencies a ON a.id = eo.agency_id
      ORDER BY eo.created_at DESC
      LIMIT ${limit}
    `
  } else if (agencyId) {
    // Opérations d'une agence spécifique
    rows = await sql<(ExchangeOperationRow & { payload: string })[]>`
      SELECT eo.id::text, eo.operation_type, eo.payload::text as payload, 
             eo.created_by, eo.created_at::text as created_at,
             eo.agency_id::text as agency_id, a.name as agency_name
      FROM exchange_operations eo
      LEFT JOIN agencies a ON a.id = eo.agency_id
      WHERE eo.agency_id = ${agencyId}::uuid
      ORDER BY eo.created_at DESC
      LIMIT ${limit}
    `
  } else {
    // Opérations de la caisse principale uniquement
    rows = await sql<(ExchangeOperationRow & { payload: string })[]>`
      SELECT id::text, operation_type, payload::text as payload, 
             created_by, created_at::text as created_at,
             agency_id::text as agency_id, NULL as agency_name
      FROM exchange_operations
      WHERE agency_id IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }
  
  return rows.map((r) => ({
    ...r,
    payload: (typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload) as Record<string, unknown>,
  }))
}

/** Calculer les commissions générées par devise pour une caisse */
export async function getCommissionsGenerated(agencyId?: string | null): Promise<{ USD: number; EUR: number; GBP: number }> {
  await ensureExchangeCaisseTables()
  
  let rows: { commission: string }[]
  
  if (agencyId) {
    rows = await sql<{ commission: string; devise: string }[]>`
      SELECT 
        COALESCE(SUM((payload->>'commission')::numeric), 0)::text as commission,
        COALESCE(payload->>'devise_vendu', payload->>'devise') as devise
      FROM exchange_operations
      WHERE operation_type IN ('vente', 'change_vente') AND agency_id = ${agencyId}::uuid
      GROUP BY COALESCE(payload->>'devise_vendu', payload->>'devise')
    `
  } else {
    rows = await sql<{ commission: string; devise: string }[]>`
      SELECT 
        COALESCE(SUM((payload->>'commission')::numeric), 0)::text as commission,
        COALESCE(payload->>'devise_vendu', payload->>'devise') as devise
      FROM exchange_operations
      WHERE operation_type IN ('vente', 'change_vente') AND agency_id IS NULL
      GROUP BY COALESCE(payload->>'devise_vendu', payload->>'devise')
    `
  }
  
  const result = { USD: 0, EUR: 0, GBP: 0 }
  for (const row of rows as any[]) {
    if (row.devise === 'USD') result.USD = Number(row.commission) || 0
    if (row.devise === 'EUR') result.EUR = Number(row.commission) || 0
    if (row.devise === 'GBP') result.GBP = Number(row.commission) || 0
  }
  return result
}

/** Processeur pour les transactions de change des agents
 * Débite/crédite la caisse appropriée de l'agence de l'agent
 */
export async function processExchangeTransaction(
  params: {
    type: "buy" | "sell"  // buy = client vend devise, sell = client achète devise
    currency: "USD" | "EUR" | "GBP"
    amountForeign: number
    amountXaf: number
    commission: number
    exchangeRate: number
    agencyName: string  // Nom de l'agence de l'agent
    clientName?: string | null
    clientPhone?: string | null
    clientIdType?: string | null
    clientIdTypeLabel?: string | null
    clientIdNumber?: string | null
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  await ensureExchangeCaisseTables()
  
  // Trouver l'agence par son nom (recherche flexible : exacte, puis insensible à la casse, puis partielle)
  let agencyRows = await sql<{ id: string }[]>`
    SELECT id::text FROM agencies WHERE name = ${params.agencyName} AND status = 'active' LIMIT 1
  `
  
  // Si pas trouvé, essayer en ignorant la casse
  if (!agencyRows.length) {
    agencyRows = await sql<{ id: string }[]>`
      SELECT id::text FROM agencies WHERE LOWER(name) = LOWER(${params.agencyName}) AND status = 'active' LIMIT 1
    `
  }
  
  // Si toujours pas trouvé, essayer une recherche partielle
  if (!agencyRows.length) {
    agencyRows = await sql<{ id: string }[]>`
      SELECT id::text FROM agencies WHERE LOWER(name) LIKE LOWER(${'%' + params.agencyName + '%'}) AND status = 'active' LIMIT 1
    `
  }
  
  if (!agencyRows.length) {
    return { success: false, error: `Agence "${params.agencyName}" non trouvée ou inactive. Vérifiez que votre agence correspond à une agence active dans le système.` }
  }
  
  const agencyId = agencyRows[0].id
  
  // Récupérer le taux réel de la dernière appro pour calculer la commission
  const lastApproRate = await getLastApproRate(params.currency, agencyId)
  
  if (params.type === "buy") {
    // Client vend des devises -> nous achetons -> on reçoit des devises, on donne du XAF
    // Créditer la caisse devise de l'agence
    // Débiter la caisse XAF de l'agence
    
    const balanceXaf = await getCaisseBalance("XAF", agencyId)
    const balanceForeign = await getCaisseBalance(params.currency, agencyId)
    const manque = params.amountXaf - balanceXaf
    if (balanceXaf < params.amountXaf) {
      return { 
        success: false, 
        error: `Solde XAF insuffisant pour acheter ${params.amountForeign.toLocaleString("fr-FR")} ${params.currency}. ` +
               `Besoin: ${params.amountXaf.toLocaleString("fr-FR")} XAF. ` +
               `Disponible: ${balanceXaf.toLocaleString("fr-FR")} XAF. ` +
               `Manque: ${manque.toLocaleString("fr-FR")} XAF. ` +
               `Demandez un approvisionnement de la caisse.`
      }
    }
    
    // Calculer les nouveaux soldes avant la transaction
    const newBalanceXaf = balanceXaf - params.amountXaf
    const newBalanceForeign = balanceForeign + params.amountForeign
    const payload = JSON.stringify({
      type: "buy",
      devise: params.currency,
      montant_devise: params.amountForeign,
      montant_xaf: params.amountXaf,
      taux_applique: params.exchangeRate,
      taux_reel_appro: lastApproRate,
      commission: params.commission,
      agence: params.agencyName,
      client_name: params.clientName || null,
      client_phone: params.clientPhone || null,
      client_id_type: params.clientIdType || null,
      client_id_type_label: params.clientIdTypeLabel || null,
      client_id_number: params.clientIdNumber || null,
    })
    
    try {
      // Transaction atomique : toutes les opérations réussissent ou aucune
      await sql.transaction([
        sql`UPDATE exchange_caisse SET balance = ${newBalanceXaf}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = 'XAF' AND agency_id = ${agencyId}::uuid`,
        sql`UPDATE exchange_caisse SET balance = ${newBalanceForeign}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = ${params.currency} AND agency_id = ${agencyId}::uuid`,
        sql`INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id) VALUES ('change_achat', ${payload}::jsonb, ${updatedBy}, ${agencyId}::uuid)`,
      ])
      
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Erreur technique lors de l'achat de devises: ${e?.message ?? "Erreur inconnue"}. Veuillez réessayer.` }
    }
  } else {
    // Client achète des devises -> nous vendons -> on donne des devises, on reçoit du XAF
    // Débiter la caisse devise de l'agence
    // Créditer la caisse XAF de l'agence (net de commission)
    
    const balanceForeign = await getCaisseBalance(params.currency, agencyId)
    const balanceXaf = await getCaisseBalance("XAF", agencyId)
    const manque = params.amountForeign - balanceForeign
    if (balanceForeign < params.amountForeign) {
      return { 
        success: false, 
        error: `Solde ${params.currency} insuffisant pour vendre ${params.amountForeign.toLocaleString("fr-FR")} ${params.currency}. ` +
               `Disponible: ${balanceForeign.toLocaleString("fr-FR")} ${params.currency}. ` +
               `Manque: ${manque.toLocaleString("fr-FR")} ${params.currency}. ` +
               `Demandez un approvisionnement de la caisse.`
      }
    }
    
    // Calculer la commission: (taux_vente - taux_reel_appro) * montant_devise
    let commissionCalculee = params.commission
    if (lastApproRate && params.exchangeRate > lastApproRate) {
      commissionCalculee = Math.round((params.exchangeRate - lastApproRate) * params.amountForeign)
    }
    
    // Calculer les nouveaux soldes avant la transaction
    // XAF: on crédite le montant reçu MOINS la commission (la commission est comptabilisée séparément)
    const newBalanceForeign = balanceForeign - params.amountForeign
    const newBalanceXaf = balanceXaf + params.amountXaf - commissionCalculee
    const payload = JSON.stringify({
      type: "sell",
      devise: params.currency,
      montant_devise: params.amountForeign,
      montant_xaf: params.amountXaf,
      taux_applique: params.exchangeRate,
      taux_reel_appro: lastApproRate,
      commission: commissionCalculee,
      agence: params.agencyName,
      client_name: params.clientName || null,
      client_phone: params.clientPhone || null,
      client_id_type: params.clientIdType || null,
      client_id_type_label: params.clientIdTypeLabel || null,
      client_id_number: params.clientIdNumber || null,
    })
    
    try {
      // Transaction atomique : toutes les opérations réussissent ou aucune
      await sql.transaction([
        sql`UPDATE exchange_caisse SET balance = ${newBalanceForeign}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = ${params.currency} AND agency_id = ${agencyId}::uuid`,
        sql`UPDATE exchange_caisse SET balance = ${newBalanceXaf}, last_updated = NOW(), updated_by = ${updatedBy} WHERE currency = 'XAF' AND agency_id = ${agencyId}::uuid`,
        sql`INSERT INTO exchange_operations (operation_type, payload, created_by, agency_id) VALUES ('change_vente', ${payload}::jsonb, ${updatedBy}, ${agencyId}::uuid)`,
      ])
      
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Erreur technique lors de la vente de devises: ${e?.message ?? "Erreur inconnue"}. Veuillez réessayer.` }
    }
  }
}

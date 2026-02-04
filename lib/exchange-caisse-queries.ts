import "server-only"
import { sql } from "./db"
import { deductFromCoffre } from "./cash-queries"

export type ExchangeCaisseCurrency = "XAF" | "USD" | "EUR"

export type ExchangeCaisseRow = {
  currency: ExchangeCaisseCurrency
  balance: number
  last_appro_rate: number | null
  last_updated: string
  updated_by: string
  last_manual_motif?: string | null
}

export type ExchangeOperationType = "appro" | "vente" | "cession" | "maj_manuelle"

export type ExchangeOperationRow = {
  id: string
  operation_type: ExchangeOperationType
  payload: Record<string, unknown>
  created_by: string
  created_at: string
}

const CURRENCIES: ExchangeCaisseCurrency[] = ["XAF", "USD", "EUR"]

/** Arrondit un taux à 2 décimales pour éviter les artefacts flottants (ex: 5.000000000000001). */
function roundRate(n: number): number {
  return Math.round(n * 100) / 100
}

export async function ensureExchangeCaisseTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS exchange_caisse (
      currency TEXT PRIMARY KEY CHECK (currency IN ('XAF', 'USD', 'EUR')),
      balance NUMERIC NOT NULL DEFAULT 0,
      last_appro_rate NUMERIC,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS exchange_operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type TEXT NOT NULL CHECK (operation_type IN ('appro', 'vente', 'cession')),
      payload JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  for (const currency of CURRENCIES) {
    await sql`
      INSERT INTO exchange_caisse (currency, balance, updated_by)
      VALUES (${currency}, 0, 'system')
      ON CONFLICT (currency) DO NOTHING
    `
  }
  await sql`
    ALTER TABLE exchange_caisse ADD COLUMN IF NOT EXISTS last_manual_motif TEXT
  `
  // Autoriser le type "maj_manuelle" dans exchange_operations (mise à jour manuelle caisse)
  try {
    await sql`ALTER TABLE exchange_operations DROP CONSTRAINT IF EXISTS exchange_operations_operation_type_check`
    await sql`ALTER TABLE exchange_operations ADD CONSTRAINT exchange_operations_operation_type_check CHECK (operation_type IN ('appro', 'vente', 'cession', 'maj_manuelle'))`
  } catch {
    // Contrainte peut avoir un autre nom selon l'environnement ; ignorer si déjà à jour
  }
}

export async function getExchangeCaisseBalances(): Promise<ExchangeCaisseRow[]> {
  await ensureExchangeCaisseTables()
  const rows = await sql<ExchangeCaisseRow[]>`
    SELECT currency, balance::numeric as balance, last_appro_rate::numeric as last_appro_rate,
           last_updated::text as last_updated, updated_by, last_manual_motif
    FROM exchange_caisse
    ORDER BY currency
  `
  return rows
}

export async function getCoffreBalance(): Promise<number> {
  const rows = await sql<{ current_balance: string }[]>`
    SELECT current_balance::text FROM cash_accounts WHERE account_type = 'coffre'
  `
  return rows.length ? Number(rows[0].current_balance) : 0
}

async function getCaisseBalance(currency: ExchangeCaisseCurrency): Promise<number> {
  const rows = await sql<{ balance: string }[]>`
    SELECT balance::text FROM exchange_caisse WHERE currency = ${currency}
  `
  return rows.length ? Number(rows[0].balance) : 0
}

async function updateCaisseBalance(
  currency: ExchangeCaisseCurrency,
  newBalance: number,
  updatedBy: string,
  lastApproRate?: number | null
): Promise<void> {
  if (lastApproRate !== undefined) {
    await sql`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
          last_appro_rate = ${lastApproRate}
      WHERE currency = ${currency}
    `
  } else {
    await sql`
      UPDATE exchange_caisse
      SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy}
      WHERE currency = ${currency}
    `
  }
}

/** Mise à jour manuelle du solde d'une caisse (XAF, USD, EUR). Enregistre un motif et une opération pour le reporting. */
export async function updateExchangeCaisseBalanceManual(
  currency: ExchangeCaisseCurrency,
  newBalance: number,
  updatedBy: string,
  motif?: string | null
): Promise<void> {
  const previousBalance = await getCaisseBalance(currency)
  await sql`
    UPDATE exchange_caisse
    SET balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy},
        last_manual_motif = ${motif ?? null}
    WHERE currency = ${currency}
  `
  await recordExchangeOperation(
    "maj_manuelle",
    {
      currency,
      previous_balance: previousBalance,
      new_balance: newBalance,
      motif: motif ?? null,
    },
    updatedBy
  )
}

export async function recordExchangeOperation(
  operationType: ExchangeOperationType,
  payload: Record<string, unknown>,
  createdBy: string
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO exchange_operations (operation_type, payload, created_by)
    VALUES (${operationType}, ${JSON.stringify(payload)}, ${createdBy})
    RETURNING id::text
  `
  return rows[0]?.id ?? ""
}

/** Appro devise: déduire de (caisse_xaf | caisse_usd | caisse_eur | coffre), ajouter à la caisse de la devise achetée, enregistrer taux réel. */
export async function executeAppro(
  params: {
    deviseAchat: ExchangeCaisseCurrency  // XAF, USD ou EUR qu'on paie
    montant: number
    deviseAchetee: "USD" | "EUR"       // devise qu'on achète
    tauxAchat: number
    depensesTransport: number
    depensesBeach: number
    depensesEchangeBillets: number
    deductFromXaf: boolean
    deductFromUsd: boolean
    deductFromEur: boolean
    deductFromCoffre: boolean
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const depenses = params.depensesTransport + params.depensesBeach + params.depensesEchangeBillets
  const montantDeviseAchetee = params.montant / params.tauxAchat
  const totalDeviseDisponible = Math.max(0, montantDeviseAchetee - depenses)
  const tauxReel = roundRate(
    totalDeviseDisponible > 0
      ? params.tauxAchat + (depenses / totalDeviseDisponible)
      : params.tauxAchat
  )

  const amountToDeduct = params.montant
  type SourceType = "xaf" | "usd" | "eur" | "coffre"
  let deductSource: SourceType | null = null
  if (params.deviseAchat === "XAF") {
    if (params.deductFromXaf) deductSource = "xaf"
    else if (params.deductFromCoffre) deductSource = "coffre"
  } else if (params.deviseAchat === "USD" && params.deductFromUsd) deductSource = "usd"
  else if (params.deviseAchat === "EUR" && params.deductFromEur) deductSource = "eur"

  if (!deductSource) {
    return {
      success: false,
      error: params.deviseAchat === "XAF"
        ? "Sélectionnez Caisse XAF ou Coffre pour déduire."
        : `Sélectionnez Caisse ${params.deviseAchat} pour déduire.`,
    }
  }

  let sourceBalance = 0
  if (deductSource === "xaf") sourceBalance = await getCaisseBalance("XAF")
  else if (deductSource === "usd") sourceBalance = await getCaisseBalance("USD")
  else if (deductSource === "eur") sourceBalance = await getCaisseBalance("EUR")
  else sourceBalance = await getCoffreBalance()

  if (sourceBalance < amountToDeduct) {
    return {
      success: false,
      error: `Solde insuffisant (${deductSource}). Disponible: ${sourceBalance.toLocaleString("fr-FR")} ${params.deviseAchat}.`,
    }
  }

  try {
    if (deductSource === "xaf") {
      await updateCaisseBalance("XAF", Math.max(0, sourceBalance - amountToDeduct), updatedBy)
    } else if (deductSource === "usd") {
      await updateCaisseBalance("USD", Math.max(0, sourceBalance - amountToDeduct), updatedBy)
    } else if (deductSource === "eur") {
      await updateCaisseBalance("EUR", Math.max(0, sourceBalance - amountToDeduct), updatedBy)
    } else {
      await deductFromCoffre(amountToDeduct, `Appro devise: ${params.deviseAchetee} - ${params.montant} ${params.deviseAchat}`, updatedBy)
    }

    const currentBought = await getCaisseBalance(params.deviseAchetee)
    await updateCaisseBalance(
      params.deviseAchetee,
      currentBought + totalDeviseDisponible,
      updatedBy,
      tauxReel
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
        deduct_from_coffre: params.deductFromCoffre,
      },
      updatedBy
    )
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de l'appro." }
  }
}

/** Vente de devise: déduire de la caisse de la devise vendue, calculer commission. */
export async function executeVente(
  params: {
    beneficiaire: string
    deviseVendu: "USD" | "EUR"
    montantVendu: number
    deviseRecu: string
    tauxDuJour: number
    montantRecu: number
  },
  updatedBy: string
): Promise<{ success: boolean; commission?: number; error?: string }> {
  const rows = await sql<{ last_appro_rate: string | null }[]>`
    SELECT last_appro_rate::text FROM exchange_caisse WHERE currency = ${params.deviseVendu}
  `
  const lastApproRate =
    rows[0]?.last_appro_rate != null
      ? roundRate(Number(rows[0].last_appro_rate))
      : roundRate(params.tauxDuJour)
  const prixVente = params.montantVendu * params.tauxDuJour
  const prixAchat = params.montantVendu * lastApproRate
  const commission = Math.max(0, prixVente - prixAchat)

  const balance = await getCaisseBalance(params.deviseVendu)
  if (balance < params.montantVendu) {
    return { success: false, error: `Solde insuffisant en ${params.deviseVendu}. Disponible: ${balance.toLocaleString("fr-FR")}.` }
  }

  try {
    await updateCaisseBalance(
      params.deviseVendu,
      balance - params.montantVendu,
      updatedBy
    )
    await recordExchangeOperation(
      "vente",
      {
        beneficiaire: params.beneficiaire,
        devise_vendu: params.deviseVendu,
        montant_vendu: params.montantVendu,
        devise_recu: params.deviseRecu,
        taux_du_jour: params.tauxDuJour,
        montant_recu: params.montantRecu,
        last_appro_rate: lastApproRate,
        commission,
      },
      updatedBy
    )
    return { success: true, commission }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de la vente." }
  }
}

/** Cession de devise: déduire du montant de la caisse. */
export async function executeCession(
  params: {
    devise: ExchangeCaisseCurrency
    montant: number
    beneficiaire: string
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const balance = await getCaisseBalance(params.devise)
  if (balance < params.montant) {
    return { success: false, error: `Solde insuffisant en ${params.devise}. Disponible: ${balance.toLocaleString("fr-FR")}.` }
  }
  try {
    await updateCaisseBalance(params.devise, balance - params.montant, updatedBy)
    await recordExchangeOperation(
      "cession",
      { devise: params.devise, montant: params.montant, beneficiaire: params.beneficiaire },
      updatedBy
    )
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Erreur lors de la cession." }
  }
}

export async function getExchangeOperations(limit: number = 50): Promise<ExchangeOperationRow[]> {
  const rows = await sql<(ExchangeOperationRow & { payload: string })[]>`
    SELECT id::text, operation_type, payload::text as payload, created_by, created_at::text as created_at
    FROM exchange_operations
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.map((r) => ({
    ...r,
    payload: (typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload) as Record<string, unknown>,
  }))
}

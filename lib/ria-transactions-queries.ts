import "server-only"
import { sql } from "./db"

export type RiaTransaction = {
  id: string
  sc_numero_transfert: string
  pin?: string
  mode_livraison?: string
  guichetier: string
  succursale: string
  code_agence: string
  sent_amount: number
  sending_currency: string
  pays_origine?: string
  pays_destination?: string
  montant_paiement?: number
  devise_beneficiaire?: string
  commission_sa: number
  devise_commission_sa: string
  date_operation: string
  taux?: number
  ttf: number
  cte: number
  tva1: number
  montant_a_payer?: number
  frais_client?: number
  action: 'Envoyé' | 'Payé' | 'Annulé' | 'Remboursé' | 'En attente'
  created_at: string
  updated_at: string
  // Calculs dérivés
  commission_ria?: number
  tva_ria?: number
  commission_uba?: number
  tva_uba?: number
  commission_ztf?: number
  ca_ztf?: number
  tva_ztf?: number
  cte_calculated?: number
  ttf_calculated?: number
  montant_principal?: number
  frais_client_calculated?: number
  montant_brut?: number
  is_remboursement?: boolean
}

export type DailyIndicators = {
  id: string
  date_calcul: string
  agence: string
  montant_principal: number
  montant_brut: number
  total_frais: number
  commissions_ria: number
  tva_ria: number
  commissions_uba: number
  tva_uba: number
  commissions_ztf: number
  tva_ztf: number
  ca_ztf: number
  cte: number
  ttf: number
  paiements: number
  annulation: number
  remboursement: number
  frais_retenus: number
  operation_attente: number
  versement_banque: number
  montant_a_debiter: number
  montant_en_coffre: number
  marge_ztf_nette: number
  taux_moyen_jour?: number
  nb_transactions: number
  ratio_frais_principal?: number
  ratio_remboursement_brut?: number
  created_at: string
  updated_at: string
}

export type GuichetierStats = {
  guichetier: string
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

export type AgenceStats = {
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

export type PaysStats = {
  pays_destination: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

// Récupérer toutes les transactions RIA avec filtres
export async function getRiaTransactions(filters?: {
  dateFrom?: string
  dateTo?: string
  guichetier?: string
  agence?: string
  action?: string
  paysDestination?: string
  limit?: number
  offset?: number
}): Promise<RiaTransaction[]> {
  let query = sql`
    SELECT 
      id::text,
      sc_numero_transfert,
      pin,
      mode_livraison,
      guichetier,
      succursale,
      code_agence,
      sent_amount,
      sending_currency,
      pays_origine,
      pays_destination,
      montant_paiement,
      devise_beneficiaire,
      commission_sa,
      devise_commission_sa,
      date_operation::text,
      taux,
      ttf,
      cte,
      tva1,
      montant_a_payer,
      frais_client,
      action,
      commission_ria,
      tva_ria,
      commission_uba,
      tva_uba,
      commission_ztf,
      ca_ztf,
      tva_ztf,
      cte_calculated,
      ttf_calculated,
      montant_principal,
      frais_client_calculated,
      montant_brut,
      is_remboursement,
      created_at::text,
      updated_at::text
    FROM ria_transactions
    WHERE 1=1
  `

  if (filters?.dateFrom) {
    query = sql`${query} AND DATE(date_operation) >= ${filters.dateFrom}`
  }
  if (filters?.dateTo) {
    query = sql`${query} AND DATE(date_operation) <= ${filters.dateTo}`
  }
  if (filters?.guichetier) {
    query = sql`${query} AND guichetier ILIKE ${`%${filters.guichetier}%`}`
  }
  if (filters?.agence) {
    query = sql`${query} AND succursale ILIKE ${`%${filters.agence}%`}`
  }
  if (filters?.action) {
    query = sql`${query} AND action = ${filters.action}`
  }
  if (filters?.paysDestination) {
    query = sql`${query} AND pays_destination ILIKE ${`%${filters.paysDestination}%`}`
  }

  query = sql`${query} ORDER BY date_operation DESC`

  if (filters?.limit) {
    query = sql`${query} LIMIT ${filters.limit}`
  }
  if (filters?.offset) {
    query = sql`${query} OFFSET ${filters.offset}`
  }

  return query as RiaTransaction[]
}

// Récupérer les indicateurs journaliers
export async function getDailyIndicators(filters?: {
  dateFrom?: string
  dateTo?: string
  agence?: string
}): Promise<DailyIndicators[]> {
  let query = sql`
    SELECT 
      id::text,
      date_calcul::text,
      agence,
      montant_principal,
      montant_brut,
      total_frais,
      commissions_ria,
      tva_ria,
      commissions_uba,
      tva_uba,
      commissions_ztf,
      tva_ztf,
      ca_ztf,
      cte,
      ttf,
      paiements,
      annulation,
      remboursement,
      frais_retenus,
      operation_attente,
      versement_banque,
      montant_a_debiter,
      montant_en_coffre,
      marge_ztf_nette,
      taux_moyen_jour,
      nb_transactions,
      ratio_frais_principal,
      ratio_remboursement_brut,
      created_at::text,
      updated_at::text
    FROM indicateurs_journaliers
    WHERE 1=1
  `

  if (filters?.dateFrom) {
    query = sql`${query} AND date_calcul >= ${filters.dateFrom}`
  }
  if (filters?.dateTo) {
    query = sql`${query} AND date_calcul <= ${filters.dateTo}`
  }
  if (filters?.agence && filters.agence !== 'Toutes') {
    query = sql`${query} AND agence = ${filters.agence}`
  }

  query = sql`${query} ORDER BY date_calcul DESC`

  return query as DailyIndicators[]
}

// Récupérer les statistiques par guichetier
export async function getGuichetierStats(filters?: {
  dateFrom?: string
  dateTo?: string
  agence?: string
}): Promise<GuichetierStats[]> {
  let query = sql`
    SELECT 
      guichetier,
      succursale as agence,
      COUNT(*) as nb_transactions,
      SUM(sent_amount) as montant_total,
      AVG(sent_amount) as montant_moyen,
      SUM(commission_sa) as commissions_generes
    FROM ria_transactions
    WHERE action = 'Envoyé'
  `

  if (filters?.dateFrom) {
    query = sql`${query} AND DATE(date_operation) >= ${filters.dateFrom}`
  }
  if (filters?.dateTo) {
    query = sql`${query} AND DATE(date_operation) <= ${filters.dateTo}`
  }
  if (filters?.agence && filters.agence !== 'Toutes') {
    query = sql`${query} AND succursale = ${filters.agence}`
  }

  query = sql`${query} GROUP BY guichetier, succursale ORDER BY montant_total DESC`

  const result = await query
  return result.map(row => ({
    guichetier: row.guichetier,
    agence: row.agence,
    nb_transactions: Number(row.nb_transactions),
    montant_total: Number(row.montant_total),
    montant_moyen: Number(row.montant_moyen),
    commissions_generes: Number(row.commissions_generes)
  }))
}

// Récupérer les statistiques par agence
export async function getAgenceStats(filters?: {
  dateFrom?: string
  dateTo?: string
}): Promise<AgenceStats[]> {
  let query = sql`
    SELECT 
      succursale as agence,
      COUNT(*) as nb_transactions,
      SUM(sent_amount) as montant_total,
      AVG(sent_amount) as montant_moyen,
      SUM(commission_sa) as commissions_generes
    FROM ria_transactions
    WHERE action = 'Envoyé'
  `

  if (filters?.dateFrom) {
    query = sql`${query} AND DATE(date_operation) >= ${filters.dateFrom}`
  }
  if (filters?.dateTo) {
    query = sql`${query} AND DATE(date_operation) <= ${filters.dateTo}`
  }

  query = sql`${query} GROUP BY succursale ORDER BY montant_total DESC`

  const result = await query
  return result.map(row => ({
    agence: row.agence,
    nb_transactions: Number(row.nb_transactions),
    montant_total: Number(row.montant_total),
    montant_moyen: Number(row.montant_moyen),
    commissions_generes: Number(row.commissions_generes)
  }))
}

// Récupérer les statistiques par pays de destination
export async function getPaysStats(filters?: {
  dateFrom?: string
  dateTo?: string
  agence?: string
}): Promise<PaysStats[]> {
  let query = sql`
    SELECT 
      pays_destination,
      COUNT(*) as nb_transactions,
      SUM(sent_amount) as montant_total,
      AVG(sent_amount) as montant_moyen,
      SUM(commission_sa) as commissions_generes
    FROM ria_transactions
    WHERE action = 'Envoyé' AND pays_destination IS NOT NULL
  `

  if (filters?.dateFrom) {
    query = sql`${query} AND DATE(date_operation) >= ${filters.dateFrom}`
  }
  if (filters?.dateTo) {
    query = sql`${query} AND DATE(date_operation) <= ${filters.dateTo}`
  }
  if (filters?.agence && filters.agence !== 'Toutes') {
    query = sql`${query} AND succursale = ${filters.agence}`
  }

  query = sql`${query} GROUP BY pays_destination ORDER BY montant_total DESC`

  const result = await query
  return result.map(row => ({
    pays_destination: row.pays_destination,
    nb_transactions: Number(row.nb_transactions),
    montant_total: Number(row.montant_total),
    montant_moyen: Number(row.montant_moyen),
    commissions_generes: Number(row.commissions_generes)
  }))
}


// Récupérer les agences uniques
export async function getUniqueAgences(): Promise<{ id: string; name: string }[]> {
  const result = await sql<{ name: string }[]>`
    SELECT DISTINCT succursale as name
    FROM ria_transactions
    WHERE succursale IS NOT NULL
    ORDER BY succursale
  `
  return result.map(r => ({ id: r.name, name: r.name }))
}

// Récupérer les guichetiers uniques
export async function getUniqueGuichetiers(): Promise<{ id: string; name: string }[]> {
  const result = await sql<{ name: string }[]>`
    SELECT DISTINCT guichetier as name
    FROM ria_transactions
    WHERE guichetier IS NOT NULL
    ORDER BY guichetier
  `
  return result.map(r => ({ id: r.name, name: r.name }))
}

// Récupérer les pays de destination uniques
export async function getUniquePaysDestinations(): Promise<{ id: string; name: string }[]> {
  const result = await sql<{ name: string }[]>`
    SELECT DISTINCT pays_destination as name
    FROM ria_transactions
    WHERE pays_destination IS NOT NULL
    ORDER BY pays_destination
  `
  return result.map(r => ({ id: r.name, name: r.name }))
}

// Récupérer les données temporelles des transactions pour les graphiques
export async function getTimeSeriesData(filters?: {
  dateFrom?: string
  dateTo?: string
  agence?: string
  guichetier?: string
}): Promise<{
  date: string
  transactions: number
  montant_total: number
  montant_principal: number
  commissions: number
  paiements: number
  annulations: number
  remboursements: number
  variation_transactions: number
  variation_montant: number
  delestage: number
}[]> {
  let dateCondition = ""
  if (filters?.dateFrom) {
    dateCondition += ` AND DATE(date_operation) >= '${filters.dateFrom}'`
  }
  if (filters?.dateTo) {
    dateCondition += ` AND DATE(date_operation) <= '${filters.dateTo}'`
  }
  if (filters?.agence && filters.agence !== 'all') {
    dateCondition += ` AND succursale = '${filters.agence}'`
  }
  if (filters?.guichetier && filters.guichetier !== 'all') {
    dateCondition += ` AND guichetier = '${filters.guichetier}'`
  }

  const result = await sql`
    SELECT 
      DATE(date_operation) as date,
      COUNT(*) as transactions,
      COALESCE(SUM(montant_brut), 0) as montant_total,
      COALESCE(SUM(montant_principal), 0) as montant_principal,
      COALESCE(SUM(frais_client_calculated), 0) as commissions,
      COUNT(CASE WHEN action = 'Payé' THEN 1 END) as paiements,
      COUNT(CASE WHEN action = 'Annulé' THEN 1 END) as annulations,
      COUNT(CASE WHEN action = 'Remboursé' THEN 1 END) as remboursements,
      COALESCE(SUM(delestage), 0) as delestage
    FROM ria_transactions
    WHERE 1=1 ${sql.unsafe(dateCondition)}
    GROUP BY DATE(date_operation)
    ORDER BY DATE(date_operation) ASC
  `

  const data = result.map(row => ({
    date: row.date,
    transactions: Number(row.transactions),
    montant_total: Number(row.montant_total),
    montant_principal: Number(row.montant_principal),
    commissions: Number(row.commissions),
    paiements: Number(row.paiements),
    annulations: Number(row.annulations),
    remboursements: Number(row.remboursements),
    variation_transactions: 0,
    variation_montant: 0,
    delestage: Number(row.delestage)
  }))

  // Calculer les variations par rapport à la journée précédente
  for (let i = 1; i < data.length; i++) {
    const current = data[i]
    const previous = data[i - 1]
    
    // Variation en pourcentage pour les transactions
    if (previous.transactions > 0) {
      current.variation_transactions = ((current.transactions - previous.transactions) / previous.transactions) * 100
    } else {
      current.variation_transactions = current.transactions > 0 ? 100 : 0
    }
    
    // Variation en pourcentage pour le montant total
    if (previous.montant_total > 0) {
      current.variation_montant = ((current.montant_total - previous.montant_total) / previous.montant_total) * 100
    } else {
      current.variation_montant = current.montant_total > 0 ? 100 : 0
    }
  }

  return data
}

// Récupérer les données du tableau de bord RIA
export async function getDashboardData(filters?: {
  dateFrom?: string
  dateTo?: string
  agence?: string
  guichetier?: string
}): Promise<{
  // Indicateurs primaires
  montant_principal_total: number
  montant_brut: number
  total_frais: number
  remboursements: number
  versement_banque: number
  montant_a_debiter: number
  montant_en_coffre: number
  
  // Indicateurs secondaires
  commissions_ria: number
  tva_ria: number
  commissions_uba: number
  tva_uba: number
  commissions_ztf: number
  tva_ztf: number
  ca_ztf: number
  cte: number
  ttf: number
  
  // Statistiques
  nb_transactions: number
  nb_paiements: number
  nb_annulations: number
  nb_remboursements: number
  montant_moyen: number
  total_delestage: number
}> {
  let dateCondition = ""
  if (filters?.dateFrom) {
    dateCondition += ` AND DATE(date_operation) >= '${filters.dateFrom}'`
  }
  if (filters?.dateTo) {
    dateCondition += ` AND DATE(date_operation) <= '${filters.dateTo}'`
  }
  if (filters?.agence && filters.agence !== 'all') {
    dateCondition += ` AND succursale = '${filters.agence}'`
  }
  if (filters?.guichetier && filters.guichetier !== 'all') {
    dateCondition += ` AND guichetier = '${filters.guichetier}'`
  }

  const result = await sql`
    SELECT 
      -- Indicateurs primaires
      COALESCE(SUM(montant_principal), 0) as montant_principal_total,
      COALESCE(SUM(montant_brut), 0) as montant_brut,
      COALESCE(SUM(frais_client_calculated), 0) as total_frais,
      COALESCE(SUM(CASE WHEN is_remboursement THEN montant_brut ELSE 0 END), 0) as remboursements,
      -- versement_banque = montant_brut - remboursements (le délestage est déjà dans montant_brut)
      COALESCE(SUM(montant_brut) - SUM(CASE WHEN is_remboursement THEN montant_brut ELSE 0 END), 0) as versement_banque,
      COALESCE(SUM(montant_brut) - SUM(CASE WHEN is_remboursement THEN montant_brut ELSE 0 END) - 
               SUM(commission_ztf + tva_ztf + ca_ztf + cte_calculated), 0) as montant_a_debiter,
      COALESCE(SUM(commission_ztf + tva_ztf + ca_ztf + cte_calculated), 0) as montant_en_coffre,
      
      -- Indicateurs secondaires
      COALESCE(SUM(commission_ria), 0) as commissions_ria,
      COALESCE(SUM(tva_ria), 0) as tva_ria,
      COALESCE(SUM(commission_uba), 0) as commissions_uba,
      COALESCE(SUM(tva_uba), 0) as tva_uba,
      COALESCE(SUM(commission_ztf), 0) as commissions_ztf,
      COALESCE(SUM(tva_ztf), 0) as tva_ztf,
      COALESCE(SUM(ca_ztf), 0) as ca_ztf,
      COALESCE(SUM(cte_calculated), 0) as cte,
      COALESCE(SUM(ttf_calculated), 0) as ttf,
      
      -- Statistiques
      COUNT(*) as nb_transactions,
      COUNT(CASE WHEN action = 'Payé' THEN 1 END) as nb_paiements,
      COUNT(CASE WHEN action = 'Annulé' THEN 1 END) as nb_annulations,
      COUNT(CASE WHEN action = 'Remboursé' THEN 1 END) as nb_remboursements,
      COALESCE(AVG(montant_principal), 0) as montant_moyen,
      COALESCE(SUM(delestage), 0) as total_delestage
    FROM ria_transactions
    WHERE 1=1 ${sql.unsafe(dateCondition)}
  `

  return result[0] || {
    montant_principal_total: 0,
    montant_brut: 0,
    total_frais: 0,
    remboursements: 0,
    versement_banque: 0,
    montant_a_debiter: 0,
    montant_en_coffre: 0,
    commissions_ria: 0,
    tva_ria: 0,
    commissions_uba: 0,
    tva_uba: 0,
    commissions_ztf: 0,
    tva_ztf: 0,
    ca_ztf: 0,
    cte: 0,
    ttf: 0,
    nb_transactions: 0,
    nb_paiements: 0,
    nb_annulations: 0,
    nb_remboursements: 0,
    montant_moyen: 0,
    total_delestage: 0
  }
}

// Importer des transactions RIA
export async function importRiaTransactions(transactions: any[], delestages: Record<string, number> = {}): Promise<void> {
  if (transactions.length === 0) return

  // Insérer les transactions une par une pour éviter les problèmes de requête trop longue
  for (const tx of transactions) {
    try {
      await sql`
        INSERT INTO ria_transactions (
          sc_numero_transfert, pin, mode_livraison, guichetier, succursale, code_agence,
          sent_amount, sending_currency, pays_origine, pays_destination, montant_paiement,
          devise_beneficiaire, commission_sa, devise_commission_sa, date_operation, taux,
          ttf, cte, tva1, montant_a_payer, frais_client, action,
          commission_ria, tva_ria, commission_uba, tva_uba, commission_ztf, ca_ztf,
          tva_ztf, cte_calculated, ttf_calculated, montant_principal, frais_client_calculated,
          montant_brut, is_remboursement, delestage
        ) VALUES (
          ${tx.sc_numero_transfert}, ${tx.pin || null}, ${tx.mode_livraison || null}, 
          ${tx.guichetier}, ${tx.succursale}, ${tx.code_agence}, ${tx.sent_amount}, 
          ${tx.sending_currency}, ${tx.pays_origine || null}, ${tx.pays_destination || null},
          ${tx.montant_paiement || null}, ${tx.devise_beneficiaire || null}, 
          ${tx.commission_sa}, ${tx.devise_commission_sa}, ${tx.date_operation}, 
          ${tx.taux || null}, ${tx.ttf}, ${tx.cte}, ${tx.tva1}, 
          ${tx.montant_a_payer || null}, ${tx.frais_client || null}, ${tx.action},
          ${tx.commission_ria || 0}, ${tx.tva_ria || 0}, ${tx.commission_uba || 0}, 
          ${tx.tva_uba || 0}, ${tx.commission_ztf || 0}, ${tx.ca_ztf || 0}, 
          ${tx.tva_ztf || 0}, ${tx.cte_calculated || 0}, ${tx.ttf_calculated || 0}, 
          ${tx.montant_principal || 0}, ${tx.frais_client_calculated || 0}, 
          ${tx.montant_brut || 0}, ${tx.is_remboursement || false}, ${delestages[tx.guichetier] || 0}
        )
        ON CONFLICT (sc_numero_transfert) DO UPDATE SET
          pin = EXCLUDED.pin,
          mode_livraison = EXCLUDED.mode_livraison,
          guichetier = EXCLUDED.guichetier,
          succursale = EXCLUDED.succursale,
          code_agence = EXCLUDED.code_agence,
          sent_amount = EXCLUDED.sent_amount,
          sending_currency = EXCLUDED.sending_currency,
          pays_origine = EXCLUDED.pays_origine,
          pays_destination = EXCLUDED.pays_destination,
          montant_paiement = EXCLUDED.montant_paiement,
          devise_beneficiaire = EXCLUDED.devise_beneficiaire,
          commission_sa = EXCLUDED.commission_sa,
          devise_commission_sa = EXCLUDED.devise_commission_sa,
          date_operation = EXCLUDED.date_operation,
          taux = EXCLUDED.taux,
          ttf = EXCLUDED.ttf,
          cte = EXCLUDED.cte,
          tva1 = EXCLUDED.tva1,
          montant_a_payer = EXCLUDED.montant_a_payer,
          frais_client = EXCLUDED.frais_client,
          action = EXCLUDED.action,
          commission_ria = EXCLUDED.commission_ria,
          tva_ria = EXCLUDED.tva_ria,
          commission_uba = EXCLUDED.commission_uba,
          tva_uba = EXCLUDED.tva_uba,
          commission_ztf = EXCLUDED.commission_ztf,
          ca_ztf = EXCLUDED.ca_ztf,
          tva_ztf = EXCLUDED.tva_ztf,
          cte_calculated = EXCLUDED.cte_calculated,
          ttf_calculated = EXCLUDED.ttf_calculated,
          montant_principal = EXCLUDED.montant_principal,
          frais_client_calculated = EXCLUDED.frais_client_calculated,
          montant_brut = EXCLUDED.montant_brut,
          is_remboursement = EXCLUDED.is_remboursement,
          updated_at = NOW()
      `
    } catch (error) {
      console.error(`Erreur lors de l'insertion de la transaction ${tx.sc_numero_transfert}:`, error)
      throw error
    }
  }
}

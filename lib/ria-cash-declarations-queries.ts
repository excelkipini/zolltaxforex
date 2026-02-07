import "server-only"
import { sql } from "./db"
import { getUserById } from "./users-queries"

export type CashDeclarationStatus = 'pending' | 'submitted' | 'rejected' | 'validated'

export type CashDeclarationRegion = 'congo' | 'paris'

export type CashDeclaration = {
  id: string
  user_id: string
  guichetier: string
  declaration_date: string
  montant_brut: number
  total_delestage: number
  excedents: number
  delestage_comment?: string
  justificatif_file_path?: string
  justificatif_files?: Array<{
    id: string
    filename: string
    url: string
    uploaded_at: string
  }>
  status: CashDeclarationStatus
  rejection_comment?: string
  validation_comment?: string
  validated_by?: string
  validated_at?: string
  created_at: string
  updated_at: string
  submitted_at?: string
  region?: CashDeclarationRegion
  total_western_union?: number
  total_ria?: number
  total_moneygram?: number
}

export type CashDeclarationWithUser = CashDeclaration & {
  user_name: string
  user_email: string
  validator_name?: string
}

/**
 * Créer un nouvel arrêté de caisse
 */
export async function createCashDeclaration(data: {
  user_id: string
  guichetier: string
  declaration_date: string
  montant_brut: number
  total_delestage: number
  excedents: number
  delestage_comment?: string
  justificatif_file_path?: string
  justificatif_files?: Array<{
    id: string
    filename: string
    url: string
    uploaded_at: string
  }>
  autoSubmit?: boolean
  region?: CashDeclarationRegion
  total_western_union?: number
  total_ria?: number
  total_moneygram?: number
}): Promise<CashDeclaration> {
  const region = data.region || 'congo'
  const totalWu = data.total_western_union || 0
  const totalRia = data.total_ria || 0
  const totalMg = data.total_moneygram || 0

  // Si autoSubmit est true, créer directement en statut 'submitted'
  if (data.autoSubmit) {
    const [result] = await sql`
      INSERT INTO ria_cash_declarations (
        user_id, guichetier, declaration_date, montant_brut, 
        total_delestage, excedents, delestage_comment, justificatif_file_path, justificatif_files, status,
        submitted_at, region, total_western_union, total_ria, total_moneygram
      )
      VALUES (
        ${data.user_id}, ${data.guichetier}, ${data.declaration_date}, 
        ${data.montant_brut}, ${data.total_delestage}, ${data.excedents}, ${data.delestage_comment || null}, 
        ${data.justificatif_file_path || null}, ${JSON.stringify(data.justificatif_files || [])}, 'submitted',
        CURRENT_TIMESTAMP, ${region}, ${totalWu}, ${totalRia}, ${totalMg}
      )
      RETURNING *
    `
    return result
  } else {
    const [result] = await sql`
      INSERT INTO ria_cash_declarations (
        user_id, guichetier, declaration_date, montant_brut, 
        total_delestage, excedents, delestage_comment, justificatif_file_path, justificatif_files, status,
        region, total_western_union, total_ria, total_moneygram
      )
      VALUES (
        ${data.user_id}, ${data.guichetier}, ${data.declaration_date}, 
        ${data.montant_brut}, ${data.total_delestage}, ${data.excedents}, ${data.delestage_comment || null}, 
        ${data.justificatif_file_path || null}, ${JSON.stringify(data.justificatif_files || [])}, 'pending',
        ${region}, ${totalWu}, ${totalRia}, ${totalMg}
      )
      RETURNING *
    `
    return result
  }
}

/**
 * Soumettre un arrêté de caisse
 */
export async function submitCashDeclaration(id: string): Promise<CashDeclaration> {
  const [result] = await sql`
    UPDATE ria_cash_declarations
    SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `
  return result
}

/**
 * Valider un arrêté de caisse
 */
export async function validateCashDeclaration(
  id: string, 
  validator_id: string, 
  comment?: string
): Promise<CashDeclaration> {
  const [result] = await sql`
    UPDATE ria_cash_declarations
    SET status = 'validated', validated_by = ${validator_id}, 
        validated_at = CURRENT_TIMESTAMP, validation_comment = ${comment || null}
    WHERE id = ${id}
    RETURNING *
  `
  return result
}

/**
 * Rejeter un arrêté de caisse
 */
export async function rejectCashDeclaration(
  id: string, 
  validator_id: string, 
  comment: string
): Promise<CashDeclaration> {
  const [result] = await sql`
    UPDATE ria_cash_declarations
    SET status = 'rejected', validated_by = ${validator_id}, 
        validated_at = CURRENT_TIMESTAMP, rejection_comment = ${comment}
    WHERE id = ${id}
    RETURNING *
  `
  return result
}


/**
 * Récupérer un arrêté de caisse par ID
 */
export async function getCashDeclarationById(id: string): Promise<CashDeclaration | null> {
  const [result] = await sql`
    SELECT * FROM ria_cash_declarations
    WHERE id = ${id}
  `
  return result || null
}

/**
 * Récupérer les arrêtés de caisse d'un utilisateur
 */
export async function getCashDeclarationsByUser(userId: string, region?: CashDeclarationRegion): Promise<CashDeclaration[]> {
  const regionFilter = region || 'congo'
  const results = await sql`
    SELECT * FROM ria_cash_declarations
    WHERE user_id = ${userId} AND COALESCE(region, 'congo') = ${regionFilter}
    ORDER BY declaration_date DESC, created_at DESC
  `
  return results
}

/**
 * Récupérer tous les arrêtés de caisse en attente de validation
 */
export async function getPendingCashDeclarations(region?: CashDeclarationRegion): Promise<CashDeclarationWithUser[]> {
  const regionFilter = region || 'congo'
  const results = await sql`
    SELECT 
      cd.*,
      u.name as user_name,
      u.email as user_email,
      v.name as validator_name
    FROM ria_cash_declarations cd
    JOIN users u ON cd.user_id = u.id
    LEFT JOIN users v ON cd.validated_by = v.id
    WHERE cd.status = 'submitted' AND COALESCE(cd.region, 'congo') = ${regionFilter}
    ORDER BY cd.submitted_at DESC, cd.declaration_date DESC
  `
  return results
}

/**
 * Récupérer tous les arrêtés de caisse (pour le Responsable caisses)
 */
export async function getAllCashDeclarations(region?: CashDeclarationRegion): Promise<CashDeclarationWithUser[]> {
  const regionFilter = region || 'congo'
  const results = await sql`
    SELECT 
      cd.*,
      u.name as user_name,
      u.email as user_email,
      v.name as validator_name
    FROM ria_cash_declarations cd
    JOIN users u ON cd.user_id = u.id
    LEFT JOIN users v ON cd.validated_by = v.id
    WHERE COALESCE(cd.region, 'congo') = ${regionFilter}
    ORDER BY cd.declaration_date DESC, cd.created_at DESC
  `
  return results
}

/**
 * Récupérer les statistiques des arrêtés de caisse
 */
export async function getCashDeclarationsStats(userId?: string, region?: CashDeclarationRegion): Promise<{
  total_pending: number
  total_validated_today: number
  total_delestage_today: number
  total_montant_today: number
  total_submitted: number
  total_validated: number
  total_rejected: number
  total_montant_submitted: number
  total_montant_validated: number
  total_montant_rejected: number
  total_delestage: number
  total_excedents: number
  total_excedents_available?: number
}>{
  try {
    console.log('📊 getCashDeclarationsStats appelée avec userId:', userId, 'region:', region)

    const today = new Date().toISOString().split('T')[0]
    const regionFilter = region || 'congo'

    // Construire la requête avec ou sans filtre utilisateur + region
    const userFilter = userId 
      ? sql`WHERE user_id = ${userId} AND COALESCE(region, 'congo') = ${regionFilter}` 
      : sql`WHERE COALESCE(region, 'congo') = ${regionFilter}`
    console.log('📊 userFilter:', userFilter)

    // Requête complète pour la base de données réelle
    const [result] = await sql`
      SELECT
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'validated' AND DATE(validated_at) = ${today} THEN 1 END) as total_validated_today,
        COALESCE(SUM(CASE WHEN status = 'validated' AND DATE(validated_at) = ${today} THEN total_delestage ELSE 0 END), 0) as total_delestage_today,
        COALESCE(SUM(CASE WHEN status = 'validated' AND DATE(validated_at) = ${today} THEN montant_brut ELSE 0 END), 0) as total_montant_today,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as total_submitted,
        COUNT(CASE WHEN status = 'validated' THEN 1 END) as total_validated,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as total_rejected,
        COALESCE(SUM(CASE WHEN status = 'submitted' THEN montant_brut ELSE 0 END), 0) as total_montant_submitted,
        COALESCE(SUM(CASE WHEN status = 'validated' THEN montant_brut ELSE 0 END), 0) as total_montant_validated,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN montant_brut ELSE 0 END), 0) as total_montant_rejected,
        COALESCE(SUM(total_delestage), 0) as total_delestage,
        COALESCE(SUM(COALESCE(excedents, 0)), 0) as total_excedents
      FROM ria_cash_declarations
      ${userFilter}
    `

    console.log('📊 Résultat de la requête:', result)

    // Calculer les excédents disponibles (déclarés - dépenses approuvées déduites)
    let total_excedents_available: number | undefined = undefined
    if (userId) {
      const [ex] = await sql`
        WITH declared AS (
          SELECT COALESCE(SUM(COALESCE(excedents,0)),0) AS total_declared
          FROM ria_cash_declarations
          WHERE user_id = ${userId} AND COALESCE(region, 'congo') = ${regionFilter}
        ),
        deducted AS (
          SELECT COALESCE(SUM(amount),0) AS total_deducted
          FROM expenses
          WHERE deduct_from_excedents = true
            AND deducted_cashier_id = ${userId}
            AND status IN ('accounting_approved','director_approved')
        )
        SELECT (COALESCE(d.total_declared,0) - COALESCE(x.total_deducted,0))::bigint AS available
        FROM declared d, deducted x
      `
      total_excedents_available = Number(ex?.available || 0)
    } else {
      // Global: somme des excédents disponibles de tous les caissiers
      const [ex] = await sql`
        WITH per_user AS (
          WITH declared AS (
            SELECT user_id, COALESCE(SUM(COALESCE(excedents,0)),0) AS total_declared
            FROM ria_cash_declarations
            WHERE COALESCE(region, 'congo') = ${regionFilter}
            GROUP BY user_id
          ),
          deducted AS (
            SELECT deducted_cashier_id AS user_id, COALESCE(SUM(amount),0) AS total_deducted
            FROM expenses
            WHERE deduct_from_excedents = true
              AND deducted_cashier_id IS NOT NULL
              AND status IN ('accounting_approved','director_approved')
            GROUP BY deducted_cashier_id
          )
          SELECT COALESCE(d.total_declared,0) - COALESCE(x.total_deducted,0) AS available
          FROM declared d
          LEFT JOIN deducted x ON x.user_id = d.user_id
        )
        SELECT COALESCE(SUM(available),0)::bigint AS available FROM per_user
      `
      total_excedents_available = Number(ex?.available || 0)
    }

    return {
      total_pending: Number(result.total_pending) || 0,
      total_validated_today: Number(result.total_validated_today) || 0,
      total_delestage_today: Number(result.total_delestage_today) || 0,
      total_montant_today: Number(result.total_montant_today) || 0,
      total_submitted: Number(result.total_submitted) || 0,
      total_validated: Number(result.total_validated) || 0,
      total_rejected: Number(result.total_rejected) || 0,
      total_montant_submitted: Number(result.total_montant_submitted) || 0,
      total_montant_validated: Number(result.total_montant_validated) || 0,
      total_montant_rejected: Number(result.total_montant_rejected) || 0,
      total_delestage: Number(result.total_delestage) || 0,
      total_excedents: Number(result.total_excedents) || 0,
      total_excedents_available,
    }
  } catch (error) {
    console.error('❌ Erreur dans getCashDeclarationsStats:', error)
    throw error
  }
}


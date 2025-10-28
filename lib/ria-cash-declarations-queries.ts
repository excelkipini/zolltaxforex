import "server-only"
import { sql } from "./db"
import { getUserById } from "./users-queries"

export type CashDeclarationStatus = 'pending' | 'submitted' | 'rejected' | 'validated'

export type CashDeclaration = {
  id: string
  user_id: string
  guichetier: string
  declaration_date: string
  montant_brut: number
  total_delestage: number
  delestage_comment?: string
  justificatif_file_path?: string
  status: CashDeclarationStatus
  rejection_comment?: string
  validation_comment?: string
  validated_by?: string
  validated_at?: string
  created_at: string
  updated_at: string
  submitted_at?: string
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
  delestage_comment?: string
  justificatif_file_path?: string
  autoSubmit?: boolean
}): Promise<CashDeclaration> {
  // Si autoSubmit est true, créer directement en statut 'submitted'
  if (data.autoSubmit) {
    const [result] = await sql`
      INSERT INTO ria_cash_declarations (
        user_id, guichetier, declaration_date, montant_brut, 
        total_delestage, delestage_comment, justificatif_file_path, status,
        submitted_at
      )
      VALUES (
        ${data.user_id}, ${data.guichetier}, ${data.declaration_date}, 
        ${data.montant_brut}, ${data.total_delestage}, ${data.delestage_comment || null}, 
        ${data.justificatif_file_path || null}, 'submitted',
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `
    return result
  } else {
    const [result] = await sql`
      INSERT INTO ria_cash_declarations (
        user_id, guichetier, declaration_date, montant_brut, 
        total_delestage, delestage_comment, justificatif_file_path, status
      )
      VALUES (
        ${data.user_id}, ${data.guichetier}, ${data.declaration_date}, 
        ${data.montant_brut}, ${data.total_delestage}, ${data.delestage_comment || null}, 
        ${data.justificatif_file_path || null}, 'pending'
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
export async function getCashDeclarationsByUser(userId: string): Promise<CashDeclaration[]> {
  const results = await sql`
    SELECT * FROM ria_cash_declarations
    WHERE user_id = ${userId}
    ORDER BY declaration_date DESC, created_at DESC
  `
  return results
}

/**
 * Récupérer tous les arrêtés de caisse en attente de validation
 */
export async function getPendingCashDeclarations(): Promise<CashDeclarationWithUser[]> {
  const results = await sql`
    SELECT 
      cd.*,
      u.name as user_name,
      u.email as user_email,
      v.name as validator_name
    FROM ria_cash_declarations cd
    JOIN users u ON cd.user_id = u.id
    LEFT JOIN users v ON cd.validated_by = v.id
    WHERE cd.status = 'submitted'
    ORDER BY cd.submitted_at DESC, cd.declaration_date DESC
  `
  return results
}

/**
 * Récupérer tous les arrêtés de caisse (pour le Responsable caisses)
 */
export async function getAllCashDeclarations(): Promise<CashDeclarationWithUser[]> {
  const results = await sql`
    SELECT 
      cd.*,
      u.name as user_name,
      u.email as user_email,
      v.name as validator_name
    FROM ria_cash_declarations cd
    JOIN users u ON cd.user_id = u.id
    LEFT JOIN users v ON cd.validated_by = v.id
    ORDER BY cd.declaration_date DESC, cd.created_at DESC
  `
  return results
}

/**
 * Récupérer les statistiques des arrêtés de caisse
 */
export async function getCashDeclarationsStats(userId?: string): Promise<{
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
}> {
  const today = new Date().toISOString().split('T')[0]
  
  // Construire la requête avec ou sans filtre utilisateur
  const userFilter = userId ? sql`WHERE user_id = ${userId}` : sql``
  
  const [result] = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'submitted') as total_pending,
      COUNT(*) FILTER (WHERE status = 'validated' AND declaration_date = ${today}) as total_validated_today,
      COALESCE(SUM(total_delestage) FILTER (WHERE declaration_date = ${today}), 0) as total_delestage_today,
      COALESCE(SUM(montant_brut) FILTER (WHERE declaration_date = ${today} AND status = 'validated'), 0) as total_montant_today,
      COUNT(*) FILTER (WHERE status = 'submitted') as total_submitted,
      COUNT(*) FILTER (WHERE status = 'validated') as total_validated,
      COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
      COALESCE(SUM(montant_brut) FILTER (WHERE status = 'submitted'), 0) as total_montant_submitted,
      COALESCE(SUM(montant_brut) FILTER (WHERE status = 'validated'), 0) as total_montant_validated,
      COALESCE(SUM(montant_brut) FILTER (WHERE status = 'rejected'), 0) as total_montant_rejected,
      COALESCE(SUM(total_delestage), 0) as total_delestage
    FROM ria_cash_declarations
    ${userFilter}
  `
  
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
  }
}


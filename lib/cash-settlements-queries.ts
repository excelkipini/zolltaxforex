import { sql } from "@neondatabase/serverless"
import { createTransaction } from "./transactions-queries"

export type CashSettlement = {
  id: string
  settlement_number: string
  cashier_id: string
  cashier_name: string
  settlement_date: string
  total_transactions_amount: number
  unloading_amount: number
  unloading_reason?: string
  final_amount: number
  received_amount?: number
  status: 'pending' | 'validated' | 'rejected' | 'exception'
  validation_notes?: string
  exception_reason?: string
  rejection_reason?: string
  validated_by?: string
  validated_by_name?: string
  validated_at?: string
  operation_report_file_path?: string
  operation_report_file_name?: string
  created_at: string
  updated_at: string
}

export type CashUnloading = {
  id: string
  settlement_id: string
  amount: number
  reason: string
  created_by: string
  created_at: string
}

// Créer un nouvel arrêté de caisse
export async function createCashSettlement(data: {
  cashier_id: string
  cashier_name: string
  settlement_date: string
  total_transactions_amount: number
  unloading_amount?: number
  unloading_reason?: string
  operation_report_file_path?: string
  operation_report_file_name?: string
}): Promise<CashSettlement> {
  const finalAmount = data.total_transactions_amount - (data.unloading_amount || 0)
  
  const result = await sql<CashSettlement[]>`
    INSERT INTO cash_settlements (
      settlement_number,
      cashier_id,
      cashier_name,
      settlement_date,
      total_transactions_amount,
      unloading_amount,
      unloading_reason,
      final_amount,
      operation_report_file_path,
      operation_report_file_name
    )
    VALUES (
      generate_settlement_number(),
      ${data.cashier_id},
      ${data.cashier_name},
      ${data.settlement_date},
      ${data.total_transactions_amount},
      ${data.unloading_amount || 0},
      ${data.unloading_reason || null},
      ${finalAmount},
      ${data.operation_report_file_path || null},
      ${data.operation_report_file_name || null}
    )
    RETURNING *
  `
  
  return result[0]
}

// Ajouter un délestage à un arrêté
export async function addUnloadingToSettlement(
  settlementId: string,
  amount: number,
  reason: string,
  createdBy: string
): Promise<CashUnloading> {
  const result = await sql<CashUnloading[]>`
    INSERT INTO cash_unloadings (settlement_id, amount, reason, created_by)
    VALUES (${settlementId}, ${amount}, ${reason}, ${createdBy})
    RETURNING *
  `
  
  // Mettre à jour le montant total de délestage dans l'arrêté
  await sql`
    UPDATE cash_settlements 
    SET 
      unloading_amount = unloading_amount + ${amount},
      final_amount = total_transactions_amount - (unloading_amount + ${amount}),
      updated_at = NOW()
    WHERE id = ${settlementId}
  `
  
  return result[0]
}

// Valider un arrêté de caisse
export async function validateCashSettlement(
  settlementId: string,
  receivedAmount: number,
  validatedBy: string,
  validatedByName: string,
  validationNotes?: string,
  exceptionReason?: string
): Promise<CashSettlement> {
  const settlement = await sql<CashSettlement[]>`
    SELECT * FROM cash_settlements WHERE id = ${settlementId}
  `
  
  if (settlement.length === 0) {
    throw new Error("Arrêté de caisse non trouvé")
  }
  
  const settlementData = settlement[0]
  let status: 'validated' | 'exception' = 'validated'
  
  // Vérifier si le montant reçu correspond au montant final
  if (Math.abs(receivedAmount - settlementData.final_amount) > 0.01) {
    if (!exceptionReason) {
      throw new Error("Le montant reçu ne correspond pas au montant final. Une raison d'exception est requise.")
    }
    status = 'exception'
  }
  
  const result = await sql<CashSettlement[]>`
    UPDATE cash_settlements 
    SET 
      received_amount = ${receivedAmount},
      status = ${status},
      validation_notes = ${validationNotes || null},
      exception_reason = ${exceptionReason || null},
      validated_by = ${validatedBy},
      validated_by_name = ${validatedByName},
      validated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${settlementId}
    RETURNING *
  `

  const validatedSettlement = result[0]

  // Créer une transaction d'arrêté de caisse dans l'onglet Opérations
  try {
    await createTransaction({
      type: 'settlement',
      description: `Arrêté de caisse ${validatedSettlement.settlement_number} - ${status === 'exception' ? 'Validé avec exception' : 'Validé'}`,
      amount: validatedSettlement.final_amount,
      currency: 'XAF',
      created_by: validatedBy,
      agency: 'Système',
      details: {
        settlement_id: validatedSettlement.id,
        settlement_number: validatedSettlement.settlement_number,
        cashier_name: validatedSettlement.cashier_name,
        settlement_date: validatedSettlement.settlement_date,
        total_transactions_amount: validatedSettlement.total_transactions_amount,
        unloading_amount: validatedSettlement.unloading_amount,
        validation_notes: validatedSettlement.validation_notes,
        exception_reason: validatedSettlement.exception_reason
      }
    })
  } catch (error) {
    console.error('Erreur lors de la création de la transaction d\'arrêté:', error)
    // Ne pas faire échouer la validation si la création de transaction échoue
  }

  return validatedSettlement
}

// Rejeter un arrêté de caisse
export async function rejectCashSettlement(
  settlementId: string,
  rejectionReason: string,
  rejectedBy: string,
  rejectedByName: string
): Promise<CashSettlement> {
  const result = await sql<CashSettlement[]>`
    UPDATE cash_settlements 
    SET 
      status = 'rejected',
      rejection_reason = ${rejectionReason},
      validated_by = ${rejectedBy},
      validated_by_name = ${rejectedByName},
      validated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${settlementId}
    RETURNING *
  `

  const rejectedSettlement = result[0]

  // Créer une transaction d'arrêté de caisse rejeté dans l'onglet Opérations
  try {
    await createTransaction({
      type: 'settlement',
      description: `Arrêté de caisse ${rejectedSettlement.settlement_number} - Rejeté`,
      amount: rejectedSettlement.final_amount,
      currency: 'XAF',
      created_by: rejectedBy,
      agency: 'Système',
      details: {
        settlement_id: rejectedSettlement.id,
        settlement_number: rejectedSettlement.settlement_number,
        cashier_name: rejectedSettlement.cashier_name,
        settlement_date: rejectedSettlement.settlement_date,
        total_transactions_amount: rejectedSettlement.total_transactions_amount,
        unloading_amount: rejectedSettlement.unloading_amount,
        rejection_reason: rejectedSettlement.rejection_reason
      }
    })
  } catch (error) {
    console.error('Erreur lors de la création de la transaction d\'arrêté rejeté:', error)
    // Ne pas faire échouer le rejet si la création de transaction échoue
  }

  return rejectedSettlement
}

// Obtenir les arrêtés de caisse d'un caissier
export async function getCashierSettlements(cashierId: string): Promise<CashSettlement[]> {
  const result = await sql<CashSettlement[]>`
    SELECT * FROM cash_settlements 
    WHERE cashier_id = ${cashierId}
    ORDER BY settlement_date DESC, created_at DESC
  `
  
  return result
}

// Obtenir tous les arrêtés de caisse (pour les gestionnaires, directeurs, etc.)
export async function getAllCashSettlements(): Promise<CashSettlement[]> {
  const result = await sql<CashSettlement[]>`
    SELECT * FROM cash_settlements 
    ORDER BY settlement_date DESC, created_at DESC
  `
  
  return result
}

// Obtenir les arrêtés en attente de validation
export async function getPendingCashSettlements(): Promise<CashSettlement[]> {
  const result = await sql<CashSettlement[]>`
    SELECT * FROM cash_settlements 
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `
  
  return result
}

// Obtenir un arrêté par son ID
export async function getCashSettlementById(settlementId: string): Promise<CashSettlement | null> {
  const result = await sql<CashSettlement[]>`
    SELECT * FROM cash_settlements WHERE id = ${settlementId}
  `
  
  return result[0] || null
}

// Obtenir les délestages d'un arrêté
export async function getSettlementUnloadings(settlementId: string): Promise<CashUnloading[]> {
  const result = await sql<CashUnloading[]>`
    SELECT * FROM cash_unloadings 
    WHERE settlement_id = ${settlementId}
    ORDER BY created_at ASC
  `
  
  return result
}

// Statistiques des arrêtés de caisse
export async function getCashSettlementStats() {
  const result = await sql`
    SELECT 
      COUNT(*) as total_settlements,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_settlements,
      COUNT(CASE WHEN status = 'validated' THEN 1 END) as validated_settlements,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_settlements,
      COUNT(CASE WHEN status = 'exception' THEN 1 END) as exception_settlements,
      COALESCE(SUM(CASE WHEN status = 'validated' THEN final_amount END), 0) as total_validated_amount,
      COALESCE(SUM(CASE WHEN status = 'exception' THEN final_amount END), 0) as total_exception_amount
    FROM cash_settlements
  `
  
  return result[0]
}

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { 
  getCashSettlementById,
  validateCashSettlement,
  rejectCashSettlement,
  addUnloadingToSettlement,
  getSettlementUnloadings
} from "@/lib/cash-settlements-queries"
import { sendSettlementEmail } from "@/lib/email-service"
import { getUserById } from "@/lib/users-queries"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth()
    
    if (!hasPermission(user, "view_cash_settlements")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'unloadings':
        const unloadings = await getSettlementUnloadings(params.id)
        return NextResponse.json({ unloadings })

      default:
        const settlement = await getCashSettlementById(params.id)
        if (!settlement) {
          return NextResponse.json({ error: "Arrêté non trouvé" }, { status: 404 })
        }
        
        // Vérifier que l'utilisateur peut voir cet arrêté
        if (user.role === 'cashier' && settlement.cashier_id !== user.id) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }
        
        return NextResponse.json({ settlement })
    }
  } catch (error: any) {
    console.error('Erreur GET cash-settlements/[id]:', error)
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth()
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'validate':
        if (!hasPermission(user, "validate_cash_settlements")) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }

        const settlement = await getCashSettlementById(params.id)
        if (!settlement) {
          return NextResponse.json({ error: "Arrêté non trouvé" }, { status: 404 })
        }

        if (settlement.status !== 'pending') {
          return NextResponse.json({ error: "Cet arrêté a déjà été traité" }, { status: 400 })
        }

        const validatedSettlement = await validateCashSettlement(
          params.id,
          body.received_amount,
          user.id,
          user.name,
          body.validation_notes,
          body.exception_reason
        )

        // Envoyer les notifications par email
        try {
          const cashier = await getUserById(validatedSettlement.cashier_id)
          const emailData = {
            settlementId: validatedSettlement.id,
            settlementNumber: validatedSettlement.settlement_number,
            cashierId: validatedSettlement.cashier_id,
            cashierName: validatedSettlement.cashier_name,
            settlementDate: validatedSettlement.settlement_date,
            totalTransactionsAmount: validatedSettlement.total_transactions_amount,
            unloadingAmount: validatedSettlement.unloading_amount,
            unloadingReason: validatedSettlement.unloading_reason,
            finalAmount: validatedSettlement.final_amount,
            receivedAmount: validatedSettlement.received_amount,
            status: validatedSettlement.status,
            validationNotes: validatedSettlement.validation_notes,
            exceptionReason: validatedSettlement.exception_reason,
            rejectionReason: validatedSettlement.rejection_reason,
            validatedBy: validatedSettlement.validated_by,
            validatedByName: validatedSettlement.validated_by_name,
            validatedAt: validatedSettlement.validated_at
          }

          if (validatedSettlement.status === 'exception') {
            await sendSettlementEmail('settlement_exception', emailData, cashier?.email)
          } else if (validatedSettlement.status === 'validated') {
            await sendSettlementEmail('settlement_validated', emailData, cashier?.email)
          }
        } catch (emailError) {
          console.error('Erreur lors de l\'envoi de l\'email:', emailError)
          // Ne pas faire échouer la validation si l'email échoue
        }

        return NextResponse.json({ 
          success: true, 
          settlement: validatedSettlement,
          message: "Arrêté validé avec succès" 
        })

      case 'reject':
        if (!hasPermission(user, "validate_cash_settlements")) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }

        const settlementToReject = await getCashSettlementById(params.id)
        if (!settlementToReject) {
          return NextResponse.json({ error: "Arrêté non trouvé" }, { status: 404 })
        }

        if (settlementToReject.status !== 'pending') {
          return NextResponse.json({ error: "Cet arrêté a déjà été traité" }, { status: 400 })
        }

        const rejectedSettlement = await rejectCashSettlement(
          params.id,
          body.rejection_reason,
          user.id,
          user.name
        )

        // Envoyer les notifications par email
        try {
          const cashier = await getUserById(rejectedSettlement.cashier_id)
          const emailData = {
            settlementId: rejectedSettlement.id,
            settlementNumber: rejectedSettlement.settlement_number,
            cashierId: rejectedSettlement.cashier_id,
            cashierName: rejectedSettlement.cashier_name,
            settlementDate: rejectedSettlement.settlement_date,
            totalTransactionsAmount: rejectedSettlement.total_transactions_amount,
            unloadingAmount: rejectedSettlement.unloading_amount,
            unloadingReason: rejectedSettlement.unloading_reason,
            finalAmount: rejectedSettlement.final_amount,
            receivedAmount: rejectedSettlement.received_amount,
            status: rejectedSettlement.status,
            validationNotes: rejectedSettlement.validation_notes,
            exceptionReason: rejectedSettlement.exception_reason,
            rejectionReason: rejectedSettlement.rejection_reason,
            validatedBy: rejectedSettlement.validated_by,
            validatedByName: rejectedSettlement.validated_by_name,
            validatedAt: rejectedSettlement.validated_at
          }

          await sendSettlementEmail('settlement_rejected', emailData, cashier?.email)
        } catch (emailError) {
          console.error('Erreur lors de l\'envoi de l\'email:', emailError)
          // Ne pas faire échouer le rejet si l'email échoue
        }

        return NextResponse.json({ 
          success: true, 
          settlement: rejectedSettlement,
          message: "Arrêté rejeté" 
        })

      case 'unloading':
        if (!hasPermission(user, "edit_cash_settlements")) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }

        const settlementForUnloading = await getCashSettlementById(params.id)
        if (!settlementForUnloading) {
          return NextResponse.json({ error: "Arrêté non trouvé" }, { status: 404 })
        }

        // Vérifier que seul le caissier qui a créé l'arrêté peut ajouter des délestages
        if (user.role === 'cashier' && settlementForUnloading.cashier_id !== user.id) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }

        const unloading = await addUnloadingToSettlement(
          params.id,
          body.amount,
          body.reason,
          user.id
        )

        return NextResponse.json({ 
          success: true, 
          unloading,
          message: "Délestage ajouté avec succès" 
        })

      default:
        return NextResponse.json({ error: "Action non reconnue" }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Erreur POST cash-settlements/[id]:', error)
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
  }
}

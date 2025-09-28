import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user } = await requireAuth()
  
  try {
    const transactionId = params.id

    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "ID de transaction requis" }, { status: 400 })
    }

    // Vérifier que la transaction existe
    const existingTransaction = await sql`
      SELECT id, type, status, created_by, agency, delete_validated_by, delete_validated_at
      FROM transactions 
      WHERE id = ${transactionId}
    `

    if (existingTransaction.length === 0) {
      return NextResponse.json({ ok: false, error: "Transaction non trouvée" }, { status: 404 })
    }

    const transaction = existingTransaction[0]

    // Vérifier les permissions - seuls les caissiers peuvent demander la suppression
    if (user.role !== "cashier") {
      return NextResponse.json({ 
        ok: false, 
        error: "Seuls les caissiers peuvent demander la suppression de transactions" 
      }, { status: 403 })
    }

    // Vérifier que le caissier peut supprimer cette transaction
    if (transaction.created_by !== user.name) {
      return NextResponse.json({ 
        ok: false, 
        error: "Vous ne pouvez demander la suppression que de vos propres transactions" 
      }, { status: 403 })
    }

    // Vérifier que la transaction est terminée
    if (transaction.status !== "completed") {
      return NextResponse.json({ 
        ok: false, 
        error: "Seules les transactions terminées peuvent être supprimées" 
      }, { status: 400 })
    }

    // Passer à "pending_delete" pour demander la suppression
    await sql`
      UPDATE transactions 
      SET status = 'pending_delete', updated_at = NOW()
      WHERE id = ${transactionId}
    `

    return NextResponse.json({ 
      ok: true, 
      message: `Demande de suppression de la transaction ${transactionId} envoyée`,
      status: "pending_delete"
    })

  } catch (error: any) {
    console.error('Erreur lors de la suppression:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}

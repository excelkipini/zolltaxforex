import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(
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

    // Vérifier que c'est un comptable ou un membre de la direction
    if (user.role !== "accounting" && user.role !== "director" && user.role !== "delegate") {
      return NextResponse.json({ 
        ok: false, 
        error: "Seuls les comptables et la direction peuvent valider les suppressions" 
      }, { status: 403 })
    }

    // Vérifier que c'est une transaction en attente de suppression
    if (transaction.status !== "pending_delete") {
      return NextResponse.json({ 
        ok: false, 
        error: "Seules les transactions en attente de suppression peuvent être validées" 
      }, { status: 400 })
    }

    // Vérifier si déjà validé
    if (transaction.delete_validated_by) {
      return NextResponse.json({ 
        ok: false, 
        error: "Cette suppression a déjà été validée" 
      }, { status: 400 })
    }

    // Supprimer directement la transaction
    await sql`
      DELETE FROM transactions 
      WHERE id = ${transactionId}
    `

    const roleLabel = user.role === "accounting" ? "le comptable" : "la direction"

    return NextResponse.json({ 
      ok: true, 
      message: `Transaction ${transactionId} supprimée par ${roleLabel}`,
      deletedBy: user.name,
      deletedAt: new Date().toISOString(),
      transaction: {
        id: transaction.id,
        type: transaction.type,
        status: "deleted"
      }
    })

  } catch (error: any) {
    console.error('Erreur lors de la validation:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { validateExpenseByAccounting, validateExpenseByDirector } from "@/lib/expenses-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  try {
    const body = await request.json()
    const { expenseId, approved, rejectionReason, validationType } = body

    if (!expenseId || typeof approved !== 'boolean' || !validationType) {
      return NextResponse.json({ 
        ok: false, 
        error: "Paramètres manquants: expenseId, approved, validationType requis" 
      }, { status: 400 })
    }

    let result

    if (validationType === 'accounting') {
      // Seuls les comptables peuvent valider au niveau comptable
      if (user.role !== 'accounting') {
        return NextResponse.json({ ok: false, error: "Seuls les comptables peuvent valider au niveau comptable" }, { status: 403 })
      }
      
      result = await validateExpenseByAccounting(
        expenseId,
        approved,
        user.name,
        rejectionReason
      )
    } else if (validationType === 'director') {
      // Seuls les directeurs peuvent valider au niveau directeur
      if (user.role !== 'director') {
        return NextResponse.json({ ok: false, error: "Seuls les directeurs peuvent valider au niveau directeur" }, { status: 403 })
      }
      
      result = await validateExpenseByDirector(
        expenseId,
        approved,
        user.name,
        rejectionReason
      )
    } else {
      return NextResponse.json({ 
        ok: false, 
        error: "Type de validation invalide. Utilisez 'accounting' ou 'director'" 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      ok: true, 
      data: result,
      message: `Dépense ${approved ? 'approuvée' : 'rejetée'} avec succès`
    })

  } catch (error: any) {
    console.error('Erreur lors de la validation de la dépense:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur lors de la validation de la dépense" 
    }, { status: 500 })
  }
}

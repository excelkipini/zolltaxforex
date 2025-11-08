import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logCardsAction } from "@/lib/cards-history"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et super admins peuvent réinitialiser l'usage
  if (!user || !["director", "delegate", "super_admin"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Non autorisé - Seuls les directeurs et super admins peuvent réinitialiser l'usage des cartes" }, { status: 403 })
  }

  try {
    // Réinitialiser l'usage mensuel de toutes les cartes actives à 0
    const result = await sql`
      UPDATE cards
      SET 
        monthly_used = 0,
        updated_at = NOW()
      WHERE status = 'active'
    `

    const updatedCount = result.count || 0

    // Enregistrer l'action dans l'historique
    await logCardsAction({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_type: 'reset_usage',
      action_description: `Réinitialisation de l'usage de ${updatedCount} cartes actives`,
      metadata: {
        updated_count: updatedCount,
        reset_at: new Date().toISOString()
      }
    })

    console.log(`🔄 Réinitialisation de l'usage des cartes:`)
    console.log(`   - Cartes réinitialisées: ${updatedCount}`)
    console.log(`   - Réinitialisé par: ${user.name}`)

    return NextResponse.json({ 
      ok: true, 
      message: `Usage réinitialisé avec succès pour ${updatedCount} carte(s)`,
      data: {
        updated_count: updatedCount,
        reset_by: user.name,
        reset_at: new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error('❌ Erreur lors de la réinitialisation de l\'usage:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}


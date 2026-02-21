import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logCardsAction } from "@/lib/cards-history"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()

  const canCancel = user.role === "director" || user.role === "delegate" || user.role === "super_admin"

  if (!canCancel) {
    return NextResponse.json(
      { ok: false, error: "Seuls les directeurs et super admins peuvent annuler une distribution" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { actionId } = body

    if (!actionId) {
      return NextResponse.json(
        { ok: false, error: "ID de l'action requis" },
        { status: 400 }
      )
    }

    // 1. Récupérer l'action de distribution
    const [action] = await sql`
      SELECT id, action_description, new_values, metadata, created_at
      FROM cards_action_history
      WHERE id = ${actionId}::uuid
        AND action_type = 'distribute'
    `

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Distribution non trouvée" },
        { status: 404 }
      )
    }

    if (action.action_description?.startsWith("[ANNULÉE]")) {
      return NextResponse.json(
        { ok: false, error: "Cette distribution a déjà été annulée" },
        { status: 400 }
      )
    }

    const metadata = typeof action.metadata === "string"
      ? JSON.parse(action.metadata)
      : action.metadata
    const newValues = typeof action.new_values === "string"
      ? JSON.parse(action.new_values)
      : action.new_values

    const distributions: Array<{ card_cid: string; amount: number }> =
      metadata?.distributions || []

    if (distributions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucune donnée de distribution trouvée dans les métadonnées" },
        { status: 400 }
      )
    }

    // 2. Reverser monthly_used pour chaque carte
    let cardsUpdated = 0
    let totalReversed = 0
    const errors: string[] = []

    for (const dist of distributions) {
      try {
        const result = await sql`
          UPDATE cards
          SET monthly_used = GREATEST(0, monthly_used - ${dist.amount}),
              updated_at = NOW()
          WHERE cid = ${dist.card_cid}
          RETURNING cid
        `
        if (result.length > 0) {
          cardsUpdated++
          totalReversed += dist.amount
        } else {
          errors.push(`Carte non trouvée: ${dist.card_cid}`)
        }
      } catch (err: any) {
        errors.push(`Erreur carte ${dist.card_cid}: ${err.message}`)
      }
    }

    // 3. Supprimer les card_recharges correspondantes
    const distDate = new Date(action.created_at)
    const dateMin = new Date(distDate.getTime() - 5000).toISOString()
    const dateMax = new Date(distDate.getTime() + 5000).toISOString()

    const deletedRecharges = await sql`
      DELETE FROM card_recharges
      WHERE notes = 'Distribution en masse'
        AND created_at >= ${dateMin}::timestamptz
        AND created_at <= ${dateMax}::timestamptz
      RETURNING id
    `

    // 4. Restaurer last_recharge_date pour chaque carte
    for (const dist of distributions) {
      try {
        const lastRecharge = await sql`
          SELECT cr.recharge_date
          FROM card_recharges cr
          JOIN cards c ON cr.card_id = c.id
          WHERE c.cid = ${dist.card_cid}
          ORDER BY cr.recharge_date DESC
          LIMIT 1
        `

        if (lastRecharge.length > 0) {
          await sql`
            UPDATE cards SET last_recharge_date = ${lastRecharge[0].recharge_date}::date
            WHERE cid = ${dist.card_cid}
          `
        } else {
          await sql`
            UPDATE cards SET last_recharge_date = NULL
            WHERE cid = ${dist.card_cid}
          `
        }
      } catch {
        // Non critique
      }
    }

    // 5. Marquer l'action originale comme annulée
    await sql`
      UPDATE cards_action_history
      SET action_description = '[ANNULÉE] ' || action_description
      WHERE id = ${actionId}::uuid
        AND action_description NOT LIKE '[ANNULÉE]%'
    `

    // 6. Logger l'annulation dans l'historique
    await logCardsAction({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_type: "distribute",
      action_description: `ANNULATION de la distribution de ${totalReversed.toLocaleString()} XAF sur ${cardsUpdated} cartes (${newValues?.country || "N/A"})`,
      new_values: {
        action: "cancellation",
        original_action_id: actionId,
        total_reversed: totalReversed,
        cards_reversed: cardsUpdated,
        recharges_deleted: deletedRecharges.length,
      },
      metadata: {
        cancelled_action_id: actionId,
        cancelled_at: new Date().toISOString(),
        total_reversed: totalReversed,
        cards_reversed: cardsUpdated,
        recharges_deleted: deletedRecharges.length,
        cancelled_by: user.name,
        errors: errors.length > 0 ? errors : undefined,
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Distribution annulée avec succès`,
      data: {
        cards_updated: cardsUpdated,
        total_reversed: totalReversed,
        recharges_deleted: deletedRecharges.length,
        errors,
      },
    })
  } catch (error: any) {
    console.error("Erreur lors de l'annulation de la distribution:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

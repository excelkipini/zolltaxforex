import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getCardsActionHistory, getCardsActionHistoryStats, getCardsActionHistoryUsers } from "@/lib/cards-history"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, super admins et comptables peuvent consulter l'historique
  const canViewHistory = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canViewHistory) {
    return NextResponse.json({ ok: false, error: "Non autorisé - Seuls les directeurs, super admins et comptables peuvent consulter l'historique" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Paramètres de pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Paramètres de filtrage
    const action_type = searchParams.get('action_type') === 'all' ? undefined : searchParams.get('action_type') || undefined
    const user_id = searchParams.get('user_id') || undefined
    const target_card_id = searchParams.get('target_card_id') || undefined
    const date_from = searchParams.get('date_from') ? new Date(searchParams.get('date_from')!) : undefined
    const date_to = searchParams.get('date_to') ? new Date(searchParams.get('date_to')!) : undefined
    
    // Type de requête
    const type = searchParams.get('type') || 'list'
    const exportCsv = searchParams.get('export') === 'true'
    
    if (type === 'stats') {
      // Récupérer les statistiques
      const stats = await getCardsActionHistoryStats()
      
      return NextResponse.json({ 
        ok: true, 
        data: stats
      })
    } else if (type === 'users') {
      // Récupérer la liste des utilisateurs pour le filtre
      const users = await getCardsActionHistoryUsers()
      
      return NextResponse.json({ 
        ok: true, 
        data: users
      })
    } else {
      // Récupérer la liste des actions
      const result = await getCardsActionHistory({
        limit: exportCsv ? undefined : limit, // Pas de limite pour l'export
        offset: exportCsv ? undefined : offset, // Pas d'offset pour l'export
        action_type,
        user_id,
        target_card_id,
        date_from,
        date_to
      })
      
      if (exportCsv) {
        // Générer le CSV
        const csvHeaders = [
          'ID',
          'Utilisateur',
          'Rôle',
          'Type d\'Action',
          'Description',
          'Carte CID',
          'Date',
          'Notes'
        ].join(',')
        
        const csvRows = result.actions.map(action => {
          const notes = action.new_values?.notes || action.metadata?.notes || ''
          return [
            action.id,
            `"${action.user_name}"`,
            `"${action.user_role}"`,
            `"${action.action_type}"`,
            `"${action.action_description}"`,
            `"${action.target_card_cid || ''}"`,
            `"${action.created_at}"`,
            `"${notes}"`
          ].join(',')
        })
        
        const csvContent = [csvHeaders, ...csvRows].join('\n')
        
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="historique-actions-cartes.csv"'
          }
        })
      } else {
        return NextResponse.json({ 
          ok: true, 
          data: {
            actions: result.actions,
            pagination: {
              page,
              limit,
              total: result.total,
              total_pages: Math.ceil(result.total / limit)
            }
          }
        })
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération de l\'historique:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}

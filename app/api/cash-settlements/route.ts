import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { 
  createCashSettlement, 
  getAllCashSettlements, 
  getCashierSettlements, 
  getPendingCashSettlements,
  getCashSettlementById,
  validateCashSettlement,
  rejectCashSettlement,
  addUnloadingToSettlement,
  getSettlementUnloadings,
  getCashSettlementStats
} from "@/lib/cash-settlements-queries"

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    if (!hasPermission(user, "view_cash_settlements")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = await getCashSettlementStats()
        return NextResponse.json({ stats })

      case 'pending':
        if (!hasPermission(user, "validate_cash_settlements")) {
          return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
        }
        const pendingSettlements = await getPendingCashSettlements()
        return NextResponse.json({ settlements: pendingSettlements })

      default:
        // Récupérer les arrêtés selon le rôle
        let settlements
        if (user.role === 'cashier') {
          settlements = await getCashierSettlements(user.id)
        } else {
          settlements = await getAllCashSettlements()
        }
        
        return NextResponse.json({ settlements })
    }
  } catch (error: any) {
    console.error('Erreur GET cash-settlements:', error)
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    if (!hasPermission(user, "create_cash_settlements")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const formData = await request.formData()
    
    const settlementData = {
      cashier_id: user.id,
      cashier_name: user.name,
      settlement_date: formData.get('settlement_date') as string,
      total_transactions_amount: parseFloat(formData.get('total_transactions_amount') as string),
      unloading_amount: parseFloat(formData.get('unloading_amount') as string) || 0,
      unloading_reason: formData.get('unloading_reason') as string || '',
      operation_report_file_path: null as string | null,
      operation_report_file_name: null as string | null
    }

    // Gérer le fichier de rapport si fourni
    const operationReportFile = formData.get('operation_report_file') as File
    if (operationReportFile && operationReportFile.size > 0) {
      // Ici, vous pourriez sauvegarder le fichier et obtenir le chemin
      // Pour l'instant, on stocke juste le nom
      settlementData.operation_report_file_name = operationReportFile.name
    }

    const settlement = await createCashSettlement(settlementData)
    
    return NextResponse.json({ 
      success: true, 
      settlement,
      message: "Arrêté de caisse créé avec succès" 
    })
  } catch (error: any) {
    console.error('Erreur POST cash-settlements:', error)
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
  }
}

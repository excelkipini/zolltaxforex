import { NextRequest, NextResponse } from "next/server"
import { 
  getCashAccounts, 
  updateCashAccountBalance, 
  deductExpenseFromCoffre,
  addCommissionToAccount,
  getCashTransactions,
  getTotalCommissions,
  getTotalReceiptCommissions,
  initializeCashAccounts,
  syncExistingCommissions,
  syncExistingReceiptCommissions,
  reconcileCommissionsBalance,
  reconcileReceiptCommissionsBalance,
  reconcileRiaExcedentsBalance
} from "@/lib/cash-queries"

// GET - Récupérer les comptes de caisse et leurs soldes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'accounts':
        // Initialiser les comptes s'ils n'existent pas
        await initializeCashAccounts()
        // Réconciliation automatique du solde des commissions (transferts et reçus)
        await reconcileCommissionsBalance('system_auto')
        await reconcileReceiptCommissionsBalance('system_auto')
        // Réconciliation du solde Excédents RIA
        await reconcileRiaExcedentsBalance('system_auto')
        const accounts = await getCashAccounts()
        return NextResponse.json({ success: true, accounts })

      case 'transactions':
        const accountType = searchParams.get('accountType') as any
        const limit = parseInt(searchParams.get('limit') || '50')
        const transactions = await getCashTransactions(accountType, limit)
        return NextResponse.json({ success: true, transactions })

      case 'total-commissions':
        const totalCommissions = await getTotalCommissions()
        return NextResponse.json({ success: true, totalCommissions })

      case 'sync-commissions':
        const syncResult = await syncExistingCommissions()
        const reconciled = await reconcileCommissionsBalance('system')
        return NextResponse.json({ 
          success: true, 
          message: `Synchronisation terminée: ${syncResult.transactionsProcessed} transactions traitées, ${syncResult.totalAdded} XAF ajoutés. Solde commissions réconcilié à ${reconciled} XAF`,
          syncResult,
          reconciled
        })

      case 'sync-receipt-commissions':
        const syncReceiptResult = await syncExistingReceiptCommissions()
        const reconciledReceipt = await reconcileReceiptCommissionsBalance('system')
        return NextResponse.json({ 
          success: true, 
          message: `Synchronisation des commissions des reçus terminée: ${syncReceiptResult.receiptsProcessed} reçus traités, ${syncReceiptResult.totalAdded} XAF ajoutés. Solde commissions des reçus réconcilié à ${reconciledReceipt} XAF`,
          syncReceiptResult,
          reconciledReceipt
        })

      default:
        // Par défaut, retourner les comptes
        await initializeCashAccounts()
        // Réconciliation automatique du solde des commissions
        await reconcileCommissionsBalance('system_auto')
        await reconcileReceiptCommissionsBalance('system_auto')
        await reconcileRiaExcedentsBalance('system_auto')
        const defaultAccounts = await getCashAccounts()
        return NextResponse.json({ success: true, accounts: defaultAccounts })
    }

  } catch (error: any) {
    console.error('Erreur lors de la récupération des données de caisse:', error)
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST - Mettre à jour les soldes ou effectuer des opérations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, accountType, newBalance, description, updatedBy, expenseId, amount, transactionId, commissionAmount } = body

    switch (action) {
      case 'update-balance':
        if (!accountType || newBalance === undefined || !description || !updatedBy) {
          return NextResponse.json(
            { success: false, error: "Paramètres manquants pour la mise à jour du solde" },
            { status: 400 }
          )
        }

        const updatedAccount = await updateCashAccountBalance(
          accountType,
          newBalance,
          updatedBy,
          description
        )

        return NextResponse.json({
          success: true,
          account: updatedAccount,
          message: "Solde mis à jour avec succès"
        })

      case 'deduct-expense':
        if (!expenseId || !amount || !description || !updatedBy) {
          return NextResponse.json(
            { success: false, error: "Paramètres manquants pour la déduction de dépense" },
            { status: 400 }
          )
        }

        await deductExpenseFromCoffre(expenseId, amount, description, updatedBy)

        return NextResponse.json({
          success: true,
          message: "Dépense déduite du coffre avec succès"
        })

      case 'add-commission':
        if (!transactionId || !commissionAmount || !description || !updatedBy) {
          return NextResponse.json(
            { success: false, error: "Paramètres manquants pour l'ajout de commission" },
            { status: 400 }
          )
        }

        await addCommissionToAccount(transactionId, commissionAmount, description, updatedBy)

        return NextResponse.json({
          success: true,
          message: "Commission ajoutée avec succès"
        })

      default:
        return NextResponse.json(
          { success: false, error: "Action non reconnue" },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Erreur lors de l\'opération de caisse:', error)
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

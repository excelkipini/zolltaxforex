import { NextRequest, NextResponse } from "next/server"
import { updateTransactionRealAmount, executeTransaction, getTransactionsForExecutor, getTransactionsPendingExecution } from "@/lib/transactions-queries"

// API route pour mettre à jour le montant réel d'une transaction (par l'auditeur)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, realAmountEUR, validatedBy } = body

    if (!transactionId || !realAmountEUR || !validatedBy) {
      return NextResponse.json(
        { error: "transactionId, realAmountEUR et validatedBy sont requis" },
        { status: 400 }
      )
    }

    if (typeof realAmountEUR !== 'number' || realAmountEUR <= 0) {
      return NextResponse.json(
        { error: "realAmountEUR doit être un nombre positif" },
        { status: 400 }
      )
    }

    const updatedTransaction = await updateTransactionRealAmount(
      transactionId,
      realAmountEUR,
      validatedBy
    )

    return NextResponse.json({
      success: true,
      transaction: updatedTransaction,
      message: updatedTransaction.status === 'validated' 
        ? 'Transaction validée automatiquement - Commission suffisante'
        : 'Transaction rejetée automatiquement - Commission insuffisante'
    })

  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du montant réel:', error)
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// API route pour récupérer les transactions en attente d'exécution
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const executorId = searchParams.get('executorId')

    if (executorId) {
      // Récupérer les transactions assignées à un exécuteur spécifique
      const transactions = await getTransactionsForExecutor(executorId)
      return NextResponse.json({ transactions })
    } else {
      // Récupérer toutes les transactions en attente d'exécution
      const transactions = await getTransactionsPendingExecution()
      return NextResponse.json({ transactions })
    }

  } catch (error: any) {
    console.error('Erreur lors de la récupération des transactions:', error)
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

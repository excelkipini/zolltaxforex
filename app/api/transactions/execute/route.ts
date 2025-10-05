import { NextRequest, NextResponse } from "next/server"
import { executeTransaction } from "@/lib/transactions-queries"

// API route pour exécuter une transaction (par l'exécuteur)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, executorId, receiptUrl, executorComment } = body

    if (!transactionId || !executorId || !receiptUrl) {
      return NextResponse.json(
        { error: "transactionId, executorId et receiptUrl sont requis" },
        { status: 400 }
      )
    }

    // Valider l'URL du reçu (format basique)
    try {
      new URL(receiptUrl)
    } catch {
      return NextResponse.json(
        { error: "receiptUrl doit être une URL valide" },
        { status: 400 }
      )
    }

    const executedTransaction = await executeTransaction(
      transactionId,
      executorId,
      receiptUrl,
      executorComment
    )

    return NextResponse.json({
      success: true,
      transaction: executedTransaction,
      message: 'Transaction exécutée avec succès'
    })

  } catch (error: any) {
    console.error('Erreur lors de l\'exécution de la transaction:', error)
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { executeTransaction } from "@/lib/transactions-queries"
import { sql } from "@/lib/db"
import path from "path"

// Fonction pour sauvegarder le fichier uploadé en base de données
async function saveUploadedFile(file: File): Promise<string> {
  // Convertir le fichier en buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Générer un nom de fichier unique
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = path.extname(file.name)
  const filename = `receipt_${timestamp}_${randomString}${extension}`
  
  // Stocker le fichier en base de données
  const result = await sql`
    INSERT INTO uploaded_files (filename, content_type, file_data, created_at)
    VALUES (${filename}, ${file.type}, ${buffer}, NOW())
    RETURNING id
  `
  
  if (result.length === 0) {
    throw new Error('Erreur lors de la sauvegarde du fichier')
  }
  
  // Retourner l'URL pour récupérer le fichier
  return `/api/files/${result[0].id}`
}

// API route pour exécuter une transaction (par l'exécuteur)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const transactionId = formData.get('transactionId') as string
    const executorId = formData.get('executorId') as string
    const executorComment = formData.get('executorComment') as string
    const receiptFile = formData.get('receiptFile') as File

    if (!transactionId || !executorId || !receiptFile) {
      return NextResponse.json(
        { error: "transactionId, executorId et fichier de reçu sont requis" },
        { status: 400 }
      )
    }

    // Vérifier la taille du fichier
    if (receiptFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Le fichier est trop volumineux (max 10MB)" },
        { status: 400 }
      )
    }

    // Vérifier le type de fichier
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(receiptFile.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      )
    }

    // Sauvegarder le fichier uploadé
    const receiptUrl = await saveUploadedFile(receiptFile)

    const executedTransaction = await executeTransaction(
      transactionId,
      executorId,
      receiptUrl,
      executorComment
    )

    return NextResponse.json({
      success: true,
      transaction: executedTransaction,
      message: 'Transaction exécutée avec succès',
      receiptUrl: receiptUrl
    })

  } catch (error: any) {
    console.error('Erreur lors de l\'exécution de la transaction:', error)
    
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

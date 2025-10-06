import { NextRequest, NextResponse } from "next/server"
import { executeTransaction } from "@/lib/transactions-queries"
import fs from "fs"
import path from "path"

// Fonction pour sauvegarder le fichier uploadé
async function saveUploadedFile(file: File): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts')
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  
  // Générer un nom de fichier unique
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = path.extname(file.name)
  const filename = `receipt_${timestamp}_${randomString}${extension}`
  
  const filepath = path.join(uploadDir, filename)
  
  // Convertir le fichier en buffer et l'écrire
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  fs.writeFileSync(filepath, buffer)
  
  // Retourner l'URL publique du fichier
  return `/uploads/receipts/${filename}`
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

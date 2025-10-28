import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import path from "path"
import { v4 as uuidv4 } from "uuid"

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

// Fonction pour sauvegarder le fichier uploadé en base de données
async function saveUploadedFile(file: File): Promise<string> {
  // Convertir le fichier en buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Générer un nom de fichier unique
  const fileExtension = path.extname(file.name)
  const filename = `cash-declaration_${Date.now()}_${uuidv4()}${fileExtension}`
  
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

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await requireAuth()

    // Récupérer le fichier depuis FormData
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      )
    }

    // Vérifier le type de fichier
    const allowedTypes = ["application/pdf", "text/csv", "application/vnd.ms-excel"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Utilisez PDF ou CSV." },
        { status: 400 }
      )
    }

    // Vérifier la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Fichier trop volumineux. Taille max: 10MB" },
        { status: 400 }
      )
    }

    // Sauvegarder le fichier en base de données
    const filePath = await saveUploadedFile(file)

    console.log(`✅ Fichier uploadé avec succès:`, {
      filePath,
      fileName: file.name,
      size: file.size,
      type: file.type,
      environment: process.env.NODE_ENV
    })

    return NextResponse.json({
      success: true,
      filePath: filePath,
      fileName: file.name,
      size: file.size,
    })

  } catch (error: any) {
    console.error("Erreur lors de l'upload:", error)
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'upload du fichier" },
      { status: 500 }
    )
  }
}

// Fonction alternative pour GET (pour la compatibilité)
export async function GET() {
  return NextResponse.json(
    { message: "Upload endpoint - Utilisez POST pour uploader un fichier" },
    { status: 200 }
  )
}


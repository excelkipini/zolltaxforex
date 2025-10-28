import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { writeFile } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

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

    // Créer le répertoire uploads s'il n'existe pas
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "cash-declarations")
    try {
      await writeFile(path.join(uploadsDir, ".gitkeep"), "")
    } catch {
      // Le répertoire existe déjà
    }

    // Générer un nom de fichier unique
    const fileExtension = file.name.split(".").pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)

    // Enregistrer le fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Retourner le chemin relatif
    const relativePath = `/uploads/cash-declarations/${fileName}`

    console.log(`Fichier uploadé: ${relativePath}`)

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      fileName: file.name,
      size: file.size,
    })

  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'upload du fichier" },
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


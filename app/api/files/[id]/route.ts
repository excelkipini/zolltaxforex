import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// API route pour servir les fichiers stockés en base de données
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id

    if (!fileId) {
      return NextResponse.json(
        { error: "ID de fichier requis" },
        { status: 400 }
      )
    }

    // Récupérer le fichier depuis la base de données
    const result = await sql`
      SELECT filename, content_type, file_data
      FROM uploaded_files
      WHERE id = ${fileId}
      LIMIT 1
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Fichier non trouvé" },
        { status: 404 }
      )
    }

    const file = result[0]

    // Retourner le fichier avec les bons headers
    return new NextResponse(file.file_data, {
      status: 200,
      headers: {
        'Content-Type': file.content_type,
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache pour 1 an
      },
    })

  } catch (error: any) {
    console.error('Erreur lors de la récupération du fichier:', error)
    
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getCashDeclarationById } from "@/lib/ria-cash-declarations-queries"
import { generateCashDeclarationPDF } from "@/lib/pdf-service"
import { getUserById } from "@/lib/users-queries"

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await requireAuth()

    // Récupérer l'ID de l'arrêté
    const searchParams = request.nextUrl.searchParams
    const declarationId = searchParams.get('id')

    if (!declarationId) {
      return NextResponse.json(
        { error: "ID de l'arrêté requis" },
        { status: 400 }
      )
    }

    // Récupérer l'arrêté
    const declaration = await getCashDeclarationById(declarationId)
    if (!declaration) {
      return NextResponse.json(
        { error: "Arrêté non trouvé" },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur peut accéder à cet arrêté
    if (declaration.user_id !== user.id && user.role !== 'cash_manager') {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    // Récupérer les informations de l'utilisateur créateur
    const caissier = await getUserById(declaration.user_id)
    if (!caissier) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      )
    }

    // Récupérer les informations du responsable si validé
    let cashManagerInfo
    if (declaration.validated_by) {
      const validator = await getUserById(declaration.validated_by)
      if (validator) {
        cashManagerInfo = { name: validator.name }
      }
    }

    // Générer le PDF
    const pdfBuffer = await generateCashDeclarationPDF(
      declaration,
      { name: caissier.name, email: caissier.email },
      cashManagerInfo
    )

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="arrete-caisse-${declaration.guichetier}-${declaration.declaration_date}.pdf"`,
      },
    })

  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error)
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    )
  }
}


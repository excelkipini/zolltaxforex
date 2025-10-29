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
    const session = await requireAuth()
    const user = session.user
    console.log('🔐 Utilisateur authentifié:', { id: user.id, role: user.role })

    // Récupérer l'ID de l'arrêté
    const searchParams = request.nextUrl.searchParams
    const declarationId = searchParams.get('id')
    console.log('📋 ID de l\'arrêté demandé:', declarationId)

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
    console.log('📄 Arrêté trouvé:', { user_id: declaration.user_id })

    // Vérifier que l'utilisateur peut accéder à cet arrêté
    // Autoriser : le créateur, le cash_manager, le director, et l'accounting
    const allowedRoles = ['cash_manager', 'director', 'accounting']
    const isOwner = declaration.user_id === user.id
    const hasPermission = allowedRoles.includes(user.role)
    console.log('🔍 Vérification des permissions:', {
      isOwner,
      hasPermission,
      userRole: user.role
    })
    
    if (!isOwner && !hasPermission) {
      console.error('❌ Accès refusé:', { declaration_user_id: declaration.user_id, current_user_id: user.id })
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


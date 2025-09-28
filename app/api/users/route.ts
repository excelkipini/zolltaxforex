import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listUsers, createUser, updateUser, deleteUser, AVAILABLE_ROLES, ROLE_MAPPING } from "@/lib/users-queries"
import { listAgencies } from "@/lib/agencies-queries"

export async function GET() {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins et auditeurs peuvent voir tous les utilisateurs
  const canViewAll = user.role === "director" || user.role === "super_admin" || user.role === "auditor"
  
  if (!canViewAll) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const users = await listUsers()
    const agencies = await listAgencies()
    
    return NextResponse.json({ 
      ok: true, 
      data: { users, agencies, availableRoles: AVAILABLE_ROLES } 
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent créer des utilisateurs
  const canCreate = user.role === "director" || user.role === "super_admin"
  
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, email, roleLabel, agency, password } = body

    if (!name || !email || !roleLabel || !agency || !password) {
      return NextResponse.json({ ok: false, error: "Tous les champs sont requis" }, { status: 400 })
    }

    if (!AVAILABLE_ROLES.includes(roleLabel)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Rôle non valide. Rôles disponibles: ${AVAILABLE_ROLES.join(", ")}` 
      }, { status: 400 })
    }

    // Vérifier que l'agence existe
    const agencies = await listAgencies()
    const agencyExists = agencies.some(a => a.name === agency)
    if (!agencyExists) {
      return NextResponse.json({ ok: false, error: "Agence non trouvée" }, { status: 400 })
    }

    const role = ROLE_MAPPING[roleLabel]
    const newUser = await createUser({
      name,
      email,
      role,
      agency,
      password_hash: password // En production, il faudrait hasher le mot de passe
    })

    return NextResponse.json({ ok: true, data: newUser })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent modifier des utilisateurs
  const canModify = user.role === "director" || user.role === "super_admin"
  
  if (!canModify) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, name, email, roleLabel, agency, password } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID utilisateur requis" }, { status: 400 })
    }

    if (!name || !email || !roleLabel || !agency) {
      return NextResponse.json({ ok: false, error: "Nom, email, rôle et agence sont requis" }, { status: 400 })
    }

    if (!AVAILABLE_ROLES.includes(roleLabel)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Rôle non valide. Rôles disponibles: ${AVAILABLE_ROLES.join(", ")}` 
      }, { status: 400 })
    }

    // Vérifier que l'agence existe
    const agencies = await listAgencies()
    const agencyExists = agencies.some(a => a.name === agency)
    if (!agencyExists) {
      return NextResponse.json({ ok: false, error: "Agence non trouvée" }, { status: 400 })
    }

    const updateData: any = {
      name: String(name),
      email: String(email),
      role: ROLE_MAPPING[roleLabel],
      agency: String(agency),
    }

    // Ajouter le mot de passe seulement s'il est fourni
    if (password && password.trim()) {
      updateData.password = String(password)
    }

    const updatedUser = await updateUser(String(id), updateData)
    return NextResponse.json({ ok: true, data: updatedUser })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et super admins peuvent supprimer des utilisateurs
  const canDelete = user.role === "director" || user.role === "super_admin"
  
  if (!canDelete) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID utilisateur requis" }, { status: 400 })
    }

    // Empêcher la suppression de soi-même
    if (id === user.id) {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })
    }

    await deleteUser(String(id))
    return NextResponse.json({ ok: true, message: "Utilisateur supprimé avec succès" })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
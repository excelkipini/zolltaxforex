"use client"

// Données mockées pour le mode développement côté client
const mockUsers = [
  {
    id: "u1000000-0000-4000-8000-000000000001",
    name: "Jean Directeur",
    email: "directeur@test.com",
    role: "director",
    agency: "Direction Générale",
    password_hash: "password123",
  },
  {
    id: "u1000000-0000-4000-8000-000000000002",
    name: "Paul Caissier",
    email: "caissier@test.com",
    role: "cashier",
    agency: "Agence Centrale",
    password_hash: "password123",
  },
  {
    id: "u1000000-0000-4000-8000-000000000003",
    name: "Marie Comptable",
    email: "comptable@test.com",
    role: "accounting",
    agency: "Service Comptabilité",
    password_hash: "password123",
  },
  {
    id: "u1000000-0000-4000-8000-000000000004",
    name: "Marc Auditeur",
    email: "auditeur@test.com",
    role: "auditor",
    agency: "Service Audit",
    password_hash: "password123",
  },
  {
    id: "u1000000-0000-4000-8000-000000000005",
    name: "Sophie Délégué",
    email: "delegue@test.com",
    role: "delegate",
    agency: "Agence Régionale",
    password_hash: "password123",
  },
  {
    id: "u1000000-0000-4000-8000-000000000006",
    name: "Admin Système",
    email: "admin@test.com",
    role: "super_admin",
    agency: "Administration",
    password_hash: "password123",
  },
]

export type SessionUser = {
  id: string
  name: string
  email: string
  role: "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate"
  agency?: string
}

// Fonction de connexion côté client
export async function loginWithCredentialsClient(email: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    // Vérifier les identifiants avec les données mockées
    const user = mockUsers.find(u => u.email === email && u.password_hash === password)
    
    if (!user) {
      return { success: false, error: "Identifiants invalides" }
    }

    // Créer la session côté client
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency,
    }

    // Stocker la session dans localStorage
    const sessionData = {
      user: sessionUser,
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 jours
    }
    localStorage.setItem('maf_session', JSON.stringify(sessionData))

    // Créer un cookie serveur via une API
    try {
      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      })
    } catch (error) {
    }

    return { success: true, user: sessionUser }
  } catch (error) {
    return { success: false, error: "Erreur de connexion" }
  }
}

// Fonction pour vérifier la session côté client
export function getSessionClient(): SessionUser | null {
  try {
    const sessionData = localStorage.getItem('maf_session')
    if (!sessionData) return null

    const session = JSON.parse(sessionData)
    
    // Vérifier si la session a expiré
    if (Date.now() > session.expires) {
      localStorage.removeItem('maf_session')
      return null
    }

    return session.user
  } catch {
    return null
  }
}

// Fonction pour déconnecter côté client
export function logoutClient() {
  localStorage.removeItem('maf_session')
}

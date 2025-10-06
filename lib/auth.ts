import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sql } from "./db"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate" | "executor"
  agency?: string
}

export type Session = {
  user: SessionUser
  exp: number
}

const SESSION_COOKIE = "maf_session"
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days

// Simple session storage without JWT to avoid library conflicts
const sessions = new Map<string, { user: SessionUser; expires: number }>()

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function createSessionCookie(user: SessionUser) {
  const expires = Date.now() + SESSION_MAX_AGE_SEC * 1000
  // Store in memory for dev hot routes (optional)
  const sessionId = generateSessionId()
  sessions.set(sessionId, { user, expires })

  const payload = JSON.stringify({ user, expires })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value
  if (sessionId) {
    sessions.delete(sessionId)
  }
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null

  // Primary: JSON cookie payload
  if (raw.startsWith("{") && raw.includes("\"user\"")) {
    try {
      const parsed = JSON.parse(raw)
      if (Date.now() > Number(parsed?.expires)) return null
      return { user: parsed.user as SessionUser, exp: Number(parsed.expires) }
    } catch {
      // fallthrough
    }
  }

  // Legacy: in-memory session id
  const legacy = sessions.get(raw)
  if (legacy) {
    if (Date.now() > legacy.expires) {
      sessions.delete(raw)
      return null
    }
    return { user: legacy.user, exp: legacy.expires }
  }

  return null
}

export async function requireAuth(): Promise<Session> {
  const s = await getSession()
  if (!s) redirect("/login")
  return s
}

export async function loginWithCredentials(email: string, password: string): Promise<string | null> {
  try {
    let users: any[] = []

    // En mode développement sans base de données, utiliser les données mockées
    if (!process.env.DATABASE_URL) {
      users = mockUsers.filter(user => user.email === email)
    } else {
      users = await sql`
        SELECT id, name, email, role, password_hash, agency 
        FROM users 
        WHERE email = ${email}
      `
    }

    if (users.length === 0) {
      return "Identifiants invalides"
    }

    const user = users[0]

    // Vérifier le mot de passe
    const isValid = await verifyPasswordByUser(String(user.id), password)
    if (!isValid) {
      return "Identifiants invalides"
    }

    // Mettre à jour la dernière connexion
    if (process.env.DATABASE_URL) {
      await sql`
        UPDATE users 
        SET last_login = NOW() 
        WHERE id = ${user.id}
      `
    }

    await createSessionCookie({
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency || undefined,
    })

    return null
  } catch (error) {
    return "Erreur de connexion"
  }
}

export async function loginAsRole(role: string): Promise<SessionUser | null> {
  try {
    const roleEmailMap: Record<string, string> = {
      cashier: "caissier@test.com",
      accounting: "comptable@test.com",
      director: "directeur@test.com",
      delegate: "delegue@test.com",
      auditor: "auditeur@test.com",
      executor: "executeur@test.com",
      super_admin: "admin@test.com",
    }

    const email = roleEmailMap[role]
    if (!email) {
      return null
    }

    let users: any[] = []

    // En mode développement sans base de données, utiliser les données mockées
    if (!process.env.DATABASE_URL) {
      users = mockUsers.filter(user => user.email === email)
    } else {
      users = await sql`
        SELECT id, name, email, role, agency 
        FROM users 
        WHERE email = ${email}
      `
    }

    if (users.length === 0) {
      return null
    }

    const user = users[0]
    const sessionUser: SessionUser = {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency || undefined,
    }

    await createSessionCookie(sessionUser)
    return sessionUser
  } catch (error) {
    return null
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const s = await getSession()
  if (!s) return null

  try {
    let users: any[] = []

    // En mode développement sans base de données, utiliser les données mockées
    if (!process.env.DATABASE_URL) {
      users = mockUsers.filter(user => user.id === s.user.id)
    } else {
      users = await sql`
        SELECT id, name, email, role, agency 
        FROM users 
        WHERE id = ${s.user.id}::uuid
      `
    }

    if (users.length === 0) return null

    const user = users[0]
    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency || undefined,
    }
  } catch {
    return null
  }
}

// Données mockées pour le mode développement
const mockUsers = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Jean Directeur",
    email: "directeur@test.com",
    role: "director",
    agency: "Direction Générale",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Paul Caissier",
    email: "caissier@test.com",
    role: "cashier",
    agency: "Agence Centrale",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Marie Comptable",
    email: "comptable@test.com",
    role: "accounting",
    agency: "Service Comptabilité",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Marc Auditeur",
    email: "auditeur@test.com",
    role: "auditor",
    agency: "Service Audit",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Sophie Délégué",
    email: "delegue@test.com",
    role: "delegate",
    agency: "Agence Régionale",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    name: "Admin Système",
    email: "admin@test.com",
    role: "super_admin",
    agency: "Administration",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Stevie Exécuteur",
    email: "executeur@test.com",
    role: "executor",
    agency: "Noura",
    password_hash: process.env.TEST_PASSWORD || "password123",
  },
]


export async function findUserByEmailWithHash(email: string) {
  try {
    let users: any[] = []

    // En mode développement sans base de données, utiliser les données mockées
    if (!process.env.DATABASE_URL) {
      users = mockUsers.filter(user => user.email === email)
    } else {
      users = await sql`
        SELECT id, name, email, role, password_hash, agency 
        FROM users 
        WHERE email = ${email}
      `
    }
    return users.length > 0 ? users[0] : null
  } catch {
    return null
  }
}

export async function verifyPasswordByUser(userId: string, password: string): Promise<boolean> {
  try {
    // En mode développement sans base de données, utiliser le mot de passe mock
    if (!process.env.DATABASE_URL) {
      return password === (process.env.TEST_PASSWORD || "password123")
    }
    
    // Récupérer le mot de passe haché de l'utilisateur
    const users = await sql`
      SELECT password_hash 
      FROM users 
      WHERE id = ${userId}::uuid
    `
    
    if (users.length === 0) {
      return false
    }
    
    const hashedPassword = users[0].password_hash
    if (!hashedPassword) {
      return false
    }
    
    // Vérifier le mot de passe avec bcrypt
    const bcrypt = await import("bcryptjs")
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    return false
  }
}

export async function getUserByIdBasic(userId: string): Promise<SessionUser | null> {
  try {
    let users: any[] = []

    // En mode développement sans base de données, utiliser les données mockées
    if (!process.env.DATABASE_URL) {
      users = mockUsers.filter(user => user.id === userId)
    } else {
      users = await sql`
        SELECT id, name, email, role, agency 
        FROM users 
        WHERE id = ${userId}::uuid
      `
    }

    if (users.length === 0) return null

    const user = users[0]
    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency || undefined,
    }
  } catch {
    return null
  }
}

// Clean up expired sessions periodically
setInterval(
  () => {
    const now = Date.now()
    for (const [sessionId, session] of sessions.entries()) {
      if (now > session.expires) {
        sessions.delete(sessionId)
      }
    }
  },
  60 * 60 * 1000,
) // Clean up every hour

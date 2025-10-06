import "server-only"
import { sql } from "./db"
import { hash } from "bcryptjs"

export type User = {
  id: string
  name: string
  email: string
  role: "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate" | "executor"
  agency: string
  password_hash?: string
  last_login?: string
  created_at: string
}

export type CreateUserInput = {
  name: string
  email: string
  role: User["role"]
  agency: string
  password?: string
  password_hash?: string
}

export async function listUsers(): Promise<User[]> {
  const rows = await sql<User[]>`
    SELECT
      id::text,
      name,
      email,
      role,
      agency,
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE role != 'super_admin'
    ORDER BY created_at DESC
  `
  return rows
}

export async function createUser(input: CreateUserInput): Promise<User> {
  // Hacher le mot de passe si fourni
  const password_hash = input.password_hash || (input.password ? await hash(input.password, 10) : null)
  
  const rows = await sql<User[]>`
    INSERT INTO users (name, email, role, agency, password_hash)
    VALUES (${input.name}, ${input.email}, ${input.role}, ${input.agency}, ${password_hash})
    RETURNING 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
  `
  return rows[0]
}

export async function updateUser(id: string, input: Partial<CreateUserInput>): Promise<User> {
  // Hacher le mot de passe si fourni
  const password_hash = input.password_hash || (input.password ? await hash(input.password, 10) : undefined)
  
  const rows = await sql<User[]>`
    UPDATE users
    SET 
      name = ${input.name || null},
      email = ${input.email || null},
      role = ${input.role || null},
      agency = ${input.agency || null},
      password_hash = ${password_hash || null}
    WHERE id = ${id}::uuid
    RETURNING 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
  `
  
  if (rows.length === 0) {
    throw new Error("Utilisateur non trouvé")
  }
  
  return rows[0]
}

export async function deleteUser(id: string): Promise<void> {
  await sql`
    DELETE FROM users WHERE id = ${id}::uuid
  `
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql<User[]>`
    SELECT 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE id = ${id}::uuid
  `
  return rows[0] || null
}

export async function getUserByName(name: string): Promise<User | null> {
  const rows = await sql<User[]>`
    SELECT 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE name = ${name}
  `
  return rows[0] || null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await sql<User[]>`
    SELECT 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE email = ${email}
  `
  return rows[0] || null
}

// Rôles disponibles
export const AVAILABLE_ROLES = [
  "Directeur Général",
  "Comptable", 
  "Auditeur",
  "Caissier",
  "Délégué",
  "Exécuteur",
  "Admin"
] as const

export type RoleLabel = typeof AVAILABLE_ROLES[number]

// Mapping des rôles
export const ROLE_MAPPING: Record<RoleLabel, User["role"]> = {
  "Directeur Général": "director",
  "Comptable": "accounting",
  "Auditeur": "auditor", 
  "Caissier": "cashier",
  "Délégué": "delegate",
  "Exécuteur": "executor",
  "Admin": "super_admin"
}

export async function getUsersByRole(role: string): Promise<User[]> {
  const rows = await sql<User[]>`
    SELECT
      id::text,
      name,
      email,
      role,
      agency,
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE role = ${role}
    ORDER BY created_at DESC
  `
  return rows
}

export async function getUsersByRoles(roles: string[]): Promise<User[]> {
  if (roles.length === 0) return []
  
  const rows = await sql<User[]>`
    SELECT
      id::text,
      name,
      email,
      role,
      agency,
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
    FROM users
    WHERE role = ANY(${roles})
    ORDER BY created_at DESC
  `
  return rows
}

// Fonction pour mettre à jour le profil utilisateur
export async function updateUserProfile(userId: string, name: string, email: string): Promise<User> {
  const rows = await sql<User[]>`
    UPDATE users
    SET 
      name = ${name},
      email = ${email},
      updated_at = NOW()
    WHERE id = ${userId}::uuid
    RETURNING 
      id::text, 
      name, 
      email, 
      role, 
      agency, 
      password_hash,
      last_login::text as last_login,
      created_at::text as created_at
  `
  
  if (rows.length === 0) {
    throw new Error("Utilisateur non trouvé")
  }
  
  return rows[0]
}

// Fonction pour changer le mot de passe utilisateur
export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    // Vérifier le mot de passe actuel
    const user = await getUserById(userId)
    if (!user || !user.password_hash) {
      return false
    }
    
    const { compare } = await import('bcryptjs')
    const isCurrentPasswordValid = await compare(currentPassword, user.password_hash)
    
    if (!isCurrentPasswordValid) {
      return false
    }
    
    // Hacher le nouveau mot de passe
    const { hash } = await import('bcryptjs')
    const newPasswordHash = await hash(newPassword, 10)
    
    // Mettre à jour le mot de passe
    await sql`
      UPDATE users
      SET 
        password_hash = ${newPasswordHash},
        updated_at = NOW()
      WHERE id = ${userId}::uuid
    `
    
    return true
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)
    return false
  }
}
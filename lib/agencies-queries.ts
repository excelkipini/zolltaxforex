import "server-only"
import { sql } from "./db"
import { createAgencyExchangeCaisse, deleteAgencyExchangeCaisse } from "./exchange-caisse-queries"

export type Agency = {
  id: string
  name: string
  country: string
  address: string
  status: "active" | "inactive"
  users: number
  created_at: string
}

export type CreateAgencyInput = {
  name: string
  country: string
  address: string
  status: "active" | "inactive"
}

export type UpdateAgencyInput = {
  id: string
  name: string
  country: string
  address: string
  status: "active" | "inactive"
}

export async function listAgencies(): Promise<Agency[]> {
  const rows = await sql<Agency[]>`
    SELECT 
      a.id::text, 
      a.name, 
      a.country, 
      a.address, 
      a.status, 
      COALESCE(user_counts.user_count, 0) as users, 
      a.created_at::text as created_at
    FROM agencies a
    LEFT JOIN (
      SELECT 
        agency, 
        COUNT(*) as user_count
      FROM users 
      WHERE role != 'super_admin'
      GROUP BY agency
    ) user_counts ON a.name = user_counts.agency
    ORDER BY a.created_at DESC
  `
  return rows
}

export async function createAgency(input: CreateAgencyInput): Promise<Agency> {
  const rows = await sql<Agency[]>`
    INSERT INTO agencies (name, country, address, status, users)
    VALUES (${input.name}, ${input.country}, ${input.address}, ${input.status}, 0)
    RETURNING 
      id::text, 
      name, 
      country, 
      address, 
      status, 
      0 as users, 
      created_at::text as created_at
  `
  
  const agency = rows[0]
  
  // Créer automatiquement les caisses de change pour la nouvelle agence
  if (agency && agency.id) {
    try {
      await createAgencyExchangeCaisse(agency.id, 'system')
    } catch (e) {
      console.error('Erreur lors de la création des caisses de change pour l\'agence:', e)
    }
  }
  
  return agency
}

export async function updateAgency(input: UpdateAgencyInput): Promise<Agency> {
  const rows = await sql<Agency[]>`
    UPDATE agencies
    SET 
      name = ${input.name},
      country = ${input.country},
      address = ${input.address},
      status = ${input.status}
    WHERE id = ${input.id}::uuid
    RETURNING 
      id::text, 
      name, 
      country, 
      address, 
      status, 
      0 as users, 
      created_at::text as created_at
  `
  return rows[0]
}

export async function deleteAgency(id: string): Promise<void> {
  await sql`
    DELETE FROM agencies WHERE id = ${id}::uuid
  `
}

export async function getAgencyById(id: string): Promise<Agency | null> {
  const rows = await sql<Agency[]>`
    SELECT 
      a.id::text, 
      a.name, 
      a.country, 
      a.address, 
      a.status, 
      COALESCE(user_counts.user_count, 0) as users, 
      a.created_at::text as created_at
    FROM agencies a
    LEFT JOIN (
      SELECT 
        agency, 
        COUNT(*) as user_count
      FROM users 
      WHERE role != 'super_admin'
      GROUP BY agency
    ) user_counts ON a.name = user_counts.agency
    WHERE a.id = ${id}::uuid
  `
  return rows[0] || null
}

// Pays disponibles
export const AVAILABLE_COUNTRIES = [
  "Congo",
  "RDC", 
  "Cameroun",
  "France"
] as const

export type Country = typeof AVAILABLE_COUNTRIES[number]
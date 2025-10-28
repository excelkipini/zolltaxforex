"use server"

import { z } from "zod"
import { createUser, updateUser, deleteUser, type CreateUserInput, type UpdateUserInput } from "@/lib/users-queries"

// Validation schemas (server-side)
const createSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  role: z.enum(["super_admin", "director", "accounting", "cashier", "auditor", "delegate", "executor", "cash_manager"]),
  agency: z.string().min(1, "Agence requise"),
  password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères"),
})

const updateSchema = z.object({
  id: z.string().uuid("ID invalide"),
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  role: z.enum(["super_admin", "director", "accounting", "cashier", "auditor", "delegate", "executor", "cash_manager"]),
  agency: z.string().min(1, "Agence requise"),
  password: z.string().min(8).optional(),
})

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function createUserAction(payload: CreateUserInput): Promise<ActionResult<any>> {
  try {
    const data = createSchema.parse(payload)
    const user = await createUser(data)
    return { ok: true, data: user }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la création"
    return { ok: false, error: msg }
  }
}

export async function updateUserAction(payload: UpdateUserInput): Promise<ActionResult<any>> {
  try {
    const data = updateSchema.parse(payload)
    const user = await updateUser(data.id, data)
    return { ok: true, data: user }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la mise à jour"
    return { ok: false, error: msg }
  }
}

export async function deleteUserAction(id: string): Promise<ActionResult<null>> {
  try {
    if (!id) return { ok: false, error: "ID manquant" }
    await deleteUser(id)
    return { ok: true, data: null }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la suppression"
    return { ok: false, error: msg }
  }
}

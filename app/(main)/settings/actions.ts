"use server"

import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { changeUserPassword, updateUserProfile } from "@/lib/users-queries"

const profileSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
})

const passwordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis"),
    next: z.string().min(8, "Le nouveau mot de passe doit comporter au moins 8 caractères"),
  })
  .refine((v) => v.current !== v.next, { path: ["next"], message: "Le nouveau mot de passe doit être différent" })

export async function updateProfileAction(_: any, formData: FormData) {
  const { user } = await requireAuth()
  try {
    const data = profileSchema.parse({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
    })
    await updateUserProfile(user.id, data.name, data.email)
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Erreur lors de la mise à jour du profil" }
  }
}

export async function changePasswordAction(_: any, formData: FormData) {
  const { user } = await requireAuth()
  try {
    const data = passwordSchema.parse({
      current: String(formData.get("current") || ""),
      next: String(formData.get("next") || ""),
    })
    const ok = await changeUserPassword(user.id, data.current, data.next)
    if (!ok) return { ok: false as const, error: "Mot de passe actuel incorrect" }
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Erreur lors du changement de mot de passe" }
  }
}

// API routes for React 18 client submission
export async function POST(request: Request) {
  // This file is not a route, so skip default export; we expose helpers used below.
  return new Response(null, { status: 404 })
}

export async function handleUpdateProfile(body: { name: string; email: string }) {
  const { user } = await requireAuth()
  try {
    const data = profileSchema.parse(body)
    await updateUserProfile(user.id, data.name, data.email)
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Erreur lors de la mise à jour du profil" }
  }
}

export async function handleChangePassword(body: { current: string; next: string }) {
  const { user } = await requireAuth()
  try {
    const data = passwordSchema.parse(body)
    const ok = await changeUserPassword(user.id, data.current, data.next)
    if (!ok) return { ok: false as const, error: "Mot de passe actuel incorrect" }
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Erreur lors du changement de mot de passe" }
  }
}

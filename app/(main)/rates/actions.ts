"use server"

import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { getSettings, getSettingsHistory, updateSettings } from "@/lib/settings-queries"
import {
  listAgencyLimitsEffective,
  upsertAgencyLimit,
  resetAgencyLimit,
  type AgencyLimitEffective,
} from "@/lib/agency-limits-queries"

export async function getSettingsAction() {
  const { user } = await requireAuth()
  // Vérifier les permissions pour voir les taux (directeurs, super admins, auditeurs et comptables)
  if (user.role !== "director" && user.role !== "delegate" && user.role !== "super_admin" && user.role !== "auditor" && user.role !== "accounting") {
    throw new Error("Non autorisé")
  }
  
  const s = await getSettings()
  const h = await getSettingsHistory(20)
  return { settings: s, history: h }
}

const updateSchema = z.object({
  usd: z.number().positive(),
  eur: z.number().positive(),
  gbp: z.number().positive(),
  transfer_limit: z.number().int().nonnegative(),
  daily_limit: z.number().int().nonnegative(),
  card_limit: z.number().int().nonnegative(),
  commission: z.number().min(0).max(100),
  user_name: z.string().optional(),
})

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function updateSettingsAction(input: z.infer<typeof updateSchema>): Promise<ActionResult<any>> {
  try {
    const { user } = await requireAuth()
    // Vérifier les permissions pour modifier les taux
    if (user.role !== "director" && user.role !== "delegate" && user.role !== "super_admin" && user.role !== "accounting") {
      return { ok: false, error: "Non autorisé" }
    }
    
    const data = updateSchema.parse(input)
    const saved = await updateSettings(data)
    const history = await getSettingsHistory(20)
    return { ok: true, data: { settings: saved, history } }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de la mise à jour des paramètres" }
  }
}

/* Agency limits */

export async function getAgencyLimitsAction(): Promise<{ items: AgencyLimitEffective[] }> {
  const { user } = await requireAuth()
  // Vérifier les permissions pour voir les plafonds d'agence
  if (user.role !== "director" && user.role !== "delegate" && user.role !== "super_admin") {
    throw new Error("Non autorisé")
  }
  
  const items = await listAgencyLimitsEffective()
  return { items }
}

const limitField = z.number().int().nonnegative().nullable().optional()
const commField = z.number().min(0).max(100).nullable().optional()

const upsertAgencyLimitSchema = z.object({
  agency_id: z.string().uuid(),
  daily_limit: limitField,
  transfer_limit: limitField,
  card_limit: limitField,
  commission: commField,
})

export async function upsertAgencyLimitAction(
  input: z.infer<typeof upsertAgencyLimitSchema>,
): Promise<ActionResult<AgencyLimitEffective>> {
  try {
    const data = upsertAgencyLimitSchema.parse(input)
    const item = await upsertAgencyLimit(data)
    return { ok: true, data: item }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de l'enregistrement des limites d'agence" }
  }
}

export async function resetAgencyLimitAction(agency_id: string): Promise<ActionResult<AgencyLimitEffective>> {
  try {
    if (!agency_id) return { ok: false, error: "ID agence manquant" }
    const item = await resetAgencyLimit(agency_id)
    return { ok: true, data: item }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de la réinitialisation des limites d'agence" }
  }
}

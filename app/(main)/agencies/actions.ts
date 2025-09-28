"use server"

import { z } from "zod"
import {
  createAgency,
  updateAgency,
  deleteAgency,
  type CreateAgencyInput,
  type UpdateAgencyInput,
} from "@/lib/agencies-queries"

const statusEnum = z.enum(["active", "inactive"])

const createSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  country: z.string().min(1, "Pays requis"),
  address: z.string().min(1, "Adresse requise"),
  status: statusEnum,
})

const updateSchema = createSchema.extend({
  id: z.string().min(1, "ID requis"),
})

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function createAgencyAction(payload: CreateAgencyInput): Promise<ActionResult<any>> {
  try {
    const data = createSchema.parse(payload)
    const agency = await createAgency(data)
    return { ok: true, data: agency }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de la création" }
  }
}

export async function updateAgencyAction(payload: UpdateAgencyInput): Promise<ActionResult<any>> {
  try {
    const data = updateSchema.parse(payload)
    const agency = await updateAgency(data)
    return { ok: true, data: agency }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de la mise à jour" }
  }
}

export async function deleteAgencyAction(id: string): Promise<ActionResult<null>> {
  try {
    if (!id) return { ok: false, error: "ID manquant" }
    await deleteAgency(id)
    return { ok: true, data: null }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erreur lors de la suppression" }
  }
}

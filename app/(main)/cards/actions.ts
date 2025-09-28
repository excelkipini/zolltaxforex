"use server"

import { z } from "zod"
import {
  createCard,
  updateCard,
  deleteCard,
  distributeAmount,
  bulkCreateCardsFromExcel,
  type CreateCardInput,
  type UpdateCardInput,
} from "@/lib/cards-queries"

const createSchema = z.object({
  cid: z.string().min(1, "CID requis"),
  last_recharge_date: z.string().optional(),
  expiration_date: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  monthly_limit: z.number().int().min(0).optional().default(2000000),
})

const updateSchema = createSchema.extend({
  id: z.string().uuid("ID invalide"),
})

const distributionSchema = z.object({
  amount: z.number().int().min(1, "Montant requis"),
  maxCards: z.number().int().min(1).max(50).optional().default(10),
})

const bulkCreateSchema = z.object({
  cards: z.array(z.object({
    cid: z.string().min(1),
    last_recharge_date: z.string().optional(),
    expiration_date: z.string().optional(),
  })).min(1, "Au moins une carte requise"),
})

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function createCardAction(payload: CreateCardInput): Promise<ActionResult<any>> {
  try {
    const data = createSchema.parse(payload)
    const card = await createCard(data)
    return { ok: true, data: card }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la création"
    return { ok: false, error: msg }
  }
}

export async function updateCardAction(payload: UpdateCardInput): Promise<ActionResult<any>> {
  try {
    const data = updateSchema.parse(payload)
    const card = await updateCard(data)
    return { ok: true, data: card }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la mise à jour"
    return { ok: false, error: msg }
  }
}

export async function deleteCardAction(id: string): Promise<ActionResult<null>> {
  try {
    if (!id) return { ok: false, error: "ID manquant" }
    await deleteCard(id)
    return { ok: true, data: null }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la suppression"
    return { ok: false, error: msg }
  }
}

export async function distributeAmountAction(
  amount: number, 
  maxCards?: number
): Promise<ActionResult<any>> {
  try {
    const data = distributionSchema.parse({ amount, maxCards })
    const result = await distributeAmount(data.amount, data.maxCards)
    return { ok: true, data: result }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la distribution"
    return { ok: false, error: msg }
  }
}

export async function bulkCreateCardsAction(payload: {
  cards: Array<{
    cid: string
    last_recharge_date?: string
    expiration_date?: string
  }>
}): Promise<ActionResult<any>> {
  try {
    const data = bulkCreateSchema.parse(payload)
    const cards = await bulkCreateCardsFromExcel(data.cards)
    return { ok: true, data: cards }
  } catch (e: any) {
    const msg = e?.message ?? "Erreur lors de la création en masse"
    return { ok: false, error: msg }
  }
}

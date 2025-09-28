import "server-only"
import { sql } from "./db"

export type Card = {
  id: string
  cid: string
  last_recharge_date?: string
  expiration_date?: string
  status: "active" | "inactive"
  monthly_limit: number
  monthly_used: number
  created_at: string
  updated_at: string
}

export type CreateCardInput = {
  cid: string
  last_recharge_date?: string
  expiration_date?: string
  status?: "active" | "inactive"
  monthly_limit?: number
}

export type UpdateCardInput = {
  id: string
  cid?: string
  last_recharge_date?: string
  expiration_date?: string
  status?: "active" | "inactive"
  monthly_limit?: number
}

export type DistributionResult = {
  total_distributed: number
  remaining_amount: number
  cards_used: number
  distributions: Array<{
    card_id: string
    cid: string
    amount: number
    remaining_limit: number
  }>
}

export async function listCards(): Promise<Card[]> {
  const rows = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    ORDER BY created_at DESC
  `
  return rows
}

export async function createCard(input: CreateCardInput): Promise<Card> {
  const rows = await sql<Card[]>`
    INSERT INTO cards (cid, last_recharge_date, expiration_date, status, monthly_limit, monthly_used)
    VALUES (
      ${input.cid}, 
      ${input.last_recharge_date || null}, 
      ${input.expiration_date || null}, 
      ${input.status || 'active'}, 
      ${input.monthly_limit || 2000000}, 
      0
    )
    RETURNING 
      id::text,
      cid,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  return rows[0]
}

export async function updateCard(input: UpdateCardInput): Promise<Card> {
  const rows = await sql<Card[]>`
    UPDATE cards
    SET 
      cid = COALESCE(${input.cid}, cid),
      last_recharge_date = COALESCE(${input.last_recharge_date}, last_recharge_date),
      expiration_date = COALESCE(${input.expiration_date}, expiration_date),
      status = COALESCE(${input.status}, status),
      monthly_limit = COALESCE(${input.monthly_limit}, monthly_limit),
      updated_at = NOW()
    WHERE id = ${input.id}::uuid
    RETURNING 
      id::text,
      cid,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  
  if (rows.length === 0) {
    throw new Error("Carte non trouvée")
  }
  
  return rows[0]
}

export async function deleteCard(id: string): Promise<void> {
  await sql`
    DELETE FROM cards WHERE id = ${id}::uuid
  `
}

export async function getCardById(id: string): Promise<Card | null> {
  const rows = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    WHERE id = ${id}::uuid
  `
  return rows[0] || null
}

export async function getAvailableCardsForDistribution(): Promise<Card[]> {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  
  const rows = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    WHERE status = 'active'
      AND (monthly_used < monthly_limit)
      AND (expiration_date IS NULL OR expiration_date::date > CURRENT_DATE)
    ORDER BY monthly_used ASC, created_at ASC
  `
  return rows
}

export async function distributeAmount(
  amount: number, 
  maxCards: number = 10
): Promise<DistributionResult> {
  const availableCards = await getAvailableCardsForDistribution()
  
  if (availableCards.length === 0) {
    throw new Error("Aucune carte disponible pour la distribution")
  }
  
  const cardsToUse = availableCards.slice(0, maxCards)
  const distributions: DistributionResult['distributions'] = []
  let remainingAmount = amount
  let totalDistributed = 0
  
  for (const card of cardsToUse) {
    if (remainingAmount <= 0) break
    
    const availableLimit = card.monthly_limit - card.monthly_used
    const amountToDistribute = Math.min(remainingAmount, availableLimit)
    
    if (amountToDistribute > 0) {
      // Mettre à jour la carte
      await sql`
        UPDATE cards
        SET 
          monthly_used = monthly_used + ${amountToDistribute},
          last_recharge_date = CURRENT_DATE,
          updated_at = NOW()
        WHERE id = ${card.id}::uuid
      `
      
      distributions.push({
        card_id: card.id,
        cid: card.cid,
        amount: amountToDistribute,
        remaining_limit: availableLimit - amountToDistribute
      })
      
      totalDistributed += amountToDistribute
      remainingAmount -= amountToDistribute
    }
  }
  
  return {
    total_distributed: totalDistributed,
    remaining_amount: remainingAmount,
    cards_used: distributions.length,
    distributions
  }
}

export async function resetMonthlyUsage(): Promise<void> {
  await sql`
    UPDATE cards
    SET 
      monthly_used = 0,
      updated_at = NOW()
    WHERE DATE_TRUNC('month', updated_at) < DATE_TRUNC('month', CURRENT_DATE)
  `
}

export async function getDistributionStats(): Promise<{
  total_limit: number
  total_used: number
  total_available: number
  active_cards: number
  available_cards: number
}> {
  const stats = await sql`
    SELECT 
      COUNT(*) as total_cards,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
      COUNT(CASE WHEN status = 'active' AND monthly_used < monthly_limit THEN 1 END) as available_cards,
      COALESCE(SUM(monthly_limit), 0) as total_limit,
      COALESCE(SUM(monthly_used), 0) as total_used
    FROM cards
  `
  
  const result = stats[0]
  const totalLimit = Number(result.total_limit)
  const totalUsed = Number(result.total_used)
  const totalAvailable = totalLimit - totalUsed
  
  return {
    total_limit: totalLimit,
    total_used: totalUsed,
    total_available: totalAvailable,
    active_cards: Number(result.active_cards),
    available_cards: Number(result.available_cards)
  }
}

export async function bulkCreateCardsFromExcel(cardsData: Array<{
  cid: string
  last_recharge_date?: string
  expiration_date?: string
}>): Promise<{
  created: Card[]
  skipped: Array<{ cid: string, reason: string }>
  total: number
}> {
  const createdCards: Card[] = []
  const skippedCards: Array<{ cid: string, reason: string }> = []
  
  for (const cardData of cardsData) {
    try {
      // Vérifier si la carte existe déjà
      const existingCard = await sql`
        SELECT id FROM cards WHERE cid = ${cardData.cid}
      `
      
      if (existingCard.length > 0) {
        skippedCards.push({
          cid: cardData.cid,
          reason: 'Carte déjà existante'
        })
        continue
      }
      
      const card = await createCard({
        cid: cardData.cid,
        last_recharge_date: cardData.last_recharge_date,
        expiration_date: cardData.expiration_date,
        status: 'active',
        monthly_limit: 2000000
      })
      createdCards.push(card)
    } catch (error: any) {
      
      // Déterminer la raison de l'échec
      let reason = 'Erreur inconnue'
      if (error?.code === '23505') {
        reason = 'Carte déjà existante'
      } else if (error?.message) {
        reason = error.message
      }
      
      skippedCards.push({
        cid: cardData.cid,
        reason
      })
    }
  }
  
  return {
    created: createdCards,
    skipped: skippedCards,
    total: cardsData.length
  }
}
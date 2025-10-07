import { sql } from "./db"
import { logCardsAction } from "./cards-history"

// Plafonds par pays
export const COUNTRY_LIMITS = {
  Mali: {
    monthly_limit: 2400000,
    recharge_limit: 810000
  },
  RDC: {
    monthly_limit: 2500000,
    recharge_limit: 550000
  },
  France: {
    monthly_limit: 2500000,
    recharge_limit: 650000
  },
  Congo: {
    monthly_limit: 2000000,
    recharge_limit: 800000
  }
} as const

export type Country = keyof typeof COUNTRY_LIMITS

// Obtenir les limites par pays
export function getCountryLimits(country: Country) {
  return COUNTRY_LIMITS[country]
}

// Obtenir tous les pays disponibles
export function getAvailableCountries(): Country[] {
  return Object.keys(COUNTRY_LIMITS) as Country[]
}

export type Card = {
  id: string
  cid: string
  country: "Mali" | "RDC" | "France" | "Congo"
  last_recharge_date?: string
  expiration_date?: string
  status: "active" | "inactive"
  monthly_limit: number
  monthly_used: number
  recharge_limit: number
  created_at: string
  updated_at: string
}

export type CreateCardInput = {
  cid: string
  country: "Mali" | "RDC" | "France" | "Congo"
  last_recharge_date?: string
  expiration_date?: string
  status?: "active" | "inactive"
  monthly_limit?: number
  recharge_limit?: number
  created_by?: {
    id: string
    name: string
    role: string
  }
}

export type UpdateCardInput = {
  id: string
  cid?: string
  country?: "Mali" | "RDC" | "France" | "Congo"
  last_recharge_date?: string
  expiration_date?: string
  status?: "active" | "inactive"
  monthly_limit?: number
  recharge_limit?: number
  updated_by?: {
    id: string
    name: string
    role: string
  }
}

export type DistributionResult = {
  total_distributed: number
  remaining_amount: number
  cards_used: number
  country: string
  distributions: Array<{
    card_id: string
    cid: string
    country: string
    amount: number
    new_balance: number
    remaining_limit: number
  }>
}

export async function listCards(country?: Country): Promise<Card[]> {
  // Utiliser la vraie base de données si DATABASE_URL est disponible
  if (process.env.DATABASE_URL) {
    // Code pour la vraie base de données
    let query = sql<Card[]>`
      SELECT 
        id::text,
        cid,
        country,
        last_recharge_date::text as last_recharge_date,
        expiration_date::text as expiration_date,
        status,
        monthly_limit,
        monthly_used,
        recharge_limit,
        created_at::text as created_at,
        updated_at::text as updated_at
      FROM cards
    `

    if (country) {
      query = sql<Card[]>`
        SELECT 
          id::text,
          cid,
          country,
          last_recharge_date::text as last_recharge_date,
          expiration_date::text as expiration_date,
          status,
          monthly_limit,
          monthly_used,
          recharge_limit,
          created_at::text as created_at,
          updated_at::text as updated_at
        FROM cards
        WHERE country = ${country}
      `
    }

    if (country) {
      const rows = await sql<Card[]>`
        SELECT 
          id::text,
          cid,
          country,
          last_recharge_date::text as last_recharge_date,
          expiration_date::text as expiration_date,
          status,
          monthly_limit,
          monthly_used,
          recharge_limit,
          created_at::text as created_at,
          updated_at::text as updated_at
        FROM cards
        WHERE country = ${country}
        ORDER BY created_at DESC
      `
      return rows
    } else {
  const rows = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
          country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
          recharge_limit,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    ORDER BY created_at DESC
  `
  return rows
}
  }

  // En mode développement sans base de données, retourner des données mockées
    const mockCards: Card[] = [
      {
        id: "card-1",
        cid: "21174132",
        country: "Mali",
        last_recharge_date: "2024-01-15",
        expiration_date: "2025-12-31",
        status: "active",
        monthly_limit: 2400000,
        monthly_used: 500000,
        recharge_limit: 810000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z"
      },
      {
        id: "card-2",
        cid: "21174133",
        country: "RDC",
        last_recharge_date: "2024-01-10",
        expiration_date: "2025-11-30",
        status: "active",
        monthly_limit: 2500000,
        monthly_used: 1200000,
        recharge_limit: 550000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-10T00:00:00Z"
      },
      {
        id: "card-3",
        cid: "21174134",
        country: "France",
        last_recharge_date: null,
        expiration_date: "2025-10-31",
        status: "inactive",
        monthly_limit: 2500000,
        monthly_used: 0,
        recharge_limit: 650000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z"
      },
      {
        id: "card-4",
        cid: "21174135",
        country: "Congo",
        last_recharge_date: "2024-01-20",
        expiration_date: "2025-09-30",
        status: "active",
        monthly_limit: 2000000,
        monthly_used: 800000,
        recharge_limit: 800000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z"
      }
    ]

    // Filtrer par pays si spécifié
    if (country) {
      return mockCards.filter(card => card.country === country)
    }

    return mockCards
  }


export async function createCard(input: CreateCardInput, skipActionLogging?: boolean): Promise<Card> {
  // Obtenir les limites par défaut pour le pays
  const countryLimits = getCountryLimits(input.country)
  
  const rows = await sql<Card[]>`
    INSERT INTO cards (cid, country, last_recharge_date, expiration_date, status, monthly_limit, monthly_used, recharge_limit)
    VALUES (
      ${input.cid}, 
      ${input.country},
      ${input.last_recharge_date || null}, 
      ${input.expiration_date || null}, 
      ${input.status || 'active'}, 
      ${input.monthly_limit || countryLimits.monthly_limit}, 
      0,
      ${input.recharge_limit || countryLimits.recharge_limit}
    )
    RETURNING 
      id::text,
      cid,
      country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      recharge_limit,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  
  const newCard = rows[0]
  
  // Enregistrer l'action dans l'historique (sauf si skipActionLogging est true)
  if (input.created_by && !skipActionLogging) {
    await logCardsAction({
      user_id: input.created_by.id,
      user_name: input.created_by.name,
      user_role: input.created_by.role,
      action_type: 'create',
      action_description: `Création de la carte ${input.cid} (${input.country})`,
      target_card_id: newCard.id,
      target_card_cid: input.cid,
      new_values: {
        cid: input.cid,
        country: input.country,
        status: input.status || 'active',
        monthly_limit: input.monthly_limit || countryLimits.monthly_limit,
        recharge_limit: input.recharge_limit || countryLimits.recharge_limit,
        expiration_date: input.expiration_date
      },
      metadata: {
        country_limits: countryLimits
      }
    })
  }
  
  return newCard
}

export async function updateCard(input: UpdateCardInput): Promise<Card> {
  // Récupérer les anciennes valeurs pour l'historique
  const oldCard = await getCardById(input.id)
  if (!oldCard) {
    throw new Error("Carte non trouvée")
  }

  const rows = await sql<Card[]>`
    UPDATE cards
    SET 
      cid = COALESCE(${input.cid}, cid),
      country = COALESCE(${input.country}, country),
      last_recharge_date = COALESCE(${input.last_recharge_date}, last_recharge_date),
      expiration_date = COALESCE(${input.expiration_date}, expiration_date),
      status = COALESCE(${input.status}, status),
      monthly_limit = COALESCE(${input.monthly_limit}, monthly_limit),
      recharge_limit = COALESCE(${input.recharge_limit}, recharge_limit),
      updated_at = NOW()
    WHERE id = ${input.id}::uuid
    RETURNING 
      id::text,
      cid,
      country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      recharge_limit,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  
  if (rows.length === 0) {
    throw new Error("Carte non trouvée")
  }
  
  const updatedCard = rows[0]

  // Enregistrer l'action dans l'historique
  if (input.updated_by) {
    const changes: string[] = []
    if (input.cid !== undefined && input.cid !== oldCard.cid) changes.push(`CID: ${oldCard.cid} → ${input.cid}`)
    if (input.country !== undefined && input.country !== oldCard.country) changes.push(`Pays: ${oldCard.country} → ${input.country}`)
    if (input.status !== undefined && input.status !== oldCard.status) changes.push(`Statut: ${oldCard.status} → ${input.status}`)
    if (input.monthly_limit !== undefined && input.monthly_limit !== oldCard.monthly_limit) changes.push(`Limite mensuelle: ${oldCard.monthly_limit} → ${input.monthly_limit}`)
    if (input.recharge_limit !== undefined && input.recharge_limit !== oldCard.recharge_limit) changes.push(`Limite recharge: ${oldCard.recharge_limit} → ${input.recharge_limit}`)
    if (input.expiration_date !== undefined && input.expiration_date !== oldCard.expiration_date) changes.push(`Date expiration: ${oldCard.expiration_date || 'N/A'} → ${input.expiration_date || 'N/A'}`)

    await logCardsAction({
      user_id: input.updated_by.id,
      user_name: input.updated_by.name,
      user_role: input.updated_by.role,
      action_type: 'update',
      action_description: `Modification de la carte ${updatedCard.cid}: ${changes.join(', ')}`,
      target_card_id: updatedCard.id,
      target_card_cid: updatedCard.cid,
      old_values: {
        cid: oldCard.cid,
        country: oldCard.country,
        status: oldCard.status,
        monthly_limit: oldCard.monthly_limit,
        recharge_limit: oldCard.recharge_limit,
        expiration_date: oldCard.expiration_date
      },
      new_values: {
        cid: updatedCard.cid,
        country: updatedCard.country,
        status: updatedCard.status,
        monthly_limit: updatedCard.monthly_limit,
        recharge_limit: updatedCard.recharge_limit,
        expiration_date: updatedCard.expiration_date
      },
      metadata: {
        changes: changes,
        updated_at: updatedCard.updated_at
      }
    })
  }
  
  return updatedCard
}

export async function deleteCard(id: string, deleted_by?: {
  id: string
  name: string
  role: string
}): Promise<void> {
  console.log('🔍 deleteCard appelée avec:', { id, deleted_by })
  
  // Récupérer les informations de la carte avant suppression
  const card = await getCardById(id)
  if (!card) {
    console.log('❌ Carte non trouvée:', id)
    throw new Error("Carte non trouvée")
  }
  
  console.log('📋 Carte trouvée:', card)

  // Enregistrer l'action dans l'historique AVANT de supprimer la carte
  if (deleted_by) {
    console.log('📝 Enregistrement de l\'action de suppression...')
    try {
      await logCardsAction({
        user_id: deleted_by.id,
        user_name: deleted_by.name,
        user_role: deleted_by.role,
        action_type: 'delete',
        action_description: `Suppression de la carte ${card.cid} (${card.country})`,
        target_card_id: card.id,
        target_card_cid: card.cid,
        old_values: {
          cid: card.cid,
          country: card.country,
          status: card.status,
          monthly_limit: card.monthly_limit,
          monthly_used: card.monthly_used,
          recharge_limit: card.recharge_limit,
          expiration_date: card.expiration_date,
          created_at: card.created_at
        },
        metadata: {
          deleted_at: new Date().toISOString(),
          card_info: {
            country: card.country,
            status: card.status,
            monthly_limit: card.monthly_limit,
            monthly_used: card.monthly_used
          }
        }
      })
      console.log('✅ Action de suppression enregistrée')
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de l\'action:', error)
      throw error // Propager l'erreur pour éviter la suppression si l'enregistrement échoue
    }
  } else {
    console.log('⚠️ Aucune information utilisateur fournie pour l\'enregistrement')
  }

  // Supprimer la carte APRÈS avoir enregistré l'action
  await sql`
    DELETE FROM cards WHERE id = ${id}::uuid
  `
  
  console.log('✅ Carte supprimée de la base')
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
      country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      recharge_limit,
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

// Nouvelle fonction pour la distribution en masse avec filtrage par pays
export async function getAvailableCardsForBulkDistribution(country?: "Mali" | "RDC" | "France" | "Congo"): Promise<Card[]> {
  const rows = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      recharge_limit,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    WHERE status = 'active'
      AND (expiration_date IS NULL OR expiration_date::date > CURRENT_DATE)
      ${country ? sql`AND country = ${country}` : sql``}
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

// Nouvelle fonction pour distribuer à des cartes spécifiques
export async function distributeAmountToSpecificCards(input: {
  amount: number
  country: "Mali" | "RDC" | "France" | "Congo"
  cardIds: string[]
  distributedBy: string
  distributedByUser?: {
    id: string
    name: string
    role: string
  }
}): Promise<DistributionResult> {
  const { amount, country, cardIds, distributedBy } = input
  
  // Récupérer les cartes spécifiques
  const cards = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      country,
      last_recharge_date::text as last_recharge_date,
      expiration_date::text as expiration_date,
      status,
      monthly_limit,
      monthly_used,
      recharge_limit,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM cards
    WHERE id = ANY(${cardIds}::uuid[])
    AND country = ${country}
    AND status = 'active'
    ORDER BY monthly_used ASC, created_at ASC
  `
  
  if (cards.length === 0) {
    throw new Error(`Aucune carte active trouvée pour le pays ${country}`)
  }
  
  const distributions: DistributionResult['distributions'] = []
  let remainingAmount = amount
  let totalDistributed = 0
  
  for (const card of cards) {
    if (remainingAmount <= 0) break
    
    // Calculer la disponibilité mensuelle (limite mensuelle - utilisation mensuelle)
    const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
    
    // Le montant à distribuer ne peut pas dépasser la disponibilité mensuelle
    // ni la limite de recharge par transaction
    const maxPerTransaction = Number(card.recharge_limit)
    const amountToDistribute = Math.min(
      remainingAmount, 
      Math.max(0, monthlyAvailable),
      maxPerTransaction
    )
    
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
      
      // Enregistrer l'historique de recharge
      await sql`
        INSERT INTO card_recharges (card_id, amount, recharged_by, recharge_date, notes)
        VALUES (${card.id}::uuid, ${amountToDistribute}, ${distributedBy}, NOW(), 'Distribution en masse')
      `
      
      distributions.push({
        card_id: card.id,
        cid: card.cid,
        country: card.country,
        amount: amountToDistribute,
        new_balance: Number(card.monthly_used) + amountToDistribute,
        remaining_limit: monthlyAvailable - amountToDistribute
      })
      
      totalDistributed += amountToDistribute
      remainingAmount -= amountToDistribute
    }
  }
  
  // Enregistrer l'action de distribution
  if (input.distributedByUser) {
    console.log('📝 Enregistrement de l\'action de distribution...')
    try {
      await logCardsAction({
        user_id: input.distributedByUser.id,
        user_name: input.distributedByUser.name,
        user_role: input.distributedByUser.role,
        action_type: 'distribute',
        action_description: `Distribution de ${totalDistributed.toLocaleString()} XAF sur ${distributions.length} cartes (${country})`,
        new_values: {
          total_distributed: totalDistributed,
          cards_used: distributions.length,
          country: country,
          remaining_amount: remainingAmount
        },
        metadata: {
          distributions: distributions.map(d => ({
            card_cid: d.cid,
            amount: d.amount,
            remaining_limit: d.remaining_limit
          })),
          distributed_at: new Date().toISOString(),
          country: country
        }
      })
      console.log('✅ Action de distribution enregistrée')
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de l\'action de distribution:', error)
    }
  } else {
    console.log('⚠️ Aucune information utilisateur fournie pour l\'enregistrement de la distribution')
  }
  
  return {
    total_distributed: totalDistributed,
    remaining_amount: remainingAmount,
    cards_used: distributions.length,
    country: country,
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
      COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_limit ELSE 0 END), 0) as total_limit,
      COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_used ELSE 0 END), 0) as total_used
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

export async function bulkCreateCardsFromExcel(
  cardsData: Array<{
  cid: string
    country?: string
  last_recharge_date?: string
  expiration_date?: string
  }>,
  importedBy?: {
    id: string
    name: string
    role: string
  }
): Promise<{
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
        country: cardData.country || 'Mali', // Utiliser le pays fourni ou Mali par défaut
        last_recharge_date: cardData.last_recharge_date,
        expiration_date: cardData.expiration_date,
        status: 'active',
        monthly_limit: 2000000
      }, true) // Skip individual action logging for bulk import
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
  
  // Enregistrer l'action d'importation globale
  if (importedBy && createdCards.length > 0) {
    await logCardsAction({
      user_id: importedBy.id,
      user_name: importedBy.name,
      user_role: importedBy.role,
      action_type: 'bulk_import',
      action_description: `Importation en masse de ${createdCards.length} cartes depuis Excel (${skippedCards.length} ignorées)`,
      new_values: {
        imported_count: createdCards.length,
        skipped_count: skippedCards.length,
        total_processed: cardsData.length
      },
      metadata: {
        imported_cards: createdCards.map(card => ({
          cid: card.cid,
          country: card.country,
          status: card.status
        })),
        skipped_cards: skippedCards,
        import_date: new Date().toISOString()
      }
    })
  }
  
  return {
    created: createdCards,
    skipped: skippedCards,
    total: cardsData.length
  }
}

// Types pour l'historique des recharges
export type CardRecharge = {
  id: string
  card_id: string
  amount: number
  recharged_by: string
  recharge_date: string
  notes?: string
  created_at: string
}

export type RechargeHistory = CardRecharge & {
  card_cid: string
  card_country: string
}

// Fonction pour obtenir l'historique des recharges
export async function getRechargeHistory(cardId?: string, country?: Country): Promise<RechargeHistory[]> {
  // Utiliser la vraie base de données si DATABASE_URL est disponible
  if (process.env.DATABASE_URL) {
    // Code pour la vraie base de données
    let query = sql<RechargeHistory[]>`
      SELECT 
        cr.id::text,
        cr.card_id::text,
        cr.amount,
        cr.recharged_by,
        cr.recharge_date::text as recharge_date,
        cr.notes,
        cr.created_at::text as created_at,
        c.cid as card_cid,
        c.country as card_country
      FROM card_recharges cr
      JOIN cards c ON cr.card_id = c.id
    `

    if (cardId) {
      query = sql<RechargeHistory[]>`
        SELECT 
          cr.id::text,
          cr.card_id::text,
          cr.amount,
          cr.recharged_by,
          cr.recharge_date::text as recharge_date,
          cr.notes,
          cr.created_at::text as created_at,
          c.cid as card_cid,
          c.country as card_country
        FROM card_recharges cr
        JOIN cards c ON cr.card_id = c.id
        WHERE cr.card_id = ${cardId}::uuid
      `
    }

    if (country) {
      query = sql<RechargeHistory[]>`
        SELECT 
          cr.id::text,
          cr.card_id::text,
          cr.amount,
          cr.recharged_by,
          cr.recharge_date::text as recharge_date,
          cr.notes,
          cr.created_at::text as created_at,
          c.cid as card_cid,
          c.country as card_country
        FROM card_recharges cr
        JOIN cards c ON cr.card_id = c.id
        WHERE c.country = ${country}
      `
    }

    if (cardId) {
      const rows = await sql<RechargeHistory[]>`
        SELECT 
          cr.id::text,
          cr.card_id::text,
          cr.amount,
          cr.recharged_by,
          cr.recharge_date::text as recharge_date,
          cr.notes,
          cr.created_at::text as created_at,
          c.cid as card_cid,
          c.country as card_country
        FROM card_recharges cr
        JOIN cards c ON cr.card_id = c.id
        WHERE cr.card_id = ${cardId}::uuid
        ORDER BY cr.recharge_date DESC
      `
      return rows
    }

    if (country) {
      const rows = await sql<RechargeHistory[]>`
        SELECT 
          cr.id::text,
          cr.card_id::text,
          cr.amount,
          cr.recharged_by,
          cr.recharge_date::text as recharge_date,
          cr.notes,
          cr.created_at::text as created_at,
          c.cid as card_cid,
          c.country as card_country
        FROM card_recharges cr
        JOIN cards c ON cr.card_id = c.id
        WHERE c.country = ${country}
        ORDER BY cr.recharge_date DESC
      `
      return rows
    }

    // Toutes les recharges
    const rows = await sql<RechargeHistory[]>`
      SELECT 
        cr.id::text,
        cr.card_id::text,
        cr.amount,
        cr.recharged_by,
        cr.recharge_date::text as recharge_date,
        cr.notes,
        cr.created_at::text as created_at,
        c.cid as card_cid,
        c.country as card_country
      FROM card_recharges cr
      JOIN cards c ON cr.card_id = c.id
      ORDER BY cr.recharge_date DESC
    `
    return rows
  }

  // En mode développement sans base de données, retourner des données mockées
    const mockHistory: RechargeHistory[] = [
      {
        id: "recharge-1",
        card_id: "card-1",
        amount: 100000,
        recharged_by: "Admin User",
        recharge_date: "2024-01-15T10:00:00Z",
        notes: "Recharge initiale",
        created_at: "2024-01-15T10:00:00Z",
        card_cid: "21174132",
        card_country: "Mali"
      },
      {
        id: "recharge-2",
        card_id: "card-2",
        amount: 200000,
        recharged_by: "Admin User",
        recharge_date: "2024-01-10T14:30:00Z",
        notes: "Recharge mensuelle",
        created_at: "2024-01-10T14:30:00Z",
        card_cid: "21174133",
        card_country: "RDC"
      },
      {
        id: "recharge-3",
        card_id: "card-4",
        amount: 150000,
        recharged_by: "Admin User",
        recharge_date: "2024-01-20T09:15:00Z",
        notes: "Recharge Congo",
        created_at: "2024-01-20T09:15:00Z",
        card_cid: "21174135",
        card_country: "Congo"
      }
    ]

    // Filtrer par carte ou pays si spécifié
    let filteredHistory = mockHistory
    if (cardId) {
      filteredHistory = filteredHistory.filter(recharge => recharge.card_id === cardId)
    }
    if (country) {
      filteredHistory = filteredHistory.filter(recharge => recharge.card_country === country)
    }

    return filteredHistory.sort((a, b) => new Date(b.recharge_date).getTime() - new Date(a.recharge_date).getTime())
  }

  // Code pour la vraie base de données

// Fonction pour enregistrer une recharge
export async function recordRecharge(
  cardId: string,
  amount: number,
  rechargedBy: string,
  notes?: string,
  rechargedByUser?: {
    id: string
    name: string
    role: string
  }
): Promise<CardRecharge> {
  // D'abord, mettre à jour la carte avec le montant utilisé
  await sql`
    UPDATE cards
    SET 
      monthly_used = monthly_used + ${amount},
      last_recharge_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = ${cardId}::uuid
  `

  // Ensuite, enregistrer l'historique de recharge
  const rows = await sql<CardRecharge[]>`
    INSERT INTO card_recharges (card_id, amount, recharged_by, notes)
    VALUES (${cardId}, ${amount}, ${rechargedBy}, ${notes || null})
    RETURNING 
      id::text,
      card_id::text,
      amount,
      recharged_by,
      recharge_date::text as recharge_date,
      notes,
      created_at::text as created_at
  `
  
  const recharge = rows[0]

  // Enregistrer l'action dans l'historique
  if (rechargedByUser) {
    // Récupérer les informations de la carte pour l'historique
    const card = await getCardById(cardId)
    if (card) {
      await logCardsAction({
        user_id: rechargedByUser.id,
        user_name: rechargedByUser.name,
        user_role: rechargedByUser.role,
        action_type: 'recharge',
        action_description: `Recharge de ${amount.toLocaleString()} XAF sur la carte ${card.cid} (${card.country})`,
        target_card_id: cardId,
        target_card_cid: card.cid,
        new_values: {
          recharge_amount: amount,
          recharge_date: recharge.recharge_date,
          notes: notes
        },
        metadata: {
          recharge_id: recharge.id,
          recharged_by: rechargedBy,
          card_country: card.country,
          card_monthly_limit: card.monthly_limit,
          card_monthly_used: card.monthly_used
        }
      })
    }
  }

  return recharge
}

// Fonction pour valider les limites de recharge
export async function validateRechargeLimits(
  cardId: string,
  rechargeAmount: number
): Promise<{ valid: boolean; reason?: string }> {
  const card = await sql<Card[]>`
    SELECT 
      id::text,
      cid,
      country,
      monthly_limit,
      monthly_used,
      recharge_limit
    FROM cards
    WHERE id = ${cardId}
  `

  if (card.length === 0) {
    return { valid: false, reason: "Carte non trouvée" }
  }

  const cardData = card[0]

  // Vérifier que le montant ne dépasse pas la limite de recharge par transaction
  if (rechargeAmount > Number(cardData.recharge_limit)) {
    return { 
      valid: false, 
      reason: `Montant de recharge (${rechargeAmount.toLocaleString()} XAF) dépasse la limite de recharge par transaction (${Number(cardData.recharge_limit).toLocaleString()} XAF)` 
    }
  }

  // Vérifier que le montant ne dépasse pas la limite mensuelle totale
  if (Number(cardData.monthly_used) + rechargeAmount > Number(cardData.monthly_limit)) {
    return { 
      valid: false, 
      reason: `La recharge dépasserait la limite mensuelle (${Number(cardData.monthly_limit).toLocaleString()} XAF)` 
    }
  }

  return { valid: true }
}

// Fonction pour mettre à jour les limites par pays
export async function updateCountryLimits(
  country: Country,
  monthlyLimit: number,
  rechargeLimit: number,
  updatedBy?: {
    id: string
    name: string
    role: string
  }
): Promise<void> {
  // Récupérer les anciennes limites pour l'historique
  const oldLimits = await sql`
    SELECT DISTINCT monthly_limit, recharge_limit
    FROM cards
    WHERE country = ${country}
    LIMIT 1
  `

  const oldMonthlyLimit = oldLimits[0]?.monthly_limit || 0
  const oldRechargeLimit = oldLimits[0]?.recharge_limit || 0

  await sql`
    UPDATE cards 
    SET 
      monthly_limit = ${monthlyLimit},
      recharge_limit = ${rechargeLimit},
      updated_at = NOW()
    WHERE country = ${country}
  `

  // Enregistrer l'action dans l'historique
  if (updatedBy) {
    await logCardsAction({
      user_id: updatedBy.id,
      user_name: updatedBy.name,
      user_role: updatedBy.role,
      action_type: 'update_country_limits',
      action_description: `Modification des plafonds pour ${country}: Limite mensuelle ${oldMonthlyLimit.toLocaleString()} → ${monthlyLimit.toLocaleString()} XAF, Limite recharge ${oldRechargeLimit.toLocaleString()} → ${rechargeLimit.toLocaleString()} XAF`,
      old_values: {
        country: country,
        monthly_limit: oldMonthlyLimit,
        recharge_limit: oldRechargeLimit
      },
      new_values: {
        country: country,
        monthly_limit: monthlyLimit,
        recharge_limit: rechargeLimit
      },
      metadata: {
        country: country,
        updated_at: new Date().toISOString(),
        affected_cards: await sql`SELECT COUNT(*) as count FROM cards WHERE country = ${country}`.then(result => result[0]?.count || 0)
      }
    })
  }
}

// Fonction pour obtenir les statistiques par pays
export async function getCountryStats(country?: Country): Promise<{
  totalCards: number
  activeCards: number
  totalMonthlyLimit: number
  totalMonthlyUsed: number
  totalRechargeLimit: number
  averageUsage: number
}> {
  // Utiliser la vraie base de données si DATABASE_URL est disponible
  if (process.env.DATABASE_URL) {
    // Code pour la vraie base de données
    let query = sql<{
      total_cards: number
      active_cards: number
      total_monthly_limit: number
      total_monthly_used: number
      total_recharge_limit: number
    }[]>`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
        SUM(monthly_limit) as total_monthly_limit,
        SUM(monthly_used) as total_monthly_used,
        SUM(recharge_limit) as total_recharge_limit
      FROM cards
    `

    if (country) {
      query = sql<{
        total_cards: number
        active_cards: number
        total_monthly_limit: number
        total_monthly_used: number
        total_recharge_limit: number
      }[]>`
        SELECT 
          COUNT(*) as total_cards,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
          SUM(monthly_limit) as total_monthly_limit,
          SUM(monthly_used) as total_monthly_used,
          SUM(recharge_limit) as total_recharge_limit
        FROM cards
        WHERE country = ${country}
      `
    }

    if (country) {
      const result = await sql<{
        total_cards: number
        active_cards: number
        total_monthly_limit: number
        total_monthly_used: number
        total_recharge_limit: number
      }[]>`
        SELECT 
          COUNT(*) as total_cards,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
          SUM(monthly_limit) as total_monthly_limit,
          SUM(monthly_used) as total_monthly_used,
          SUM(recharge_limit) as total_recharge_limit
        FROM cards
        WHERE country = ${country}
      `
      
      const stats = result[0]
      const averageUsage = stats.total_monthly_limit > 0 
        ? (stats.total_monthly_used / stats.total_monthly_limit) * 100 
        : 0

      return {
        totalCards: stats.total_cards,
        activeCards: stats.active_cards,
        totalMonthlyLimit: stats.total_monthly_limit,
        totalMonthlyUsed: stats.total_monthly_used,
        totalRechargeLimit: stats.total_recharge_limit,
        averageUsage: Math.round(averageUsage * 100) / 100
      }
    } else {
      const result = await sql<{
        total_cards: number
        active_cards: number
        total_monthly_limit: number
        total_monthly_used: number
        total_recharge_limit: number
      }[]>`
        SELECT 
          COUNT(*) as total_cards,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
          SUM(monthly_limit) as total_monthly_limit,
          SUM(monthly_used) as total_monthly_used,
          SUM(recharge_limit) as total_recharge_limit
        FROM cards
      `
      
      const stats = result[0]
      const averageUsage = stats.total_monthly_limit > 0 
        ? (stats.total_monthly_used / stats.total_monthly_limit) * 100 
        : 0

      return {
        totalCards: stats.total_cards,
        activeCards: stats.active_cards,
        totalMonthlyLimit: stats.total_monthly_limit,
        totalMonthlyUsed: stats.total_monthly_used,
        totalRechargeLimit: stats.total_recharge_limit,
        averageUsage: Math.round(averageUsage * 100) / 100
      }
    }
  }

  // En mode développement sans base de données, calculer les statistiques à partir des données mockées
    const mockCards: Card[] = [
      {
        id: "card-1",
        cid: "21174132",
        country: "Mali",
        last_recharge_date: "2024-01-15",
        expiration_date: "2025-12-31",
        status: "active",
        monthly_limit: 2400000,
        monthly_used: 500000,
        recharge_limit: 810000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z"
      },
      {
        id: "card-2",
        cid: "21174133",
        country: "RDC",
        last_recharge_date: "2024-01-10",
        expiration_date: "2025-11-30",
        status: "active",
        monthly_limit: 2500000,
        monthly_used: 1200000,
        recharge_limit: 550000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-10T00:00:00Z"
      },
      {
        id: "card-3",
        cid: "21174134",
        country: "France",
        last_recharge_date: null,
        expiration_date: "2025-10-31",
        status: "inactive",
        monthly_limit: 2500000,
        monthly_used: 0,
        recharge_limit: 650000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z"
      },
      {
        id: "card-4",
        cid: "21174135",
        country: "Congo",
        last_recharge_date: "2024-01-20",
        expiration_date: "2025-09-30",
        status: "active",
        monthly_limit: 2000000,
        monthly_used: 800000,
        recharge_limit: 800000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z"
      }
    ]

    // Filtrer par pays si spécifié
    const filteredCards = country ? mockCards.filter(card => card.country === country) : mockCards

    const totalCards = filteredCards.length
    const activeCards = filteredCards.filter(card => card.status === 'active').length
    const totalMonthlyLimit = filteredCards.reduce((sum, card) => sum + card.monthly_limit, 0)
    const totalMonthlyUsed = filteredCards.reduce((sum, card) => sum + card.monthly_used, 0)
    const totalRechargeLimit = filteredCards.reduce((sum, card) => sum + card.recharge_limit, 0)
    const averageUsage = totalMonthlyLimit > 0 ? (totalMonthlyUsed / totalMonthlyLimit) : 0

    return {
      totalCards,
      activeCards,
      totalMonthlyLimit,
      totalMonthlyUsed,
      totalRechargeLimit,
      averageUsage
    }
  }

  // Code pour la vraie base de données

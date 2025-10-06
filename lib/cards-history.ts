import { sql } from "@/lib/db"

export interface CardsActionHistoryEntry {
  user_id: string
  user_name: string
  user_role: string
  action_type: 'create' | 'update' | 'delete' | 'recharge' | 'distribute' | 'reset_usage' | 'import' | 'export'
  action_description: string
  target_card_id?: string
  target_card_cid?: string
  old_values?: any
  new_values?: any
  metadata?: any
  ip_address?: string
  user_agent?: string
}

/**
 * Enregistre une action dans l'historique des cartes
 */
export async function logCardsAction(entry: CardsActionHistoryEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO cards_action_history (
        user_id,
        user_name,
        user_role,
        action_type,
        action_description,
        target_card_id,
        target_card_cid,
        old_values,
        new_values,
        metadata,
        ip_address,
        user_agent
      ) VALUES (
        ${entry.user_id}::uuid,
        ${entry.user_name},
        ${entry.user_role},
        ${entry.action_type},
        ${entry.action_description},
        ${entry.target_card_id ? entry.target_card_id : null}::uuid,
        ${entry.target_card_cid || null},
        ${entry.old_values ? JSON.stringify(entry.old_values) : null},
        ${entry.new_values ? JSON.stringify(entry.new_values) : null},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null},
        ${entry.ip_address || null}::inet,
        ${entry.user_agent || null}
      )
    `
    
    console.log(`📝 Action enregistrée: ${entry.action_type} - ${entry.action_description}`)
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement de l\'action:', error)
    // Ne pas faire échouer l'opération principale si l'historique échoue
  }
}

/**
 * Récupère l'historique des actions sur les cartes
 */
export async function getCardsActionHistory(options: {
  limit?: number
  offset?: number
  action_type?: string
  user_id?: string
  target_card_id?: string
  date_from?: Date
  date_to?: Date
} = {}): Promise<{
  actions: any[]
  total: number
}> {
  const {
    limit = 50,
    offset = 0,
    action_type,
    user_id,
    target_card_id,
    date_from,
    date_to
  } = options

  // Construire la requête avec les conditions
  let query = sql`
    SELECT 
      id,
      user_id,
      user_name,
      user_role,
      action_type,
      action_description,
      target_card_id,
      target_card_cid,
      old_values,
      new_values,
      metadata,
      ip_address,
      user_agent,
      created_at
    FROM cards_action_history
  `
  
  let countQuery = sql`
    SELECT COUNT(*) as total
    FROM cards_action_history
  `

  // Ajouter les conditions WHERE
  if (action_type && action_type !== 'all') {
    query = sql`${query} WHERE action_type = ${action_type}`
    countQuery = sql`${countQuery} WHERE action_type = ${action_type}`
  }

  if (user_id) {
    const whereClause = (action_type && action_type !== 'all') ? 'AND' : 'WHERE'
    query = sql`${query} ${sql.unsafe(whereClause)} user_id = ${user_id}`
    countQuery = sql`${countQuery} ${sql.unsafe(whereClause)} user_id = ${user_id}`
  }

  if (target_card_id) {
    const whereClause = ((action_type && action_type !== 'all') || user_id) ? 'AND' : 'WHERE'
    query = sql`${query} ${sql.unsafe(whereClause)} target_card_id = ${target_card_id}`
    countQuery = sql`${countQuery} ${sql.unsafe(whereClause)} target_card_id = ${target_card_id}`
  }

  if (date_from) {
    const whereClause = ((action_type && action_type !== 'all') || user_id || target_card_id) ? 'AND' : 'WHERE'
    query = sql`${query} ${sql.unsafe(whereClause)} created_at >= ${date_from}`
    countQuery = sql`${countQuery} ${sql.unsafe(whereClause)} created_at >= ${date_from}`
  }

  if (date_to) {
    const whereClause = ((action_type && action_type !== 'all') || user_id || target_card_id || date_from) ? 'AND' : 'WHERE'
    query = sql`${query} ${sql.unsafe(whereClause)} created_at <= ${date_to}`
    countQuery = sql`${countQuery} ${sql.unsafe(whereClause)} created_at <= ${date_to}`
  }

  // Ajouter ORDER BY, LIMIT et OFFSET
  if (limit !== undefined && offset !== undefined) {
    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  } else {
    query = sql`${query} ORDER BY created_at DESC`
  }

  // Exécuter les requêtes
  const [totalResult, actions] = await Promise.all([
    countQuery,
    query
  ])
  
  const total = Number(totalResult[0]?.total || 0)

  return {
    actions: actions.map(action => {
      try {
        return {
          ...action,
          old_values: action.old_values ? JSON.parse(action.old_values) : null,
          new_values: action.new_values ? JSON.parse(action.new_values) : null,
          metadata: action.metadata ? JSON.parse(action.metadata) : null
        }
      } catch (error) {
        console.error('❌ Erreur lors du parsing JSON pour l\'action:', action.id, error)
        return {
          ...action,
          old_values: null,
          new_values: null,
          metadata: null
        }
      }
    }),
    total
  }
}

/**
 * Récupère les statistiques de l'historique des actions
 */
export async function getCardsActionHistoryStats(): Promise<{
  total_actions: number
  actions_by_type: Record<string, number>
  actions_by_user: Array<{ user_name: string; count: number }>
  recent_actions: number
}> {
  // Total des actions
  const totalResult = await sql`SELECT COUNT(*) as total FROM cards_action_history`
  const total_actions = Number(totalResult[0]?.total || 0)

  // Actions par type
  const actionsByTypeResult = await sql`
    SELECT action_type, COUNT(*) as count
    FROM cards_action_history
    GROUP BY action_type
    ORDER BY count DESC
  `
  const actions_by_type = actionsByTypeResult.reduce((acc, row) => {
    acc[row.action_type] = Number(row.count)
    return acc
  }, {} as Record<string, number>)

  // Actions par utilisateur
  const actionsByUserResult = await sql`
    SELECT user_name, COUNT(*) as count
    FROM cards_action_history
    GROUP BY user_name
    ORDER BY count DESC
    LIMIT 10
  `
  const actions_by_user = actionsByUserResult.map(row => ({
    user_name: row.user_name,
    count: Number(row.count)
  }))

  // Actions récentes (dernières 24h)
  const recentResult = await sql`
    SELECT COUNT(*) as count
    FROM cards_action_history
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `
  const recent_actions = Number(recentResult[0]?.count || 0)

  return {
    total_actions,
    actions_by_type,
    actions_by_user,
    recent_actions
  }
}

/**
 * Récupère la liste des utilisateurs pour le filtre
 */
export async function getCardsActionHistoryUsers(): Promise<Array<{id: string, name: string}>> {
  const result = await sql`
    SELECT DISTINCT user_id, user_name
    FROM cards_action_history
    ORDER BY user_name ASC
  `
  
  return result.map(row => ({
    id: row.user_id,
    name: row.user_name
  }))
}

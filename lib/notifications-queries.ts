import "server-only"
import { sql } from "./db"

export type Notification = {
  id: string
  message: string
  target_role: string | null
  target_user_name: string | null
  read: boolean
  created_at: string
}

export async function createNotification(input: {
  message: string
  target_role?: string | null
  target_user_name?: string | null
}): Promise<Notification> {
  const rows = await sql<Notification[]>`
    INSERT INTO notifications (message, target_role, target_user_name)
    VALUES (${input.message}, ${input.target_role ?? null}, ${input.target_user_name ?? null})
    RETURNING id::text, message, target_role, target_user_name, read, created_at::text;
  `
  return rows[0]
}

export async function listUnreadNotifications(params: { role: string; userName: string; limit?: number }): Promise<Notification[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const rows = await sql<Notification[]>`
    SELECT id::text, message, target_role, target_user_name, read, created_at::text
    FROM notifications
    WHERE read = FALSE
      AND (target_role = ${params.role} OR target_user_name = ${params.userName})
    ORDER BY created_at ASC
    LIMIT ${limit};
  `
  return rows
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  await sql`UPDATE notifications SET read = TRUE WHERE id = ANY(${ids}::uuid[]);`
}



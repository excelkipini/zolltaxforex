import { sql } from "@/lib/db"

const allowDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true"

export async function GET(req: Request) {
  if (!allowDev) return new Response("Forbidden", { status: 403 })
  const url = new URL(req.url)
  const email = (url.searchParams.get("email") || "").trim()
  if (!email) return new Response(JSON.stringify({ error: "email requis" }), { status: 400 })

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate')),
      agency TEXT NOT NULL DEFAULT 'Non assigné',
      last_login TIMESTAMPTZ,
      password_hash TEXT
    );
  `

  const rows = await sql<{ id: string; has_hash: boolean }[]>`
    SELECT id::text AS id, (password_hash IS NOT NULL AND length(password_hash) > 0) AS has_hash
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1;
  `

  if (!rows.length) {
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }

  return new Response(JSON.stringify({ exists: true, id: rows[0].id, has_hash: rows[0].has_hash }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}

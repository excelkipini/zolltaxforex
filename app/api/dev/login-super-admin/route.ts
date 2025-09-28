import { createSessionCookie } from "@/lib/auth"
import { sql } from "@/lib/db"
import bcrypt from "bcryptjs"

// Allow in dev by default; in prod only if explicitly enabled via ALLOW_DEV_LOGIN=true
const allowDevLogin = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true"

export async function GET() {
  if (!allowDevLogin) {
    return new Response("Forbidden", { status: 403 })
  }

  // Defaults can be overridden by env
  const email = (process.env.ADMIN_EMAIL || "admin@zolltaxforex.com").trim()
  const name = (process.env.ADMIN_NAME || "Super Admin").trim()
  const role = "super_admin" as const
  const agency = "Agence Centrale"
  const password = process.env.ADMIN_PASSWORD?.trim() // optional

  // Ensure users table exists (idempotent)
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

  // Find by email
  const found = await sql<{ id: string }[]>`
    SELECT id::text AS id
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1;
  `

  let userId: string
  if (found.length) {
    userId = found[0].id
    // Update role/name/agency, and optionally password
    let hash: string | null = null
    if (password && password.length >= 8) {
      hash = await bcrypt.hash(password, 10)
    }
    await sql`
      UPDATE users
      SET name = ${name},
          role = ${role},
          agency = COALESCE(agency, ${agency}),
          password_hash = COALESCE(${hash}, password_hash)
      WHERE id = ${userId}::uuid;
    `
  } else {
    // Insert new super admin
    // Use Postgres gen_random_uuid() if available, otherwise generate in app
    let id: string | null = null
    try {
      const r = await sql<{ id: string }[]>`
        SELECT gen_random_uuid()::text AS id;
      `
      id = r?.[0]?.id ?? null
    } catch {
      // ignore, will generate in app
    }
    userId = id ?? globalThis.crypto?.randomUUID?.() ?? `u_${Date.now()}`
    const hash = password && password.length >= 8 ? await bcrypt.hash(password, 10) : null

    await sql`
      INSERT INTO users (id, name, email, role, agency, password_hash)
      VALUES (${userId}::uuid, ${name}, ${email}, ${role}, ${agency}, ${hash});
    `
  }

  // Set session cookie and redirect to dashboard
  await createSessionCookie({
    id: userId,
    name,
    email,
    role,
  })

  // Optional: touch last_login
  try {
    await sql`
      UPDATE users SET last_login = NOW() WHERE id = ${userId}::uuid;
    `
  } catch {
    // ignore
  }

  const html = `<!doctype html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Connexion Super Admin</title>
    <meta http-equiv="refresh" content="0; url=/dashboard" />
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; color:#111827; }
      .box { text-align:center; padding:24px; border:1px solid #e5e7eb; border-radius:12px; max-width:420px; }
      .btn { display:inline-block; margin-top:12px; padding:8px 14px; background:#111827; color:#fff; text-decoration:none; border-radius:8px; }
      .muted { color:#6b7280; font-size:12px; margin-top:6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Connexion en cours…</h1>
      <p>Votre session Super Admin a été créée. Redirection vers le tableau de bord.</p>
      <a class="btn" href="/dashboard">Aller au tableau de bord</a>
      <div class="muted">Si la redirection ne démarre pas automatiquement, cliquez sur le bouton ci-dessus.</div>
      <script>window.location.replace('/dashboard')</script>
    </div>
  </body>
  </html>`

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

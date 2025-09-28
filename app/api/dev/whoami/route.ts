import { getSession } from "@/lib/auth"

const allowDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true"

export async function GET() {
  if (!allowDev) return new Response("Forbidden", { status: 403 })
  const s = await getSession()
  return new Response(JSON.stringify({ session: s }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}

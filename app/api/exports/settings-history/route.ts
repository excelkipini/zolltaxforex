import { getSettingsHistoryFiltered } from "@/lib/settings-queries"

// Simple CSV escape: wrap with quotes if the field includes ", or newline. Double quotes are escaped.
function csvEscape(v: unknown) {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limitParam = url.searchParams.get("limit")
  const from = url.searchParams.get("from") || undefined
  const to = url.searchParams.get("to") || undefined
  const user = url.searchParams.get("user") || undefined
  const field = url.searchParams.get("field") || undefined

  let limit = Number.parseInt(limitParam || "500", 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = 500
  limit = Math.min(limit, 5000)

  const items = await getSettingsHistoryFiltered({
    from,
    to,
    user,
    field,
    limit,
  })

  const header = ["id", "changed_at", "user_name", "field", "old_value", "new_value"]
  const rows = items.map((r) => [
    csvEscape(r.id),
    csvEscape(r.changed_at),
    csvEscape(r.user_name),
    csvEscape(r.field),
    csvEscape(r.old_value),
    csvEscape(r.new_value),
  ])
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")

  const today = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="settings-history_${today}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}

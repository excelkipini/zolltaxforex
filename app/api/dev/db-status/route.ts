import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Test connection
    const connectionTest = await sql`SELECT 1 as test, NOW() as timestamp`

    // Get database info
    const dbInfo = await sql`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as version
    `

    // Get table info
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    // Get data counts
    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const result = await sql`SELECT COUNT(*) as count FROM ${sql(table.table_name)}`
        counts[table.table_name] = Number(result[0].count)
      } catch {
        counts[table.table_name] = -1 // Error counting
      }
    }

    return NextResponse.json({
      status: "connected",
      timestamp: connectionTest[0].timestamp,
      database: {
        name: dbInfo[0].database_name,
        user: dbInfo[0].user_name,
        version: dbInfo[0].version.split(" ").slice(0, 2).join(" "),
      },
      tables: tables.map((t) => t.table_name),
      counts,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

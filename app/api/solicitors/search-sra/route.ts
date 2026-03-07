import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchSRAByFirmName } from "@/lib/sra-search"

/**
 * GET /api/solicitors/search-sra?q={firmName}
 * Searches the SRA register and returns matches with their SRA numbers.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const results = await searchSRAByFirmName(q)
  return NextResponse.json({ results })
}

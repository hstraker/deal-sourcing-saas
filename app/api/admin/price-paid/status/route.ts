/**
 * GET /api/admin/price-paid/status
 *
 * Returns PPD import stats and recent import history.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPpdStats } from "@/lib/price-paid"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [stats, recentImports] = await Promise.all([
    getPpdStats(),
    prisma.pricePaidImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  return NextResponse.json({ stats, recentImports })
}

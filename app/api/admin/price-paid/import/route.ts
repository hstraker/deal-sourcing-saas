/**
 * POST /api/admin/price-paid/import
 *
 * Starts a Price Paid Data import for a given year (or 0 = full dataset).
 * Runs in the background; returns 202 Accepted immediately.
 *
 * Body: { year: number }  // 1995–present, or 0 for the complete dataset
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { downloadAndImportPpd } from "@/lib/price-paid"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let year: number
  try {
    const body = await request.json()
    year = parseInt(body.year ?? "0", 10)
    if (isNaN(year) || (year !== 0 && (year < 1995 || year > new Date().getFullYear()))) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Check for already-running import
  const running = await prisma.pricePaidImport.findFirst({
    where: { status: { in: ["RUNNING", "PENDING"] } },
    select: { id: true, year: true },
  })
  if (running) {
    return NextResponse.json(
      { error: "An import is already running", runningImport: running },
      { status: 409 }
    )
  }

  // Create import record
  const importRecord = await prisma.pricePaidImport.create({
    data: { year, status: "PENDING" },
  })

  // Fire-and-forget
  downloadAndImportPpd(year, importRecord.id).catch((err) => {
    console.error("[PPD] Background import failed:", err)
  })

  return NextResponse.json(
    {
      success: true,
      message: `PPD import started for ${year === 0 ? "full dataset" : `year ${year}`}`,
      importId: importRecord.id,
    },
    { status: 202 }
  )
}

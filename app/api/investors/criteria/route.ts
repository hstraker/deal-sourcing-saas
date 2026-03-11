import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/** Lightweight endpoint — returns only the criteria fields needed for client-side match scoring. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const investors = await prisma.investor.findMany({
      where: {
        OR: [
          { preferredAreas: { isEmpty: false } },
          { minBudget: { not: null } },
          { maxBudget: { not: null } },
          { minYield: { not: null } },
          { minBmv: { not: null } },
          { strategy: { isEmpty: false } },
        ],
      },
      select: {
        id: true,
        preferredAreas: true,
        minBudget: true,
        maxBudget: true,
        minYield: true,
        minBmv: true,
        strategy: true,
        user: { select: { firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(
      investors.map((inv) => ({
        id: inv.id,
        name: [inv.user.firstName, inv.user.lastName].filter(Boolean).join(" ") || "—",
        preferredAreas: inv.preferredAreas,
        minBudget: inv.minBudget ?? null,
        maxBudget: inv.maxBudget ?? null,
        minYield: inv.minYield ? Number(inv.minYield) : null,
        minBmv: inv.minBmv ? Number(inv.minBmv) : null,
        strategy: inv.strategy,
      }))
    )
  } catch (error) {
    console.error("Error fetching investor criteria:", error)
    return NextResponse.json({ error: "Failed to fetch investor criteria" }, { status: 500 })
  }
}

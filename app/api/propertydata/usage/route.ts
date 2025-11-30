import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/propertydata/usage - Get API usage stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get usage for current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const usage = await prisma.propertyDataCache.aggregate({
      where: {
        fetchedAt: {
          gte: startOfMonth,
        },
      },
      _sum: {
        creditsUsed: true,
      },
      _count: {
        id: true,
      },
    })

    return NextResponse.json({
      creditsUsed: usage._sum.creditsUsed || 0,
      creditsRemaining: 2000 - (usage._sum.creditsUsed || 0),
      requestsThisMonth: usage._count.id || 0,
      limit: 2000,
    })
  } catch (error) {
    console.error("Error fetching usage stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    )
  }
}


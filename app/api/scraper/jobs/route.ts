import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)

    const jobs = await prisma.scraperJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        source: true,
        category: true,
        status: true,
        totalFound: true,
        successful: true,
        failed: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      jobs: jobs.map(j => ({
        ...j,
        startedAt:   j.startedAt?.toISOString()   ?? null,
        completedAt: j.completedAt?.toISOString()  ?? null,
        createdAt:   j.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[Scraper Jobs API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}

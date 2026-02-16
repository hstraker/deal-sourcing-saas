import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { jobId } = params

    const job = await prisma.scraperJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json(
        { error: "Scraper job not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        source: job.source,
        category: job.category,
        criteria: job.criteria,
        status: job.status,
        progress: {
          totalFound: job.totalFound,
          processed: job.processed,
          successful: job.successful,
          failed: job.failed,
        },
        errors: job.errors,
        propertiesFound: job.propertiesFound,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        createdAt: job.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[Scraper Status API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch scraper job status" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * POST /api/scraper/cancel
 * Cancel a specific job (by id) OR all stuck QUEUED/RUNNING jobs (when no id given).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const jobId: string | undefined = body?.jobId

    if (jobId) {
      // Cancel a specific job
      const job = await prisma.scraperJob.findUnique({ where: { id: jobId }, select: { status: true } })
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
      if (!["QUEUED", "RUNNING"].includes(job.status)) {
        return NextResponse.json({ error: "Job is not running", status: job.status }, { status: 400 })
      }
      await prisma.scraperJob.update({
        where: { id: jobId },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          errors: [{ message: "Manually cancelled by user", timestamp: new Date().toISOString() }] as any,
        },
      })
      return NextResponse.json({ success: true, cancelled: 1 })
    }

    // No jobId — cancel ALL stuck QUEUED/RUNNING jobs
    const result = await prisma.scraperJob.updateMany({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        errors: [{ message: "Manually cancelled (bulk clear)", timestamp: new Date().toISOString() }] as any,
      },
    })

    return NextResponse.json({ success: true, cancelled: result.count })
  } catch (error: any) {
    console.error("[Scraper Cancel API] Error:", error)
    return NextResponse.json({ error: "Failed to cancel jobs" }, { status: 500 })
  }
}

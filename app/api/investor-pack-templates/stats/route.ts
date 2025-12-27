import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/investor-pack-templates/stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Total generated
    const totalGenerated = await prisma.investorPackGeneration.count()

    // Last 30 days
    const last30Days = await prisma.investorPackGeneration.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    // Last 7 days
    const last7Days = await prisma.investorPackGeneration.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    })

    // Most used template
    const templatesUsage = await prisma.investorPackGeneration.groupBy({
      by: ['templateId'],
      _count: true,
      orderBy: {
        _count: {
          templateId: 'desc',
        },
      },
      take: 1,
    })

    let mostUsedTemplate = null
    if (templatesUsage.length > 0 && templatesUsage[0].templateId) {
      const template = await prisma.investorPackTemplate.findUnique({
        where: { id: templatesUsage[0].templateId },
        select: { name: true },
      })

      if (template) {
        mostUsedTemplate = {
          name: template.name,
          count: templatesUsage[0]._count,
        }
      }
    }

    // Recent generations
    const recentGenerations = await prisma.investorPackGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        template: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      totalGenerated,
      last30Days,
      last7Days,
      mostUsedTemplate,
      recentGenerations,
    })
  } catch (error: any) {
    console.error("Error fetching stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/investor-pack-templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templates = await prisma.investorPackTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// POST /api/investor-pack-templates
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    const template = await prisma.investorPackTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        isDefault: false, // Can only set one default at a time
        isActive: body.isActive ?? true,
        templateType: body.templateType || 'single',
        coverStyle: body.coverStyle || null,
        colorScheme: body.colorScheme || 'blue',
        orientation: body.orientation || 'landscape',
        // Company info now comes from global CompanyProfile table
        sections: body.sections || [],
        metricsConfig: body.metricsConfig || {},
        // 4-part template fields
        part1Enabled: body.part1Enabled ?? true,
        part1Sections: body.part1Sections || [],
        part2Enabled: body.part2Enabled ?? true,
        part2Sections: body.part2Sections || [],
        part3Enabled: body.part3Enabled ?? true,
        part3Sections: body.part3Sections || [],
        part4Enabled: body.part4Enabled ?? true,
        part4Sections: body.part4Sections || [],
        includeRiskWarnings: body.includeRiskWarnings ?? true,
        customFields: body.customFields || null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}

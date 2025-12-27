import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/investor-pack-templates/[id]/duplicate
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get the original template
    const original = await prisma.investorPackTemplate.findUnique({
      where: { id: params.id },
    })

    if (!original) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Create a duplicate
    const duplicate = await prisma.investorPackTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        isDefault: false, // Copies are never default
        isActive: original.isActive,
        templateType: original.templateType,
        coverStyle: original.coverStyle,
        colorScheme: original.colorScheme,
        orientation: original.orientation,
        // Company info now comes from global CompanyProfile table
        sections: original.sections as any,
        metricsConfig: original.metricsConfig as any,
        // 4-part template fields
        part1Enabled: original.part1Enabled,
        part1Sections: original.part1Sections as any,
        part2Enabled: original.part2Enabled,
        part2Sections: original.part2Sections as any,
        part3Enabled: original.part3Enabled,
        part3Sections: original.part3Sections as any,
        part4Enabled: original.part4Enabled,
        part4Sections: original.part4Sections as any,
        includeRiskWarnings: original.includeRiskWarnings,
        customFields: original.customFields as any,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ template: duplicate }, { status: 201 })
  } catch (error: any) {
    console.error("Error duplicating template:", error)
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 }
    )
  }
}

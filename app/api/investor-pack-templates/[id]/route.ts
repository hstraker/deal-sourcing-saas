import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH /api/investor-pack-templates/[id]
export async function PATCH(
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

    const body = await request.json()

    const template = await prisma.investorPackTemplate.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description || null,
        isActive: body.isActive,
        templateType: body.templateType,
        coverStyle: body.coverStyle,
        colorScheme: body.colorScheme,
        orientation: body.orientation,
        // Company info now comes from global CompanyProfile table
        sections: body.sections,
        metricsConfig: body.metricsConfig,
        // 4-part template fields
        part1Enabled: body.part1Enabled,
        part1Sections: body.part1Sections,
        part2Enabled: body.part2Enabled,
        part2Sections: body.part2Sections,
        part3Enabled: body.part3Enabled,
        part3Sections: body.part3Sections,
        part4Enabled: body.part4Enabled,
        part4Sections: body.part4Sections,
        includeRiskWarnings: body.includeRiskWarnings,
        customFields: body.customFields || null,
      },
    })

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    )
  }
}

// DELETE /api/investor-pack-templates/[id]
export async function DELETE(
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

    // Check if it's the default template
    const template = await prisma.investorPackTemplate.findUnique({
      where: { id: params.id },
    })

    if (template?.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default template" },
        { status: 400 }
      )
    }

    await prisma.investorPackTemplate.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}

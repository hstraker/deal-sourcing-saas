import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/investor-pack-templates/[id]/set-default
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

    // Remove default from all templates
    await prisma.investorPackTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })

    // Set this template as default
    const template = await prisma.investorPackTemplate.update({
      where: { id: params.id },
      data: { isDefault: true },
    })

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error("Error setting default template:", error)
    return NextResponse.json(
      { error: "Failed to set default template" },
      { status: 500 }
    )
  }
}

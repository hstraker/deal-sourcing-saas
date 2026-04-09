import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/vendor-leads/[id]/photos
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const photos = await prisma.propertyPhoto.findMany({
    where: { vendorLeadId: params.id, isDeleted: false },
    orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
  })
  return NextResponse.json({ photos })
}

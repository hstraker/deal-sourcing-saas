import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomBytes } from "crypto"

// POST /api/vendor-leads/[id]/photos/upload-session
// Creates (or refreshes) the public upload token so the vendor can upload photos via link/QR code.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = randomBytes(24).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const lead = await prisma.vendorLead.update({
    where: { id: params.id },
    data: {
      photoUploadToken: token,
      photoUploadExpiresAt: expiresAt,
    },
    select: { id: true, vendorName: true, propertyAddress: true, photoUploadToken: true, photoUploadExpiresAt: true },
  })

  const uploadUrl = `${process.env.NEXTAUTH_URL ?? ""}/upload/${token}`
  return NextResponse.json({ ...lead, uploadUrl })
}

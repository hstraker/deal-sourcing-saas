import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateS3Key, getSignedUploadUrl, getPublicUrl } from "@/lib/s3"

// POST /api/vendor-leads/[id]/photos/sourcer-upload
// Handles presign → S3 upload → confirm flow for sourcer direct uploads.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const lead = await prisma.vendorLead.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const body = await request.json()

  if (body.action === "presign") {
    const { filename, contentType, sizeBytes } = body
    if (!filename || !contentType?.startsWith("image/") || !sizeBytes) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    if (sizeBytes > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 })
    }
    const s3Key = generateS3Key(`vendor-photos/${lead.id}`, filename)
    const uploadUrl = await getSignedUploadUrl(s3Key, contentType, 900)
    return NextResponse.json({ uploadUrl, s3Key, publicUrl: getPublicUrl(s3Key) })
  }

  if (body.action === "confirm") {
    const { s3Key, filename, contentType, sizeBytes } = body
    if (!s3Key) return NextResponse.json({ error: "Missing s3Key" }, { status: 400 })
    try {
      const photo = await prisma.propertyPhoto.create({
        data: {
          vendorLeadId: lead.id,
          source: "vendor_upload",
          s3Key,
          url: getPublicUrl(s3Key),
          filename,
          mimeType: contentType,
          sizeBytes,
        },
      })
      return NextResponse.json({ success: true, photo })
    } catch (err: any) {
      console.error("[sourcer-upload confirm]", err)
      return NextResponse.json({ error: "Failed to save photo record", detail: err?.message ?? String(err) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

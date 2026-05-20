import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateS3Key, getSignedUploadUrl, getPublicUrl } from "@/lib/s3"

// POST /api/vendor-leads/[id]/floorplan
// body: { action: "presign", filename, contentType, sizeBytes }
//   → { uploadUrl, s3Key, publicUrl }
// body: { action: "confirm", s3Key, filename, contentType, sizeBytes }
//   → { success, photo }
//
// DELETE /api/vendor-leads/[id]/floorplan?photoId=xxx
//   → { success }

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const lead = await prisma.vendorLead.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const body = await request.json()

  if (body.action === "presign") {
    const { filename, contentType, sizeBytes } = body as {
      filename: string
      contentType: string
      sizeBytes: number
    }
    if (!filename || !contentType || !sizeBytes) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    if (!contentType.startsWith("image/") && contentType !== "application/pdf") {
      return NextResponse.json({ error: "Only images and PDFs are allowed" }, { status: 400 })
    }
    if (sizeBytes > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 })
    }
    const s3Key = generateS3Key(`vendor-floorplans/${lead.id}`, filename)
    const uploadUrl = await getSignedUploadUrl(s3Key, contentType, 900)
    return NextResponse.json({ uploadUrl, s3Key, publicUrl: getPublicUrl(s3Key) })
  }

  if (body.action === "confirm") {
    const { s3Key, filename, contentType, sizeBytes } = body as {
      s3Key: string
      filename: string
      contentType: string
      sizeBytes: number
    }
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
    } catch (err: unknown) {
      console.error("[floorplan confirm]", err)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: "Failed to save floorplan record", detail: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const photoId = searchParams.get("photoId")
  if (!photoId) return NextResponse.json({ error: "Missing photoId" }, { status: 400 })

  const photo = await prisma.propertyPhoto.findUnique({ where: { id: photoId } })
  if (!photo || photo.vendorLeadId !== params.id) {
    return NextResponse.json({ error: "Floorplan not found" }, { status: 404 })
  }

  await prisma.propertyPhoto.delete({ where: { id: photoId } })

  return NextResponse.json({ success: true })
}

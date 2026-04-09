import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateS3Key, getSignedUploadUrl, getPublicUrl } from "@/lib/s3"
import { z } from "zod"

// GET /api/upload/[token] — verify token and return lead info
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const lead = await prisma.vendorLead.findUnique({
    where: { photoUploadToken: params.token },
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      photoUploadExpiresAt: true,
      photos: {
        where: { isDeleted: false },
        select: { id: true, url: true, aiRoomType: true, aiCondition: true, aiConditionScore: true, uploadedAt: true },
        orderBy: { uploadedAt: "asc" },
      },
    },
  })

  if (!lead) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (lead.photoUploadExpiresAt && lead.photoUploadExpiresAt < new Date()) {
    return NextResponse.json({ error: "Upload link has expired" }, { status: 410 })
  }

  return NextResponse.json(lead)
}

const presignSchema = z.object({
  filename: z.string(),
  contentType: z.string().regex(/^image\//),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024), // 20MB max
})

// POST /api/upload/[token]/presign — generate presigned S3 URL for direct upload
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const lead = await prisma.vendorLead.findUnique({
    where: { photoUploadToken: params.token },
    select: { id: true, photoUploadExpiresAt: true },
  })

  if (!lead) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (lead.photoUploadExpiresAt && lead.photoUploadExpiresAt < new Date()) {
    return NextResponse.json({ error: "Upload link has expired" }, { status: 410 })
  }

  const body = await request.json()
  const action = body.action as string

  if (action === "presign") {
    const parsed = presignSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const { filename, contentType, sizeBytes } = parsed.data
    const s3Key = generateS3Key(`vendor-photos/${lead.id}`, filename)
    const uploadUrl = await getSignedUploadUrl(s3Key, contentType, 900) // 15 min expiry
    return NextResponse.json({ uploadUrl, s3Key, publicUrl: getPublicUrl(s3Key) })
  }

  if (action === "confirm") {
    const { s3Key, filename, contentType, sizeBytes } = body as {
      s3Key: string
      filename: string
      contentType: string
      sizeBytes: number
    }
    if (!s3Key) return NextResponse.json({ error: "Missing s3Key" }, { status: 400 })

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
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

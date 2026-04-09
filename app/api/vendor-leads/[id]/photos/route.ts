import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateS3Key, getSignedUploadUrl, getPublicUrl } from "@/lib/s3"
import { z } from "zod"

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

const presignSchema = z.object({
  action: z.literal("presign"),
  filename: z.string(),
  contentType: z.string().regex(/^image\//),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
})

const confirmSchema = z.object({
  action: z.literal("confirm"),
  s3Key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
})

// POST /api/vendor-leads/[id]/photos — sourcer direct upload (presign or confirm)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const lead = await prisma.vendorLead.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const body = await request.json()

  if (body.action === "presign") {
    const parsed = presignSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    const { filename, contentType, sizeBytes } = parsed.data
    const s3Key = generateS3Key(`vendor-photos/${lead.id}`, filename)
    const uploadUrl = await getSignedUploadUrl(s3Key, contentType, 900)
    return NextResponse.json({ uploadUrl, s3Key, publicUrl: getPublicUrl(s3Key) })
  }

  if (body.action === "confirm") {
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    const { s3Key, filename, contentType, sizeBytes } = parsed.data
    const photo = await prisma.propertyPhoto.create({
      data: {
        vendorLeadId: lead.id,
        source: "sourcer_upload",
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

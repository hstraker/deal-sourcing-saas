import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createConversationSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  message: z.string().min(1, "Message is required"),
  aiResponse: z.string().optional(),
  intent: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  videoSent: z.boolean().optional(),
  videoUrl: z.string().optional(),
  messageId: z.string().optional(),
  provider: z.string().optional(),
})

// GET /api/vendors/[id]/conversations - Get all conversations for a vendor
export async function GET(
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

    const conversations = await prisma.vendorAIConversation.findMany({
      where: { vendorId: params.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }
}

// POST /api/vendors/[id]/conversations - Create a new conversation entry
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

    const body = await request.json()
    const validatedData = createConversationSchema.parse(body)

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
    })

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    const conversation = await prisma.vendorAIConversation.create({
      data: {
        vendorId: params.id,
        direction: validatedData.direction,
        message: validatedData.message,
        aiResponse: validatedData.aiResponse,
        intent: validatedData.intent,
        confidence: validatedData.confidence,
        videoSent: validatedData.videoSent || false,
        videoUrl: validatedData.videoUrl,
        messageId: validatedData.messageId,
        provider: validatedData.provider,
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating conversation:", error)
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    )
  }
}


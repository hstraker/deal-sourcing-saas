import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { appendStatusHistory } from "@/lib/status-history"

const statusUpdateSchema = z.object({
  status: z.enum(["new", "review", "in_progress", "ready", "listed", "reserved", "sold", "archived"]),
  assignedToId: z.string().uuid().optional().nullable(),
  note: z.string().max(200).optional(),
})

export async function PUT(
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

    const existingDeal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (
      session.user.role === "sourcer" &&
      existingDeal.assignedToId !== session.user.id &&
      existingDeal.createdById !== session.user.id &&
      existingDeal.assignedToId !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = await request.json()
    const parsed = statusUpdateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const now = new Date()
    const statusChanged = data.status !== existingDeal.status

    const updatedDeal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        status: data.status,
        assignedToId: data.assignedToId === undefined ? existingDeal.assignedToId : data.assignedToId,
        statusUpdatedAt: statusChanged ? now : undefined,
        statusHistory: (statusChanged
          ? appendStatusHistory(existingDeal.statusHistory, {
              status: data.status,
              changedAt: now.toISOString(),
              changedBy: session.user.id,
              note: data.note ?? "Pipeline update",
            })
          : undefined) as any,
        listedAt: statusChanged && data.status === "listed" ? now : undefined,
        archivedAt: statusChanged && data.status === "archived" ? now : undefined,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        photos: {
          where: { isCover: true },
          take: 1,
        },
      },
    })

    return NextResponse.json(updatedDeal)
  } catch (error) {
    console.error("Error updating deal status:", error)
    return NextResponse.json(
      { error: "Failed to update deal status" },
      { status: 500 }
    )
  }
}



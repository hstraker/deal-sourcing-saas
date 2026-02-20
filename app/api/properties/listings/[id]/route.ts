import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!["admin", "sourcer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    if (typeof body.isFavorited === "boolean") {
      const updated = await prisma.propertyListing.update({
        where: { id: params.id },
        data: { isFavorited: body.isFavorited },
        select: { id: true, isFavorited: true },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  } catch (error) {
    console.error("[Properties PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update property" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!["admin", "sourcer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.propertyListing.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Properties DELETE] Error:", error)
    return NextResponse.json(
      { error: "Failed to delete property" },
      { status: 500 }
    )
  }
}

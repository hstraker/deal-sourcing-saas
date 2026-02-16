import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { resumeImport } from "@/lib/land-registry"

// POST /api/admin/land-registry/import/[id]/resume
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await resumeImport(params.id)

    return NextResponse.json({ message: "Import resumed" })
  } catch (error: any) {
    console.error("Error resuming import:", error)
    return NextResponse.json(
      { error: error.message || "Failed to resume import" },
      { status: 400 }
    )
  }
}


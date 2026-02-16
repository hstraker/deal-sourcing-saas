import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getImportStats } from "@/lib/land-registry"

// GET /api/admin/land-registry/status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [stats, recentImports] = await Promise.all([
      getImportStats(),
      prisma.landRegistryImport.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    return NextResponse.json({ stats, recentImports })
  } catch (error) {
    console.error("Error fetching Land Registry status:", error)
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    )
  }
}

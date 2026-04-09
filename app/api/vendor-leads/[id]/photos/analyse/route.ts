import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { analyseVendorLeadPhotos } from "@/lib/services/photoAnalysis"

// POST /api/vendor-leads/[id]/photos/analyse
// Triggers async AI analysis on all unanalysed photos for this lead.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fire off analysis — runs in background, don't await in HTTP handler
  analyseVendorLeadPhotos(params.id).catch((err) =>
    console.error(`Photo analysis failed for lead ${params.id}:`, err)
  )

  return NextResponse.json({ success: true, message: "Analysis started" })
}

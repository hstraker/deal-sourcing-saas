import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generatePreviewHTML } from "@/lib/investor-pack-generator"

// POST /api/investor-pack-templates/preview-html
// Accepts a template config object in the body and returns preview HTML using sample deal data.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const template = await request.json()
    const html = generatePreviewHTML(template)

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error generating preview HTML:", error)
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 })
  }
}

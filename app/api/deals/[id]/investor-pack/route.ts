import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateInvestorPack } from "@/lib/investor-pack-generator"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const dealId = params.id

    console.log(`[Investor Pack] Generating PDF for deal ${dealId}...`)

    // Generate the PDF
    const pdfBuffer = await generateInvestorPack(dealId)

    console.log(`[Investor Pack] PDF generated successfully (${pdfBuffer.length} bytes)`)

    // Return the PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="investor-pack-${dealId}.pdf"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error: any) {
    console.error("[Investor Pack] Error:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to generate investor pack",
      },
      { status: 500 }
    )
  }
}

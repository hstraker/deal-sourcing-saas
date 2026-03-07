import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateInvestorPack } from "@/lib/investor-pack-generator"
import { verifyDownloadToken } from "@/lib/investor-token"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id
    const token = request.nextUrl.searchParams.get("token")

    // Authorise: either a logged-in admin/sourcer OR a valid signed download token
    let interestUrl: string | undefined

    if (token) {
      const { valid, dealId: tokenDealId, deliveryId } = verifyDownloadToken(token)
      if (!valid || tokenDealId !== dealId) {
        return new NextResponse("Invalid or expired link", { status: 403 })
      }

      // Track download and surface the interestToken for the CTA button
      if (deliveryId) {
        const delivery = await prisma.investorPackDelivery.findUnique({
          where: { id: deliveryId },
          select: { interestToken: true },
        })
        if (delivery?.interestToken) {
          const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
          interestUrl = `${appUrl}/api/investor-interest?token=${delivery.interestToken}`
        }
        // Fire-and-forget download tracking
        prisma.investorPackDelivery.update({
          where: { id: deliveryId },
          data: { downloadedAt: new Date(), downloadCount: { increment: 1 } },
        }).catch(() => {})
      }
    } else {
      // Require session for portal/admin preview
      const session = await getServerSession(authOptions)
      if (!session) {
        return new NextResponse("Unauthorized", { status: 401 })
      }
    }

    console.log(`[Investor Pack] Generating PDF for deal ${dealId}...`)

    const pdfBuffer = await generateInvestorPack(dealId, undefined, interestUrl)

    console.log(`[Investor Pack] PDF generated successfully (${pdfBuffer.length} bytes)`)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="investor-pack-${dealId}.pdf"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error: any) {
    console.error("[Investor Pack] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate investor pack" },
      { status: 500 }
    )
  }
}

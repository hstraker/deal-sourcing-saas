import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendInvestorPackEmail } from "@/lib/email"

// POST /api/investors/pack-delivery/[id]/resend - Resend investor pack email
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [delivery, companyProfile] = await Promise.all([
      prisma.investorPackDelivery.findUnique({
        where: { id: params.id },
        include: {
          investor: {
            include: {
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
          deal: {
            select: {
              id: true,
              address: true,
              propertyType: true,
              bedrooms: true,
              marketValue: true,
              estimatedMonthlyRent: true,
              postcode: true,
            },
          },
        },
      }),
      prisma.companyProfile.findFirst(),
    ])

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 })
    }

    const recipientEmail = delivery.recipientEmail || delivery.investor.user.email
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const packLabel = delivery.partNumber
      ? `Part ${delivery.partNumber} of investor pack`
      : "Complete investor pack"

    const emailResult = await sendInvestorPackEmail({
      to: recipientEmail,
      investorName:
        `${delivery.investor.user.firstName || ""} ${delivery.investor.user.lastName || ""}`.trim() ||
        recipientEmail,
      dealAddress: delivery.deal.address,
      dealId: delivery.deal.id,
      packLabel,
      appUrl,
      downloadToken: (delivery as any).downloadToken ?? undefined,
      interestToken: (delivery as any).interestToken ?? undefined,
      propertyType: delivery.deal.propertyType ?? undefined,
      bedrooms: delivery.deal.bedrooms ?? undefined,
      marketValue: delivery.deal.marketValue ? Number(delivery.deal.marketValue) : undefined,
      monthlyRent: delivery.deal.estimatedMonthlyRent ? Number(delivery.deal.estimatedMonthlyRent) : undefined,
      postcode: delivery.deal.postcode ?? undefined,
      companyName: companyProfile?.companyName,
      companyAddress: companyProfile?.companyAddress ?? undefined,
      companyPhone: companyProfile?.companyPhone ?? undefined,
    })

    const emailStatus = emailResult.noSmtp ? "no_smtp" : emailResult.success ? "sent" : "failed"

    await prisma.investorPackDelivery.update({
      where: { id: params.id },
      data: {
        emailStatus,
        emailError: emailResult.error || null,
        sentAt: emailResult.success ? new Date() : undefined,
      },
    })

    if (emailResult.success) {
      await prisma.investorActivity.create({
        data: {
          investorId: delivery.investorId,
          activityType: "PACK_REQUESTED",
          description: `${packLabel} re-sent for ${delivery.deal.address}`,
          dealId: delivery.dealId,
          packDeliveryId: delivery.id,
          triggeredById: session.user.id,
          metadata: { resent: true, partNumber: delivery.partNumber },
        },
      })
    }

    return NextResponse.json({
      success: emailResult.success,
      emailStatus,
      error: emailResult.error,
      noSmtp: emailResult.noSmtp,
    })
  } catch (error: any) {
    console.error("Error resending investor pack:", error)
    return NextResponse.json(
      { error: "Failed to resend investor pack" },
      { status: 500 }
    )
  }
}

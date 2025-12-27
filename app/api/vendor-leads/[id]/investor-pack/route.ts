import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
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

    const vendorLeadId = params.id

    // Get template ID from query parameters
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    console.log(`[Investor Pack] Generating PDF for vendor lead ${vendorLeadId} with template ${templateId}...`)

    // Fetch the template if specified
    let template = null
    if (templateId) {
      template = await prisma.investorPackTemplate.findUnique({
        where: { id: templateId },
      })

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        )
      }

      if (!template.isActive) {
        return NextResponse.json(
          { error: "Template is not active" },
          { status: 400 }
        )
      }
    } else {
      // If no template specified, get the default template
      template = await prisma.investorPackTemplate.findFirst({
        where: { isDefault: true, isActive: true },
      })

      if (!template) {
        return NextResponse.json(
          { error: "No default template found. Please create a default template first." },
          { status: 400 }
        )
      }
    }

    // Fetch the vendor lead with all necessary data
    const vendorLead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!vendorLead) {
      return NextResponse.json(
        { error: "Vendor lead not found" },
        { status: 404 }
      )
    }

    // Increment generation counter
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        investorPackGenerationCount: {
          increment: 1,
        },
        lastInvestorPackGeneratedAt: new Date(),
      },
    })

    // Check if vendor lead has minimum required data
    if (!vendorLead.propertyAddress) {
      return NextResponse.json(
        { error: "Vendor lead must have a property address" },
        { status: 400 }
      )
    }

    if (!vendorLead.askingPrice) {
      return NextResponse.json(
        { error: "Vendor lead must have an asking price" },
        { status: 400 }
      )
    }

    // OPTION 1 WORKFLOW: Only generate packs from confirmed deals
    // Check if vendor lead has been promoted to a Deal
    // This ensures we only market deals where vendor has accepted and committed

    // First check if vendor lead is linked to a deal
    let dealId: string | null = null

    if (vendorLead.dealId) {
      dealId = vendorLead.dealId
      console.log(`[Investor Pack] Vendor lead has linked deal: ${dealId}`)
    } else {
      // Check if there's a Vendor record with this phone number that has a deal
      const existingVendor = await prisma.vendor.findFirst({
        where: {
          phone: vendorLead.vendorPhone,
        },
        include: {
          deal: true,
        },
      })

      if (existingVendor?.dealId && existingVendor.deal) {
        dealId = existingVendor.dealId
        console.log(`[Investor Pack] Found deal via vendor record: ${dealId}`)

        // Update vendor lead to reflect this link
        await prisma.vendorLead.update({
          where: { id: vendorLeadId },
          data: { dealId: dealId },
        })
      }
    }

    // If no deal exists, reject the request
    if (!dealId) {
      console.log(`[Investor Pack] No deal found for vendor lead ${vendorLeadId}`)
      return NextResponse.json(
        {
          error: "Deal Not Ready for Investor Marketing",
          message: "This vendor lead has not yet been promoted to a deal. Deals can only be marketed to investors after the vendor has accepted the offer and provided solicitor details.",
          requiresAction: "Complete the vendor pipeline process to create a deal first.",
          pipelineStage: vendorLead.pipelineStage,
          suggestion: vendorLead.pipelineStage === "OFFER_ACCEPTED"
            ? "Vendor has accepted - request solicitor details to complete deal creation"
            : vendorLead.pipelineStage === "READY_FOR_INVESTORS"
            ? "Deal should be created - check pipeline status"
            : "Continue vendor negotiation process"
        },
        { status: 400 }
      )
    }

    // Fetch the deal to verify it exists and is in the right state
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
    })

    if (!deal) {
      console.error(`[Investor Pack] Deal ${dealId} linked to vendor lead but not found in database`)
      return NextResponse.json(
        { error: "Deal not found. Data integrity issue - please contact support." },
        { status: 404 }
      )
    }

    // Check deal status - only generate packs for deals that are ready for investors
    const allowedStatuses = ["ready", "listed", "review"]
    if (!allowedStatuses.includes(deal.status)) {
      return NextResponse.json(
        {
          error: "Deal Not Available for Marketing",
          message: `Deal is in status "${deal.status}" and cannot be marketed to investors yet.`,
          dealStatus: deal.status,
        },
        { status: 400 }
      )
    }

    console.log(`[Investor Pack] Using confirmed deal ${dealId} (status: ${deal.status})`)

    // Update deal status on first pack generation (ready → listed)
    if (deal.status === "ready" && !deal.investorPackSent) {
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: "listed",
          investorPackSent: true,
          investorPackSentAt: new Date(),
          listedAt: new Date(),
        },
      })
      console.log(`[Investor Pack] Deal status updated: ready → listed`)
    }

    // Generate the PDF with template
    const pdfBuffer = await generateInvestorPack(dealId, template)

    console.log(`[Investor Pack] PDF generated successfully (${pdfBuffer.length} bytes)`)

    // Log the generation to database
    await prisma.investorPackGeneration.create({
      data: {
        templateId: template.id,
        vendorLeadId: vendorLeadId,
        dealId: dealId,
        propertyAddress: vendorLead.propertyAddress,
        askingPrice: vendorLead.askingPrice,
        generatedById: session.user.id,
        fileSize: pdfBuffer.length,
        // pageCount will be updated if we implement page counting
      },
    })

    // Update template usage statistics
    await prisma.investorPackTemplate.update({
      where: { id: template.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })

    console.log(`[Investor Pack] Generation logged to database`)

    // Return the PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="investor-pack-${vendorLead.propertyAddress.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf"`,
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

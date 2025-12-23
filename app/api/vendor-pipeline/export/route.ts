/**
 * Export Pipeline Data API
 * GET /api/vendor-pipeline/export
 * Exports vendor pipeline data as CSV
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/vendor-pipeline/export
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get("stage")
    const motivationMin = searchParams.get("motivation_min")
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")

    const where: any = {}
    if (stage) {
      where.pipelineStage = stage
    }
    if (motivationMin) {
      where.motivationScore = { gte: parseInt(motivationMin) }
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo)
      }
    }

    const leads = await prisma.vendorLead.findMany({
      where,
      include: {
        _count: {
          select: {
            smsMessages: true,
            pipelineEvents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Convert to CSV
    const headers = [
      "ID",
      "Vendor Name",
      "Phone",
      "Email",
      "Property Address",
      "Postcode",
      "Asking Price",
      "Pipeline Stage",
      "Motivation Score",
      "BMV Score",
      "Offer Amount",
      "Offer Percentage",
      "Created At",
      "Last Contact",
      "SMS Count",
    ]

    const rows = leads.map((lead) => [
      lead.id,
      lead.vendorName,
      lead.vendorPhone,
      lead.vendorEmail || "",
      lead.propertyAddress || "",
      lead.propertyPostcode || "",
      lead.askingPrice ? Number(lead.askingPrice).toFixed(2) : "",
      lead.pipelineStage,
      lead.motivationScore?.toString() || "",
      lead.bmvScore ? Number(lead.bmvScore).toFixed(2) : "",
      lead.offerAmount ? Number(lead.offerAmount).toFixed(2) : "",
      lead.offerPercentage ? Number(lead.offerPercentage).toFixed(2) : "",
      lead.createdAt.toISOString(),
      lead.lastContactAt ? lead.lastContactAt.toISOString() : "",
      lead._count.smsMessages.toString(),
    ])

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="vendor-pipeline-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error("Error exporting pipeline data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}


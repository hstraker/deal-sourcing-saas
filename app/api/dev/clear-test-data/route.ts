/**
 * API Route: DELETE /api/dev/clear-test-data
 * Clear test vendor leads and associated data
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 })
    }

    // Only allow in development mode
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Only available in development mode" }, { status: 403 })
    }

    console.log("🧹 [Dev Mode] Clearing test data...")

    // Get test leads (those with test phone numbers or test emails)
    const testLeads = await prisma.vendorLead.findMany({
      where: {
        OR: [
          { vendorPhone: { contains: "+4477009" } }, // UK test numbers
          { vendorEmail: { contains: "@example.com" } },
          { vendorEmail: { contains: "@test.com" } },
          { vendorName: { contains: "Test" } },
        ]
      },
      select: { id: true, vendorName: true }
    })

    if (testLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No test data found to clear",
        deletedCount: 0
      })
    }

    const leadIds = testLeads.map(lead => lead.id)

    // Delete associated data (cascade will handle most, but being explicit)
    const deletedMessages = await prisma.sMSMessage.deleteMany({
      where: { vendorLeadId: { in: leadIds } }
    })

    const deletedComparables = await prisma.comparableProperty.deleteMany({
      where: { vendorLeadId: { in: leadIds } }
    })

    const deletedLeads = await prisma.vendorLead.deleteMany({
      where: { id: { in: leadIds } }
    })

    console.log(`✅ Deleted ${deletedLeads.count} test leads`)
    console.log(`✅ Deleted ${deletedMessages.count} messages`)
    console.log(`✅ Deleted ${deletedComparables.count} comparables`)

    return NextResponse.json({
      success: true,
      message: "Test data cleared successfully",
      deletedCount: {
        leads: deletedLeads.count,
        messages: deletedMessages.count,
        comparables: deletedComparables.count
      },
      deletedLeads: testLeads.map(l => ({ id: l.id, name: l.vendorName }))
    })

  } catch (error: any) {
    console.error("[Dev Mode] Clear test data error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

// app/api/action-counts/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export interface ActionItem {
  type: "deal" | "vendor"
  id: string
  label: string
  href: string
  action: string
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [dealsInProgress, vendorsReady] = await Promise.all([
      prisma.deal.findMany({
        where: {
          status: "in_progress",
          investorReservations: { none: { status: { not: "cancelled" } } },
        },
        select: { id: true, address: true, postcode: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.vendorLead.findMany({
        where: { pipelineStage: "READY_FOR_INVESTORS" },
        select: { id: true, vendorName: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ])

    const items: ActionItem[] = [
      ...dealsInProgress.map((d) => ({
        type: "deal" as const,
        id: d.id,
        label: [d.address, d.postcode].filter(Boolean).join(", "),
        href: `/dashboard/deals/${d.id}`,
        action: "Review",
      })),
      ...vendorsReady.map((v) => ({
        type: "vendor" as const,
        id: v.id,
        label: v.vendorName,
        href: `/dashboard/vendors/${v.id}`,
        action: "Match",
      })),
    ]

    return NextResponse.json({
      dealsCount: dealsInProgress.length,
      vendorsCount: vendorsReady.length,
      items,
    })
  } catch (error) {
    console.error("Error fetching action counts:", error)
    return NextResponse.json({ error: "Failed to fetch action counts" }, { status: 500 })
  }
}

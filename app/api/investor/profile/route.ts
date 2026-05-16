/**
 * GET  /api/investor/profile  — get the investor's own profile + stats
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      createdAt: true,
      investor: {
        select: {
          id: true,
          pipelineStage: true,
          preferredAreas: true,
          minBudget: true,
          maxBudget: true,
          minYield: true,
          minBmv: true,
          strategy: true,
          experienceLevel: true,
          financingStatus: true,
          dealsPurchased: true,
          totalSpent: true,
          dealsViewed: true,
          packsRequested: true,
          activeReservationsCount: true,
          emailAlerts: true,
          smsAlerts: true,
          _count: {
            select: {
              favorites: true,
              reservations: true,
            },
          },
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    user: {
      ...user,
      investor: user.investor
        ? {
            ...user.investor,
            minBudget: user.investor.minBudget ? Number(user.investor.minBudget) : null,
            maxBudget: user.investor.maxBudget ? Number(user.investor.maxBudget) : null,
          }
        : null,
    },
  })
}

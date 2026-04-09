import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const schema = z.object({
  override: z.enum(["excellent", "good", "needs_work", "needs_modernisation", "poor"]).nullable(),
})

// PATCH /api/vendor-leads/[id]/photos/condition-override
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const lead = await prisma.vendorLead.update({
    where: { id: params.id },
    data: { photoConditionOverride: parsed.data.override as any },
    select: { id: true, photoConditionOverride: true },
  })

  return NextResponse.json(lead)
}

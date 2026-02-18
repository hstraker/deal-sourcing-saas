/**
 * POST /api/admin/price-paid/import/[id]/cancel
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { cancelPpdImport } from "@/lib/price-paid"

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await cancelPpdImport(params.id)
    return NextResponse.json({ success: true, message: "Import cancelled" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

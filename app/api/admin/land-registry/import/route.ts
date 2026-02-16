import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { downloadAndImportDataset } from "@/lib/land-registry"

// POST /api/admin/land-registry/import
// Body: { datasetType: "ccod" | "ocod" | "both" }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { datasetType } = body as { datasetType?: string }

    if (!datasetType || !["ccod", "ocod", "both"].includes(datasetType)) {
      return NextResponse.json(
        { error: "Invalid datasetType. Must be 'ccod', 'ocod', or 'both'" },
        { status: 400 }
      )
    }

    if (!process.env.LAND_REGISTRY_API_KEY) {
      return NextResponse.json(
        { error: "LAND_REGISTRY_API_KEY is not configured" },
        { status: 500 }
      )
    }

    const datasets: ("ccod" | "ocod")[] =
      datasetType === "both" ? ["ccod", "ocod"] : [datasetType as "ccod" | "ocod"]

    // Check if ANY import is currently running (not just same dataset type)
    const anyRunning = await prisma.landRegistryImport.findFirst({
      where: {
        status: { in: ["PENDING", "RUNNING", "PAUSED"] },
      },
    })

    if (anyRunning) {
      return NextResponse.json(
        {
          error: `An import is already in progress (${anyRunning.datasetType} - ${anyRunning.status}). Please wait for it to complete or cancel it first.`,
          runningImport: {
            id: anyRunning.id,
            datasetType: anyRunning.datasetType,
            status: anyRunning.status,
          },
        },
        { status: 409 }
      )
    }

    const imports: { id: string; datasetType: string }[] = []

    for (const ds of datasets) {
      // Check if there's recent completed data (within last 7 days)
      const recentCompleted = await prisma.landRegistryImport.findFirst({
        where: {
          datasetType: ds.toUpperCase(),
          status: "COMPLETED",
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { completedAt: "desc" },
      })

      if (recentCompleted) {
        // Check how many records we already have
        const existingCount = await prisma.companyOwnership.count({
          where: {
            isOverseas: ds === "ocod",
          },
        })

        // Warn user but allow reimport (they can cancel if needed)
        console.log(
          `[LandRegistry] Warning: Recent import found for ${ds.toUpperCase()} (${existingCount.toLocaleString()} records). Reimport will skip duplicates.`
        )
      }

      const importRecord = await prisma.landRegistryImport.create({
        data: {
          datasetType: ds.toUpperCase(),
          status: "PENDING",
        },
      })

      imports.push({ id: importRecord.id, datasetType: ds.toUpperCase() })

      // Fire off the import asynchronously — do NOT await
      downloadAndImportDataset(ds, importRecord.id).catch((e) => {
        console.error(`[LandRegistry] Background import failed for ${ds}:`, e)
      })
    }

    return NextResponse.json(
      {
        message: `Import started for: ${datasets.map((d) => d.toUpperCase()).join(", ")}`,
        imports,
      },
      { status: 202 }
    )
  } catch (error) {
    console.error("Error starting Land Registry import:", error)
    return NextResponse.json(
      { error: "Failed to start import" },
      { status: 500 }
    )
  }
}

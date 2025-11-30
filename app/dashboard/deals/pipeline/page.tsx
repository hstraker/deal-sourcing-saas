import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DealPipelineBoard } from "@/components/deals/deal-pipeline-board"
import { getSignedDownloadUrl } from "@/lib/s3"

export const dynamic = "force-dynamic"

export default async function DealPipelinePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const where: any = {}

  if (session.user.role === "sourcer") {
    where.OR = [
      { assignedToId: session.user.id },
      { assignedToId: null },
      { createdById: session.user.id },
    ]
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { uploadedAt: "desc" }],
      },
    },
    orderBy: [
      { status: "asc" },
      { statusUpdatedAt: "asc" },
      { createdAt: "desc" },
    ],
  })

  // Generate presigned URLs for all photos
  const transformedDeals = await Promise.all(
    deals.map(async (deal) => {
      const photosWithUrls = await Promise.all(
        deal.photos.map(async (photo) => {
          const signedUrl = await getSignedDownloadUrl(photo.s3Key, 3600)
          return {
            id: photo.id,
            s3Url: signedUrl,
            caption: photo.caption,
            isCover: photo.isCover,
          }
        })
      )
      return {
        id: deal.id,
        address: deal.address,
        postcode: deal.postcode,
        status: deal.status,
        dealScore: deal.dealScore,
        packTier: deal.packTier,
        packPrice: deal.packPrice ? Number(deal.packPrice) : null,
        statusUpdatedAt: deal.statusUpdatedAt?.toISOString() ?? deal.updatedAt.toISOString(),
        assignedTo: deal.assignedTo
          ? {
              id: deal.assignedTo.id,
              firstName: deal.assignedTo.firstName,
              lastName: deal.assignedTo.lastName,
              email: deal.assignedTo.email,
            }
          : null,
        photos: photosWithUrls,
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deal Pipeline</h1>
        <p className="text-muted-foreground">
          Drag and drop deals to move them through the sourcing workflow.
        </p>
      </div>

      <DealPipelineBoard deals={transformedDeals} currentUserId={session.user.id} />
    </div>
  )
}



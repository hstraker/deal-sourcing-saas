import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DealForm } from "@/components/deals/deal-form"
import { DealPhotoManager } from "@/components/deals/deal-photo-manager"
import { notFound } from "next/navigation"
import { getSignedDownloadUrl } from "@/lib/s3"

export const dynamic = "force-dynamic"

interface EditDealPageProps {
  params: {
    id: string
  }
}

export default async function EditDealPage({ params }: EditDealPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { uploadedAt: "desc" }],
      },
    },
  })

  if (!deal) {
    notFound()
  }

  // Check permissions for sourcers
  if (
    session.user.role === "sourcer" &&
    deal.assignedToId !== session.user.id &&
    deal.createdById !== session.user.id &&
    deal.assignedToId !== null
  ) {
    redirect("/dashboard/deals")
  }

  // Generate presigned URLs for photos (valid for 1 hour)
  const photosWithUrls = await Promise.all(
    deal.photos.map(async (photo) => {
      const signedUrl = await getSignedDownloadUrl(photo.s3Key, 3600)
      return {
        ...photo,
        s3Url: signedUrl,
      }
    })
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Deal</h1>
        <p className="text-muted-foreground">{deal.address}</p>
      </div>

      <DealForm
        dealId={params.id}
        initialData={{
          address: deal.address,
          postcode: deal.postcode || undefined,
          propertyType: deal.propertyType as any,
          bedrooms: deal.bedrooms ?? undefined,
          bathrooms: deal.bathrooms ?? undefined,
          squareFeet: deal.squareFeet ?? undefined,
          askingPrice: Number(deal.askingPrice),
          marketValue: deal.marketValue ? Number(deal.marketValue) : undefined,
          estimatedRefurbCost: deal.estimatedRefurbCost
            ? Number(deal.estimatedRefurbCost)
            : undefined,
          afterRefurbValue: deal.afterRefurbValue
            ? Number(deal.afterRefurbValue)
            : undefined,
          estimatedMonthlyRent: deal.estimatedMonthlyRent
            ? Number(deal.estimatedMonthlyRent)
            : undefined,
          bmvPercentage: deal.bmvPercentage ? Number(deal.bmvPercentage) : undefined,
          grossYield: deal.grossYield ? Number(deal.grossYield) : undefined,
          netYield: deal.netYield ? Number(deal.netYield) : undefined,
          roi: deal.roi ? Number(deal.roi) : undefined,
          roce: deal.roce ? Number(deal.roce) : undefined,
          dealScore: deal.dealScore ?? undefined,
          status: deal.status as any,
          packTier: deal.packTier as any,
          packPrice: deal.packPrice ? Number(deal.packPrice) : undefined,
          dataSource: deal.dataSource as any,
          externalId: deal.externalId || undefined,
          agentName: deal.agentName || undefined,
          agentPhone: deal.agentPhone || undefined,
          listingUrl: deal.listingUrl || undefined,
          assignedToId: deal.assignedToId || undefined,
        }}
      />

      <div className="mt-10">
        <DealPhotoManager
          dealId={params.id}
          initialPhotos={photosWithUrls.map((photo) => ({
            id: photo.id,
            s3Url: photo.s3Url,
            caption: photo.caption,
            isCover: photo.isCover,
            sortOrder: photo.sortOrder,
          }))}
        />
      </div>
    </div>
  )
}


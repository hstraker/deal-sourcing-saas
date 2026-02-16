import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ReviewQueue } from "@/components/scraper/review-queue"
import { toPropertyListingForClient } from "@/types/property-listing"

export const dynamic = "force-dynamic"

export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <div>Unauthorized</div>
  }

  // Fetch properties needing review
  const listings = await prisma.propertyListing.findMany({
    where: {
      OR: [
        { reviewStatus: "PENDING" },
        { reviewStatus: "AUTO_APPROVED", isAmbiguous: true },
      ],
    },
    orderBy: { scrapedAt: "desc" },
  })

  // Stats for header
  const [totalPending, totalAmbiguous] = await Promise.all([
    prisma.propertyListing.count({
      where: { reviewStatus: "PENDING" },
    }),
    prisma.propertyListing.count({
      where: {
        isAmbiguous: true,
        reviewStatus: { in: ["PENDING", "AUTO_APPROVED"] },
      },
    }),
  ])

  const listingsForClient = listings.map(toPropertyListingForClient)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">
          {totalPending} pending, {totalAmbiguous} ambiguous ({listings.length}{" "}
          total)
        </p>
      </div>

      <ReviewQueue listings={listingsForClient as any} />
    </div>
  )
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Mark this page as dynamic since it uses server-side data
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  // Get dashboard stats
  const totalDeals = await prisma.deal.count()
  const dealsThisMonth = await prisma.deal.count({
    where: {
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  })
  const dealsListed = await prisma.deal.count({
    where: { status: "listed" },
  })
  const dealsSold = await prisma.deal.count({
    where: { status: "sold" },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name || session?.user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeals}</div>
            <p className="text-xs text-muted-foreground">
              All time deals sourced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              New deals added
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Listed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsListed}</div>
            <p className="text-xs text-muted-foreground">
              Currently listed deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsSold}</div>
            <p className="text-xs text-muted-foreground">
              Total deals sold
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


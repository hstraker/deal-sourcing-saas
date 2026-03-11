// components/deals/matching-investors-panel.tsx
import { prisma } from "@/lib/db"
import { matchInvestors } from "@/lib/deals/investor-matcher"
import Link from "next/link"
import { Users } from "lucide-react"

interface Props {
  dealId: string
  postcode: string | null
  askingPrice: number
  bmvPercentage: number | null
  grossYield: number | null
  recommendedStrategy: string | null
}

export async function MatchingInvestorsPanel({
  dealId,
  postcode,
  askingPrice,
  bmvPercentage,
  grossYield,
  recommendedStrategy,
}: Props) {
  const investors = await prisma.investor.findMany({
    where: {
      OR: [
        { preferredAreas: { isEmpty: false } },
        { minBudget: { not: null } },
        { maxBudget: { not: null } },
        { minYield: { not: null } },
        { minBmv: { not: null } },
        { strategy: { isEmpty: false } },
      ],
    },
    select: {
      id: true,
      preferredAreas: true,
      minBudget: true,
      maxBudget: true,
      minYield: true,
      minBmv: true,
      strategy: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  const normalised = investors.map((inv) => ({
    id: inv.id,
    name:
      [inv.user.firstName, inv.user.lastName].filter(Boolean).join(" ") || "—",
    preferredAreas: inv.preferredAreas,
    minBudget: inv.minBudget ?? null,
    maxBudget: inv.maxBudget ?? null,
    minYield: inv.minYield ? Number(inv.minYield) : null,
    minBmv: inv.minBmv ? Number(inv.minBmv) : null,
    strategy: inv.strategy,
  }))

  const matches = matchInvestors(normalised, {
    postcode,
    askingPrice,
    bmvPercentage,
    grossYield,
    recommendedStrategy,
  })

  return (
    <div className="ds-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-[#2563EB]" />
          Matching Investors
        </h2>
        {matches.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {matches.length}
          </span>
        )}
      </div>
      <div className="p-5">
        {matches.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No investors match this deal&apos;s criteria yet.
          </p>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => {
              const pct = Math.round(m.score * 100)
              const barColor =
                pct >= 80
                  ? "bg-green-500"
                  : pct >= 50
                  ? "bg-amber-400"
                  : "bg-gray-300"
              const pctColor =
                pct >= 80
                  ? "text-green-600"
                  : pct >= 50
                  ? "text-amber-500"
                  : "text-gray-400"
              return (
                <div
                  key={m.investorId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {m.name}
                    </p>
                    {m.criteriaLine && (
                      <p className="truncate text-xs text-gray-500">
                        {m.criteriaLine}
                      </p>
                    )}
                    <Link
                      href={`/dashboard/reservations?dealId=${dealId}&investorId=${m.investorId}`}
                      className="mt-1 inline-block text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      + Reserve
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-1.5 w-10 rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`w-8 text-right text-xs font-bold ${pctColor}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

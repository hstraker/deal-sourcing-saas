// app/dashboard/vendors/activity/page.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Clock, ArrowRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Activity — DealStack" }

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Email Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
  VALUATION_PENDING: "Valuation Pending",
}

function dotColor(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = details.toStage as string
    if (["OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"].includes(to))
      return "bg-green-500"
    if (["OFFER_REJECTED", "DEAD_LEAD"].includes(to)) return "bg-red-500"
    return "bg-blue-500"
  }
  if (eventType === "offer_accepted") return "bg-green-600"
  if (eventType === "offer_rejected") return "bg-red-500"
  if (eventType === "deal_validated") return "bg-green-500"
  if (eventType === "deal_rejected") return "bg-orange-500"
  if (eventType === "vendor_offer_sent") return "bg-yellow-500"
  return "bg-slate-400"
}

function eventTitle(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = STAGE_LABELS[details.toStage as string] ?? details.toStage ?? "—"
    return `Stage → ${to}`
  }
  if (eventType === "vendor_offer_sent") {
    const channel = ((details.channel as string) ?? "").toUpperCase()
    const price = details.offerPrice ? ` £${Number(details.offerPrice).toLocaleString()}` : ""
    return `Offer sent via ${channel}${price}`
  }
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function investorDotColor(activityType: string): string {
  if (["PURCHASE_COMPLETED", "RESERVATION_MADE"].includes(activityType)) return "bg-green-500"
  if (activityType === "RESERVATION_CANCELLED") return "bg-red-500"
  return "bg-blue-500"
}

export default async function VendorActivityPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [events, investorActivities] = await Promise.all([
    prisma.pipelineEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        eventType: true,
        details: true,
        createdAt: true,
        vendorLeadId: true,
        vendorLead: {
          select: { vendorName: true, propertyAddress: true, propertyPostcode: true },
        },
      },
    }),
    prisma.investorActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        activityType: true,
        description: true,
        createdAt: true,
        investor: {
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Recent pipeline events across all vendors and investors"
      />

      {/* Vendor pipeline events */}
      <div className="ds-card overflow-hidden">
        <div className="border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-[#2563EB]" />
            {events.length} vendor event{events.length !== 1 ? "s" : ""}
          </h3>
        </div>
        <div className="p-5">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No activity recorded yet</p>
          ) : (
            <ol className="relative ml-3 space-y-5 border-l border-[var(--ds-border)]">
              {events.map((ev) => {
                const details = (ev.details ?? {}) as Record<string, unknown>
                const color = dotColor(ev.eventType, details)
                const title = eventTitle(ev.eventType, details)
                const address = ev.vendorLead
                  ? [ev.vendorLead.propertyAddress, ev.vendorLead.propertyPostcode]
                      .filter(Boolean)
                      .join(", ")
                  : null
                return (
                  <li key={ev.id} className="group ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium leading-tight">{title}</p>
                        {ev.vendorLead && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {ev.vendorLead.vendorName}
                            {address && (
                              <span className="text-gray-400"> · {address}</span>
                            )}
                          </p>
                        )}
                        <time
                          suppressHydrationWarning
                          className="mt-0.5 block text-xs text-gray-400/70"
                        >
                          {new Date(ev.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      {ev.vendorLeadId && (
                        <Link
                          href={`/dashboard/vendors/${ev.vendorLeadId}/activity`}
                          className="flex shrink-0 items-center gap-1 text-xs text-[#2563EB] opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Investor activity */}
      <div className="ds-card overflow-hidden">
        <div className="border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-[#2563EB]" />
            {investorActivities.length} investor event{investorActivities.length !== 1 ? "s" : ""}
          </h3>
        </div>
        <div className="p-5">
          {investorActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No investor activity recorded yet
            </p>
          ) : (
            <ol className="relative ml-3 space-y-5 border-l border-[var(--ds-border)]">
              {investorActivities.map((act) => {
                const color = investorDotColor(act.activityType)
                const name = [
                  act.investor.user.firstName,
                  act.investor.user.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") || act.investor.user.email
                return (
                  <li key={act.id} className="ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <p className="text-sm font-medium leading-tight">{name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {act.description ||
                        act.activityType.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {act.activityType}
                      </Badge>
                      <time
                        suppressHydrationWarning
                        className="text-xs text-gray-400/70"
                      >
                        {new Date(act.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

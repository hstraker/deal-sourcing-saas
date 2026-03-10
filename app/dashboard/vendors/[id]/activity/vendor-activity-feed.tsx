"use client"

import { Clock, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface PipelineEvent {
  id: string
  eventType: string
  details: Record<string, unknown>
  createdAt: string
  createdBy: string | null
}

interface SmsMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: string
  status: string | null
}

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Email Offer Sent",
  VIDEO_SENT: "Video Sent",
  RETRY_1: "Follow-up 1",
  RETRY_2: "Follow-up 2",
  RETRY_3: "Follow-up 3",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
  VALUATION_PENDING: "Valuation Pending",
}

const formatDate = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

function eventLabel(ev: PipelineEvent): { title: string; detail?: string; color: string } {
  const d = ev.details || {}
  switch (ev.eventType) {
    case "stage_transition": {
      const from = STAGE_LABELS[d.fromStage as string] ?? d.fromStage ?? "—"
      const to = STAGE_LABELS[d.toStage as string] ?? d.toStage ?? "—"
      const isPositive = ["OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"].includes(d.toStage as string)
      const isNegative = ["OFFER_REJECTED", "DEAD_LEAD"].includes(d.toStage as string)
      return {
        title: `Stage changed to ${to}`,
        detail: `From: ${from}`,
        color: isPositive ? "bg-green-500" : isNegative ? "bg-red-500" : "bg-blue-500",
      }
    }
    case "vendor_offer_sent": {
      const channel = ((d.channel as string) ?? "").toUpperCase()
      const price = d.offerPrice ? ` — £${Number(d.offerPrice).toLocaleString()}` : ""
      const success = d.emailSuccess || d.smsSuccess
      return {
        title: `Offer sent via ${channel}${price}`,
        detail: success === false ? "Delivery failed" : d.noSmtp ? "SMTP not configured" : "Delivered",
        color: success === false ? "bg-red-400" : "bg-yellow-500",
      }
    }
    case "offer_accepted":
      return { title: "Offer Accepted", detail: "Vendor accepted the offer", color: "bg-green-600" }
    case "offer_rejected":
      return { title: "Offer Rejected", detail: (d.rejectionReason as string) || undefined, color: "bg-red-500" }
    case "deal_validated":
      return { title: "Deal Validated", detail: d.description as string | undefined, color: "bg-green-500" }
    case "deal_rejected":
      return { title: "Deal Failed Validation", detail: d.description as string | undefined, color: "bg-orange-500" }
    default:
      return {
        title: ev.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        color: "bg-slate-400",
      }
  }
}

export function VendorActivityFeed({
  pipelineEvents,
  smsMessages,
}: {
  pipelineEvents: PipelineEvent[]
  smsMessages: SmsMessage[]
}) {
  return (
    <div className="space-y-6">
      {/* Pipeline Events */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#2563EB]" />
            Pipeline Activity
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {pipelineEvents.length} event{pipelineEvents.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="p-5">
          {pipelineEvents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pipeline events recorded yet</p>
          ) : (
            <ol className="relative border-l border-[var(--ds-border)] ml-3 space-y-5">
              {pipelineEvents.map((ev) => {
                const { title, detail, color } = eventLabel(ev)
                return (
                  <li key={ev.id} className="ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <p className="text-sm font-medium leading-tight">{title}</p>
                    {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
                    <time suppressHydrationWarning className="text-xs text-gray-400/70 mt-0.5 block">
                      {formatDate(ev.createdAt)}
                    </time>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {/* SMS Messages */}
      {smsMessages.length > 0 && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#2563EB]" />
              SMS Messages
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{smsMessages.length} message{smsMessages.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="p-5 space-y-3">
            {smsMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-sm",
                  msg.direction === "inbound"
                    ? "bg-gray-50 border border-gray-200 self-start max-w-[80%]"
                    : "bg-blue-50 border border-blue-200 ml-auto max-w-[80%]"
                )}
              >
                <p>{msg.messageBody}</p>
                <span suppressHydrationWarning className="text-[10px] text-gray-400">
                  {msg.direction === "inbound" ? "Vendor" : "You"} · {formatDate(msg.createdAt)}
                  {msg.status && ` · ${msg.status}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

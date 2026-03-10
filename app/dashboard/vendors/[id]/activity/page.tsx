import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorPageShell } from "@/components/vendors/vendor-page-shell"
import { VendorActivityFeed } from "./vendor-activity-feed"

export default async function VendorActivityPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      propertyPostcode: true,
      pipelineEvents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          eventType: true,
          details: true,
          createdAt: true,
          createdBy: true,
        },
      },
      smsMessages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          direction: true,
          messageBody: true,
          createdAt: true,
          status: true,
        },
      },
    },
  })

  if (!lead) notFound()

  const serialised = {
    ...lead,
    pipelineEvents: lead.pipelineEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      details: e.details as Record<string, unknown>,
    })),
    smsMessages: lead.smsMessages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  }

  return (
    <VendorPageShell
      leadId={lead.id}
      vendorName={lead.vendorName}
      propertyAddress={lead.propertyAddress}
      propertyPostcode={lead.propertyPostcode}
    >
      <VendorActivityFeed
        pipelineEvents={serialised.pipelineEvents}
        smsMessages={serialised.smsMessages}
      />
    </VendorPageShell>
  )
}

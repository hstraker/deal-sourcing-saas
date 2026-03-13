import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ScheduleManagement } from "@/components/admin/schedule-management"
import { PageHeader } from "@/components/ui/page-header"

export const metadata = {
  title: "Schedules | Admin",
}

export const dynamic = "force-dynamic"

function computeNextRun(scheduleType: string, enabled: boolean): string | null {
  if (!enabled) return null
  const now = new Date()
  if (scheduleType === "TWICE_DAILY") {
    const today6am = new Date(now); today6am.setHours(6, 0, 0, 0)
    const today6pm = new Date(now); today6pm.setHours(18, 0, 0, 0)
    const tomorrow6am = new Date(now); tomorrow6am.setDate(tomorrow6am.getDate() + 1); tomorrow6am.setHours(6, 0, 0, 0)
    if (now < today6am) return today6am.toISOString()
    if (now < today6pm) return today6pm.toISOString()
    return tomorrow6am.toISOString()
  }
  if (scheduleType === "DAILY") {
    const today6am = new Date(now); today6am.setHours(6, 0, 0, 0)
    const tomorrow6am = new Date(now); tomorrow6am.setDate(tomorrow6am.getDate() + 1); tomorrow6am.setHours(6, 0, 0, 0)
    return now < today6am ? today6am.toISOString() : tomorrow6am.toISOString()
  }
  if (scheduleType === "HOURLY") {
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next.toISOString()
  }
  return null
}

export default async function AdminSchedulesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  const [scraperSettings, recentJobs, lastCompletedJob] = await Promise.all([
    prisma.scraperSettings.findFirst(),
    prisma.scraperJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.scraperJob.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ])

  const settings = scraperSettings
    ? {
        id: scraperSettings.id,
        enabled: scraperSettings.enabled,
        scheduleType: scraperSettings.scheduleType,
        rightmoveEnabled: scraperSettings.rightmoveEnabled,
        zooplaEnabled: scraperSettings.zooplaEnabled,
        onthemarketEnabled: scraperSettings.onthemarketEnabled,
        primelocationEnabled: (scraperSettings as any).primelocationEnabled ?? true,
        searchCriteria: scraperSettings.searchCriteria as any,
      }
    : null

  const schedule = {
    lastRun: lastCompletedJob?.completedAt?.toISOString() ?? null,
    nextRun: scraperSettings
      ? computeNextRun(scraperSettings.scheduleType, scraperSettings.enabled)
      : null,
  }

  const jobs = recentJobs.map((j) => ({
    id: j.id,
    source: j.source as string,
    status: j.status as string,
    totalFound: j.totalFound,
    processed: j.processed,
    successful: j.successful,
    failed: j.failed,
    startedAt: j.startedAt?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
    createdAt: j.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        subtitle="Manage automated scraper runs and view job history"
      />
      <ScheduleManagement
        initialSettings={settings}
        initialSchedule={schedule}
        initialJobs={jobs}
      />
    </div>
  )
}

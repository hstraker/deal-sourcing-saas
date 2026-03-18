// app/dashboard/layout.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DEFAULT_TOKENS } from "@/lib/theme/defaults"
import type { ThemeTokens } from "@/lib/theme/types"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Only allow admin and sourcer roles in Phase 1
  if (session.user.role === "investor") {
    redirect("/")
  }

  const userTheme = session.user.id
    ? await prisma.userTheme.findUnique({ where: { userId: session.user.id } })
    : null

  // Merge defaults with user overrides — all tokens always present (no fallback gaps)
  const themeTokens: ThemeTokens = {
    ...DEFAULT_TOKENS,
    ...((userTheme?.tokens ?? {}) as ThemeTokens),
  }

  return (
    <div style={themeTokens as unknown as React.CSSProperties}>
      <DashboardLayout>{children}</DashboardLayout>
    </div>
  )
}

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { VendorPipelineKanbanBoard } from "@/components/vendors/vendor-pipeline-kanban-board"

export const dynamic = "force-dynamic"

export default async function VendorPipelinePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div>
      <VendorPipelineKanbanBoard />
    </div>
  )
}


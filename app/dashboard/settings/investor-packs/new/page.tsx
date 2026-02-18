import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PackTemplateDesigner } from "@/components/settings/pack-template-designer"

export default async function NewInvestorPackTemplatePage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== "admin" && session.user.role !== "sourcer")) {
    redirect("/dashboard")
  }

  return <PackTemplateDesigner template={null} />
}

import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PackTemplateDesigner } from "@/components/settings/pack-template-designer"

interface PageProps {
  params: { id: string }
}

export default async function EditInvestorPackTemplatePage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== "admin" && session.user.role !== "sourcer")) {
    redirect("/dashboard")
  }

  const template = await prisma.investorPackTemplate.findUnique({
    where: { id: params.id },
  })

  if (!template) {
    notFound()
  }

  // Serialise Prisma record for the client component
  const serialised = {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    colorScheme: template.colorScheme,
    isActive: template.isActive,
    isDefault: template.isDefault,
    sections: template.sections,
  }

  return <PackTemplateDesigner template={serialised} />
}

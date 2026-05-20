import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSignedDownloadUrl } from "@/lib/s3"
import { AccountPage } from "@/components/account/account-page"

export const dynamic = "force-dynamic"

export default async function MyAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id:                  true,
      email:               true,
      firstName:           true,
      lastName:            true,
      phone:               true,
      bio:                 true,
      timezone:            true,
      role:                true,
      permissions:         true,
      profilePictureS3Key: true,
      isActive:            true,
      createdAt:           true,
      lastLogin:           true,
      notificationPrefs:   true,
    },
  })

  if (!user) redirect("/login")

  // Resolve a signed URL for the current profile picture
  let profilePictureUrl: string | null = null
  if (user.profilePictureS3Key) {
    try {
      profilePictureUrl = await getSignedDownloadUrl(user.profilePictureS3Key, 3600)
    } catch { /* non-fatal */ }
  }

  const serialised = JSON.parse(JSON.stringify({ ...user, profilePictureUrl }))

  return <AccountPage user={serialised} />
}

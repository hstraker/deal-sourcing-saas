import { redirect } from "next/navigation"

export default function ResidentialFinderRedirect() {
  redirect("/dashboard/finder?tab=residential")
}

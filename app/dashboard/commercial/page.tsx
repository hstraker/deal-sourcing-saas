import { redirect } from "next/navigation"

export default function CommercialFinderRedirect() {
  redirect("/dashboard/finder?tab=commercial")
}

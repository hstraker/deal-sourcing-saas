import { redirect } from "next/navigation"

export default function HomePage() {
  // For Phase 1 MVP, redirect to dashboard if authenticated, otherwise to login
  redirect("/login")
}


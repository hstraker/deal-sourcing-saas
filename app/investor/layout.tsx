import type { ReactNode } from "react"
import { InvestorNav } from "@/components/investor/investor-nav"

export const metadata = {
  title: "Investor Portal | DealStack",
}

export default function InvestorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

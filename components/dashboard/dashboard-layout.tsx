import { Sidebar } from "./sidebar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <Sidebar />
      <main className="ml-14 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}

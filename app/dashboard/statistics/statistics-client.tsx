// app/dashboard/statistics/statistics-client.tsx
"use client"

import { useState } from "react"
import { Building2, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MetricsDateFilter } from "@/components/ui/metrics-date-filter"
import { VendorAnalyticsPanel } from "@/components/dashboard/vendor-analytics-panel"
import { InvestorManagementDashboard } from "@/components/settings/investor-management-dashboard"

export function StatisticsClient() {
  // undefined = filter not yet initialised (MetricsDateFilter useEffect pending)
  // null = filter initialised, no date selected
  // string = filter initialised with a date
  const [from, setFrom] = useState<string | null | undefined>(undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <MetricsDateFilter onChange={(v) => setFrom(v)} />
      </div>

      <Tabs defaultValue="vendor" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vendor" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Vendor Pipeline
          </TabsTrigger>
          <TabsTrigger value="investor" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Investor Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendor">
          {from !== undefined && <VendorAnalyticsPanel from={from} />}
        </TabsContent>

        <TabsContent value="investor">
          {from !== undefined && <InvestorManagementDashboard from={from} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

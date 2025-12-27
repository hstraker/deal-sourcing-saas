"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/format"

interface FinancialPieChartProps {
  data: Array<{
    name: string
    value: number
    color: string
  }>
  title?: string
}

const COLORS = ["#57F287", "#5865F2", "#FEE75C", "#ED4245", "#95a5a6", "#9b59b6", "#3498db", "#e74c3c"]

export function FinancialPieChart({ data, title }: FinancialPieChartProps) {
  // Filter out data points with zero or null values
  const filteredData = data.filter((item) => item.value !== null && item.value !== 0 && !isNaN(item.value))

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No data available for chart</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-semibold mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {filteredData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}


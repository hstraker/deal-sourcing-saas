// components/deals/deal-score-ring.tsx
"use client"

interface DealScoreRingProps {
  score: number | null
  size?: number
}

function getScoreBand(score: number | null): { color: string; label: string } {
  if (score === null) return { color: "#6b7280", label: "NOT SCORED" }
  if (score >= 80) return { color: "#22c55e", label: "GREAT DEAL" }
  if (score >= 60) return { color: "#6eb5ff", label: "GOOD DEAL" }
  if (score >= 40) return { color: "#f59e0b", label: "AVERAGE" }
  return { color: "#ef4444", label: "POOR DEAL" }
}

export function DealScoreRing({ score, size = 96 }: DealScoreRingProps) {
  const { color, label } = getScoreBand(score)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) / 100 : 0
  const strokeDashoffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Score text */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="20"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {score !== null ? score : "—"}
        </text>
      </svg>
      <p className="text-xs font-semibold tracking-wide" style={{ color }}>
        {label}
      </p>
    </div>
  )
}

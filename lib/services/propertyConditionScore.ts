/**
 * Property Condition Score Service
 * Converts photo AI scores into a human-readable condition label.
 */

export type ConditionLabel = "excellent" | "good" | "needs_work" | "needs_modernisation" | "poor"

/**
 * Weight map — how much each room type contributes to the overall score.
 * Structural/key rooms weighted more heavily than secondary rooms.
 */
const ROOM_WEIGHTS: Record<string, number> = {
  exterior: 2.0,
  kitchen: 1.8,
  bathroom: 1.5,
  reception: 1.2,
  bedroom: 1.0,
  hallway: 0.8,
  garden: 0.6,
  utility: 0.5,
  garage: 0.4,
  loft: 0.4,
  cellar: 0.4,
  other: 0.5,
}

export interface PhotoScore {
  roomType: string
  conditionScore: number // 0-100
}

/**
 * Compute a weighted aggregate condition score from individual photo scores.
 * Returns a score 0-100 and a condition label.
 */
export function computeWeightedConditionScore(photos: PhotoScore[]): {
  score: number
  label: ConditionLabel
  breakdown: Record<string, number>
} {
  if (photos.length === 0) {
    return { score: 0, label: "poor", breakdown: {} }
  }

  let totalWeight = 0
  let weightedSum = 0
  const breakdown: Record<string, number> = {}

  for (const photo of photos) {
    const weight = ROOM_WEIGHTS[photo.roomType] ?? 0.5
    totalWeight += weight
    weightedSum += photo.conditionScore * weight
    breakdown[photo.roomType] = (breakdown[photo.roomType] ?? 0) + photo.conditionScore
  }

  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0)
  const label = scoreToLabel(score)

  return { score, label, breakdown }
}

export function scoreToLabel(score: number): ConditionLabel {
  if (score >= 80) return "excellent"
  if (score >= 65) return "good"
  if (score >= 50) return "needs_work"
  if (score >= 30) return "needs_modernisation"
  return "poor"
}

export function labelToScore(label: ConditionLabel): number {
  switch (label) {
    case "excellent": return 90
    case "good": return 72
    case "needs_work": return 57
    case "needs_modernisation": return 40
    case "poor": return 15
  }
}

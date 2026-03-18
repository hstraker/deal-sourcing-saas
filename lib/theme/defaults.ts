// lib/theme/defaults.ts
// Single source of truth for all default CSS variable values.
// layout.tsx spreads DEFAULT_TOKENS + userOverrides so every CSS var is
// always set on the wrapper <div>, even before the user saves any theme.
import type { ThemeTokens } from "./types"

export const DEFAULT_TOKENS: ThemeTokens = {
  // Brand
  "--ds-primary":        "#2563EB",
  "--ds-accent":         "#F5A623",
  "--value-positive":    "#16A34A",
  "--value-negative":    "#DC2626",
  "--value-highlight":   "#2563EB",

  // Sidebar
  "--sidebar-bg":        "#1A1A1F",
  "--sidebar-active-bg": "#F5A623",
  "--sidebar-hover":     "#2A2A32",
  "--sidebar-border":    "#2D2D38",

  // Typography
  "--font-size-base":       "14px",
  "--font-weight-heading":  "700",

  // Spacing
  "--page-padding":      "32px",
  "--card-padding":      "24px",
  "--section-gap":       "20px",
  "--table-row-height":  "52px",

  // Deal status badge colours (bg + text as hex)
  "--status-deal-new-bg":         "#f3f4f6",
  "--status-deal-new-text":       "#1f2937",
  "--status-deal-review-bg":      "#fef9c3",
  "--status-deal-review-text":    "#713f12",
  "--status-deal-in_progress-bg": "#dbeafe",
  "--status-deal-in_progress-text":"#1e40af",
  "--status-deal-ready-bg":       "#ede9fe",
  "--status-deal-ready-text":     "#4c1d95",
  "--status-deal-listed-bg":      "#dcfce7",
  "--status-deal-listed-text":    "#14532d",
  "--status-deal-reserved-bg":    "#ffedd5",
  "--status-deal-reserved-text":  "#7c2d12",
  "--status-deal-sold-bg":        "#bbf7d0",
  "--status-deal-sold-text":      "#14532d",
  "--status-deal-archived-bg":    "#e5e7eb",
  "--status-deal-archived-text":  "#4b5563",

  // Pipeline stage badge colours
  "--status-pipeline-new_lead-bg":             "#dbeafe",
  "--status-pipeline-new_lead-text":           "#1d4ed8",
  "--status-pipeline-ai_conversation-bg":      "#ede9fe",
  "--status-pipeline-ai_conversation-text":    "#6d28d9",
  "--status-pipeline-deal_validation-bg":      "#fef3c7",
  "--status-pipeline-deal_validation-text":    "#92400e",
  "--status-pipeline-offer_made-bg":           "#d1fae5",
  "--status-pipeline-offer_made-text":         "#065f46",
  "--status-pipeline-offer_accepted-bg":       "#dcfce7",
  "--status-pipeline-offer_accepted-text":     "#14532d",
  "--status-pipeline-offer_rejected-bg":       "#fee2e2",
  "--status-pipeline-offer_rejected-text":     "#991b1b",
  "--status-pipeline-video_sent-bg":           "#cffafe",
  "--status-pipeline-video_sent-text":         "#164e63",
  "--status-pipeline-retry_1-bg":              "#ffedd5",
  "--status-pipeline-retry_1-text":            "#7c2d12",
  "--status-pipeline-retry_2-bg":              "#ffedd5",
  "--status-pipeline-retry_2-text":            "#7c2d12",
  "--status-pipeline-retry_3-bg":              "#ffedd5",
  "--status-pipeline-retry_3-text":            "#7c2d12",
  "--status-pipeline-paperwork_sent-bg":       "#e0e7ff",
  "--status-pipeline-paperwork_sent-text":     "#3730a3",
  "--status-pipeline-ready_for_investors-bg":  "#ede9fe",
  "--status-pipeline-ready_for_investors-text":"#4c1d95",
  "--status-pipeline-dead_lead-bg":            "#fecaca",
  "--status-pipeline-dead_lead-text":          "#7f1d1d",

  // Contact type badge colours
  "--status-contact-solicitor-bg":         "#dbeafe",
  "--status-contact-solicitor-text":       "#1d4ed8",
  "--status-contact-investor_contact-bg":  "#ede9fe",
  "--status-contact-investor_contact-text":"#4c1d95",
  "--status-contact-vendor_contact-bg":    "#ccfbf1",
  "--status-contact-vendor_contact-text":  "#134e4a",
  "--status-contact-estate_agent-bg":      "#dcfce7",
  "--status-contact-estate_agent-text":    "#14532d",
  "--status-contact-contractor-bg":        "#fef3c7",
  "--status-contact-contractor-text":      "#92400e",
  "--status-contact-other-bg":             "#f3f4f6",
  "--status-contact-other-text":           "#374151",
}

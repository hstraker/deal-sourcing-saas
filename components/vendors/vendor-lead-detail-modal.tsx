"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  PoundSterling,
  Edit,
  Save,
  X,
  Trash2,
  Loader2,
  FileDown,
  Calculator,
  Percent,
  Home,
  ArrowDownRight,
  Target,
  Wallet,
  Building2,
  AlertTriangle,
  BarChart3,
  ListChecks,
  KeyRound,
  User,
  Search,
  BedDouble,
  Bath,
  Maximize2,
  Minimize2,
  Bell,
  AlertCircle,
  Clock as ClockIcon,
} from "lucide-react"
import { PipelineStage } from "@prisma/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import { formatCurrency } from "@/lib/format"
import { ShieldCheck } from "lucide-react"
import { SolicitorSelector, type Solicitor as SolicitorType } from "@/components/solicitors/solicitor-selector"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AiConversationTab } from "./ai-conversation-tab"

interface SMSMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: Date
  messageSid?: string | null
  status?: string | null
  aiGenerated?: boolean | null
  intentDetected?: string | null
  aiResponseMetadata?: Record<string, any> | null
  confidenceScore?: number | null
}

interface PipelineEvent {
  id: string
  eventType: string
  details: Record<string, any>
  createdAt: Date
  createdBy?: string | null
}

export interface VendorLead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  condition: string | null
  estimatedMonthlyRent: number | null
  estimatedAnnualRent: number | null
  pipelineStage: PipelineStage
  motivationScore: number | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  timelineDays: number | null
  competingOffers: boolean | null
  bmvScore: number | null
  estimatedMarketValue: number | null
  estimatedRefurbCost: number | null
  profitPotential: number | null
  validationPassed: boolean | null
  validationNotes: string | null
  validatedAt: Date | null
  offerAmount: number | null
  offerPercentage: number | null
  offerSentAt: Date | null
  offerAcceptedAt: Date | null
  offerRejectedAt: Date | null
  rejectionReason: string | null
  retryCount: number
  videoSent: boolean
  videoUrl: string | null
  conversationStartedAt: Date | null
  lastContactAt: Date | null
  investorPackGenerationCount?: number
  lastInvestorPackGeneratedAt?: Date | null
  dealId: string | null
  reservedByInvestorId: string | null
  reservedAt: Date | null
  reservation?: {
    id: string
    dealId: string
    investorId: string
    status: string
    reservationFee: number
    createdAt: Date
    updatedAt: Date
    investor: {
      id: string
      user: { firstName: string | null; lastName: string | null; email: string; phone: string | null }
    }
  } | null
  reservedByInvestor?: {
    id: string
    user: { firstName: string | null; lastName: string | null; email: string; phone: string | null }
  } | null
  latestCheckRisk: string | null
  latestCheckedAt: Date | null
  isTest?: boolean
  solicitorId?: string | null
  solicitor?: SolicitorType | null
  conversationState?: Record<string, any> | null
  conversationStartedAt?: Date | null
  smsMessages: SMSMessage[]
  pipelineEvents?: PipelineEvent[]
}

interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
  initialTab?: "details" | "comparables" | "activity" | "portal-check" | "ai-conversation"
  alertReason?: string
  alertUrgency?: "high" | "medium" | "low"
}

const formatDate = (date: Date | null) => {
  if (!date) return "—"
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatTimeAgo = (date: Date | null) => {
  if (!date) return "Never"
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return "Just now"
}

/**
 * Strips property-listing noise (e.g. "2 bed flat for sale, £120,000", "000 - Zoopla")
 * from a scraped address string and returns a clean "Street, Town, POSTCODE" form.
 *
 * Handles two cases:
 *  1. Postcode embedded in address — extract clean prefix then reattach postcode
 *  2. Postcode stored separately   — clean address then append postcode
 *
 * Examples:
 *   "Ffordd Coed Darcy, Llandarcy, Neath SA10, 2 bed flat for sale, £120,000, SA10 6FR"
 *   → "Ffordd Coed Darcy, Llandarcy, Neath SA10 6FR"
 *
 *   "Phoebe Road, Copper Quarter, Swansea"  +  postcode "SA1 7FL"
 *   → "Phoebe Road, Copper Quarter, Swansea, SA1 7FL"
 */
const isJunkSegment = (s: string): boolean => {
  if (!s) return true
  if (s.includes("£")) return true
  if (/\d+\s*(bed|bath|studio|reception)/i.test(s)) return true
  if (/(for\s+sale|to\s+let|for\s+rent|sold\s+subject|under\s+offer)/i.test(s)) return true
  if (/\b(zoopla|rightmove|onthemarket|primelocation|nethouseprices|mouseprice|spareroom)\b/i.test(s)) return true
  // Pure digit / punctuation fragment — price tail e.g. "000" from "£250,000"
  if (/^[\d\s\-–—,]+$/.test(s)) return true
  return false
}

const cleanPropertyAddress = (address: string | null, postcode: string | null): string => {
  if (!address) return postcode ?? "No Address"

  if (postcode && address.includes(postcode)) {
    // ── Case 1: postcode is already embedded — strip junk between location and postcode ──
    const pcIdx = address.indexOf(postcode)
    const before = address.slice(0, pcIdx).trimEnd().replace(/,\s*$/, "")
    const segments = before.split(",").map((s) => s.trim()).filter((s) => !isJunkSegment(s))
    const cleanBefore = segments.join(", ")
    const outcode = postcode.split(" ")[0]
    const incode = postcode.split(" ")[1] ?? ""
    // If prefix already ends with the outcode, append only the incode (no duplicate)
    if (cleanBefore.endsWith(outcode)) {
      return incode ? `${cleanBefore} ${incode}` : cleanBefore
    }
    const sep = /[a-zA-Z0-9]/.test(cleanBefore.slice(-1)) ? " " : ""
    return `${cleanBefore}${sep}${postcode}`
  }

  // ── Case 2: postcode is separate — clean address then append postcode ──
  const segments = address.split(",").map((s) => s.trim()).filter((s) => !isJunkSegment(s))
  const cleanAddress = segments.join(", ")
  if (!postcode) return cleanAddress || address
  return `${cleanAddress}, ${postcode}`
}

interface ParsedStrategy {
  key: string
  name: string
  emoji: string
  maxOffer: number
  yield: number | null
  viable: boolean
}

interface ParsedNotes {
  comparables: Array<{ address: string; price: number; beds?: number; date?: string; distance?: string }>
  rentalYield: {
    monthlyRent?: number; weeklyRent?: number; annualRent?: number
    grossYield?: number; grossYieldLabel?: string; netYield?: number
    cashFlow?: number; dataSource?: string; confidence?: string
    passed?: boolean; note?: string
  } | null
  marketValueSource: { source: string; confidence: string; count?: number } | null
  creditsUsed: number | null
  failureReasons: string[]
  strategyData: { recommended: string; strategies: ParsedStrategy[] } | null
}

function parseValidationNotes(notes: string | null): ParsedNotes | null {
  if (!notes) return null

  // Parse comparable properties
  const comparables: ParsedNotes["comparables"] = []
  const lines = notes.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const propMatch = lines[i].match(/^\s+(\d+)\.\s+(.+)$/)
    if (propMatch && i + 1 < lines.length) {
      const detailMatch = lines[i + 1].match(/💷 £([\d,]+) \| 🛏️ (\d+) bed \| 📅 (.+?) \| ([\d.]+) mi/)
      if (detailMatch) {
        comparables.push({
          address: propMatch[2].trim(),
          price: parseInt(detailMatch[1].replace(/,/g, "")),
          beds: parseInt(detailMatch[2]),
          date: detailMatch[3],
          distance: detailMatch[4] + " mi",
        })
      }
    }
  }

  // Parse market value source (from 📊 section)
  let marketValueSource: ParsedNotes["marketValueSource"] = null
  const mvIdx = notes.indexOf("📊 MARKET VALUE ANALYSIS")
  if (mvIdx !== -1) {
    const mvSlice = notes.slice(mvIdx, mvIdx + 400)
    const sourceMatch = mvSlice.match(/Data Source: (.+)/)
    const confMatch = mvSlice.match(/Confidence: (\w+)/)
    const countMatch = mvSlice.match(/\((\d+) properties\)/)
    marketValueSource = {
      source: sourceMatch ? sourceMatch[1].trim() : "Unknown",
      confidence: confMatch ? confMatch[1].trim() : "",
      count: countMatch ? parseInt(countMatch[1]) : undefined,
    }
  }

  // Parse rental yield section
  let rentalYield: ParsedNotes["rentalYield"] = null
  const yieldIdx = notes.indexOf("🏠 RENTAL YIELD ANALYSIS")
  if (yieldIdx !== -1) {
    const yieldSlice = notes.slice(yieldIdx)
    const passed = yieldSlice.includes("✅")
    const monthlyMatch = yieldSlice.match(/Monthly Rent: £([\d,]+)/)
    const weeklyMatch = yieldSlice.match(/Weekly Rent: £([\d,]+)/)
    const annualMatch = yieldSlice.match(/Annual Rent: £([\d,]+)/)
    const grossMatch = yieldSlice.match(/Gross Yield: ([\d.]+)%\s*\((.+?)\)/)
    const netMatch = yieldSlice.match(/Net Yield: ([\d.]+)%/)
    const cashFlowMatch = yieldSlice.match(/Monthly Cash Flow: £([\d,]+)/)
    const sourceMatch = yieldSlice.match(/Data Source: (.+)/)
    const confMatch = yieldSlice.match(/Confidence: (\w+)/)
    const noteMatch = yieldSlice.match(/💡 Note: (.+)/)
    rentalYield = {
      monthlyRent: monthlyMatch ? parseInt(monthlyMatch[1].replace(/,/g, "")) : undefined,
      weeklyRent: weeklyMatch ? parseInt(weeklyMatch[1].replace(/,/g, "")) : undefined,
      annualRent: annualMatch ? parseInt(annualMatch[1].replace(/,/g, "")) : undefined,
      grossYield: grossMatch ? parseFloat(grossMatch[1]) : undefined,
      grossYieldLabel: grossMatch ? grossMatch[2] : undefined,
      netYield: netMatch ? parseFloat(netMatch[1]) : undefined,
      cashFlow: cashFlowMatch ? parseInt(cashFlowMatch[1].replace(/,/g, "")) : undefined,
      dataSource: sourceMatch ? sourceMatch[1].trim() : undefined,
      confidence: confMatch ? confMatch[1].trim() : undefined,
      passed,
      note: noteMatch ? noteMatch[1].trim() : undefined,
    }
  }

  // Parse credits used
  const creditsMatch = notes.match(/PropertyData API Credits Used: (\d+)/)
  const creditsUsed = creditsMatch ? parseInt(creditsMatch[1]) : null

  // Parse failure reasons
  const failureReasons: string[] = []
  const failIdx = notes.indexOf("REASONS FOR FAILURE")
  if (failIdx !== -1) {
    const failSlice = notes.slice(failIdx)
    for (const m of failSlice.matchAll(/\d+\. (.+)/g)) {
      failureReasons.push(m[1].trim())
    }
  }

  // Parse machine-readable strategy data
  let strategyData: ParsedNotes["strategyData"] = null
  const stratMatch = notes.match(/\[STRATEGY_DATA\](.*?)\[\/STRATEGY_DATA\]/)
  if (stratMatch) {
    try {
      strategyData = JSON.parse(stratMatch[1])
    } catch {
      // malformed — ignore
    }
  }

  return { comparables, rentalYield, marketValueSource, creditsUsed, failureReasons, strategyData }
}

export function VendorLeadDetailModal({
  lead,
  open,
  onOpenChange,
  onUpdate,
  initialTab,
  alertReason,
  alertUrgency = "low",
}: VendorLeadDetailModalProps) {
  const [manualMessage, setManualMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showConversation, setShowConversation] = useState(false)
  const [fullLead, setFullLead] = useState<VendorLead | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "details")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRemovingReservation, setIsRemovingReservation] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string;
    variant: "destructive" | "archive" | "warning" | "default";
    confirmLabel: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", variant: "default", confirmLabel: "Confirm", onConfirm: () => {} })
  const [isCalculating, setIsCalculating] = useState(false)
  const [isGeneratingPack, setIsGeneratingPack] = useState(false)
  const [isFixingPostcode, setIsFixingPostcode] = useState(false)
  const [bmvResult, setBmvResult] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")


  // Transform initial lead prop to ensure Decimal types are converted to numbers
  const transformLead = (leadData: any) => ({
    ...leadData,
    askingPrice: leadData.askingPrice ? Number(leadData.askingPrice) : null,
    bmvScore: leadData.bmvScore ? Number(leadData.bmvScore) : null,
    estimatedMarketValue: leadData.estimatedMarketValue ? Number(leadData.estimatedMarketValue) : null,
    estimatedRefurbCost: leadData.estimatedRefurbCost ? Number(leadData.estimatedRefurbCost) : null,
    profitPotential: leadData.profitPotential ? Number(leadData.profitPotential) : null,
    offerAmount: leadData.offerAmount ? Number(leadData.offerAmount) : null,
    offerPercentage: leadData.offerPercentage ? Number(leadData.offerPercentage) : null,
    motivationScore: leadData.motivationScore ? Number(leadData.motivationScore) : null,
    estimatedMonthlyRent: leadData.estimatedMonthlyRent ? Number(leadData.estimatedMonthlyRent) : null,
    estimatedAnnualRent: leadData.estimatedAnnualRent ? Number(leadData.estimatedAnnualRent) : null,
    reservedAt: leadData.reservedAt ? new Date(leadData.reservedAt) : null,
    reservation: leadData.reservation
      ? {
          ...leadData.reservation,
          reservationFee: Number(leadData.reservation.reservationFee),
          createdAt: new Date(leadData.reservation.createdAt),
          updatedAt: new Date(leadData.reservation.updatedAt),
        }
      : null,
  })

  useEffect(() => {
    if (open && lead.id) {
      // Fetch full lead details with all messages
      fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lead) {
            // Transform dates and Decimal types
            const transformed = {
              ...transformLead(data.lead),
              validatedAt: data.lead.validatedAt ? new Date(data.lead.validatedAt) : null,
              offerSentAt: data.lead.offerSentAt ? new Date(data.lead.offerSentAt) : null,
              offerAcceptedAt: data.lead.offerAcceptedAt ? new Date(data.lead.offerAcceptedAt) : null,
              offerRejectedAt: data.lead.offerRejectedAt ? new Date(data.lead.offerRejectedAt) : null,
              conversationStartedAt: data.lead.conversationStartedAt ? new Date(data.lead.conversationStartedAt) : null,
              lastContactAt: data.lead.lastContactAt ? new Date(data.lead.lastContactAt) : null,
              smsMessages: (data.lead.smsMessages || []).map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              })),
              pipelineEvents: (data.lead.pipelineEvents || []).map((ev: any) => ({
                ...ev,
                createdAt: new Date(ev.createdAt),
              })),
            }
            setFullLead(transformed)
          }
        })
        .catch((error) => {
          console.error("Error fetching lead details:", error)
        })
    }
  }, [open, lead.id])

  // Fetch available templates
  useEffect(() => {
    if (open) {
      fetch('/api/investor-pack-templates')
        .then(res => res.json())
        .then(data => {
          if (data.templates) {
            setTemplates(data.templates)
            // Auto-select the default template
            const defaultTemplate = data.templates.find((t: any) => t.isDefault)
            if (defaultTemplate) {
              setSelectedTemplateId(defaultTemplate.id)
            } else if (data.templates.length > 0) {
              setSelectedTemplateId(data.templates[0].id)
            }
          }
        })
        .catch(error => {
          console.error('Error fetching templates:', error)
        })
    }
  }, [open])


  const currentLead = fullLead || transformLead(lead)
  const parsedNotes = parseValidationNotes(currentLead.validationNotes)

  const handleSendManualMessage = async () => {
    if (!manualMessage.trim()) return

    setSendingMessage(true)
    try {
      const response = await fetch(`/api/vendor-pipeline/leads/${lead.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: manualMessage }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
      }

      const data = await response.json()
      
      // Refresh lead data to show new message
      if (onUpdate) {
        onUpdate()
      } else {
        // Fallback: refetch lead details
        const leadResponse = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        if (leadResponse.ok) {
          const leadData = await leadResponse.json()
          if (leadData.lead) {
            const transformed = {
              ...transformLead(leadData.lead),
              validatedAt: leadData.lead.validatedAt ? new Date(leadData.lead.validatedAt) : null,
              offerSentAt: leadData.lead.offerSentAt ? new Date(leadData.lead.offerSentAt) : null,
              offerAcceptedAt: leadData.lead.offerAcceptedAt ? new Date(leadData.lead.offerAcceptedAt) : null,
              offerRejectedAt: leadData.lead.offerRejectedAt ? new Date(leadData.lead.offerRejectedAt) : null,
              conversationStartedAt: leadData.lead.conversationStartedAt ? new Date(leadData.lead.conversationStartedAt) : null,
              lastContactAt: leadData.lead.lastContactAt ? new Date(leadData.lead.lastContactAt) : null,
              smsMessages: (leadData.lead.smsMessages || []).map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              })),
              pipelineEvents: (leadData.lead.pipelineEvents || []).map((ev: any) => ({
                ...ev,
                createdAt: new Date(ev.createdAt),
              })),
            }
            setFullLead(transformed)
          }
        }
      }

      setManualMessage("")
      toast.success("Message sent successfully")
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast.error(error.message || "Failed to send message")
    } finally {
      setSendingMessage(false)
    }
  }

  const handleFixPostcode = async () => {
    if (!currentLead.propertyAddress) {
      toast.error("Add a property address first")
      return
    }
    setIsFixingPostcode(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${currentLead.id}/fix-postcode`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to resolve postcode")
        return
      }
      if (data.corrected) {
        // Update the edit form and the display
        setEditForm((prev: any) => ({ ...prev, propertyPostcode: data.postcode }))
        toast.success(`Postcode resolved: ${data.postcode} (via ${data.source.replace(/_/g, " ")})`)
        onUpdate?.()
      } else {
        toast.info(`Postcode is already correct: ${data.postcode}`)
      }
    } catch {
      toast.error("Failed to resolve postcode")
    } finally {
      setIsFixingPostcode(false)
    }
  }

  const motivationBadgeColor = (score: number | null) => {
    if (!score) return "bg-gray-100 text-gray-700"
    if (score >= 8) return "bg-green-100 text-green-700"
    if (score >= 5) return "bg-yellow-100 text-yellow-700"
    return "bg-red-100 text-red-700"
  }

  const handleEdit = () => {
    // Initialize edit form with current values
    setEditForm({
      vendorName: currentLead.vendorName || "",
      vendorPhone: currentLead.vendorPhone || "",
      vendorEmail: currentLead.vendorEmail || "",
      propertyAddress: currentLead.propertyAddress || "",
      propertyPostcode: currentLead.propertyPostcode || "",
      askingPrice: currentLead.askingPrice || "",
      propertyType: currentLead.propertyType || "",
      bedrooms: currentLead.bedrooms || "",
      bathrooms: currentLead.bathrooms || "",
      squareFeet: currentLead.squareFeet || "",
      condition: currentLead.condition || "",
      estimatedMonthlyRent: currentLead.estimatedMonthlyRent || "",
      estimatedAnnualRent: currentLead.estimatedAnnualRent || "",
      motivationScore: currentLead.motivationScore || "",
      urgencyLevel: currentLead.urgencyLevel || "",
      reasonForSelling: currentLead.reasonForSelling || "",
      timelineDays: currentLead.timelineDays || "",
      competingOffers: currentLead.competingOffers || false,
      estimatedMarketValue: currentLead.estimatedMarketValue || "",
      estimatedRefurbCost: currentLead.estimatedRefurbCost || "",
      pipelineStage: currentLead.pipelineStage || "",
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({})
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Convert empty strings to null and numbers
      const dataToSave = Object.entries(editForm).reduce((acc, [key, value]) => {
        if (value === "") {
          acc[key] = null
        } else if (["askingPrice", "bedrooms", "bathrooms", "squareFeet", "estimatedMonthlyRent", "estimatedAnnualRent", "motivationScore", "timelineDays", "estimatedMarketValue", "estimatedRefurbCost"].includes(key)) {
          acc[key] = value ? Number(value) : null
        } else {
          acc[key] = value
        }
        return acc
      }, {} as any)

      const response = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update vendor lead")
      }

      const updatedLead = await response.json()

      // Transform and update fullLead state
      const transformed = {
        ...transformLead(updatedLead),
        validatedAt: updatedLead.validatedAt ? new Date(updatedLead.validatedAt) : null,
        offerSentAt: updatedLead.offerSentAt ? new Date(updatedLead.offerSentAt) : null,
        offerAcceptedAt: updatedLead.offerAcceptedAt ? new Date(updatedLead.offerAcceptedAt) : null,
        offerRejectedAt: updatedLead.offerRejectedAt ? new Date(updatedLead.offerRejectedAt) : null,
        conversationStartedAt: updatedLead.conversationStartedAt ? new Date(updatedLead.conversationStartedAt) : null,
        lastContactAt: updatedLead.lastContactAt ? new Date(updatedLead.lastContactAt) : null,
        smsMessages: fullLead?.smsMessages || [],
      }

      setFullLead(transformed)
      setIsEditing(false)

      if (onUpdate) {
        onUpdate()
      }

      // Check if BMV-affecting fields were changed
      const bmvFieldsChanged = ["askingPrice", "estimatedMarketValue", "estimatedRefurbCost", "condition", "motivationScore", "urgencyLevel"]
        .some(field => editForm[field] !== undefined && editForm[field] !== "")

      if (bmvFieldsChanged) {
        toast.success("Vendor updated - Click 'Calculate BMV' to refresh metrics", { duration: 5000 })
      } else {
        toast.success("Vendor updated successfully")
      }
    } catch (error: any) {
      console.error("Error updating vendor lead:", error)
      toast.error(error.message || "Failed to update vendor")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    setConfirmDialog({
      open: true,
      title: `Delete ${currentLead.vendorName}?`,
      description: "This cannot be undone. The vendor lead and all conversation history will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        setIsDeleting(true)
        try {
          const response = await fetch(`/api/vendor-leads/${lead.id}`, {
            method: "DELETE",
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Failed to delete vendor lead")
          }

          toast.success(`${currentLead.vendorName} deleted successfully`)

          if (onUpdate) {
            onUpdate()
          }

          onOpenChange(false)
        } catch (error: any) {
          console.error("Error deleting vendor lead:", error)
          toast.error(error.message || "Failed to delete vendor")
        } finally {
          setIsDeleting(false)
        }
      },
    })
  }

  const handleRemoveReservation = () => {
    if (!currentLead.reservation) return
    setConfirmDialog({
      open: true,
      title: "Remove investor reservation?",
      description: "This cannot be undone. The reservation will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Remove reservation",
      onConfirm: async () => {
        setIsRemovingReservation(true)
        try {
          const res = await fetch(`/api/reservations/${currentLead.reservation!.id}`, {
            method: "DELETE",
          })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Failed to remove reservation")
          }
          setFullLead((prev) => prev ? { ...prev, reservation: null } : prev)
          toast.success("Reservation removed")
          if (onUpdate) onUpdate()
        } catch (err: any) {
          toast.error(err.message || "Failed to remove reservation")
        } finally {
          setIsRemovingReservation(false)
        }
      },
    })
  }

  const handleGenerateInvestorPack = async () => {
    if (!currentLead.propertyAddress) {
      toast.error("Property address is required to generate investor pack")
      return
    }

    if (!currentLead.askingPrice) {
      toast.error("Asking price is required to generate investor pack")
      return
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template")
      return
    }

    setIsGeneratingPack(true)

    try {
      const response = await fetch(`/api/vendor-leads/${lead.id}/investor-pack?templateId=${selectedTemplateId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle the specific "Deal Not Ready" error with helpful guidance
        if (response.status === 400 && errorData.error === "Deal Not Ready for Investor Marketing") {
          const stage = currentLead.pipelineStage
          let helpMessage = errorData.message || "This vendor lead must complete the pipeline process first."

          if (stage === "OFFER_ACCEPTED") {
            helpMessage += "\n\nNext Step: Request solicitor details from the vendor to create the deal."
          } else if (stage === "READY_FOR_INVESTORS") {
            helpMessage += "\n\nThe deal should be created. Please check the vendor pipeline status."
          } else if (stage === "NEW_LEAD" || stage === "AI_CONVERSATION") {
            helpMessage += "\n\nThe AI is still qualifying this lead. Wait for validation and offer stages."
          } else {
            helpMessage += `\n\nCurrent Stage: ${stage}. Continue the vendor negotiation process.`
          }

          toast.error(helpMessage, { duration: 8000 })
          return
        }

        throw new Error(errorData.error || "Failed to generate investor pack")
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const fileName = currentLead.propertyAddress.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      a.download = `investor-pack-${fileName}.pdf`
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Investor pack generated successfully")

      // Refresh lead data
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      console.error("Error generating investor pack:", error)
      toast.error(error.message || "Failed to generate investor pack")
    } finally {
      setIsGeneratingPack(false)
    }
  }

  const handleCalculateBMV = async () => {
    if (!currentLead.askingPrice) {
      toast.error("Please add an asking price before calculating BMV")
      return
    }

    setIsCalculating(true)
    try {
      const response = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to calculate BMV")
      }

      const result = await response.json()
      setBmvResult(result.data)

      // Fetch the updated lead from the database to ensure consistency
      const freshLead = await fetch(`/api/vendor-leads/${lead.id}`)
      if (freshLead.ok) {
        const freshData = await freshLead.json()
        const transformed = {
          ...transformLead(freshData),
          validatedAt: freshData.validatedAt ? new Date(freshData.validatedAt) : null,
          offerSentAt: freshData.offerSentAt ? new Date(freshData.offerSentAt) : null,
          offerAcceptedAt: freshData.offerAcceptedAt ? new Date(freshData.offerAcceptedAt) : null,
          offerRejectedAt: freshData.offerRejectedAt ? new Date(freshData.offerRejectedAt) : null,
          conversationStartedAt: freshData.conversationStartedAt ? new Date(freshData.conversationStartedAt) : null,
          lastContactAt: freshData.lastContactAt ? new Date(freshData.lastContactAt) : null,
          smsMessages: currentLead.smsMessages, // Keep existing messages
        }
        setFullLead(transformed)
      }

      if (onUpdate) {
        onUpdate()
      }

      if (result.data.validationPassed) {
        toast.success(`Deal validated! ${Number(result.data.bmvScore).toFixed(1)}% BMV with £${Number(result.data.profitPotential).toLocaleString()} profit`)
      } else {
        toast.warning("Deal calculated but failed validation criteria")
      }
    } catch (error: any) {
      console.error("Error calculating BMV:", error)
      toast.error(error.message || "Failed to calculate BMV")
    } finally {
      setIsCalculating(false)
    }
  }

  // Derive land registry status from fresh calculation result OR from stored validation notes
  const landRegistryUsed: boolean =
    bmvResult?.landRegistryUsed === true ||
    (currentLead.validationNotes?.includes("Data Found: HM Land Registry") ?? false)
  const landRegistryOwnership = bmvResult?.landRegistryOwnership ?? null
  // Detect if LR was checked but no match found (i.e. data was imported but postcode not matched)
  const landRegistryCheckedNoMatch: boolean =
    !landRegistryUsed &&
    (bmvResult?.landRegistryUsed === false ||
      (currentLead.validationNotes?.includes("No match in Land Registry dataset") ?? false))
  // Detect outcode-only postcode (e.g. "SA5" with no incode)
  const isOutcodeOnly: boolean =
    bmvResult?.isOutcodeOnly === true ||
    (currentLead.validationNotes?.includes("outcode-only") ?? false) ||
    (currentLead.propertyPostcode != null &&
      !/^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/i.test(currentLead.propertyPostcode.trim()))
  // Postcode correction info from latest BMV calculation
  const postcodeWasCorrected: boolean = bmvResult?.postcodeWasCorrected === true
  const postcodeUsed: string | null = bmvResult?.postcodeUsed ?? currentLead.propertyPostcode ?? null
  const postcodeResolutionSource: string | null = bmvResult?.postcodeResolutionSource ?? null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={isFullscreen
            ? "!fixed !left-2 !top-2 !right-2 !bottom-2 !translate-x-0 !translate-y-0 !max-w-none !w-auto !max-h-none !h-auto rounded-xl overflow-y-auto"
            : "max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
          }>
          <DialogHeader className="pb-2 border-b pr-16">
            {/* ── Row 1: stage pill + action buttons ──────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] border-0">
                  {currentLead.pipelineStage.replace(/_/g, " ")}
                </Badge>
                {currentLead.dealId ? (
                  <Badge className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                    Deal Created
                  </Badge>
                ) : null}
                {alertReason && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className={cn(
                            "text-[11px] font-medium px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-help",
                            alertUrgency === "high"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : alertUrgency === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-orange-50 text-orange-600 border-orange-200"
                          )}
                        >
                          {alertUrgency === "high" ? (
                            <AlertCircle className="h-3 w-3 shrink-0" />
                          ) : alertUrgency === "medium" ? (
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                          ) : (
                            <ClockIcon className="h-3 w-3 shrink-0" />
                          )}
                          {alertUrgency === "high" ? "Action Required" : alertUrgency === "medium" ? "Needs Attention" : "Stale Lead"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                        <div className="flex items-start gap-1.5">
                          <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>{alertReason}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {!isEditing ? (
                  <>
                    {/* Template selector + Pack button — grouped */}
                    <div className="flex items-center rounded-md border bg-white overflow-hidden">
                      {templates.length > 0 && (
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger className="h-8 w-36 border-0 border-r rounded-none shadow-none focus:ring-0 text-xs pl-2.5 pr-1">
                            <SelectValue placeholder="Template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.filter((t: any) => t.isActive).map((template: any) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}{template.isDefault ? " ✓" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              <Button
                                size="sm"
                                className="h-8 rounded-none border-0 gap-1.5 text-xs px-3"
                                onClick={handleGenerateInvestorPack}
                                disabled={isGeneratingPack || !currentLead.propertyAddress || !currentLead.askingPrice || !selectedTemplateId}
                              >
                                {isGeneratingPack
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <FileDown className="h-3.5 w-3.5" />}
                                {isGeneratingPack ? "Generating…" : "Investor Pack"}
                              </Button>
                              {currentLead.investorPackGenerationCount != null && currentLead.investorPackGenerationCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none z-10">
                                  {currentLead.investorPackGenerationCount}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            <p suppressHydrationWarning>
                              {currentLead.investorPackGenerationCount && currentLead.investorPackGenerationCount > 0
                                ? `Generated ${currentLead.investorPackGenerationCount}×${currentLead.lastInvestorPackGeneratedAt ? ` · Last: ${formatTimeAgo(currentLead.lastInvestorPackGeneratedAt)}` : ""}`
                                : "Generate professional investor pack PDF"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Edit — icon button */}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={handleEdit}
                            disabled={isSaving}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Edit lead</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Delete — icon button, red tint */}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={handleDelete}
                            disabled={isSaving || isDeleting}
                          >
                            {isDeleting
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs text-red-600">Delete lead</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Fullscreen toggle */}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setIsFullscreen((v) => !v)}
                          >
                            {isFullscreen
                              ? <Minimize2 className="h-3.5 w-3.5" />
                              : <Maximize2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCancelEdit} disabled={isSaving}>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={isSaving}>
                      {isSaving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Save className="h-3.5 w-3.5" />}
                      Save changes
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* ── Row 2: property address as title ────────────────────────────── */}
            <DialogTitle className="mt-3 flex items-start gap-2 text-base font-semibold leading-snug">
              <MapPin className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
              <span>{cleanPropertyAddress(currentLead.propertyAddress, currentLead.propertyPostcode)}</span>
            </DialogTitle>

            {/* ── Row 3: meta chips ────────────────────────────────────────────── */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {currentLead.vendorName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-2 py-0.5">
                  <User className="h-3 w-3" />
                  {currentLead.vendorName}
                </span>
              )}
              {currentLead.vendorPhone && (
                <a
                  href={`tel:${currentLead.vendorPhone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-md px-2 py-0.5 hover:bg-green-100 transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  {currentLead.vendorPhone}
                </a>
              )}
              {currentLead.askingPrice && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-50 text-green-800 border border-green-300 rounded-md px-2 py-0.5">
                  <PoundSterling className="h-3 w-3" />
                  {formatCurrency(currentLead.askingPrice)}
                </span>
              )}
              {currentLead.bmvScore !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5 border",
                  Number(currentLead.bmvScore) >= 15
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-red-50 text-red-700 border-red-200"
                )}>
                  <TrendingUp className="h-3 w-3" />
                  {Number(currentLead.bmvScore).toFixed(1)}% BMV
                </span>
              )}
              {currentLead.validationPassed !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 border",
                  currentLead.validationPassed
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-600 border-red-200"
                )}>
                  {currentLead.validationPassed
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <XCircle className="h-3 w-3" />}
                  {currentLead.validationPassed ? "Validated" : "Not Validated"}
                </span>
              )}
            </div>
          </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 gap-0.5 bg-gray-50">
            <TabsTrigger
              value="details"
              className="relative flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
                data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
            >
              <User className="h-3.5 w-3.5" />
              <span>Contact Info</span>
              {currentLead.reservation && (
                <span className="absolute top-1.5 right-2 inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="comparables"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
                data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Comparables</span>
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
                data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger
              value="portal-check"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
                data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Portal Check</span>
            </TabsTrigger>
            <TabsTrigger
              value="ai-conversation"
              className="relative flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
                data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>AI Convo</span>
              {currentLead.smsMessages && currentLead.smsMessages.length > 0 && (
                <span className="absolute top-1.5 right-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* ── Row 1: Contact + Property ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Contact */}
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4 text-[#2563EB]" />
                    Vendor Contact
                  </h3>
                </div>
                <div className="p-5 space-y-2">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="vendorName">Name *</Label>
                        <Input
                          id="vendorName"
                          value={editForm.vendorName || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="vendorPhone">Phone *</Label>
                        <Input
                          id="vendorPhone"
                          value={editForm.vendorPhone || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorPhone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="vendorEmail">Email</Label>
                        <Input
                          id="vendorEmail"
                          type="email"
                          value={editForm.vendorEmail || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorEmail: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                        <User className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-semibold text-sm">{currentLead.vendorName}</span>
                      </div>
                      <a
                        href={`tel:${currentLead.vendorPhone}`}
                        className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 hover:bg-green-100 transition-colors"
                      >
                        <Phone className="h-4 w-4 text-green-700 shrink-0" />
                        <span className="font-medium text-sm text-green-800">{currentLead.vendorPhone}</span>
                      </a>
                      {currentLead.vendorEmail && (
                        <a
                          href={`mailto:${currentLead.vendorEmail}`}
                          className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 hover:bg-blue-100 transition-colors"
                        >
                          <Mail className="h-4 w-4 text-blue-700 shrink-0" />
                          <span className="font-medium text-sm text-blue-800 truncate">{currentLead.vendorEmail}</span>
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Property */}
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Home className="h-4 w-4 text-[#2563EB]" />
                    Property
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="propertyAddress">Address</Label>
                        <Textarea
                          id="propertyAddress"
                          value={editForm.propertyAddress || ""}
                          onChange={(e) => setEditForm({ ...editForm, propertyAddress: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="propertyPostcode">Postcode</Label>
                        <div className="flex gap-2">
                          <Input
                            id="propertyPostcode"
                            value={editForm.propertyPostcode || ""}
                            onChange={(e) => setEditForm({ ...editForm, propertyPostcode: e.target.value })}
                            placeholder="e.g. SA5 7AB"
                          />
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 px-3"
                                  onClick={handleFixPostcode}
                                  disabled={isFixingPostcode || !editForm.propertyAddress}
                                >
                                  {isFixingPostcode ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Search className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                {editForm.propertyAddress
                                  ? "Look up postcode from address using Land Registry data"
                                  : "Add a property address first"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="propertyType">Type</Label>
                        <Input
                          id="propertyType"
                          value={editForm.propertyType || ""}
                          onChange={(e) => setEditForm({ ...editForm, propertyType: e.target.value })}
                          placeholder="e.g., terraced, semi-detached"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="bedrooms">Bedrooms</Label>
                          <Input
                            id="bedrooms"
                            type="number"
                            value={editForm.bedrooms || ""}
                            onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="bathrooms">Bathrooms</Label>
                          <Input
                            id="bathrooms"
                            type="number"
                            value={editForm.bathrooms || ""}
                            onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="squareFeet">Square Footage</Label>
                        <Input
                          id="squareFeet"
                          type="number"
                          value={editForm.squareFeet || ""}
                          onChange={(e) => setEditForm({ ...editForm, squareFeet: e.target.value })}
                          placeholder="Total sq ft"
                        />
                      </div>
                      <div>
                        <Label htmlFor="askingPrice">Asking Price (£)</Label>
                        <Input
                          id="askingPrice"
                          type="number"
                          value={editForm.askingPrice || ""}
                          onChange={(e) => setEditForm({ ...editForm, askingPrice: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="estimatedMonthlyRent">Monthly Rent (£)</Label>
                          <Input
                            id="estimatedMonthlyRent"
                            type="number"
                            value={editForm.estimatedMonthlyRent || ""}
                            onChange={(e) => {
                              const monthly = e.target.value
                              setEditForm({
                                ...editForm,
                                estimatedMonthlyRent: monthly,
                                estimatedAnnualRent: monthly ? String(Number(monthly) * 12) : ""
                              })
                            }}
                            placeholder="Est. monthly rent"
                          />
                        </div>
                        <div>
                          <Label htmlFor="estimatedAnnualRent">Annual Rent (£)</Label>
                          <Input
                            id="estimatedAnnualRent"
                            type="number"
                            value={editForm.estimatedAnnualRent || ""}
                            onChange={(e) => setEditForm({ ...editForm, estimatedAnnualRent: e.target.value })}
                            placeholder="Auto-calculated"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="condition">Property Condition</Label>
                        <Select
                          value={editForm.condition || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, condition: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="needs_work">Needs Work</SelectItem>
                            <SelectItem value="needs_modernisation">Needs Modernisation</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      {(currentLead.propertyAddress || currentLead.propertyPostcode) && (
                        <div className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                            <span className="font-medium text-sm leading-snug flex-1">
                              {cleanPropertyAddress(currentLead.propertyAddress, currentLead.propertyPostcode)}
                            </span>
                          </div>
                          {/* Show resolve button when postcode is missing or outcode-only */}
                          {currentLead.propertyAddress && !/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}\b/i.test(currentLead.propertyPostcode ?? "") && (
                            <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span className="text-xs text-amber-700 flex-1">
                                {currentLead.propertyPostcode ? `"${currentLead.propertyPostcode}" is not a full postcode` : "No postcode set"}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                                onClick={handleFixPostcode}
                                disabled={isFixingPostcode}
                              >
                                {isFixingPostcode ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Search className="h-3 w-3 mr-1" />
                                )}
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Spec chips */}
                      {(currentLead.propertyType || currentLead.bedrooms != null || currentLead.bathrooms != null || currentLead.squareFeet || currentLead.condition) && (
                        <div className="flex flex-wrap gap-1.5">
                          {currentLead.propertyType && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                              <Building2 className="h-3 w-3" />
                              {currentLead.propertyType}
                            </span>
                          )}
                          {currentLead.bedrooms != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              <BedDouble className="h-3 w-3" />
                              {currentLead.bedrooms} bed
                            </span>
                          )}
                          {currentLead.bathrooms != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              <Bath className="h-3 w-3" />
                              {currentLead.bathrooms} bath
                            </span>
                          )}
                          {currentLead.squareFeet && (
                            <span suppressHydrationWarning className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              {currentLead.squareFeet.toLocaleString()} sq ft
                            </span>
                          )}
                          {currentLead.condition && (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize",
                              currentLead.condition === "excellent" || currentLead.condition === "good"
                                ? "bg-green-100 text-green-800"
                                : currentLead.condition === "needs_work" || currentLead.condition === "needs_modernisation"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            )}>
                              {currentLead.condition.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Asking price highlight */}
                      {currentLead.askingPrice && (
                        <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <PoundSterling className="h-4 w-4 text-green-700" />
                            <span className="text-xs font-medium text-green-700">Asking Price</span>
                          </div>
                          <span className="font-bold text-green-800">{formatCurrency(currentLead.askingPrice)}</span>
                        </div>
                      )}
                      {/* Rental estimate */}
                      {currentLead.estimatedMonthlyRent && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-xs text-gray-400">Rental estimate</span>
                          <span className="font-medium text-sm">
                            {formatCurrency(currentLead.estimatedMonthlyRent)}/mo
                            {currentLead.askingPrice && currentLead.estimatedAnnualRent && (
                              <span className="text-xs text-green-600 font-normal ml-1.5">
                                ({((Number(currentLead.estimatedAnnualRent) / Number(currentLead.askingPrice)) * 100).toFixed(1)}% yield)
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 2: Seller Intel + Activity ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Seller Intelligence */}
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#2563EB]" />
                    Seller Intelligence
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="motivationScore">Motivation Score (1-10)</Label>
                        <Input
                          id="motivationScore"
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.motivationScore || ""}
                          onChange={(e) => setEditForm({ ...editForm, motivationScore: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="urgencyLevel">Urgency Level</Label>
                        <Select
                          value={editForm.urgencyLevel || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, urgencyLevel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="quick">Quick</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="timelineDays">Timeline (days)</Label>
                        <Input
                          id="timelineDays"
                          type="number"
                          value={editForm.timelineDays || ""}
                          onChange={(e) => setEditForm({ ...editForm, timelineDays: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="reasonForSelling">Reason for Selling</Label>
                        <Select
                          value={editForm.reasonForSelling || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, reasonForSelling: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relocation">Relocation</SelectItem>
                            <SelectItem value="financial">Financial</SelectItem>
                            <SelectItem value="divorce">Divorce</SelectItem>
                            <SelectItem value="inheritance">Inheritance</SelectItem>
                            <SelectItem value="downsize">Downsize</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="competingOffers"
                          checked={editForm.competingOffers || false}
                          onChange={(e) => setEditForm({ ...editForm, competingOffers: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="competingOffers" className="cursor-pointer">
                          Has Competing Offers
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      {currentLead.motivationScore !== null && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-400">Motivation</span>
                            <Badge className={motivationBadgeColor(currentLead.motivationScore)}>
                              {currentLead.motivationScore}/10
                            </Badge>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                currentLead.motivationScore >= 8 ? "bg-green-500"
                                  : currentLead.motivationScore >= 5 ? "bg-yellow-500"
                                  : "bg-red-500"
                              )}
                              style={{ width: `${(currentLead.motivationScore / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {currentLead.urgencyLevel && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full cursor-default",
                                  currentLead.urgencyLevel === "urgent" ? "bg-red-100 text-red-800"
                                    : currentLead.urgencyLevel === "quick" ? "bg-orange-100 text-orange-800"
                                    : currentLead.urgencyLevel === "moderate" ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-400"
                                )}>
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {currentLead.urgencyLevel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">Urgency level</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {currentLead.timelineDays && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                            <Clock className="h-2.5 w-2.5" />
                            {currentLead.timelineDays}d timeline
                          </span>
                        )}
                        {currentLead.reasonForSelling && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full capitalize">
                            {currentLead.reasonForSelling.replace(/_/g, " ")}
                          </span>
                        )}
                        {currentLead.competingOffers && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            ⚠ Competing offers
                          </span>
                        )}
                      </div>
                      {currentLead.motivationScore === null && !currentLead.urgencyLevel && !currentLead.reasonForSelling && (
                        <p className="text-xs text-gray-400 italic">No seller intelligence gathered yet</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Activity */}
              <div className="ds-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#2563EB]" />
                    Activity
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {isEditing ? (
                    <div>
                      <Label htmlFor="pipelineStage">Stage</Label>
                      <Select
                        value={editForm.pipelineStage || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, pipelineStage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                          <SelectItem value="INITIAL_CONTACT">Initial Contact</SelectItem>
                          <SelectItem value="AI_CONVERSATION">AI Conversation</SelectItem>
                          <SelectItem value="DEAL_VALIDATION">Deal Validation</SelectItem>
                          <SelectItem value="VALUATION_PENDING">Valuation Pending</SelectItem>
                          <SelectItem value="VALUATION_COMPLETE">Valuation Complete</SelectItem>
                          <SelectItem value="OFFER_PREPARATION">Offer Preparation</SelectItem>
                          <SelectItem value="OFFER_SENT">Offer Sent</SelectItem>
                          <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                          <SelectItem value="OFFER_ACCEPTED">Offer Accepted</SelectItem>
                          <SelectItem value="SOLICITOR_INSTRUCTED">Solicitor Instructed</SelectItem>
                          <SelectItem value="LOCKOUT_SIGNED">Lockout Signed</SelectItem>
                          <SelectItem value="COMPLETION_PENDING">Completion Pending</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400">Stage</span>
                        <Badge className="text-xs">{currentLead.pipelineStage.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">Last contact</span>
                        </div>
                        <span suppressHydrationWarning className="text-xs font-medium">{formatTimeAgo(currentLead.lastContactAt)}</span>
                      </div>
                      {currentLead.conversationStartedAt && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="text-xs">Conv. started</span>
                          </div>
                          <span className="text-xs">{formatDate(currentLead.conversationStartedAt)}</span>
                        </div>
                      )}
                      {currentLead.retryCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Follow-up attempts</span>
                          <Badge variant="outline" className="text-xs">{currentLead.retryCount}</Badge>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Solicitor ────────────────────────────────────────────────────────── */}
            <div className="ds-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                  Solicitor
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Conveyancing solicitor for this deal. Assign from the shared registry or add a new one.
                </p>
              </div>
              <div className="p-5">
                <SolicitorSelector
                  value={currentLead.solicitorId ?? null}
                  initialSolicitor={currentLead.solicitor ?? null}
                  onChange={async (id, sol) => {
                    try {
                      const res = await fetch(`/api/vendor-pipeline/leads/${currentLead.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ solicitorId: id }),
                      })
                      if (!res.ok) throw new Error("Failed to update")
                      setFullLead((prev) =>
                        prev ? { ...prev, solicitorId: id, solicitor: sol } : prev
                      )
                      toast.success(id ? "Solicitor assigned to deal" : "Solicitor removed from deal")
                    } catch {
                      toast.error("Failed to update solicitor")
                    }
                  }}
                />
              </div>
            </div>

            {/* ── Investor Reservation ─────────────────────────────────────────────── */}
            {(() => {
              const statusLabel: Record<string, string> = {
                pending: "Pending", pack_sent: "Pack Sent", fee_pending: "Fee Requested",
                fee_paid: "Fee Paid", proof_of_funds_pending: "POF Requested",
                pof_received: "POF Received", verified: "POF Verified",
                lock_out_sent: "Lock-out Sent", locked_out: "Lock-out Signed",
                completed: "Completed", cancelled: "Cancelled",
              }
              const statusColor: Record<string, string> = {
                pending: "bg-gray-100 text-gray-700 border-gray-200",
                pack_sent: "bg-blue-100 text-blue-700 border-blue-200",
                fee_pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
                fee_paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
                proof_of_funds_pending: "bg-orange-100 text-orange-700 border-orange-200",
                pof_received: "bg-sky-100 text-sky-700 border-sky-200",
                verified: "bg-green-100 text-green-700 border-green-200",
                lock_out_sent: "bg-purple-100 text-purple-700 border-purple-200",
                locked_out: "bg-violet-100 text-violet-700 border-violet-200",
                completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
              }
              const res = currentLead.reservation
              return (
                <div className="ds-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-[#2563EB]" />
                        Investor Reservation
                      </h3>
                      {res && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs border", statusColor[res.status] || "")}>
                            {statusLabel[res.status] || res.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-red-500 hover:text-red-500 hover:bg-red-50"
                            onClick={handleRemoveReservation}
                            disabled={isRemovingReservation}
                          >
                            {isRemovingReservation
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <X className="h-3 w-3 mr-0.5" />
                            }
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    {res ? (() => {
                      const inv = res.investor
                      const investorName = [inv.user.firstName, inv.user.lastName].filter(Boolean).join(" ") || inv.user.email
                      const steps = [
                        "pending", "pack_sent", "fee_pending", "fee_paid",
                        "proof_of_funds_pending", "pof_received", "verified",
                        "lock_out_sent", "locked_out", "completed",
                      ]
                      const currentStep = steps.indexOf(res.status)
                      return (
                        <div className="space-y-3">
                          <div className="flex gap-0.5">
                            {steps.map((step, i) => (
                              <div
                                key={step}
                                className={cn(
                                  "h-1.5 flex-1 rounded-full transition-colors",
                                  i < currentStep ? "bg-violet-500" : i === currentStep ? "bg-violet-400" : "bg-gray-100"
                                )}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Pending</span>
                            <span>Step {Math.max(currentStep + 1, 1)} / {steps.length}</span>
                            <span>Completed</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 pt-1 text-sm border-t">
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Investor</p>
                              <p className="font-medium text-xs truncate">{investorName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Contact</p>
                              <a href={`mailto:${inv.user.email}`} className="text-blue-600 hover:underline text-xs truncate block">{inv.user.email}</a>
                              {inv.user.phone && (
                                <a href={`tel:${inv.user.phone}`} className="text-blue-600 hover:underline text-xs">{inv.user.phone}</a>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Reservation Fee</p>
                              <p className="font-semibold text-emerald-700">£{res.reservationFee.toLocaleString()}</p>
                              <p suppressHydrationWarning className="text-[10px] text-gray-400 mt-0.5">
                                {currentLead.reservedAt ? formatDate(currentLead.reservedAt) : formatDate(res.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })() : (
                      <div className="flex items-center gap-2 text-gray-400 py-1">
                        <KeyRound className="h-4 w-4 shrink-0" />
                        <p className="text-xs">No investor reservation — will appear once an investor reserves the linked deal.</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Conversation ─────────────────────────────────────────────────────── */}
            <div className="ds-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#2563EB]" />
                    Conversation
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {currentLead.smsMessages.length} message{currentLead.smsMessages.length !== 1 ? "s" : ""}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setShowConversation((v) => !v)}
                      className="text-xs text-gray-400 hover:text-gray-900 underline underline-offset-2 transition-colors"
                    >
                      {showConversation ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>
              {showConversation && (
                <div className="p-5">
                  <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-gray-50 rounded-lg mb-4">
                    {currentLead.smsMessages.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm">No messages yet</p>
                    ) : (
                      currentLead.smsMessages.map((message: any) => {
                        const isOutbound = message.direction === "outbound"
                        return (
                          <div key={message.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[75%] rounded-lg px-3 py-2",
                              isOutbound ? "bg-blue-500 text-white" : "bg-white border"
                            )}>
                              <p className="text-sm whitespace-pre-wrap">{message.messageBody}</p>
                              <p
                                suppressHydrationWarning
                                className={cn("text-xs mt-1", isOutbound ? "text-blue-100" : "text-gray-400")}
                              >
                                {formatTimeAgo(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Send a manual message to the vendor..."
                      value={manualMessage}
                      onChange={(e) => setManualMessage(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleSendManualMessage}
                      disabled={!manualMessage.trim() || sendingMessage}
                      className="w-full"
                    >
                      {sendingMessage ? "Sending..." : "Send Message"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>


          {/* ── Activity Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="activity" className="space-y-4">
            {(() => {
              const STAGE_LABELS: Record<string, string> = {
                NEW_LEAD: "New Lead",
                AI_CONVERSATION: "AI Conversation",
                DEAL_VALIDATION: "Deal Validation",
                OFFER_MADE: "Email Offer Sent",
                VIDEO_SENT: "Video Sent",
                RETRY_1: "Follow-up 1",
                RETRY_2: "Follow-up 2",
                RETRY_3: "Follow-up 3",
                OFFER_ACCEPTED: "Offer Accepted",
                OFFER_REJECTED: "Offer Rejected",
                PAPERWORK_SENT: "Paperwork Sent",
                READY_FOR_INVESTORS: "Ready for Investors",
                DEAD_LEAD: "Dead Lead",
                INITIAL_CONTACT: "Initial Contact",
                VALUATION_PENDING: "Valuation Pending",
              }

              const eventLabel = (ev: PipelineEvent): { title: string; detail?: string; color: string } => {
                const d = ev.details || {}
                switch (ev.eventType) {
                  case "stage_transition": {
                    const from = STAGE_LABELS[d.fromStage] ?? d.fromStage ?? "—"
                    const to = STAGE_LABELS[d.toStage] ?? d.toStage ?? "—"
                    const isPositive = ["OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"].includes(d.toStage)
                    const isNegative = ["OFFER_REJECTED", "DEAD_LEAD"].includes(d.toStage)
                    return {
                      title: `Stage changed to ${to}`,
                      detail: `From: ${from}`,
                      color: isPositive ? "bg-green-500" : isNegative ? "bg-red-500" : "bg-blue-500",
                    }
                  }
                  case "vendor_offer_sent": {
                    const channel = (d.channel as string ?? "").toUpperCase()
                    const price = d.offerPrice ? ` — £${Number(d.offerPrice).toLocaleString()}` : ""
                    const success = d.emailSuccess || d.smsSuccess
                    return {
                      title: `Offer sent via ${channel}${price}`,
                      detail: success === false ? "Delivery failed" : d.noSmtp ? "SMTP not configured" : "Delivered",
                      color: success === false ? "bg-red-400" : "bg-yellow-500",
                    }
                  }
                  case "offer_accepted":
                    return { title: "Offer Accepted", detail: "Vendor accepted the offer", color: "bg-green-600" }
                  case "offer_rejected":
                    return { title: "Offer Rejected", detail: d.rejectionReason || undefined, color: "bg-red-500" }
                  case "deal_validated":
                    return { title: "Deal Validated", detail: d.description as string | undefined, color: "bg-green-500" }
                  case "deal_rejected":
                    return { title: "Deal Failed Validation", detail: d.description as string | undefined, color: "bg-orange-500" }
                  default:
                    return {
                      title: ev.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                      color: "bg-slate-400",
                    }
                }
              }

              const events = currentLead.pipelineEvents ?? []

              return (
                <div className="ds-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--ds-border)]">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#2563EB]" />
                      Pipeline Activity
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {events.length} event{events.length !== 1 ? "s" : ""} recorded
                    </p>
                  </div>
                  <div className="p-5">
                    {events.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No activity recorded yet</p>
                    ) : (
                      <ol className="relative border-l border-[var(--ds-border)] ml-3 space-y-5">
                        {events.map((ev: PipelineEvent) => {
                          const { title, detail, color } = eventLabel(ev)
                          return (
                            <li key={ev.id} className="ml-5">
                              <span className={cn(
                                "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                                color
                              )} />
                              <p className="text-sm font-medium leading-tight">{title}</p>
                              {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
                              <time suppressHydrationWarning className="text-xs text-gray-400/70 mt-0.5 block">
                                {formatDate(ev.createdAt)}
                              </time>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="comparables" className="space-y-4 w-full min-w-0 overflow-hidden">
            <VendorComparablesTab
              vendorLeadId={lead.id}
              askingPrice={typeof currentLead.askingPrice === 'number' ? currentLead.askingPrice : (currentLead.askingPrice ? Number(currentLead.askingPrice) : undefined)}
              propertyPostcode={currentLead.propertyPostcode}
            />
          </TabsContent>
          <TabsContent value="portal-check" className="space-y-4">
            <PortalCheckDetailPanel
              leadId={currentLead.id}
              latestCheckRisk={currentLead.latestCheckRisk ?? null}
              latestCheckedAt={
                currentLead.latestCheckedAt
                  ? new Date(currentLead.latestCheckedAt).toISOString()
                  : null
              }
              onRiskUpdated={() => onUpdate?.()}
            />
          </TabsContent>

          <TabsContent value="ai-conversation" className="space-y-4">
            <AiConversationTab
              lead={{
                id: currentLead.id,
                vendorName: currentLead.vendorName,
                vendorPhone: currentLead.vendorPhone,
                propertyAddress: currentLead.propertyAddress,
                pipelineStage: currentLead.pipelineStage,
                motivationScore: currentLead.motivationScore,
                urgencyLevel: currentLead.urgencyLevel,
                reasonForSelling: currentLead.reasonForSelling,
                timelineDays: currentLead.timelineDays,
                competingOffers: currentLead.competingOffers,
                condition: currentLead.condition,
                askingPrice: currentLead.askingPrice,
                conversationState: currentLead.conversationState,
                conversationStartedAt: currentLead.conversationStartedAt,
                lastContactAt: currentLead.lastContactAt,
                smsMessages: currentLead.smsMessages,
              }}
              onUpdate={onUpdate}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmDialog.open}
      onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      title={confirmDialog.title}
      description={confirmDialog.description}
      variant={confirmDialog.variant}
      confirmLabel={confirmDialog.confirmLabel}
      onConfirm={confirmDialog.onConfirm}
    />
  </>
  )
}


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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "lucide-react"
import { PipelineStage } from "@prisma/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import { formatCurrency } from "@/lib/format"

interface SMSMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: Date
  messageSid?: string | null
  status?: string | null
}

interface VendorLead {
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
  smsMessages: SMSMessage[]
}

interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
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
}: VendorLeadDetailModalProps) {
  const [manualMessage, setManualMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [fullLead, setFullLead] = useState<VendorLead | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRemovingReservation, setIsRemovingReservation] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
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

  const handleDelete = async () => {
    if (!confirm(`Delete ${currentLead.vendorName}? This cannot be undone.`)) {
      return
    }

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
  }

  const handleRemoveReservation = async () => {
    if (!currentLead.reservation) return
    if (!confirm("Remove this investor reservation? This cannot be undone.")) return
    setIsRemovingReservation(true)
    try {
      const res = await fetch(`/api/reservations/${currentLead.reservation.id}`, {
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
              <div className="flex items-center gap-2">
                <Badge className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border-0">
                  {currentLead.pipelineStage.replace(/_/g, " ")}
                </Badge>
                {currentLead.dealId ? (
                  <Badge className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                    Deal Created
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5">
                {!isEditing ? (
                  <>
                    {/* Template selector + Pack button — grouped */}
                    <div className="flex items-center rounded-md border bg-background overflow-hidden">
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
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-900 dark:hover:bg-red-950/30"
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
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{cleanPropertyAddress(currentLead.propertyAddress, currentLead.propertyPostcode)}</span>
            </DialogTitle>

            {/* ── Row 3: meta chips ────────────────────────────────────────────── */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {currentLead.vendorName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800 rounded-md px-2 py-0.5">
                  <User className="h-3 w-3" />
                  {currentLead.vendorName}
                </span>
              )}
              {currentLead.vendorPhone && (
                <a
                  href={`tel:${currentLead.vendorPhone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800 rounded-md px-2 py-0.5 hover:bg-green-100 transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  {currentLead.vendorPhone}
                </a>
              )}
              {currentLead.askingPrice && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-50 text-green-800 border border-green-300 dark:bg-green-950/20 dark:text-green-300 dark:border-green-700 rounded-md px-2 py-0.5">
                  <PoundSterling className="h-3 w-3" />
                  {formatCurrency(currentLead.askingPrice)}
                </span>
              )}
              {currentLead.bmvScore !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5 border",
                  Number(currentLead.bmvScore) >= 15
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300"
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
          <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-0.5 bg-muted/60">
            <TabsTrigger
              value="details"
              className="relative flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-background hover:text-primary hover:shadow-sm
                data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <User className="h-3.5 w-3.5" />
              <span>Contact Info</span>
              {currentLead.reservation && (
                <span className="absolute top-1.5 right-2 inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="validation"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-background hover:text-primary hover:shadow-sm
                data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Validation</span>
            </TabsTrigger>
            <TabsTrigger
              value="comparables"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-background hover:text-primary hover:shadow-sm
                data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Comparables</span>
            </TabsTrigger>
            <TabsTrigger
              value="offer"
              className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
                hover:bg-background hover:text-primary hover:shadow-sm
                data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Offer Analysis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* ── Row 1: Contact + Property ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Contact */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Vendor Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                      <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm">{currentLead.vendorName}</span>
                      </div>
                      <a
                        href={`tel:${currentLead.vendorPhone}`}
                        className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 px-3 py-2 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                      >
                        <Phone className="h-4 w-4 text-green-700 dark:text-green-400 shrink-0" />
                        <span className="font-medium text-sm text-green-800 dark:text-green-300">{currentLead.vendorPhone}</span>
                      </a>
                      {currentLead.vendorEmail && (
                        <a
                          href={`mailto:${currentLead.vendorEmail}`}
                          className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          <Mail className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
                          <span className="font-medium text-sm text-blue-800 dark:text-blue-300 truncate">{currentLead.vendorEmail}</span>
                        </a>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Property */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                        <div className="rounded-lg bg-muted/60 px-3 py-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full capitalize">
                              <Building2 className="h-3 w-3" />
                              {currentLead.propertyType}
                            </span>
                          )}
                          {currentLead.bedrooms != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full">
                              <BedDouble className="h-3 w-3" />
                              {currentLead.bedrooms} bed
                            </span>
                          )}
                          {currentLead.bathrooms != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full">
                              <Bath className="h-3 w-3" />
                              {currentLead.bathrooms} bath
                            </span>
                          )}
                          {currentLead.squareFeet && (
                            <span suppressHydrationWarning className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full">
                              {currentLead.squareFeet.toLocaleString()} sq ft
                            </span>
                          )}
                          {currentLead.condition && (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize",
                              currentLead.condition === "excellent" || currentLead.condition === "good"
                                ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"
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
                        <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <PoundSterling className="h-4 w-4 text-green-700 dark:text-green-400" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">Asking Price</span>
                          </div>
                          <span className="font-bold text-green-800 dark:text-green-300">{formatCurrency(currentLead.askingPrice)}</span>
                        </div>
                      )}
                      {/* Rental estimate */}
                      {currentLead.estimatedMonthlyRent && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-xs text-muted-foreground">Rental estimate</span>
                          <span className="font-medium text-sm">
                            {formatCurrency(currentLead.estimatedMonthlyRent)}/mo
                            {currentLead.askingPrice && currentLead.estimatedAnnualRent && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-normal ml-1.5">
                                ({((Number(currentLead.estimatedAnnualRent) / Number(currentLead.askingPrice)) * 100).toFixed(1)}% yield)
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Row 2: Seller Intel + Activity ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Seller Intelligence */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Seller Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                            <span className="text-xs font-medium text-muted-foreground">Motivation</span>
                            <Badge className={motivationBadgeColor(currentLead.motivationScore)}>
                              {currentLead.motivationScore}/10
                            </Badge>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
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
                                  currentLead.urgencyLevel === "urgent" ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                                    : currentLead.urgencyLevel === "quick" ? "bg-orange-100 text-orange-800"
                                    : currentLead.urgencyLevel === "moderate" ? "bg-yellow-100 text-yellow-800"
                                    : "bg-muted text-muted-foreground"
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            <Clock className="h-2.5 w-2.5" />
                            {currentLead.timelineDays}d timeline
                          </span>
                        )}
                        {currentLead.reasonForSelling && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
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
                        <p className="text-xs text-muted-foreground italic">No seller intelligence gathered yet</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                        <span className="text-xs font-medium text-muted-foreground">Stage</span>
                        <Badge className="text-xs">{currentLead.pipelineStage.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">Last contact</span>
                        </div>
                        <span suppressHydrationWarning className="text-xs font-medium">{formatTimeAgo(currentLead.lastContactAt)}</span>
                      </div>
                      {currentLead.conversationStartedAt && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="text-xs">Conv. started</span>
                          </div>
                          <span className="text-xs">{formatDate(currentLead.conversationStartedAt)}</span>
                        </div>
                      )}
                      {currentLead.retryCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Follow-up attempts</span>
                          <Badge variant="outline" className="text-xs">{currentLead.retryCount}</Badge>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
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
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        Investor Reservation
                      </CardTitle>
                      {res && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs border", statusColor[res.status] || "")}>
                            {statusLabel[res.status] || res.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
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
                  </CardHeader>
                  <CardContent>
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
                                  i < currentStep ? "bg-violet-500" : i === currentStep ? "bg-violet-400" : "bg-muted"
                                )}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Pending</span>
                            <span>Step {Math.max(currentStep + 1, 1)} / {steps.length}</span>
                            <span>Completed</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 pt-1 text-sm border-t">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Investor</p>
                              <p className="font-medium text-xs truncate">{investorName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Contact</p>
                              <a href={`mailto:${inv.user.email}`} className="text-blue-600 hover:underline text-xs truncate block">{inv.user.email}</a>
                              {inv.user.phone && (
                                <a href={`tel:${inv.user.phone}`} className="text-blue-600 hover:underline text-xs">{inv.user.phone}</a>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Reservation Fee</p>
                              <p className="font-semibold text-emerald-700">£{res.reservationFee.toLocaleString()}</p>
                              <p suppressHydrationWarning className="text-[10px] text-muted-foreground mt-0.5">
                                {currentLead.reservedAt ? formatDate(currentLead.reservedAt) : formatDate(res.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })() : (
                      <div className="flex items-center gap-2 text-muted-foreground py-1">
                        <KeyRound className="h-4 w-4 shrink-0" />
                        <p className="text-xs">No investor reservation — will appear once an investor reserves the linked deal.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}

            {/* ── Conversation ─────────────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Conversation
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {currentLead.smsMessages.length} message{currentLead.smsMessages.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-muted/30 rounded-lg mb-4">
                  {currentLead.smsMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">No messages yet</p>
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
                              className={cn("text-xs mt-1", isOutbound ? "text-blue-100" : "text-muted-foreground")}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            {/* ── Header card: title + Calculate BMV action ────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>BMV Analysis Results</CardTitle>
                    <CardDescription>
                      {currentLead.validatedAt ? `Validated on ${formatDate(currentLead.validatedAt)}` : "Not yet validated"}
                    </CardDescription>
                    {landRegistryUsed && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border gap-1 font-medium">
                          <Building2 className="h-3 w-3" />
                          Land Registry Used
                        </Badge>
                        {landRegistryOwnership && (
                          <span className="text-xs text-muted-foreground">
                            Owner: {landRegistryOwnership.companyName}
                            {landRegistryOwnership.isCorporateOwned && " · Corporate"}
                            {landRegistryOwnership.isOverseasOwned && " · Overseas"}
                            {landRegistryOwnership.isPortfolioOwner && " · Portfolio"}
                          </span>
                        )}
                      </div>
                    )}
                    {landRegistryCheckedNoMatch && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-muted-foreground gap-1 font-normal">
                          <Building2 className="h-3 w-3" />
                          No Land Registry Match
                        </Badge>
                      </div>
                    )}
                    {isOutcodeOnly && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 border gap-1 font-medium">
                          ⚠️ Incomplete Postcode: {currentLead.propertyPostcode ?? "none"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Edit and add full postcode for accurate BMV
                        </span>
                      </div>
                    )}
                    {postcodeWasCorrected && postcodeUsed && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 border gap-1 font-medium">
                          ℹ️ Postcode corrected → {postcodeUsed}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Auto-resolved via {postcodeResolutionSource} (was: {currentLead.propertyPostcode})
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleCalculateBMV}
                    disabled={isCalculating || !currentLead.askingPrice}
                    size="sm"
                    variant="outline"
                  >
                    {isCalculating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    )}
                    {isCalculating ? "Calculating..." : "Calculate BMV"}
                  </Button>
                </div>
              </CardHeader>
              {isEditing && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="estimatedMarketValue">Estimated Market Value (£)</Label>
                      <Input
                        id="estimatedMarketValue"
                        type="number"
                        value={editForm.estimatedMarketValue || ""}
                        onChange={(e) => setEditForm({ ...editForm, estimatedMarketValue: e.target.value })}
                        placeholder="Auto-estimated if blank"
                      />
                    </div>
                    <div>
                      <Label htmlFor="estimatedRefurbCost">Estimated Refurb Cost (£)</Label>
                      <Input
                        id="estimatedRefurbCost"
                        type="number"
                        value={editForm.estimatedRefurbCost || ""}
                        onChange={(e) => setEditForm({ ...editForm, estimatedRefurbCost: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-400 p-4 rounded-lg text-sm text-amber-900">
                    <p className="font-bold mb-1">⚠️ Important: After Saving Edits</p>
                    <p className="mb-2">
                      If you change asking price, market value, condition, motivation, or refurb costs, you must click <strong>&quot;Calculate BMV&quot;</strong> to recalculate the deal metrics.
                    </p>
                    <p className="text-xs">
                      BMV calculations are not automatic to give you full control over when they&apos;re performed.
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-700">
                    <p className="font-medium mb-1">How BMV Calculation Works</p>
                    <ul className="list-disc list-inside space-y-1 text-xs mt-2">
                      <li><strong>Market Value:</strong> Estimated from asking price if not provided</li>
                      <li><strong>BMV %:</strong> (Market Value − Asking Price) / Market Value × 100</li>
                      <li><strong>Offer Amount:</strong> 70–85% of market value (adjusted by motivation, condition, urgency)</li>
                      <li><strong>Profit:</strong> Market Value − Offer Amount − Refurb Cost</li>
                    </ul>
                    <p className="mt-2 font-medium">To pass validation: BMV ≥ 15% AND Profit ≥ £10,000</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ── Empty state: missing asking price ────────────────────────────── */}
            {!isEditing && !currentLead.askingPrice && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border-2 border-dashed border-muted text-center">
                <PoundSterling className="h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">Missing Asking Price</p>
                <p className="text-sm text-muted-foreground max-w-xs">Add an asking price in the Details tab before calculating BMV.</p>
              </div>
            )}

            {/* ── Empty state: not yet calculated ──────────────────────────────── */}
            {!isEditing && currentLead.askingPrice !== null && currentLead.bmvScore === null && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border-2 border-dashed border-muted text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">BMV Not Yet Calculated</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Click &quot;Calculate BMV&quot; above to analyse this deal and get offer recommendations.
                </p>
              </div>
            )}

            {/* ── Full results (only when calculated and not editing) ───────────── */}
            {!isEditing && currentLead.bmvScore !== null && (
              <>
                {/* Stale data notice */}
                {currentLead.validatedAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    Last calculated {formatDate(currentLead.validatedAt)} — recalculate if you&apos;ve changed property details.
                  </p>
                )}

                {/* ── Status Banner ─────────────────────────────────────────────── */}
                <div className={cn(
                  "rounded-xl p-5 border-2",
                  currentLead.validationPassed
                    ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                    : "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {currentLead.validationPassed ? (
                        <CheckCircle2 className="h-9 w-9 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-9 w-9 text-red-600 shrink-0" />
                      )}
                      <div>
                        <p className={cn("text-xl font-bold", currentLead.validationPassed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                          {currentLead.validationPassed ? "Validation Passed" : "Validation Failed"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentLead.validationPassed
                            ? "This deal meets minimum investment criteria"
                            : "This deal does not meet minimum investment criteria"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">BMV</p>
                        <p className={cn("text-2xl font-bold", Number(currentLead.bmvScore) >= 15 ? "text-green-600" : "text-red-600")}>
                          {Number(currentLead.bmvScore).toFixed(1)}%
                        </p>
                      </div>
                      {currentLead.offerAmount !== null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Our Offer</p>
                          <p className="text-2xl font-bold">{formatCurrency(currentLead.offerAmount)}</p>
                        </div>
                      )}
                      {currentLead.profitPotential !== null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Net Profit</p>
                          <p className={cn("text-2xl font-bold", Number(currentLead.profitPotential) >= 10000 ? "text-green-600" : "text-amber-600")}>
                            {formatCurrency(currentLead.profitPotential)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Key Metrics Row ────────────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-4">
                  {currentLead.estimatedMarketValue !== null && (
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Market Value</p>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(currentLead.estimatedMarketValue)}</p>
                        {parsedNotes?.marketValueSource?.count && (
                          <p className="text-xs text-muted-foreground mt-1.5">{parsedNotes.marketValueSource.count} comparable sales</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {currentLead.askingPrice !== null && (
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asking Price</p>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(currentLead.askingPrice)}</p>
                        {currentLead.estimatedMarketValue !== null && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            £{(currentLead.estimatedMarketValue - currentLead.askingPrice).toLocaleString()} below market
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  <Card className={cn("border", Number(currentLead.bmvScore) >= 15 ? "border-green-300" : "border-red-300")}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">BMV Discount</p>
                      </div>
                      <p className={cn("text-2xl font-bold", Number(currentLead.bmvScore) >= 15 ? "text-green-600" : "text-red-600")}>
                        {Number(currentLead.bmvScore).toFixed(1)}%
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        {Number(currentLead.bmvScore) >= 15 ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {Number(currentLead.bmvScore) >= 15
                            ? "Meets 15% threshold"
                            : `${(15 - Number(currentLead.bmvScore)).toFixed(1)}% below threshold`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Offer + Profit Cards ───────────────────────────────────────── */}
                {currentLead.offerAmount !== null && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-muted-foreground" />
                          Offer Calculation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Market Value</span>
                          <span className="font-medium">{formatCurrency(currentLead.estimatedMarketValue)}</span>
                        </div>
                        {currentLead.offerPercentage !== null && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              Offer at {Number(currentLead.offerPercentage).toFixed(1)}% of MV
                            </span>
                            <span className="font-medium text-blue-600">{formatCurrency(currentLead.offerAmount)}</span>
                          </div>
                        )}
                        {currentLead.estimatedRefurbCost !== null && currentLead.estimatedRefurbCost > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Refurb Allowance</span>
                            <span className="font-medium text-orange-600">−{formatCurrency(currentLead.estimatedRefurbCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-semibold">Recommended Offer</span>
                          <span className="font-bold">{formatCurrency(currentLead.offerAmount)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {currentLead.profitPotential !== null && (
                      <Card className={cn("border", Number(currentLead.profitPotential) >= 10000 ? "border-green-300" : "border-red-300")}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            Profit Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Market Value</span>
                            <span className="font-medium">{formatCurrency(currentLead.estimatedMarketValue)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Less: Our Offer</span>
                            <span className="font-medium text-red-600">−{formatCurrency(currentLead.offerAmount)}</span>
                          </div>
                          {currentLead.estimatedRefurbCost !== null && currentLead.estimatedRefurbCost > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Less: Refurb Cost</span>
                              <span className="font-medium text-red-600">−{formatCurrency(currentLead.estimatedRefurbCost)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-semibold">Net Profit Potential</span>
                            <div className="text-right">
                              <p className={cn("font-bold", Number(currentLead.profitPotential) >= 10000 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(currentLead.profitPotential)}
                              </p>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                {Number(currentLead.profitPotential) >= 10000 ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {Number(currentLead.profitPotential) >= 10000 ? "Meets £10k threshold" : "Below £10k threshold"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* ── Strategy Analysis ─────────────────────────────────────────── */}
                {parsedNotes?.strategyData && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          Investment Strategy Analysis
                        </span>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 border text-xs font-semibold">
                          Recommended: {parsedNotes.strategyData.strategies.find(s => s.key === parsedNotes.strategyData!.recommended)?.name ?? parsedNotes.strategyData.recommended}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        {parsedNotes.strategyData.strategies.map((s) => {
                          const isRec = s.key === parsedNotes.strategyData!.recommended
                          return (
                            <div
                              key={s.key}
                              className={cn(
                                "rounded-lg border p-3 flex flex-col gap-1.5",
                                isRec
                                  ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20"
                                  : s.viable
                                  ? "border-green-200 bg-green-50/50 dark:bg-green-950/10"
                                  : "border-muted bg-muted/30 opacity-60"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold flex items-center gap-1.5">
                                  <span>{s.emoji}</span>
                                  <span>{s.name}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  {isRec && <Badge className="text-[10px] px-1.5 py-0 bg-blue-600 text-white border-0">★ Best fit</Badge>}
                                  {s.viable
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                                </div>
                              </div>
                              <div className="space-y-0.5 text-xs text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Max offer</span>
                                  <span className={cn("font-medium", s.viable ? "text-foreground" : "")}>
                                    {formatCurrency(s.maxOffer)}
                                  </span>
                                </div>
                                {s.yield !== null && (
                                  <div className="flex justify-between">
                                    <span>Gross yield</span>
                                    <span className={cn("font-medium", s.yield >= 7 ? "text-green-600" : "text-amber-600")}>
                                      {s.yield.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span>Status</span>
                                  <span className={cn("font-medium", s.viable ? "text-green-600" : "text-red-500")}>
                                    {s.viable ? "Viable" : "Not viable"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Investment Criteria Checklist ──────────────────────────────── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      Investment Criteria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {currentLead.bmvScore !== null && (() => {
                        const pass = Number(currentLead.bmvScore) >= 15
                        return (
                          <div className={cn("flex items-center justify-between p-3 rounded-lg", pass ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                            <div className="flex items-center gap-2 min-w-0">
                              {pass ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                              <span className="text-sm font-medium">BMV ≥ 15%</span>
                              <span className="text-xs text-muted-foreground hidden sm:inline">asking price discount from market value</span>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <span className={cn("text-sm font-bold", pass ? "text-green-600" : "text-red-600")}>
                                {Number(currentLead.bmvScore).toFixed(1)}%
                              </span>
                              {!pass && (
                                <p className="text-xs text-muted-foreground">{(15 - Number(currentLead.bmvScore)).toFixed(1)}% short</p>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                      {currentLead.profitPotential !== null && (() => {
                        const pass = Number(currentLead.profitPotential) >= 10000
                        return (
                          <div className={cn("flex items-center justify-between p-3 rounded-lg", pass ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                            <div className="flex items-center gap-2 min-w-0">
                              {pass ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                              <span className="text-sm font-medium">Net Profit ≥ £10,000</span>
                              <span className="text-xs text-muted-foreground hidden sm:inline">market value minus offer and refurb</span>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <span className={cn("text-sm font-bold", pass ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(currentLead.profitPotential)}
                              </span>
                              {!pass && Number(currentLead.profitPotential) > 0 && (
                                <p className="text-xs text-muted-foreground">£{(10000 - Number(currentLead.profitPotential)).toLocaleString()} short</p>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Rental Yield Analysis ─────────────────────────────────────── */}
                {parsedNotes?.rentalYield && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          Rental Yield Analysis
                        </CardTitle>
                        {parsedNotes.rentalYield.passed !== undefined && (
                          <Badge className={cn("border text-xs", parsedNotes.rentalYield.passed
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-amber-100 text-amber-800 border-amber-300")}>
                            {parsedNotes.rentalYield.passed ? "✓ Pass" : "Unverified"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                        {parsedNotes.rentalYield.monthlyRent !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Monthly Rent</span>
                            <span className="font-medium">£{parsedNotes.rentalYield.monthlyRent.toLocaleString()}</span>
                          </div>
                        )}
                        {parsedNotes.rentalYield.annualRent !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Annual Rent</span>
                            <span className="font-medium">£{parsedNotes.rentalYield.annualRent.toLocaleString()}</span>
                          </div>
                        )}
                        {parsedNotes.rentalYield.grossYield !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Gross Yield</span>
                            <div className="text-right">
                              <span className={cn("font-bold", parsedNotes.rentalYield.grossYield >= 7 ? "text-green-600" : "text-amber-600")}>
                                {parsedNotes.rentalYield.grossYield.toFixed(2)}%
                              </span>
                              {parsedNotes.rentalYield.grossYieldLabel && (
                                <span className="text-xs text-muted-foreground ml-1.5">({parsedNotes.rentalYield.grossYieldLabel})</span>
                              )}
                            </div>
                          </div>
                        )}
                        {parsedNotes.rentalYield.netYield !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Net Yield</span>
                            <span className="font-medium">{parsedNotes.rentalYield.netYield.toFixed(2)}%</span>
                          </div>
                        )}
                        {parsedNotes.rentalYield.cashFlow !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Est. Monthly Cash Flow</span>
                            <span className={cn("font-medium", parsedNotes.rentalYield.cashFlow >= 0 ? "text-green-600" : "text-red-600")}>
                              £{parsedNotes.rentalYield.cashFlow.toLocaleString()}/mo
                            </span>
                          </div>
                        )}
                        {parsedNotes.rentalYield.dataSource !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Data Source</span>
                            <span>{parsedNotes.rentalYield.dataSource}</span>
                          </div>
                        )}
                      </div>
                      {parsedNotes.rentalYield.note && (
                        <p className="mt-3 text-xs text-muted-foreground italic border-t pt-2">
                          💡 {parsedNotes.rentalYield.note}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Market Value Source ───────────────────────────────────────── */}
                {parsedNotes?.marketValueSource && (
                  <Card className="bg-muted/30">
                    <CardContent className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 mr-1">
                          <BarChart3 className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Market Value Source</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{parsedNotes.marketValueSource.source}</Badge>
                        {parsedNotes.marketValueSource.count && (
                          <Badge variant="outline" className="text-xs">{parsedNotes.marketValueSource.count} comparable sales</Badge>
                        )}
                        {parsedNotes.marketValueSource.confidence && (
                          <Badge className={cn("text-xs border", parsedNotes.marketValueSource.confidence === "HIGH"
                            ? "bg-green-100 text-green-800 border-green-300"
                            : parsedNotes.marketValueSource.confidence === "MEDIUM"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-red-100 text-red-800 border-red-300"
                          )}>
                            {parsedNotes.marketValueSource.confidence} confidence
                          </Badge>
                        )}
                        {parsedNotes.creditsUsed !== null && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {parsedNotes.creditsUsed} API credit{parsedNotes.creditsUsed !== 1 ? "s" : ""} used
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Failure Reasons ───────────────────────────────────────────── */}
                {!currentLead.validationPassed && parsedNotes?.failureReasons && parsedNotes.failureReasons.length > 0 && (
                  <Card className="border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Why This Deal Failed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {parsedNotes.failureReasons.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="offer" className="space-y-4">
            {/* Excel Offer Engine */}
            <OfferAnalysisPanel
              dealId={currentLead.dealId}
              askingPrice={currentLead.askingPrice ?? 0}
              gdv={currentLead.estimatedMarketValue}
              estimatedRent={currentLead.estimatedMonthlyRent ?? parsedNotes?.rentalYield?.monthlyRent ?? null}
              totalRefurbishment={currentLead.estimatedRefurbCost}
              vendorLeadId={lead.id}
              vendorName={currentLead.vendorName}
              vendorEmail={currentLead.vendorEmail}
              vendorPhone={currentLead.vendorPhone}
              missingInputsHint={
                (!currentLead.estimatedMarketValue || !currentLead.estimatedRefurbCost)
                  ? "Go to the Validation tab → click Edit to set Market Value and Refurb Cost."
                  : (!currentLead.estimatedMonthlyRent && !parsedNotes?.rentalYield?.monthlyRent)
                  ? "Go to the Details tab → click Edit to set Monthly Rent."
                  : undefined
              }
            />

            {/* Offer Status Banner */}
            {currentLead.offerAcceptedAt && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-900">Offer Accepted!</p>
                    <p className="text-sm text-green-700">Accepted on {formatDate(currentLead.offerAcceptedAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {currentLead.offerRejectedAt && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div className="flex-1">
                    <p className="font-bold text-red-900">Offer Rejected</p>
                    <p className="text-sm text-red-700">Rejected on {formatDate(currentLead.offerRejectedAt)}</p>
                    {currentLead.rejectionReason && (
                      <p className="text-sm text-red-800 mt-2 italic">&quot;{currentLead.rejectionReason}&quot;</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentLead.offerAmount === null ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">No Offer Calculated Yet</p>
                    <p className="text-sm mt-2">Run &quot;Calculate BMV&quot; in the Validation tab to generate an offer</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Key Metrics Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700 mb-1">Our Offer</p>
                          <p className="text-3xl font-bold text-blue-900">{formatCurrency(currentLead.offerAmount)}</p>
                          {currentLead.offerPercentage && (
                            <Badge className="mt-2 bg-blue-600 text-white border-0">
                              {Number(currentLead.offerPercentage).toFixed(1)}% of market value
                            </Badge>
                          )}
                        </div>
                        <Wallet className="h-8 w-8 text-blue-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-700 mb-1">Asking Price</p>
                          <p className="text-3xl font-bold text-amber-900">{formatCurrency(currentLead.askingPrice)}</p>
                          {currentLead.estimatedMarketValue && currentLead.askingPrice && (
                            <Badge className="mt-2 bg-amber-600 text-white border-0">
                              {((Number(currentLead.askingPrice) / Number(currentLead.estimatedMarketValue)) * 100).toFixed(1)}% of market value
                            </Badge>
                          )}
                        </div>
                        <Home className="h-8 w-8 text-amber-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-700 mb-1">Market Value</p>
                          <p className="text-3xl font-bold text-purple-900">
                            {currentLead.estimatedMarketValue ? formatCurrency(currentLead.estimatedMarketValue) : "—"}
                          </p>
                          {currentLead.bmvScore && (
                            <Badge className="mt-2 bg-purple-600 text-white border-0">
                              {Number(currentLead.bmvScore).toFixed(1)}% BMV
                            </Badge>
                          )}
                        </div>
                        <Target className="h-8 w-8 text-purple-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Investment Returns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Investment Returns
                    </CardTitle>
                    <CardDescription>Key metrics for this deal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentLead.bmvScore && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-xs font-medium text-purple-700 mb-1">BMV %</p>
                          <p className="text-2xl font-bold text-purple-900">{Number(currentLead.bmvScore).toFixed(1)}%</p>
                        </div>
                      )}

                      {currentLead.estimatedAnnualRent && currentLead.offerAmount && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-700 mb-1">Gross Yield</p>
                          <p className="text-2xl font-bold text-green-900">
                            {((Number(currentLead.estimatedAnnualRent) / Number(currentLead.offerAmount)) * 100).toFixed(2)}%
                          </p>
                        </div>
                      )}

                      {currentLead.profitPotential && currentLead.offerAmount && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-700 mb-1">ROI</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {((Number(currentLead.profitPotential) / Number(currentLead.offerAmount)) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}

                      {currentLead.profitPotential && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-xs font-medium text-emerald-700 mb-1">Profit £</p>
                          <p className="text-2xl font-bold text-emerald-900">
                            {(Number(currentLead.profitPotential) / 1000).toFixed(0)}k
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Offer Strategy */}
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-800 flex items-center gap-2">
                      Offer Strategy
                      {landRegistryUsed && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border gap-1 font-medium text-xs">
                          <Building2 className="h-3 w-3" />
                          Land Registry
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {currentLead.offerAmount !== null && currentLead.askingPrice !== null && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-700 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(currentLead.offerAmount)} — {(((Number(currentLead.askingPrice) - Number(currentLead.offerAmount)) / Number(currentLead.askingPrice)) * 100).toFixed(1)}% below asking
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              Saving {formatCurrency(Number(currentLead.askingPrice) - Number(currentLead.offerAmount))}
                              {currentLead.offerPercentage && (
                                <> · {Number(currentLead.offerPercentage).toFixed(1)}% of MV</>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {currentLead.offerPercentage && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-700 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">Vendor motivation adjusted</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {currentLead.motivationScore && `Motivation ${currentLead.motivationScore}/10`}
                              {currentLead.urgencyLevel && ` · ${currentLead.urgencyLevel}`}
                              {currentLead.condition && ` · ${currentLead.condition.replace(/_/g, " ")}`}
                            </p>
                          </div>
                        </div>
                      )}

                      {landRegistryUsed && landRegistryOwnership && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
                          <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">Land Registry applied</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {landRegistryOwnership.companyName}
                              {landRegistryOwnership.isCorporateOwned && " · Corporate (-2%)"}
                              {landRegistryOwnership.isOverseasOwned && " · Overseas (-2%)"}
                              {landRegistryOwnership.isPortfolioOwner && " · Portfolio (-1%)"}
                            </p>
                          </div>
                        </div>
                      )}

                      {currentLead.bmvScore && Number(currentLead.bmvScore) >= 15 && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-700 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{Number(currentLead.bmvScore).toFixed(1)}% BMV ✓</p>
                            <p className="text-slate-500 text-xs mt-0.5">Exceeds 15% minimum threshold</p>
                          </div>
                        </div>
                      )}

                      {currentLead.profitPotential && Number(currentLead.profitPotential) >= 10000 && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-700 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">Profit potential ✓</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {formatCurrency(currentLead.profitPotential)} net after costs
                            </p>
                          </div>
                        </div>
                      )}

                      {currentLead.estimatedMonthlyRent && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-700 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(currentLead.estimatedMonthlyRent)}/mo rental</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {currentLead.offerAmount && currentLead.estimatedAnnualRent && (
                                <>{((Number(currentLead.estimatedAnnualRent) / Number(currentLead.offerAmount)) * 100).toFixed(2)}% gross yield</>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Info */}
                {(currentLead.offerSentAt || currentLead.retryCount > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Offer History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentLead.offerSentAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Offer Sent</span>
                          <span className="font-medium">{formatDate(currentLead.offerSentAt)}</span>
                        </div>
                      )}
                      {currentLead.retryCount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Follow-up Attempts</span>
                          <Badge variant="outline">{currentLead.retryCount}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="comparables" className="space-y-4 w-full min-w-0 overflow-hidden">
            <VendorComparablesTab
              vendorLeadId={lead.id}
              askingPrice={typeof currentLead.askingPrice === 'number' ? currentLead.askingPrice : (currentLead.askingPrice ? Number(currentLead.askingPrice) : undefined)}
              propertyPostcode={currentLead.propertyPostcode}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

  </>
  )
}


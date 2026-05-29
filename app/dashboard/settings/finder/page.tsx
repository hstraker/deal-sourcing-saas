"use client"

import { useState, useEffect } from "react"
import { Label }    from "@/components/ui/label"
import { Switch }   from "@/components/ui/switch"
import { Input }    from "@/components/ui/input"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Globe, Clock, Loader2, Save, MapPin, X, Star,
  Home, Building2, Zap, Shield, HelpCircle, SearchCheck, TrendingUp,
} from "lucide-react"
import { toast }       from "sonner"
import { PageHeader }  from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// ─── Location master list (shared by both tabs) ──────────────────────────────
const LOCATIONS = [
  { displayName: "Birmingham (B)",      outcode: "2245",        slug: "birmingham",          postcodes: "B1–B99",         region: "West Midlands" },
  { displayName: "London (E)",          outcode: "87490",       slug: "east-london",         postcodes: "E1–E20",         region: "London" },
  { displayName: "London (N)",          outcode: "87498",       slug: "north-london",        postcodes: "N1–N22",         region: "London" },
  { displayName: "London (NW)",         outcode: "87499",       slug: "north-west-london",   postcodes: "NW1–NW11",       region: "London" },
  { displayName: "London (SE)",         outcode: "87502",       slug: "south-east-london",   postcodes: "SE1–SE28",       region: "London" },
  { displayName: "London (SW)",         outcode: "87504",       slug: "south-west-london",   postcodes: "SW1–SW20",       region: "London" },
  { displayName: "London (W)",          outcode: "87506",       slug: "west-london",         postcodes: "W1–W14",         region: "London" },
  { displayName: "London (WC)",         outcode: "87507",       slug: "central-london",      postcodes: "WC1–WC2",        region: "London" },
  { displayName: "London (EC)",         outcode: "87489",       slug: "city-of-london",      postcodes: "EC1–EC4",        region: "London" },
  { displayName: "Manchester (M)",      outcode: "904",         slug: "manchester",          postcodes: "M1–M90",         region: "Greater Manchester" },
  { displayName: "Leeds (LS)",          outcode: "787",         slug: "leeds",               postcodes: "LS1–LS29",       region: "West Yorkshire" },
  { displayName: "Liverpool (L)",       outcode: "791",         slug: "liverpool",           postcodes: "L1–L40",         region: "Merseyside" },
  { displayName: "Sheffield (S)",       outcode: "1335",        slug: "sheffield",           postcodes: "S1–S81",         region: "South Yorkshire" },
  { displayName: "Bristol (BS)",        outcode: "219",         slug: "bristol",             postcodes: "BS1–BS49",       region: "South West" },
  { displayName: "Nottingham (NG)",     outcode: "1024",        slug: "nottingham",          postcodes: "NG1–NG25",       region: "East Midlands" },
  { displayName: "Leicester (LE)",      outcode: "770",         slug: "leicester",           postcodes: "LE1–LE19",       region: "East Midlands" },
  { displayName: "Coventry (CV)",       outcode: "405",         slug: "coventry",            postcodes: "CV1–CV37",       region: "West Midlands" },
  { displayName: "Bradford (BD)",       outcode: "153",         slug: "bradford",            postcodes: "BD1–BD23",       region: "West Yorkshire" },
  { displayName: "Newcastle (NE)",      outcode: "1007",        slug: "newcastle-upon-tyne", postcodes: "NE1–NE66",       region: "North East" },
  { displayName: "Sunderland (SR)",     outcode: "1440",        slug: "sunderland",          postcodes: "SR1–SR8",        region: "North East" },
  { displayName: "Glasgow (G)",         outcode: "550",         slug: "glasgow",             postcodes: "G1–G84",         region: "Scotland" },
  { displayName: "Edinburgh (EH)",      outcode: "475",         slug: "edinburgh",           postcodes: "EH1–EH55",       region: "Scotland" },
  { displayName: "Cardiff (CF)",        outcode: "289",         slug: "cardiff",             postcodes: "CF1–CF64",       region: "South Wales",    isPriority: true },
  { displayName: "Newport (NP)",        outcode: "REGION^991",  slug: "newport",             postcodes: "NP1–NP25",       region: "South Wales",    isPriority: true },
  { displayName: "Swansea (SA)",        outcode: "REGION^1305", slug: "swansea",             postcodes: "SA1–SA9",        region: "West Wales",     isPriority: true },
  { displayName: "Belfast (BT)",        outcode: "233",         slug: "belfast",             postcodes: "BT1–BT94",       region: "Northern Ireland" },
  { displayName: "Wolverhampton (WV)",  outcode: "1631",        slug: "wolverhampton",       postcodes: "WV1–WV16",       region: "West Midlands" },
  { displayName: "Derby (DE)",          outcode: "424",         slug: "derby",               postcodes: "DE1–DE75",       region: "East Midlands" },
  { displayName: "Stoke-on-Trent (ST)", outcode: "1407",        slug: "stoke-on-trent",      postcodes: "ST1–ST21",       region: "West Midlands" },
  { displayName: "Southampton (SO)",    outcode: "1372",        slug: "southampton",         postcodes: "SO14–SO53",      region: "South East" },
  { displayName: "Portsmouth (PO)",     outcode: "1167",        slug: "portsmouth",          postcodes: "PO1–PO41",       region: "South East" },
  { displayName: "Plymouth (PL)",       outcode: "1148",        slug: "plymouth",            postcodes: "PL1–PL35",       region: "South West" },
  { displayName: "Reading (RG)",        outcode: "1207",        slug: "reading",             postcodes: "RG1–RG45",       region: "South East" },
  { displayName: "Milton Keynes (MK)",  outcode: "942",         slug: "milton-keynes",       postcodes: "MK1–MK19",       region: "South East" },
  { displayName: "Luton (LU)",          outcode: "808",         slug: "luton",               postcodes: "LU1–LU7",        region: "East of England" },
  { displayName: "Northampton (NN)",    outcode: "1033",        slug: "northampton",         postcodes: "NN1–NN29",       region: "East Midlands" },
  { displayName: "Swindon (SN)",        outcode: "1361",        slug: "swindon",             postcodes: "SN1–SN26",       region: "South West" },
  { displayName: "Peterborough (PE)",   outcode: "1098",        slug: "peterborough",        postcodes: "PE1–PE38",       region: "East of England" },
  { displayName: "Bath (BA)",           outcode: "95",          slug: "bath",                postcodes: "BA1–BA22",       region: "South West" },
  { displayName: "Exeter (EX)",         outcode: "490",         slug: "exeter",              postcodes: "EX1–EX39",       region: "South West" },
  { displayName: "Bournemouth (BH)",    outcode: "190",         slug: "bournemouth",         postcodes: "BH1–BH25",       region: "South West" },
  { displayName: "Gloucester (GL)",     outcode: "547",         slug: "gloucester",          postcodes: "GL1–GL56",       region: "South West" },
  { displayName: "Brighton/Hove (BN)", outcode: "213",          slug: "brighton",            postcodes: "BN1–BN50",       region: "South East" },
  { displayName: "Oxford (OX)",         outcode: "1063",        slug: "oxford",              postcodes: "OX1–OX49",       region: "South East" },
  { displayName: "Guildford (GU)",      outcode: "571",         slug: "guildford",           postcodes: "GU1–GU35",       region: "South East" },
  { displayName: "Cambridge (CB)",      outcode: "271",         slug: "cambridge",           postcodes: "CB1–CB25",       region: "East of England" },
  { displayName: "Norwich (NR)",        outcode: "1020",        slug: "norwich",             postcodes: "NR1–NR35",       region: "East of England" },
  { displayName: "Ipswich (IP)",        outcode: "635",         slug: "ipswich",             postcodes: "IP1–IP33",       region: "East of England" },
  { displayName: "York (YO)",           outcode: "1671",        slug: "york",                postcodes: "YO1–YO62",       region: "Yorkshire" },
  { displayName: "Hull (HU)",           outcode: "613",         slug: "hull",                postcodes: "HU1–HU20",       region: "Yorkshire" },
  { displayName: "Middlesbrough (TS)",  outcode: "982",         slug: "middlesbrough",       postcodes: "TS1–TS29",       region: "North East" },
  { displayName: "Preston (PR)",        outcode: "1172",        slug: "preston",             postcodes: "PR1–PR26",       region: "Lancashire" },
  { displayName: "Chester (CH)",        outcode: "338",         slug: "chester",             postcodes: "CH1–CH66",       region: "Cheshire" },
  { displayName: "Aberdeen (AB)",       outcode: "1",           slug: "aberdeen",            postcodes: "AB10–AB56",      region: "Scotland" },
  { displayName: "Wrexham/N. Wales (LL)", outcode: "REGION^1304", slug: "wrexham",           postcodes: "LL11–LL77",      region: "North Wales",    isPriority: true },
  { displayName: "Powys (LD)",          outcode: "764",         slug: "llandrindod-wells",   postcodes: "LD1–LD8",        region: "Mid Wales",      isPriority: true },
  { displayName: "Harrow (HA)",         outcode: "587",         slug: "harrow",              postcodes: "HA0–HA9",        region: "London" },
  { displayName: "Croydon (CR)",        outcode: "407",         slug: "croydon",             postcodes: "CR0–CR9",        region: "London" },
  { displayName: "Watford (WD)",        outcode: "1554",        slug: "watford",             postcodes: "WD1–WD25",       region: "East of England" },
] as const

const RESI_TYPES = [
  { value: "terraced",      label: "Terraced" },
  { value: "semi-detached", label: "Semi-Detached" },
  { value: "detached",      label: "Detached" },
  { value: "flat",          label: "Flat" },
  { value: "bungalow",      label: "Bungalow" },
  { value: "land",          label: "Land" },
]

const COMM_TYPES = [
  { value: "office",      label: "Office" },
  { value: "retail",      label: "Retail" },
  { value: "industrial",  label: "Industrial" },
  { value: "warehouse",   label: "Warehouse" },
  { value: "mixed-use",   label: "Mixed Use" },
  { value: "leisure",     label: "Leisure" },
  { value: "land",        label: "Land" },
  { value: "hotel",       label: "Hotel" },
  { value: "healthcare",  label: "Healthcare" },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Loc = { outcode: string; displayName: string; slug?: string }

interface ResiCriteria {
  category: "RESIDENTIAL"
  locations: Loc[]
  minPrice: number | null
  maxPrice: number | null
  minBedrooms: number | null
  maxBedrooms: number | null
  propertyTypes: string[] | null
  addedSince: string | null
  includeSSTC: boolean
  maxPages: number | null
}

interface CommCriteria {
  category: "COMMERCIAL"
  locations: Loc[]
  minPrice: number | null
  maxPrice: number | null
  propertyTypes: string[] | null
  addedSince: string | null
  includeSSTC: boolean
  maxPages: number | null
}

interface SettingsRow {
  enabled: boolean
  scheduleType: string
  rightmoveEnabled: boolean
  zooplaEnabled: boolean
  onthemarketEnabled: boolean
  primelocationEnabled: boolean
  autoAnalysisEnabled: boolean
  autoAnalysisThreshold: number | null
  requireManualReview: boolean
  requestDelay: number
  maxConcurrent: number
  useProxy: boolean
  proxyUrl: string | null
}

const RESI_DEFAULTS: SettingsRow = {
  enabled: false, scheduleType: "TWICE_DAILY",
  rightmoveEnabled: true, zooplaEnabled: true, onthemarketEnabled: true, primelocationEnabled: true,
  autoAnalysisEnabled: false, autoAnalysisThreshold: null, requireManualReview: true,
  requestDelay: 3000, maxConcurrent: 2, useProxy: false, proxyUrl: null,
}
const COMM_DEFAULTS: SettingsRow = { ...RESI_DEFAULTS }

const RESI_CRITERIA_DEFAULTS: ResiCriteria = {
  category: "RESIDENTIAL", locations: [], minPrice: null, maxPrice: null,
  minBedrooms: null, maxBedrooms: null, propertyTypes: null, addedSince: "24hours", includeSSTC: false, maxPages: 5,
}
const COMM_CRITERIA_DEFAULTS: CommCriteria = {
  category: "COMMERCIAL", locations: [], minPrice: null, maxPrice: null,
  propertyTypes: null, addedSince: "24hours", includeSSTC: false, maxPages: 5,
}

// ─── Job History Component ────────────────────────────────────────────────────

const JOB_STATUS_COLORS: Record<string, string> = {
  QUEUED:    "bg-gray-100 text-gray-700",
  RUNNING:   "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED:    "bg-red-100 text-red-700",
  CANCELLED: "bg-yellow-100 text-yellow-700",
}
const JOB_SRC_COLORS: Record<string, string> = {
  RIGHTMOVE:    "bg-blue-100 text-blue-800",
  ZOOPLA:       "bg-purple-100 text-purple-800",
  ONTHEMARKET:  "bg-emerald-100 text-emerald-800",
  PRIMELOCATION:"bg-orange-100 text-orange-800",
}

function fmt12h(d: Date) {
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

function JobHistory() {
  const [jobs, setJobs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/scraper/jobs?limit=50")
      .then(r => r.json())
      .then(d => { if (d.jobs) setJobs(d.jobs) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="ds-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--ds-border)] flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Job History</h3>
        <span className="text-xs text-gray-400 ml-auto">Last 50 scraper runs</span>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No scraper jobs yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left bg-gray-50">
                <th className="table-header px-4 py-2">Source</th>
                <th className="table-header px-4 py-2">Category</th>
                <th className="table-header px-4 py-2">Status</th>
                <th className="table-header px-4 py-2">Found</th>
                <th className="table-header px-4 py-2">Saved</th>
                <th className="table-header px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: any) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${JOB_SRC_COLORS[job.source] || "bg-gray-100 text-gray-700"}`}>
                      {job.source}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      {job.category === "COMMERCIAL" ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                      {job.category === "COMMERCIAL" ? "Commercial" : "Residential"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${JOB_STATUS_COLORS[job.status] || ""}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-600">{job.totalFound ?? 0}</td>
                  <td className="px-4 py-2 tabular-nums text-green-600 font-medium">{job.successful ?? 0}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs" suppressHydrationWarning>
                    {new Date(job.createdAt).toLocaleDateString()} {fmt12h(new Date(job.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinderSettingsPage() {
  const [critTab, setCritTab] = useState<"resi" | "commercial">("resi")

  // Shared settings state (portals + schedule — mirrored to both rows on save)
  const [shared, setShared] = useState({
    rightmoveEnabled: true, zooplaEnabled: true, onthemarketEnabled: true, primelocationEnabled: true,
    scheduleType: "TWICE_DAILY",
  })

  // Per-category state
  const [resi,     setResi]     = useState<SettingsRow>(RESI_DEFAULTS)
  const [resiCrit, setResiCrit] = useState<ResiCriteria>(RESI_CRITERIA_DEFAULTS)
  const [comm,     setComm]     = useState<SettingsRow>(COMM_DEFAULTS)
  const [commCrit, setCommCrit] = useState<CommCriteria>(COMM_CRITERIA_DEFAULTS)

  // UI state
  const [loading,    setLoading]    = useState(true)
  const [savingResi, setSavingResi] = useState(false)
  const [savingComm, setSavingComm] = useState(false)
  const [resiSearch, setResiSearch] = useState("")
  const [commSearch, setCommSearch] = useState("")
  const [isDryRun,   setIsDryRun]   = useState(false)
  const [isFixing,   setIsFixing]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fixResult,  setFixResult]   = useState<any>(null)

  // ── Load both settings on mount ───────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/scraper/settings"),
          fetch("/api/scraper/settings/commercial"),
        ])
        if (r1.ok) {
          const d = await r1.json()
          const s = d.settings
          setShared(prev => ({
            ...prev,
            rightmoveEnabled:     s.rightmoveEnabled,
            zooplaEnabled:        s.zooplaEnabled,
            onthemarketEnabled:   s.onthemarketEnabled,
            primelocationEnabled: s.primelocationEnabled ?? true,
            scheduleType:         s.scheduleType,
          }))
          setResi({
            enabled: s.enabled, scheduleType: s.scheduleType,
            rightmoveEnabled: s.rightmoveEnabled, zooplaEnabled: s.zooplaEnabled,
            onthemarketEnabled: s.onthemarketEnabled, primelocationEnabled: s.primelocationEnabled ?? true,
            autoAnalysisEnabled: s.autoAnalysisEnabled, autoAnalysisThreshold: s.autoAnalysisThreshold,
            requireManualReview: s.requireManualReview, requestDelay: s.requestDelay,
            maxConcurrent: s.maxConcurrent, useProxy: s.useProxy, proxyUrl: s.proxyUrl,
          })
          if (s.searchCriteria) {
            setResiCrit({ ...RESI_CRITERIA_DEFAULTS, ...s.searchCriteria, category: "RESIDENTIAL" })
          }
        }
        if (r2.ok) {
          const d = await r2.json()
          const s = d.settings
          setComm({
            enabled: s.enabled, scheduleType: s.scheduleType,
            rightmoveEnabled: s.rightmoveEnabled, zooplaEnabled: s.zooplaEnabled,
            onthemarketEnabled: s.onthemarketEnabled, primelocationEnabled: s.primelocationEnabled ?? true,
            autoAnalysisEnabled: s.autoAnalysisEnabled, autoAnalysisThreshold: s.autoAnalysisThreshold,
            requireManualReview: s.requireManualReview, requestDelay: s.requestDelay,
            maxConcurrent: s.maxConcurrent, useProxy: s.useProxy, proxyUrl: s.proxyUrl,
          })
          if (s.searchCriteria) {
            setCommCrit({ ...COMM_CRITERIA_DEFAULTS, ...s.searchCriteria, category: "COMMERCIAL" })
          }
        }
      } catch (e: any) {
        toast.error("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveResi = async () => {
    setSavingResi(true)
    try {
      const body = {
        ...resi, ...shared,
        searchCriteria: { ...resiCrit, category: "RESIDENTIAL" },
      }
      const res = await fetch("/api/scraper/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to save residential settings")
      toast.success("Residential settings saved")
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingResi(false) }
  }

  const saveComm = async () => {
    setSavingComm(true)
    try {
      const body = {
        ...comm, ...shared,
        searchCriteria: { ...commCrit, category: "COMMERCIAL", minBedrooms: undefined, maxBedrooms: undefined },
      }
      const res = await fetch("/api/scraper/settings/commercial", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to save commercial settings")
      toast.success("Commercial settings saved")
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingComm(false) }
  }

  const saveAll = async () => {
    await Promise.all([saveResi(), saveComm()])
  }

  // ── Location helpers ──────────────────────────────────────────────────────

  const addLoc = (tab: "resi" | "commercial", loc: typeof LOCATIONS[number]) => {
    if (tab === "resi") {
      if (resiCrit.locations.some(l => l.outcode === loc.outcode)) return
      setResiCrit(c => ({ ...c, locations: [...c.locations, { outcode: loc.outcode, displayName: loc.displayName, slug: loc.slug }] }))
      setResiSearch("")
    } else {
      if (commCrit.locations.some(l => l.outcode === loc.outcode)) return
      setCommCrit(c => ({ ...c, locations: [...c.locations, { outcode: loc.outcode, displayName: loc.displayName, slug: loc.slug }] }))
      setCommSearch("")
    }
  }

  const removeLoc = (tab: "resi" | "commercial", outcode: string) => {
    if (tab === "resi") setResiCrit(c => ({ ...c, locations: c.locations.filter(l => l.outcode !== outcode) }))
    else                setCommCrit(c => ({ ...c, locations: c.locations.filter(l => l.outcode !== outcode) }))
  }

  const toggleType = (tab: "resi" | "commercial", val: string) => {
    if (tab === "resi") {
      const cur = resiCrit.propertyTypes ?? []
      setResiCrit(c => ({ ...c, propertyTypes: cur.includes(val) ? cur.filter(t => t !== val) : [...cur, val] }))
    } else {
      const cur = commCrit.propertyTypes ?? []
      setCommCrit(c => ({ ...c, propertyTypes: cur.includes(val) ? cur.filter(t => t !== val) : [...cur, val] }))
    }
  }

  // ── Postcode repair ───────────────────────────────────────────────────────

  const runPostcodeFix = async (dryRun: boolean) => {
    if (dryRun) setIsDryRun(true); else setIsFixing(true)
    setFixResult(null)
    try {
      const res = await fetch("/api/admin/fix-postcodes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed"); return }
      setFixResult({ ...data.summary, dryRun: data.dryRun })
      toast.success(dryRun ? `Dry run: ${data.summary?.totalCorrected ?? 0} records would be corrected` : `Fixed ${data.summary?.totalCorrected ?? 0} records`)
    } catch { toast.error("Postcode fix failed") }
    finally { if (dryRun) setIsDryRun(false); else setIsFixing(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const PORTALS = [
    { id: "rightmoveEnabled",     label: "Rightmove" },
    { id: "zooplaEnabled",        label: "Zoopla" },
    { id: "onthemarketEnabled",   label: "OnTheMarket" },
    { id: "primelocationEnabled", label: "PrimeLocation" },
  ] as const

  const activeCrit   = critTab === "resi" ? resiCrit   : commCrit
  const activeSearch = critTab === "resi" ? resiSearch  : commSearch
  const activeTypes  = critTab === "resi" ? RESI_TYPES  : COMM_TYPES

  const filteredLocs = LOCATIONS.filter(
    l => l.displayName.toLowerCase().includes(activeSearch.toLowerCase()) &&
         !activeCrit.locations.some(x => x.outcode === l.outcode)
  )

  return (
    <div>
      <PageHeader
        title="Finder Settings"
        subtitle="Configure portals, schedule, and search criteria for residential & commercial scanning"
        className="mb-6"
        actions={
          <Button className="btn-primary" onClick={saveAll} disabled={savingResi || savingComm}>
            {(savingResi || savingComm) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All
          </Button>
        }
      />

      <div className="max-w-4xl space-y-5">

        {/* ── Shared: Portals + Schedule ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Portals */}
          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Portals
                <span className="ml-auto text-xs font-normal text-gray-400">Applies to both Residential &amp; Commercial</span>
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {PORTALS.map(({ id, label }) => (
                <div key={id} className="flex items-center justify-between">
                  <Label htmlFor={id} className="cursor-pointer">{label}</Label>
                  <Switch
                    id={id}
                    checked={shared[id]}
                    onCheckedChange={v => setShared(s => ({ ...s, [id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Schedule
                <span className="ml-auto text-xs font-normal text-gray-400">Applies to both</span>
              </h3>
            </div>
            <div className="p-5">
              <Select value={shared.scheduleType} onValueChange={v => setShared(s => ({ ...s, scheduleType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TWICE_DAILY">Twice daily (6 AM &amp; 6 PM)</SelectItem>
                  <SelectItem value="DAILY">Daily (6 AM)</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-2">Both residential and commercial scans run on the same schedule.</p>
            </div>
          </div>
        </div>

        {/* ── Per-category criteria ── */}
        <div className="ds-card overflow-hidden">
          {/* Tab header */}
          <div className="flex items-center border-b border-[var(--ds-border)]">
            <button
              onClick={() => setCritTab("resi")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
                critTab === "resi"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              <Home className="h-4 w-4" />
              Residential
            </button>
            <button
              onClick={() => setCritTab("commercial")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
                critTab === "commercial"
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              <Building2 className="h-4 w-4" />
              Commercial
            </button>
          </div>

          <div className="p-5 space-y-5">

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`${critTab}-enabled`}>
                  {critTab === "resi" ? "Residential" : "Commercial"} scanner enabled
                </Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  {critTab === "resi"
                    ? "Scans portals for residential properties matching your criteria"
                    : "Scans portals for commercial properties — offices, retail, industrial, land"
                  }
                </p>
              </div>
              <Switch
                id={`${critTab}-enabled`}
                checked={critTab === "resi" ? resi.enabled : comm.enabled}
                onCheckedChange={v =>
                  critTab === "resi"
                    ? setResi(s => ({ ...s, enabled: v }))
                    : setComm(s => ({ ...s, enabled: v }))
                }
              />
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Locations */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Locations</Label>
                {critTab === "resi" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs text-xs">
                        <p className="font-semibold mb-1">Priority Scoring Areas</p>
                        <p>Locations marked <span className="text-yellow-500">★</span> receive a boosted location score in deal scoring (CF, SA, NP, LL, LD).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Selected badges */}
              {activeCrit.locations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeCrit.locations.map(loc => {
                    const meta = LOCATIONS.find(l => l.outcode === loc.outcode) as any
                    return (
                      <TooltipProvider key={loc.outcode}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={`pl-2 pr-1 py-1 gap-1 cursor-default ${
                                meta?.isPriority ? "border border-yellow-400/50 bg-yellow-50 text-yellow-800" : ""
                              }`}
                            >
                              {meta?.isPriority && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                              {loc.displayName}
                              <button onClick={() => removeLoc(critTab, loc.outcode)} className="ml-1 rounded-full hover:bg-gray-100 p-0.5">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </TooltipTrigger>
                          {meta && (
                            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                              <p className="font-semibold">{meta.displayName}</p>
                              <p className="text-gray-400">{meta.region} · {meta.postcodes.split(" ")[0]}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                </div>
              )}

              {activeCrit.locations.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  No locations selected — add at least one to enable scanning.
                </p>
              )}

              {/* Search input */}
              <div className="relative">
                <Input
                  placeholder="Search locations to add…"
                  value={activeSearch}
                  onChange={e => critTab === "resi" ? setResiSearch(e.target.value) : setCommSearch(e.target.value)}
                  className="text-sm"
                />
                {activeSearch && filteredLocs.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-[var(--ds-border)] rounded-md shadow-md max-h-56 overflow-y-auto">
                    {filteredLocs.map(loc => (
                      <button key={loc.outcode} onClick={() => addLoc(critTab, loc)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-1.5">
                          {(loc as any).isPriority && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />}
                          <span className="font-medium">{loc.displayName}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{loc.region} · {loc.postcodes.split(" ")[0]}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Price + Beds (resi) / Price (commercial) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Price */}
              <div className="space-y-1.5">
                <Label>Price Range</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <Input
                      type="number" min={0} step={critTab === "resi" ? 5000 : 10000} placeholder="Min"
                      value={activeCrit.minPrice ?? ""}
                      onChange={e => {
                        const v = e.target.value ? parseInt(e.target.value) : null
                        critTab === "resi" ? setResiCrit(c => ({ ...c, minPrice: v })) : setCommCrit(c => ({ ...c, minPrice: v }))
                      }}
                      className="w-32 pl-6"
                    />
                  </div>
                  <span className="text-gray-400">—</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <Input
                      type="number" min={0} step={critTab === "resi" ? 5000 : 10000} placeholder="Max"
                      value={activeCrit.maxPrice ?? ""}
                      onChange={e => {
                        const v = e.target.value ? parseInt(e.target.value) : null
                        critTab === "resi" ? setResiCrit(c => ({ ...c, maxPrice: v })) : setCommCrit(c => ({ ...c, maxPrice: v }))
                      }}
                      className="w-32 pl-6"
                    />
                  </div>
                </div>
                {critTab === "commercial" && <p className="text-xs text-gray-400">Typical SSAS range: £100k–£500k</p>}
              </div>

              {/* Bedrooms (resi only) */}
              {critTab === "resi" && (
                <div className="space-y-1.5">
                  <Label>Bedrooms</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0} max={10} placeholder="Min"
                      value={resiCrit.minBedrooms ?? ""}
                      onChange={e => setResiCrit(c => ({ ...c, minBedrooms: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-20"
                    />
                    <span className="text-gray-400">—</span>
                    <Input
                      type="number" min={0} max={10} placeholder="Max"
                      value={resiCrit.maxBedrooms ?? ""}
                      onChange={e => setResiCrit(c => ({ ...c, maxBedrooms: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-20"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Added since + Max pages + Include SSTC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Added Since</Label>
                <Select
                  value={activeCrit.addedSince ?? "any"}
                  onValueChange={v => {
                    const val = v === "any" ? null : v as any
                    critTab === "resi" ? setResiCrit(c => ({ ...c, addedSince: val })) : setCommCrit(c => ({ ...c, addedSince: val }))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="24hours">Last 24 hours</SelectItem>
                    <SelectItem value="3days">Last 3 days</SelectItem>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="14days">Last 14 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Pages / Location</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={1} max={42}
                    value={activeCrit.maxPages ?? ""}
                    onChange={e => {
                      const v = e.target.value ? parseInt(e.target.value) : null
                      critTab === "resi" ? setResiCrit(c => ({ ...c, maxPages: v })) : setCommCrit(c => ({ ...c, maxPages: v }))
                    }}
                    className="w-20"
                  />
                  <span className="text-xs text-gray-400">~24/page</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Include Under Offer</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Switch
                    id={`sstc-${critTab}`}
                    checked={activeCrit.includeSSTC ?? false}
                    onCheckedChange={v =>
                      critTab === "resi" ? setResiCrit(c => ({ ...c, includeSSTC: v })) : setCommCrit(c => ({ ...c, includeSSTC: v }))
                    }
                  />
                  <Label htmlFor={`sstc-${critTab}`} className="text-sm font-normal cursor-pointer text-gray-500">
                    Include SSTC / under offer
                  </Label>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Property types */}
            <div className="space-y-2">
              <Label>
                Property Types
                <span className="text-xs font-normal text-gray-400 ml-1">(leave blank for all)</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {activeTypes.map(pt => (
                  <div key={pt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`${critTab}-${pt.value}`}
                      checked={(activeCrit.propertyTypes ?? []).includes(pt.value)}
                      onCheckedChange={() => toggleType(critTab, pt.value)}
                    />
                    <Label htmlFor={`${critTab}-${pt.value}`} className="text-sm font-normal cursor-pointer">
                      {pt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Auto-approve (per category) */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Approve
              </h4>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor={`aa-${critTab}`}>Auto-approve high-scoring properties</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Properties at or above the threshold skip the review queue</p>
                </div>
                <Switch
                  id={`aa-${critTab}`}
                  checked={critTab === "resi" ? resi.autoAnalysisEnabled : comm.autoAnalysisEnabled}
                  onCheckedChange={v =>
                    critTab === "resi"
                      ? setResi(s => ({ ...s, autoAnalysisEnabled: v }))
                      : setComm(s => ({ ...s, autoAnalysisEnabled: v }))
                  }
                />
              </div>
              {(critTab === "resi" ? resi.autoAnalysisEnabled : comm.autoAnalysisEnabled) && (
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap text-sm text-gray-400">Auto-approve if BMV score ≥</Label>
                  <Input
                    type="number" min={0} max={100} placeholder="e.g. 60"
                    value={(critTab === "resi" ? resi.autoAnalysisThreshold : comm.autoAnalysisThreshold) ?? ""}
                    onChange={e => {
                      const v = e.target.value ? parseInt(e.target.value) : null
                      critTab === "resi" ? setResi(s => ({ ...s, autoAnalysisThreshold: v })) : setComm(s => ({ ...s, autoAnalysisThreshold: v }))
                    }}
                    className="w-24"
                  />
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor={`mr-${critTab}`}>Require manual review</Label>
                  <p className="text-xs text-gray-400 mt-0.5">All properties go to review queue first</p>
                </div>
                <Switch
                  id={`mr-${critTab}`}
                  checked={critTab === "resi" ? resi.requireManualReview : comm.requireManualReview}
                  onCheckedChange={v =>
                    critTab === "resi"
                      ? setResi(s => ({ ...s, requireManualReview: v }))
                      : setComm(s => ({ ...s, requireManualReview: v }))
                  }
                />
              </div>
            </div>

            {/* Per-tab save button */}
            <div className="flex justify-end pt-2">
              <Button
                className={critTab === "resi" ? "btn-primary" : "bg-amber-600 hover:bg-amber-700 text-white"}
                onClick={critTab === "resi" ? saveResi : saveComm}
                disabled={savingResi || savingComm}
              >
                {(savingResi || savingComm) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save {critTab === "resi" ? "Residential" : "Commercial"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Advanced (shared) ── */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Advanced
              <span className="ml-auto text-xs font-normal text-gray-400">Applies to active criteria tab</span>
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm w-36">Request delay (ms)</Label>
              <Input
                type="number" min={1000} max={30000} step={500}
                value={(critTab === "resi" ? resi : comm).requestDelay}
                onChange={e => {
                  const v = parseInt(e.target.value) || 3000
                  critTab === "resi" ? setResi(s => ({ ...s, requestDelay: v })) : setComm(s => ({ ...s, requestDelay: v }))
                }}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm w-36">Max concurrent</Label>
              <Input
                type="number" min={1} max={10}
                value={(critTab === "resi" ? resi : comm).maxConcurrent}
                onChange={e => {
                  const v = parseInt(e.target.value) || 2
                  critTab === "resi" ? setResi(s => ({ ...s, maxConcurrent: v })) : setComm(s => ({ ...s, maxConcurrent: v }))
                }}
                className="w-20"
              />
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <Label htmlFor="useProxy">Enable proxy</Label>
              <Switch
                id="useProxy"
                checked={(critTab === "resi" ? resi : comm).useProxy}
                onCheckedChange={v =>
                  critTab === "resi" ? setResi(s => ({ ...s, useProxy: v })) : setComm(s => ({ ...s, useProxy: v }))
                }
              />
            </div>
            {(critTab === "resi" ? resi : comm).useProxy && (
              <div className="sm:col-span-2">
                <Input
                  type="url" placeholder="http://proxy:port"
                  value={(critTab === "resi" ? resi : comm).proxyUrl || ""}
                  onChange={e => {
                    const v = e.target.value || null
                    critTab === "resi" ? setResi(s => ({ ...s, proxyUrl: v })) : setComm(s => ({ ...s, proxyUrl: v }))
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Postcode Repair ── */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <SearchCheck className="h-4 w-4" />
              Postcode Repair
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Cross-checks all scraped listings and vendor leads against Land Registry data to validate and fill missing postcodes.
            </p>
            {fixResult && (
              <div className="rounded-md border border-[var(--ds-border)] bg-gray-50 p-3 text-sm space-y-2">
                <p className="font-medium">{fixResult.dryRun ? "Dry run complete — no changes saved" : "Postcode repair complete"}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400">
                  <span>Properties scanned:</span><span className="font-medium text-gray-900">{fixResult.propertyListings?.processed}</span>
                  <span>Properties corrected:</span><span className="font-medium text-green-600">{fixResult.propertyListings?.corrected}</span>
                  <span>Leads scanned:</span><span className="font-medium text-gray-900">{fixResult.vendorLeads?.processed}</span>
                  <span>Leads corrected:</span><span className="font-medium text-green-600">{fixResult.vendorLeads?.corrected}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => runPostcodeFix(true)} disabled={isDryRun || isFixing}>
                {isDryRun ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
                Dry Run
              </Button>
              <Button className="btn-primary" size="sm" onClick={() => setShowConfirm(true)} disabled={isDryRun || isFixing}>
                {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
                Fix Postcodes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Job History ── */}
      <JobHistory />

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        variant="warning"
        title="Update Postcodes"
        description="This will update postcodes for all scraped properties and vendor leads with missing or incorrect postcodes."
        confirmLabel="Update"
        onConfirm={() => runPostcodeFix(false)}
      />
    </div>
  )
}

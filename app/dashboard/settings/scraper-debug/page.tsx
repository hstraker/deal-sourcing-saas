"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

// Same location list as settings pages
const LOCATIONS = [
  { displayName: "Birmingham (B)",    outcode: "2245",       slug: "birmingham",         region: "West Midlands" },
  { displayName: "London (E)",        outcode: "87490",      slug: "east-london",        region: "London" },
  { displayName: "London (N)",        outcode: "87498",      slug: "north-london",       region: "London" },
  { displayName: "London (NW)",       outcode: "87499",      slug: "north-west-london",  region: "London" },
  { displayName: "London (SE)",       outcode: "87502",      slug: "south-east-london",  region: "London" },
  { displayName: "London (SW)",       outcode: "87504",      slug: "south-west-london",  region: "London" },
  { displayName: "London (W)",        outcode: "87506",      slug: "west-london",        region: "London" },
  { displayName: "London (WC)",       outcode: "87507",      slug: "central-london",     region: "London" },
  { displayName: "London (EC)",       outcode: "87489",      slug: "city-of-london",     region: "London" },
  { displayName: "Manchester (M)",    outcode: "904",        slug: "manchester",         region: "Greater Manchester" },
  { displayName: "Leeds (LS)",        outcode: "787",        slug: "leeds",              region: "West Yorkshire" },
  { displayName: "Liverpool (L)",     outcode: "791",        slug: "liverpool",          region: "Merseyside" },
  { displayName: "Sheffield (S)",     outcode: "1335",       slug: "sheffield",          region: "South Yorkshire" },
  { displayName: "Bristol (BS)",      outcode: "219",        slug: "bristol",            region: "South West" },
  { displayName: "Nottingham (NG)",   outcode: "1024",       slug: "nottingham",         region: "East Midlands" },
  { displayName: "Leicester (LE)",    outcode: "770",        slug: "leicester",          region: "East Midlands" },
  { displayName: "Coventry (CV)",     outcode: "405",        slug: "coventry",           region: "West Midlands" },
  { displayName: "Bradford (BD)",     outcode: "153",        slug: "bradford",           region: "West Yorkshire" },
  { displayName: "Newcastle (NE)",    outcode: "1007",       slug: "newcastle-upon-tyne",region: "North East" },
  { displayName: "Sunderland (SR)",   outcode: "1440",       slug: "sunderland",         region: "North East" },
  { displayName: "Glasgow (G)",       outcode: "550",        slug: "glasgow",            region: "Scotland" },
  { displayName: "Edinburgh (EH)",    outcode: "475",        slug: "edinburgh",          region: "Scotland" },
  { displayName: "Cardiff (CF)",      outcode: "289",        slug: "cardiff",            region: "South Wales" },
  { displayName: "Belfast (BT)",      outcode: "233",        slug: "belfast",            region: "Northern Ireland" },
  { displayName: "Wolverhampton (WV)",outcode: "1631",       slug: "wolverhampton",      region: "West Midlands" },
  { displayName: "Derby (DE)",        outcode: "424",        slug: "derby",              region: "East Midlands" },
  { displayName: "Stoke-on-Trent (ST)",outcode:"1407",       slug: "stoke-on-trent",     region: "West Midlands" },
  { displayName: "Southampton (SO)",  outcode: "1372",       slug: "southampton",        region: "South East" },
  { displayName: "Portsmouth (PO)",   outcode: "1167",       slug: "portsmouth",         region: "South East" },
  { displayName: "Plymouth (PL)",     outcode: "1148",       slug: "plymouth",           region: "South West" },
  { displayName: "Reading (RG)",      outcode: "1207",       slug: "reading",            region: "South East" },
  { displayName: "Milton Keynes (MK)",outcode: "942",        slug: "milton-keynes",      region: "South East" },
  { displayName: "Luton (LU)",        outcode: "808",        slug: "luton",              region: "East of England" },
  { displayName: "Northampton (NN)",  outcode: "1033",       slug: "northampton",        region: "East Midlands" },
  { displayName: "Newport (NP)",      outcode: "REGION^991", slug: "newport",            region: "South Wales" },
  { displayName: "Swansea (SA)",      outcode: "REGION^1305",slug: "swansea",            region: "West Wales" },
  { displayName: "Swindon (SN)",      outcode: "1361",       slug: "swindon",            region: "South West" },
  { displayName: "Peterborough (PE)", outcode: "1098",       slug: "peterborough",       region: "East of England" },
  { displayName: "Bath (BA)",         outcode: "95",         slug: "bath",               region: "South West" },
  { displayName: "Exeter (EX)",       outcode: "490",        slug: "exeter",             region: "South West" },
  { displayName: "Bournemouth (BH)",  outcode: "190",        slug: "bournemouth",        region: "South West" },
  { displayName: "Brighton/Hove (BN)",outcode: "213",        slug: "brighton",           region: "South East" },
  { displayName: "Oxford (OX)",       outcode: "1063",       slug: "oxford",             region: "South East" },
  { displayName: "Cambridge (CB)",    outcode: "271",        slug: "cambridge",          region: "East of England" },
  { displayName: "Norwich (NR)",      outcode: "1020",       slug: "norwich",            region: "East of England" },
  { displayName: "York (YO)",         outcode: "1671",       slug: "york",               region: "Yorkshire" },
  { displayName: "Hull (HU)",         outcode: "613",        slug: "hull",               region: "Yorkshire" },
  { displayName: "Middlesbrough (TS)",outcode: "982",        slug: "middlesbrough",      region: "North East" },
  { displayName: "Preston (PR)",      outcode: "1172",       slug: "preston",            region: "Lancashire" },
  { displayName: "Chester (CH)",      outcode: "338",        slug: "chester",            region: "Cheshire" },
  { displayName: "Aberdeen (AB)",     outcode: "1",          slug: "aberdeen",           region: "Scotland" },
  { displayName: "Wrexham/N. Wales (LL)", outcode: "REGION^1304", slug: "wrexham",      region: "North Wales" },
]

const SOURCES = ["RIGHTMOVE", "ZOOPLA", "ONTHEMARKET", "PRIMELOCATION"] as const
type Source = typeof SOURCES[number]

const SOURCE_COLORS: Record<Source, string> = {
  RIGHTMOVE:    "bg-blue-100 text-blue-800 border-blue-200",
  ZOOPLA:       "bg-purple-100 text-purple-800 border-purple-200",
  ONTHEMARKET:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  PRIMELOCATION:"bg-orange-100 text-orange-800 border-orange-200",
}

interface DiagResult {
  success: boolean
  searchUrls: string[]
  searchResults: {
    url: string
    propertyLinksFound: number
    sampleLinks: string[]
    httpStatus?: number
    pageTitle?: string
    pageSnippet?: string
    error?: string
  }[]
  detailSample?: {
    url: string
    extracted: any
    error?: string
  }
  logs: string[]
  duration: number
  summary: string
}

function LogLine({ line }: { line: string }) {
  const isWarn = line.includes("⚠️") || line.includes("FAILED") || line.includes("Error") || line.includes("0 property")
  const isOk   = line.includes("OK") || line.includes("launched") || line.includes("closed") || line.includes("Built")
  return (
    <div className={`font-mono text-xs leading-5 ${isWarn ? "text-amber-600" : isOk ? "text-emerald-600" : "text-gray-400"}`}>
      {line}
    </div>
  )
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

export default function ScraperDebugPage() {
  const [source, setSource]       = useState<Source>("ZOOPLA")
  const [category, setCategory]   = useState<"RESIDENTIAL" | "COMMERCIAL">("COMMERCIAL")
  const [locationKey, setLocationKey] = useState("Milton Keynes (MK)")
  const [minPrice, setMinPrice]   = useState("")
  const [maxPrice, setMaxPrice]   = useState("")
  const [addedSince, setAddedSince] = useState("")
  const [testDetail, setTestDetail] = useState(false)
  const [running, setRunning]     = useState(false)
  const [result, setResult]       = useState<DiagResult | null>(null)

  const selectedLocation = LOCATIONS.find(l => l.displayName === locationKey) ?? LOCATIONS[0]

  const run = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/scraper/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          category,
          location: {
            outcode: selectedLocation.outcode,
            displayName: selectedLocation.displayName,
            slug: selectedLocation.slug,
          },
          ...(minPrice && { minPrice: Number(minPrice) }),
          ...(maxPrice && { maxPrice: Number(maxPrice) }),
          ...(addedSince && { addedSince }),
          testDetailPage: testDetail,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Diagnostic failed"); return }
      setResult(data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  const totalLinks = result?.searchResults.reduce((s, r) => s + r.propertyLinksFound, 0) ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Scraper Diagnostics"
        description="Test a portal + category combination in real-time — see search URLs, property links found, and extracted data."
      />

      {/* ── Config panel ── */}
      <div className="ds-card p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Source */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Portal</Label>
            <Select value={source} onValueChange={v => setSource(v as Source)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="RESIDENTIAL">Residential</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min price */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Min Price</Label>
            <Input className="h-9" placeholder="e.g. 100000" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
          </div>

          {/* Max price */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Max Price</Label>
            <Input className="h-9" placeholder="e.g. 500000" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Location */}
          <div className="space-y-1.5 col-span-2 sm:col-span-2">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</Label>
            <Select value={locationKey} onValueChange={setLocationKey}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {LOCATIONS.map(l => (
                  <SelectItem key={l.displayName} value={l.displayName}>
                    {l.displayName} — {l.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">
              outcode: <code className="bg-gray-100 px-1 rounded">{selectedLocation.outcode}</code>
              {" · "}
              slug: <code className="bg-gray-100 px-1 rounded">{selectedLocation.slug}</code>
            </p>
          </div>

          {/* Added since */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Added Since</Label>
            <Select value={addedSince || "any"} onValueChange={v => setAddedSince(v === "any" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="24hours">Last 24h</SelectItem>
                <SelectItem value="3days">Last 3 days</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="14days">Last 14 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <Switch id="testDetail" checked={testDetail} onCheckedChange={setTestDetail} />
            <Label htmlFor="testDetail" className="text-sm text-gray-600 cursor-pointer">
              Also test first property detail page (slower)
            </Label>
          </div>
          <Button onClick={run} disabled={running} className="gap-2">
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" />Running…</>
              : <><Play className="h-4 w-4" />Run Diagnostic</>
            }
          </Button>
        </div>

        {running && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⏳ Launching headless browser and fetching pages — this takes 15–30 seconds…
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">

          {/* Summary banner */}
          <div className={`flex items-start gap-3 rounded-lg px-4 py-3 border ${
            result.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {result.success
              ? <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-600" />
              : <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
            }
            <div>
              <p className="font-medium text-sm">{result.summary}</p>
              <p className="text-xs mt-0.5 opacity-70">
                <Clock className="h-3 w-3 inline mr-1" />
                {(result.duration / 1000).toFixed(1)}s · {totalLinks} link(s) found across {result.searchResults.length} page(s)
              </p>
            </div>
            <Badge className={`ml-auto flex-shrink-0 ${SOURCE_COLORS[source]}`}>
              {source}
            </Badge>
          </div>

          {/* Search URLs */}
          <Collapsible title={`Search URLs (${result.searchUrls.length})`} defaultOpen>
            <div className="space-y-1.5">
              {result.searchUrls.length === 0
                ? <p className="text-sm text-amber-600">No URLs built — portal may not support this category or the location slug is missing.</p>
                : result.searchUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:underline truncate flex-1">
                      <LinkIcon className="h-3 w-3 inline mr-1 flex-shrink-0" />{url}
                    </a>
                  </div>
                ))
              }
            </div>
          </Collapsible>

          {/* Per-page results */}
          {result.searchResults.map((r, i) => (
            <Collapsible key={i} title={`Page ${i + 1} — ${r.propertyLinksFound} links found`} defaultOpen={i === 0}>
              <div className="space-y-3 text-sm">
                {r.error && (
                  <div className="flex gap-2 text-red-600 bg-red-50 rounded p-2 text-xs">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{r.error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400 mb-0.5">HTTP Status</div>
                    <div className={`font-mono font-semibold ${r.httpStatus === 200 ? "text-emerald-600" : "text-red-600"}`}>
                      {r.httpStatus ?? "—"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400 mb-0.5">Page Title</div>
                    <div className="font-mono truncate">{r.pageTitle ?? "—"}</div>
                  </div>
                </div>

                {r.pageSnippet && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Page text snippet</div>
                    <div className="font-mono text-xs bg-gray-900 text-gray-200 rounded p-3 whitespace-pre-wrap leading-5 max-h-32 overflow-y-auto">
                      {r.pageSnippet}
                    </div>
                  </div>
                )}

                {r.propertyLinksFound > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Sample property links</div>
                    <div className="space-y-1">
                      {r.sampleLinks.map((link, j) => (
                        <a key={j} href={link} target="_blank" rel="noopener noreferrer"
                          className="block font-mono text-xs text-blue-600 hover:underline truncate">
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {r.propertyLinksFound === 0 && !r.error && (
                  <div className="flex gap-2 text-amber-700 bg-amber-50 rounded p-2 text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Page loaded (HTTP {r.httpStatus}) but no property links were extracted.
                      {/captcha|robot|blocked|verify/i.test(r.pageTitle ?? "") && " Bot detection suspected — check Page title above."}
                      {" "}The search URL may be valid but use a different link format than the selector expects.
                    </span>
                  </div>
                )}
              </div>
            </Collapsible>
          ))}

          {/* Detail page result */}
          {result.detailSample && (
            <Collapsible title="Detail page extraction" defaultOpen>
              {result.detailSample.error
                ? <p className="text-sm text-red-600">{result.detailSample.error}</p>
                : (
                  <div className="space-y-2">
                    <a href={result.detailSample.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:underline block truncate">
                      {result.detailSample.url}
                    </a>
                    <pre className="bg-gray-900 text-gray-200 rounded p-3 text-xs overflow-x-auto max-h-80">
                      {JSON.stringify(result.detailSample.extracted, null, 2)}
                    </pre>
                  </div>
                )
              }
            </Collapsible>
          )}

          {/* Console logs */}
          <Collapsible title={`Console log (${result.logs.length} lines)`}>
            <div className="bg-gray-950 rounded p-3 space-y-0.5 max-h-64 overflow-y-auto">
              {result.logs.map((line, i) => <LogLine key={i} line={line} />)}
            </div>
          </Collapsible>

        </div>
      )}
    </div>
  )
}

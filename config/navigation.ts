import {
  FunnelIcon,
  BellAlertIcon,
  MagnifyingGlassCircleIcon,
  ChartBarIcon,
  CalculatorIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon,
  ChartPieIcon,
  BookmarkSquareIcon,
  SwatchIcon,
  ArchiveBoxIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  BriefcaseIcon,
  HomeModernIcon,
  BuildingStorefrontIcon,
  CpuChipIcon,
  StarIcon,
  ClipboardDocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  ChatBubbleBottomCenterTextIcon,
  CurrencyPoundIcon,
  CameraIcon,
  MapPinIcon,
  WrenchIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline"

export const NAV_SECTIONS = [

  // ─────────────────────────────────────────────────────
  // AI — first-class AI toolset section
  // ─────────────────────────────────────────────────────
  {
    id: "ai",
    label: "AI Tools",
    icon: CpuChipIcon,
    title: "AI Tools",
    groups: [
      {
        label: "Deal Intelligence",
        items: [
          {
            label: "Deal Scorer",
            href: "/dashboard/ai/deal-scorer",
            icon: StarIcon,
            tooltip: "AI-powered 0–100 deal quality score across 9 signals: BMV, yield, flood risk, EPC, lease, motivation, photo condition, comparables and portal risk.",
          },
        ],
      },
      {
        label: "Due Diligence",
        items: [
          {
            label: "DD Checklist",
            href: "/dashboard/ai/due-diligence",
            icon: ClipboardDocumentCheckIcon,
            tooltip: "AI generates a tailored due diligence checklist per deal — flags leasehold traps, flood zone actions, corporate ownership red flags, and EPC obligations.",
          },
          {
            label: "Document Reader",
            href: "/dashboard/ai/document-reader",
            icon: DocumentMagnifyingGlassIcon,
            tooltip: "Drop any property document — title register, lease, management pack, surveyor report — and Claude extracts key dates, covenants, red flags, and charges.",
          },
        ],
      },
      {
        label: "Offer & Negotiation",
        items: [
          {
            label: "Negotiation Coach",
            href: "/dashboard/negotiate",
            icon: ChatBubbleBottomCenterTextIcon,
            tooltip: "AI negotiation command centre — Voss/Klaff/Dawson playbooks, objection handlers, round scripts, and Live Copilot. Paste the vendor's reply → get the exact response.",
          },
          {
            label: "Offer Analysis",
            href: "/dashboard/offer-analysis",
            icon: CurrencyPoundIcon,
            tooltip: "Goal-seek offer calculator — max purchase price for BRRR, BTL, and Flip strategies. Viability score, negotiation ladder, financial breakdown with bridging.",
          },
        ],
      },
      {
        label: "Property Analysis",
        items: [
          {
            label: "Refurb Estimator",
            href: "/dashboard/ai/refurb-estimator",
            icon: WrenchIcon,
            tooltip: "Claude Vision analyses property photos and estimates refurb costs by room and category — kitchen, bathrooms, damp, structural, windows, EPC improvements.",
          },
          {
            label: "Photo Analysis",
            href: "/dashboard/ai/photo-analysis",
            icon: CameraIcon,
            tooltip: "AI condition scoring from property photos — kerb appeal, room-by-room condition, flags (damp, structural, finish quality), and overall condition score.",
          },
          {
            label: "Area Intelligence",
            href: "/dashboard/ai/area-intelligence",
            icon: MapPinIcon,
            tooltip: "AI-generated investor area brief — rental demand, regeneration signals, crime trend, school catchments, HMO licensing, and comparable market context.",
          },
          {
            label: "Investor Matching",
            href: "/dashboard/ai/investor-matching",
            icon: UserPlusIcon,
            tooltip: "AI ranks your investor database by fit for each deal and drafts personalised email and SMS pitches — edit before sending.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────
  // INVEST
  // ─────────────────────────────────────────────────────
  {
    id: "invest",
    label: "Invest",
    icon: ChartBarIcon,
    title: "Invest",
    groups: [
      {
        label: "Pipeline",
        items: [
          { label: "Vendor Leads", href: "/dashboard/vendors", icon: FunnelIcon,    tooltip: "Manage vendor leads from your sourcing pipeline. Track conversations, offers, and pipeline stages" },
          { label: "Deals",        href: "/dashboard/deals",   icon: ChartBarIcon,  tooltip: "Curated investment deals ready for investors. Manage photos, packs, and reservations" },
        ],
      },
      {
        label: "Sourcing",
        items: [
          { label: "Property Finder",  href: "/dashboard/finder",  icon: HomeModernIcon,   tooltip: "Scan Rightmove, Zoopla, OnTheMarket and PrimeLocation for residential & commercial properties matching your buy criteria" },
          { label: "SSAS Analyser",    href: "/dashboard/ssas",    icon: BriefcaseIcon,    tooltip: "Analyse commercial property listings for SSAS pension investment — yield, DSCR, loan-back viability, and risk scoring" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────
  // MANAGE
  // ─────────────────────────────────────────────────────
  {
    id: "manage",
    label: "Manage",
    icon: Squares2X2Icon,
    title: "Manage",
    groups: [
      {
        label: "Overview",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: ChartPieIcon, tooltip: "Pipeline health, deal quality, investor reservations, and recent activity" },
        ],
      },
      {
        label: "Client Management",
        items: [
          { label: "Contacts", href: "/dashboard/contacts", icon: UserGroupIcon, tooltip: "Solicitors, estate agents, surveyors, and vendor contacts" },
        ],
      },
      {
        label: "Investors",
        items: [
          { label: "Investors",    href: "/dashboard/investors",       icon: UsersIcon,             tooltip: "Investor profiles with criteria, deal history, and communication log" },
          { label: "Reservations", href: "/dashboard/reservations",    icon: BookmarkSquareIcon,    tooltip: "Track investor deal reservations, fees, and completion status" },
          { label: "Packs",        href: "/dashboard/investors/packs", icon: DocumentDuplicateIcon, tooltip: "Create and send investor information packs for specific deals" },
        ],
      },
      {
        label: "Archive",
        items: [
          { label: "Archive", href: "/dashboard/archive", icon: ArchiveBoxIcon, tooltip: "Archived vendor leads and deals. Items can be restored at any time" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────
  // FINANCE — hidden until dedicated pages are built
  // TODO: restore when /dashboard/cashflow and /dashboard/payments are implemented
  // ─────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────────────
  {
    id: "admin",
    label: "Admin",
    icon: Cog6ToothIcon,
    title: "Admin",
    groups: [
      {
        label: "Admin",
        items: [
          { label: "Schedules",       href: "/dashboard/admin/schedules",    icon: CalendarDaysIcon },
          { label: "Users",           href: "/dashboard/admin/users",        icon: UsersIcon,      tooltip: "Add and manage team members (sourcers, admins). Set roles and permissions" },
          { label: "Sourcing Alerts", href: "/dashboard/sourcing-alerts",    icon: BellAlertIcon,  tooltip: "Set up automated alerts for new deals matching your investment criteria" },
        ],
      },
      {
        label: "Imports",
        items: [
          { label: "HM Land Registry", href: "/dashboard/settings/land-registry", icon: ArrowUpTrayIcon },
        ],
      },
      {
        label: "Settings",
        items: [
          { label: "Underwriting Engine",     href: "/dashboard/settings/offer-calculator",    icon: CalculatorIcon,                tooltip: "Configure offer thresholds: minimum BMV %, yield, refurb costs, and offer ladder strategy" },
          { label: "AI Conversation",         href: "/dashboard/settings/ai-conversation",    icon: ChatBubbleLeftRightIcon,       tooltip: "Control when the AI SMS agent auto-starts conversations per lead source" },
          { label: "Finder Settings",          href: "/dashboard/settings/finder",               icon: HomeModernIcon,        tooltip: "Configure portals, schedule, and search criteria for residential & commercial property scanning" },
          { label: "Investor Pack Templates", href: "/dashboard/settings/investor-packs",     icon: DocumentDuplicateIcon },
          { label: "Company Profile",         href: "/dashboard/settings/company-profile",    icon: BuildingOffice2Icon },
          { label: "Appearance",              href: "/dashboard/admin/appearance",            icon: SwatchIcon,                  tooltip: "Customise dashboard theme, colours, and company branding" },
        ],
      },
      {
        label: "Marketing",
        items: [
          { label: "Facebook Campaign", href: "/dashboard/admin/facebook-campaign", icon: MegaphoneIcon, tooltip: "Facebook Lead Ad campaign kit — ad designs, lead form setup, targeting guide, and webhook integration" },
        ],
      },
      {
        label: "Development",
        items: [
          { label: "Lead Simulator",    href: "/dashboard/admin/lead-test",          icon: BeakerIcon,            tooltip: "Create test leads to check system behaviour and validate offer calculations" },
          { label: "Scraper Debugger",  href: "/dashboard/settings/scraper-debug",   icon: WrenchScrewdriverIcon, tooltip: "Test any portal + category combination — see exact URLs, links found, and extracted property data" },
          { label: "Utilities",         href: "/dashboard/settings",                  icon: WrenchScrewdriverIcon },
          { label: "Email Test",        href: "/dashboard/settings",                  icon: EnvelopeIcon },
        ],
      },
    ],
  },

]

// Returns the NAV1 section id that owns the given pathname
export function getSectionIdFromPath(pathname: string): string {
  // Fast-path: /dashboard/ai/* always belongs to the AI section
  if (pathname.startsWith("/dashboard/ai") || pathname === "/dashboard/negotiate" || pathname === "/dashboard/offer-analysis") {
    return "ai"
  }
  for (const section of NAV_SECTIONS) {
    for (const group of section.groups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(item.href + "/")) {
          return section.id
        }
      }
    }
  }
  return NAV_SECTIONS[1].id // default: Invest (now index 1 since AI is 0)
}

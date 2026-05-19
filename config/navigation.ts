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
} from "@heroicons/react/24/outline"

export const NAV_SECTIONS = [

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
        label: "🧠 AI Coach",
        items: [
          {
            label: "Negotiation Coach",
            href: "/dashboard/negotiate",
            icon: SparklesIcon,
            tooltip: "AI-powered negotiation command centre — scripts, objection handlers, and live copilot for every active deal. Powered by Voss, Klaff & Dawson frameworks.",
          },
        ],
      },
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
          { label: "Scraper", href: "/dashboard/scraper", icon: MagnifyingGlassCircleIcon, tooltip: "Monitor Rightmove and Zoopla for newly listed properties matching your criteria" },
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
          { label: "Scraper Settings",        href: "/dashboard/settings/scraper",            icon: MagnifyingGlassCircleIcon },
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
          { label: "Lead Simulator", href: "/dashboard/admin/lead-test", icon: BeakerIcon,            tooltip: "Create test leads to check system behaviour and validate offer calculations" },
          { label: "Utilities",      href: "/dashboard/settings",         icon: WrenchScrewdriverIcon }, // TODO: dedicated utilities route
          { label: "Email Test",     href: "/dashboard/settings",         icon: EnvelopeIcon },          // TODO: dedicated email test route
        ],
      },
    ],
  },

]

// Returns the NAV1 section id that owns the given pathname
export function getSectionIdFromPath(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const group of section.groups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(item.href + "/")) {
          return section.id
        }
      }
    }
  }
  return NAV_SECTIONS[0].id // default: Invest
}

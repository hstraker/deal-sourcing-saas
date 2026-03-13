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
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  CurrencyPoundIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon,
  ChartPieIcon,
  BookmarkSquareIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  PresentationChartLineIcon,
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
        label: "Property Sourcing",
        items: [
          { label: "Vendor Leads", href: "/dashboard/vendors", icon: FunnelIcon },
          { label: "Scrappers",    href: "/dashboard/scraper", icon: MagnifyingGlassCircleIcon },
        ],
      },
      {
        label: "Property Analysis",
        items: [
          { label: "Deal Analysis",  href: "/dashboard/deals",             icon: ChartBarIcon },
          { label: "Offer Analysis", href: "/dashboard/offer-analysis",    icon: CalculatorIcon },
          { label: "Comparables",    href: "/dashboard/comparables",       icon: DocumentDuplicateIcon },
          { label: "Validation",     href: "/dashboard/validation",        icon: ClipboardDocumentCheckIcon },
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
          { label: "Statistics", href: "/dashboard/statistics",        icon: PresentationChartLineIcon },
          { label: "Dashboard",  href: "/dashboard",                   icon: ChartPieIcon },
          { label: "Activity",   href: "/dashboard/vendors/activity",  icon: ClockIcon },
        ],
      },
      {
        label: "Client Management",
        items: [
          { label: "Contacts", href: "/dashboard/contacts", icon: UserGroupIcon },
        ],
      },
      {
        label: "Vendors",
        items: [
          { label: "Leads",        href: "/dashboard/vendors",           icon: FunnelIcon },
          { label: "Board",        href: "/dashboard/vendors/board",     icon: Squares2X2Icon },
          { label: "Portal Check", href: "/dashboard/vendors/portal-check", icon: ShieldCheckIcon },
        ],
      },
      {
        label: "Investors",
        items: [
          { label: "Investors",    href: "/dashboard/investors",                icon: UsersIcon },
          { label: "Reservations", href: "/dashboard/reservations",             icon: BookmarkSquareIcon },
          { label: "Packs",        href: "/dashboard/investors/packs",  icon: DocumentDuplicateIcon },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────
  // FINANCE
  // ─────────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance",
    icon: CurrencyPoundIcon,
    title: "Finance",
    groups: [
      {
        label: "Finance",
        items: [
          { label: "Cashflow", href: "/dashboard/analytics", icon: ArrowTrendingUpIcon }, // TODO: dedicated cashflow route
          { label: "Payments", href: "/dashboard/analytics", icon: CreditCardIcon },      // TODO: dedicated payments route
        ],
      },
    ],
  },

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
          { label: "Users",           href: "/dashboard/admin/users",        icon: UsersIcon },
          { label: "Sourcing Alerts", href: "/dashboard/sourcing-alerts",    icon: BellAlertIcon },
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
          { label: "Underwriting Engine",     href: "/dashboard/settings/offer-calculator",  icon: CalculatorIcon },
          { label: "Scraper Settings",        href: "/dashboard/settings/scraper",            icon: MagnifyingGlassCircleIcon },
          { label: "Investor Pack Templates", href: "/dashboard/settings/investor-packs",     icon: DocumentDuplicateIcon },
          { label: "Company Profile",         href: "/dashboard/settings/company-profile",    icon: BuildingOffice2Icon },
        ],
      },
      {
        label: "Development",
        items: [
          { label: "Lead Simulator", href: "/dashboard/admin/lead-test", icon: BeakerIcon },
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

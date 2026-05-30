"use client"

/**
 * AIToolComingSoon — placeholder page for planned AI tools
 */

import {
  DocumentMagnifyingGlassIcon,
  WrenchIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline"

const ICON_MAP = {
  document: DocumentMagnifyingGlassIcon,
  wrench: WrenchIcon,
}

interface Props {
  title: string
  description: string
  icon: keyof typeof ICON_MAP
  eta: string
  capabilities: string[]
}

export function AIToolComingSoon({ title, description, icon, eta, capabilities }: Props) {
  const IconComponent = ICON_MAP[icon] ?? DocumentMagnifyingGlassIcon

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <IconComponent className="h-6 w-6 text-[#2563EB]" />
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ml-1 flex items-center gap-1">
            <ClockIcon className="h-3 w-3" /> {eta}
          </span>
        </div>
        <p className="text-sm text-gray-500 max-w-2xl">{description}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Planned capabilities</p>
        <ul className="space-y-3">
          {capabilities.map((cap, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircleIcon className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{cap}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

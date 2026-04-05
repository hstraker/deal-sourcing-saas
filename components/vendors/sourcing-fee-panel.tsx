"use client"

import { useState } from "react"
import { Save, TrendingUp, TrendingDown, PoundSterling, Users, FileText, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── helpers ───────────────────────────────────────────────────────────────────

function gbp(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n)
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, colour = "gray",
}: {
  label: string; value: string; sub?: string; colour?: "green" | "red" | "blue" | "gray"
}) {
  const cls = {
    green: "border-green-200 bg-green-50",
    red:   "border-red-200 bg-red-50",
    blue:  "border-blue-200 bg-blue-50",
    gray:  "border-gray-200 bg-gray-50",
  }[colour]
  const textCls = {
    green: "text-green-700",
    red:   "text-red-600",
    blue:  "text-blue-700",
    gray:  "text-gray-800",
  }[colour]

  return (
    <div className={cn("rounded-xl border p-3 text-center", cls)}>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={cn("text-lg font-extrabold leading-none", textCls)}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Form field ────────────────────────────────────────────────────────────────

function FieldRow({
  label, children, hint,
}: {
  label: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  )
}

function MoneyInput({
  value, onChange, placeholder = "0",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">£</span>
      <input
        type="number"
        min={0}
        className="w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 py-2 text-sm font-semibold text-gray-800 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SourcingFeeData {
  sourcingFee: string | number | null
  sourcingFeeType: string | null
  sourcingFeePercent: string | number | null
  coSourcingPartner: string | null
  coSourcingFeePercent: string | number | null
  acquisitionCostSurvey: string | number | null
  acquisitionCostLegal: string | number | null
  acquisitionCostMarketing: string | number | null
  acquisitionCostOther: string | number | null
  sourcingFeeInvoicedAt: string | null
  sourcingFeePaidAt: string | null
}

export interface SourcingFeePanelProps {
  leadId: string
  purchasePrice?: number | null
  data: SourcingFeeData
  onSaved?: (data: SourcingFeeData) => void
}

export function SourcingFeePanel({ leadId, purchasePrice, data, onSaved }: SourcingFeePanelProps) {
  const [form, setForm] = useState({
    sourcingFee:           String(data.sourcingFee ?? ""),
    sourcingFeeType:       data.sourcingFeeType ?? "fixed",
    sourcingFeePercent:    String(data.sourcingFeePercent ?? ""),
    coSourcingPartner:     data.coSourcingPartner ?? "",
    coSourcingFeePercent:  String(data.coSourcingFeePercent ?? ""),
    costSurvey:            String(data.acquisitionCostSurvey ?? ""),
    costLegal:             String(data.acquisitionCostLegal ?? ""),
    costMarketing:         String(data.acquisitionCostMarketing ?? ""),
    costOther:             String(data.acquisitionCostOther ?? ""),
    invoicedAt:            data.sourcingFeeInvoicedAt?.split("T")[0] ?? "",
    paidAt:                data.sourcingFeePaidAt?.split("T")[0] ?? "",
  })
  const [saving, setSaving] = useState(false)

  // Compute P&L
  const grossFee = form.sourcingFeeType === "percent" && purchasePrice && toNum(form.sourcingFeePercent)
    ? Math.round(purchasePrice * (toNum(form.sourcingFeePercent)! / 100))
    : toNum(form.sourcingFee) ?? 0

  const partnerCut = grossFee > 0 && toNum(form.coSourcingFeePercent)
    ? Math.round(grossFee * (toNum(form.coSourcingFeePercent)! / 100))
    : 0

  const netFee = grossFee - partnerCut

  const totalCosts =
    (toNum(form.costSurvey) ?? 0) +
    (toNum(form.costLegal) ?? 0) +
    (toNum(form.costMarketing) ?? 0) +
    (toNum(form.costOther) ?? 0)

  const netProfit = netFee - totalCosts
  const isInvoiced = !!form.invoicedAt
  const isPaid = !!form.paidAt

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        sourcingFee:              toNum(form.sourcingFee),
        sourcingFeeType:          form.sourcingFeeType,
        sourcingFeePercent:       toNum(form.sourcingFeePercent),
        coSourcingPartner:        form.coSourcingPartner || null,
        coSourcingFeePercent:     toNum(form.coSourcingFeePercent),
        acquisitionCostSurvey:    toNum(form.costSurvey),
        acquisitionCostLegal:     toNum(form.costLegal),
        acquisitionCostMarketing: toNum(form.costMarketing),
        acquisitionCostOther:     toNum(form.costOther),
        sourcingFeeInvoicedAt:    form.invoicedAt ? new Date(form.invoicedAt).toISOString() : null,
        sourcingFeePaidAt:        form.paidAt ? new Date(form.paidAt).toISOString() : null,
      }
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Sourcing fee saved")
      onSaved?.(body as unknown as SourcingFeeData)
    } catch {
      toast.error("Failed to save sourcing fee")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* P&L Summary cards */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          Deal P&L Summary
        </p>
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            label="Gross Fee"
            value={gbp(grossFee)}
            colour="blue"
          />
          <MetricCard
            label="Net Fee"
            sub={partnerCut > 0 ? `After ${gbp(partnerCut)} partner cut` : undefined}
            value={gbp(netFee)}
            colour="blue"
          />
          <MetricCard
            label="Net Profit"
            sub={totalCosts > 0 ? `After ${gbp(totalCosts)} costs` : undefined}
            value={gbp(netProfit)}
            colour={netProfit > 0 ? "green" : netProfit < 0 ? "red" : "gray"}
          />
        </div>

        {/* Fee status badges */}
        <div className="mt-2 flex gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
            isInvoiced ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
          )}>
            <FileText className="h-3 w-3" />
            {isInvoiced ? `Invoiced ${form.invoicedAt}` : "Not yet invoiced"}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
            isPaid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
          )}>
            <CheckCircle className="h-3 w-3" />
            {isPaid ? `Paid ${form.paidAt}` : "Fee not yet received"}
          </span>
        </div>
      </div>

      {/* Sourcing fee input */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Sourcing Fee</p>

        <div className="flex gap-2">
          <button
            className={cn("flex-1 rounded-lg py-2 text-xs font-semibold border transition-colors",
              form.sourcingFeeType === "fixed"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
            onClick={() => setForm(f => ({ ...f, sourcingFeeType: "fixed" }))}
          >
            Fixed Amount
          </button>
          <button
            className={cn("flex-1 rounded-lg py-2 text-xs font-semibold border transition-colors",
              form.sourcingFeeType === "percent"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
            onClick={() => setForm(f => ({ ...f, sourcingFeeType: "percent" }))}
          >
            % of Purchase
          </button>
        </div>

        {form.sourcingFeeType === "fixed" ? (
          <FieldRow label="Sourcing Fee" hint="Typically £3,000–£8,000">
            <MoneyInput value={form.sourcingFee} onChange={v => setForm(f => ({ ...f, sourcingFee: v }))} placeholder="5000" />
          </FieldRow>
        ) : (
          <FieldRow label="Fee as % of Purchase Price" hint={purchasePrice ? `= ${gbp(grossFee)} at ${purchasePrice ? gbp(purchasePrice) : "?"}` : "Enter purchase price first"}>
            <div className="relative">
              <input
                type="number" min={0} max={10} step={0.1}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 pr-7 py-2 text-sm font-semibold text-gray-800 focus:border-blue-400 focus:outline-none"
                value={form.sourcingFeePercent}
                onChange={e => setForm(f => ({ ...f, sourcingFeePercent: e.target.value }))}
                placeholder="2"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </FieldRow>
        )}
      </div>

      {/* Co-sourcing */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Co-Sourcing Split
        </p>
        <FieldRow label="Partner Name" hint="Leave blank if sole sourcing">
          <input
            type="text"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
            value={form.coSourcingPartner}
            onChange={e => setForm(f => ({ ...f, coSourcingPartner: e.target.value }))}
            placeholder="Partner company / individual"
          />
        </FieldRow>
        {form.coSourcingPartner && (
          <FieldRow label="Partner's % of Total Fee" hint={`= ${gbp(partnerCut)} to partner, ${gbp(netFee)} retained`}>
            <div className="relative">
              <input
                type="number" min={0} max={100}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 pr-7 py-2 text-sm font-semibold text-gray-800 focus:border-blue-400 focus:outline-none"
                value={form.coSourcingFeePercent}
                onChange={e => setForm(f => ({ ...f, coSourcingFeePercent: e.target.value }))}
                placeholder="30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </FieldRow>
        )}
      </div>

      {/* Associated costs */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Associated Costs
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Survey / Valuation">
            <MoneyInput value={form.costSurvey} onChange={v => setForm(f => ({ ...f, costSurvey: v }))} placeholder="600" />
          </FieldRow>
          <FieldRow label="Legal / Searches">
            <MoneyInput value={form.costLegal} onChange={v => setForm(f => ({ ...f, costLegal: v }))} placeholder="0" />
          </FieldRow>
          <FieldRow label="Marketing">
            <MoneyInput value={form.costMarketing} onChange={v => setForm(f => ({ ...f, costMarketing: v }))} placeholder="0" />
          </FieldRow>
          <FieldRow label="Other Costs">
            <MoneyInput value={form.costOther} onChange={v => setForm(f => ({ ...f, costOther: v }))} placeholder="0" />
          </FieldRow>
        </div>
        {totalCosts > 0 && (
          <div className="flex justify-between text-xs border-t border-gray-200 pt-2">
            <span className="text-gray-500">Total costs</span>
            <span className="font-bold text-gray-800">{gbp(totalCosts)}</span>
          </div>
        )}
      </div>

      {/* Invoice & payment tracking */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Fee Tracking
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Invoice Date">
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
              value={form.invoicedAt}
              onChange={e => setForm(f => ({ ...f, invoicedAt: e.target.value }))}
            />
          </FieldRow>
          <FieldRow label="Payment Received">
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
              value={form.paidAt}
              onChange={e => setForm(f => ({ ...f, paidAt: e.target.value }))}
            />
          </FieldRow>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save P&L Data"}
      </button>
    </div>
  )
}

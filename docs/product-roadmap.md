# Deal Sourcing SaaS — Product Roadmap

> Living document. Updated as features are implemented.
> Last reviewed: 6 April 2026

---

## How to Use This Document

Each feature has a **Status**, **Priority**, and **Category**.
Work through features top-to-bottom within each priority band.

**Status legend:**
- `🔲 Planned` — not started
- `🔄 In Progress` — currently being built
- `✅ Done` — shipped

---

## 🔴 Priority 1 — Critical (Revenue & Investor Impact)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | **Sourcing Fee & Deal P&L Tracker** | ✅ Done | `SourcingFeePanel` — fee, co-sourcing splits, net profit. Integrated as "Deal P&L" tab in vendor lead modal |
| 2 | **SDLT Calculator** | ✅ Done | `AcquisitionCostPanel` — standard, additional dwelling (+3%), first-time buyer, company rates. Integrated into validation modal |
| 3 | **All-In Cost of Acquisition** | ✅ Done | `AcquisitionCostPanel` — purchase + SDLT + solicitor + survey + bridging + insurance + refurb + contingency |
| 4 | **Conveyancing Pipeline** | 🔲 Planned | Post-offer-accepted tracker: solicitor instruction → searches → exchange → completion |
| 5 | **Investor Auto-Matching Engine** | ✅ Done | `InvestorMatchPanel` in Valuation tab — 5-criteria scoring (area/budget/BMV/yield/strategy), one-click notify, bulk notify, delivery tracking via pipeline events |

---

## 🟠 Priority 2 — High Impact (Operational)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6 | **Follow-Up Reminder System** | 🔲 Planned | Per-vendor scheduled follow-ups, dormant lead re-engagement queue (30/60/90 days) |
| 7 | **Refurb Tracker** | 🔲 Planned | Contractor management, room-by-room cost tracking, progress photos, actual vs estimate |
| 8 | **Deal Velocity & Performance Analytics** | 🔲 Planned | Days per pipeline stage, conversion rates, lead source attribution, cost per acquisition |
| 9 | **WhatsApp Integration** | ✅ Done | SMS/WA channel toggle in both AI conversation UIs, green WA banner, per-message channel tracking, unified Twilio webhook detects channel from `whatsapp:` prefix, `preferredChannel` stored on lead. Sandbox configured at app.habbits.co.uk |
| 10 | **Area Intelligence Dashboard** | 🔲 Planned | Crime stats, flood risk, school ratings, planning applications, house price trend per postcode |

---

## 🟡 Priority 3 — Medium Impact (Deal Quality)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | **Leasehold Red Flag System** | 🔲 Planned | Years remaining, ground rent, service charge, lease extension cost, auto-flag <85 years |
| 12 | **Mortgage Scenario Calculator** | 🔲 Planned | Current BTL rates, ICR stress test at 5.5%, monthly payment vs rent, cashflow |
| 13 | **HMO Potential Screener** | 🔲 Planned | Bedroom count → HMO flag, Article 4 check, room rate vs single-let comparison |
| 14 | **Vendor Re-Engagement Campaigns** | 🔲 Planned | Automated "checking in" SMS at 30/60/90 days, price reduction triggers |
| 15 | **Exit Data Tracker (Actual vs Projected)** | 🔲 Planned | Record actuals post-completion: purchase, refurb, rent achieved, refinance value |

---

## 🔵 Priority 4 — Investor Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 16 | **Investor Portal (Public-Facing)** | 🔲 Planned | Investor login, live available deals, self-serve pack download, one-click reservation |
| 17 | **Investor KYC/AML Compliance** | 🔲 Planned | AML check status, KYC document vault, source of funds declaration, risk score |
| 18 | **Investor Tier Management** | 🔲 Planned | VIP/Preferred/Standard tiers, deal release schedule, exclusivity windows |
| 19 | **Investor Portfolio Tracker** | 🔲 Planned | Properties owned via your deals, rental income, capital deployed, total return |

---

## ⚪ Priority 5 — Tools & Compliance

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 20 | **Bridging Finance Calculator** | 🔲 Planned | Loan amount, LTV, monthly rate, arrangement fee, exit fee, total cost of bridge |
| 21 | **Sourcing Alert Intelligence** | 🔲 Planned | Price reduction alerts, long time on market alerts, combined signal lead quality score |
| 22 | **Comparable Sales Heat Map** | 🔲 Planned | Geographic view of deals, average discount % by area, yield by postcode |
| 23 | **Deal Room / Deal Board** | 🔲 Planned | Public/semi-public page for investors, available deals (no address), urgency signals |
| 24 | **Referral Partner Management** | 🔲 Planned | Estate agents who refer leads, commission agreements, performance tracking |
| 25 | **Compliance Dashboard** | 🔲 Planned | TPO membership, AML, GDPR consent records, sourcing agreements, DNC registry |

---

## ✅ Already Built (Reference)

| Feature | Notes |
|---------|-------|
| Vendor SMS Pipeline + AI Conversations | Claude AI agent, Twilio SMS/WhatsApp, inbound webhook, live polling |
| WhatsApp Channel | SMS/WA toggle on both conversation UIs, per-message channel tracking, sandbox configured |
| BMV Validation Engine | Comparable sales, rental yield, strategy comparison, sourcer summary |
| Strategy Comparison (BTL/Flip/BRRR/B&H) | Per-strategy Max Viable Price, viability with tooltips |
| Sourcing Fee & Deal P&L | `SourcingFeePanel` — fee, co-sourcing splits, net profit, integrated as Deal P&L tab |
| SDLT + Acquisition Costs | `AcquisitionCostPanel` — all buyer types, all-in cost breakdown, integrated into validation modal |
| Investor Auto-Matching | `InvestorMatchPanel` — 5-criteria match scoring, one-click notify, bulk notify, delivery log |
| Portal Check (Rightmove/Zoopla) | Live listing check, risk flags |
| Property Scraper | Rightmove, Zoopla, OnTheMarket automated scraping |
| Investor Pack Generation | PDF templates, delivery tracking |
| Investor Management | Profiles, criteria, reservations |
| Land Registry Integration | Ownership data, price paid history |
| Comparable Properties | PropertyData API fetch, stored comparables |
| Deal Pipeline | Kanban + table views, stage management |
| Facebook Lead Ads | Webhook integration, lead sync |
| Team Management | Multi-user, role-based access |
| Sourcing Alerts | Saved searches, email/SMS notifications |

---

## Implementation Notes

### SDLT Rates (as of April 2026)

**Standard residential (main home):**
| Band | Rate |
|------|------|
| £0 – £250,000 | 0% |
| £250,001 – £925,000 | 5% |
| £925,001 – £1,500,000 | 10% |
| Over £1,500,000 | 12% |

**Additional dwelling / BTL / company (+3% surcharge on each band):**
| Band | Rate |
|------|------|
| £0 – £250,000 | 3% |
| £250,001 – £925,000 | 8% |
| £925,001 – £1,500,000 | 13% |
| Over £1,500,000 | 15% |

**First-time buyer relief:**
| Band | Rate |
|------|------|
| £0 – £425,000 | 0% |
| £425,001 – £625,000 | 5% |
| Over £625,000 | Standard rates (no relief) |

### Sourcing Fee Typical Ranges
- Standard deal fee: £3,000 – £8,000
- As % of purchase: 1.5% – 3%
- Co-sourcing partner split: 20% – 50% of fee
- Typical investor reservation fee: £500 – £2,000 (credited against sourcing fee)

### All-In Cost Components
1. Purchase price (agreed)
2. SDLT (calculated)
3. Solicitor / conveyancing fees (£1,500 – £3,000)
4. Survey (£400 – £1,500 depending on type)
5. Bridging finance costs (if used)
6. Buildings insurance (first year)
7. Refurbishment costs
8. Contingency (5–10% of refurb)

---

## 📋 Session Changelog

### 6 April 2026 — Session 2
**Completed:**
- ✅ Integrated `SourcingFeePanel` into vendor lead detail modal as new "Deal P&L" tab (6th tab)
- ✅ Integrated `AcquisitionCostPanel` (SDLT + all-in costs) into validation modal right panel
- ✅ Fixed `sourcing-fee-panel.tsx` API call from PUT → PATCH
- ✅ Applied 16-column DB migration for sourcing fee + acquisition cost fields (via raw SQL + `prisma migrate resolve`)
- ✅ Built `InvestorMatchPanel` — lazy-load, 5-criteria scoring, colour-coded badges, one-click notify, bulk notify ≥60%, delivery tracking via pipeline events
- ✅ Built `/api/vendor-pipeline/leads/[id]/matching-investors` — GET endpoint with strategy parsing from validation notes
- ✅ Built `/api/vendor-pipeline/leads/[id]/notify-investor` — POST endpoint logging `investor_notified` to pipeline events
- ✅ Added WhatsApp channel support to Twilio service, AI SMS agent, webhook, send-message and start-conversation APIs
- ✅ Added SMS/WA toggle to `ai-conversation-tab.tsx` (vendor detail modal — Outreach tab)
- ✅ Added SMS/WA toggle, start conversation button, and WhatsApp banner to `ai-conversation-modal.tsx` (table row popup)
- ✅ Applied WhatsApp DB migration (`channel` on sms_messages, `preferred_channel` on vendor_leads)
- ✅ Configured Twilio WhatsApp sandbox webhook at `https://app.habbits.co.uk/api/vendor-pipeline/webhook/sms`
- ✅ Ran `prisma generate` to fix "Unknown argument channel" error

**Next up (Priority order):**
1. **#4 Conveyancing Pipeline** — post-offer-accepted stage tracker
2. **#6 Follow-Up Reminder System** — scheduled follow-ups, dormant lead re-engagement
3. **#7 Refurb Tracker** — contractor management, room-by-room costs, actual vs estimate
4. **#8 Deal Velocity Analytics** — days per stage, conversion rates, lead source attribution
5. **#10 Area Intelligence Dashboard** — crime, flood risk, schools, planning apps per postcode

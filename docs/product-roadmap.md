# Deal Sourcing SaaS — Product Roadmap

> Living document. Updated as features are implemented.
> Last reviewed: April 2026

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
| 1 | **Sourcing Fee & Deal P&L Tracker** | 🔄 In Progress | Sourcing fee, co-sourcing splits, associated costs, net profit per deal |
| 2 | **SDLT Calculator** | 🔄 In Progress | Built into every deal. Standard, additional dwelling (3%), company, first-time buyer rates |
| 3 | **All-In Cost of Acquisition** | 🔄 In Progress | Purchase + SDLT + solicitor + survey + bridging + insurance + refurb = total cash required |
| 4 | **Conveyancing Pipeline** | 🔲 Planned | Post-offer-accepted tracker: solicitor instruction → searches → exchange → completion |
| 5 | **Investor Auto-Matching Engine** | 🔲 Planned | Auto-match validated deals to investor criteria, one-click notify matched investors |

---

## 🟠 Priority 2 — High Impact (Operational)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6 | **Follow-Up Reminder System** | 🔲 Planned | Per-vendor scheduled follow-ups, dormant lead re-engagement queue (30/60/90 days) |
| 7 | **Refurb Tracker** | 🔲 Planned | Contractor management, room-by-room cost tracking, progress photos, actual vs estimate |
| 8 | **Deal Velocity & Performance Analytics** | 🔲 Planned | Days per pipeline stage, conversion rates, lead source attribution, cost per acquisition |
| 9 | **WhatsApp Integration** | 🔲 Planned | WhatsApp channel alongside SMS for AI conversations (Meta Business API) |
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
| Vendor SMS Pipeline + AI Conversations | Claude AI agent, Twilio SMS, inbound webhook |
| BMV Validation Engine | Comparable sales, rental yield, strategy comparison, sourcer summary |
| Strategy Comparison (BTL/Flip/BRRR/B&H) | Per-strategy Max Viable Price, viability with tooltips |
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

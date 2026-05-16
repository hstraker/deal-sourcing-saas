# App Review — Property Investor & Deal Sourcer Perspective

**Reviewed:** 2026-05-15  
**Reviewer lens:** Experienced UK property investor (BTL, BRRR, flip) + active deal sourcer

---

## Executive Summary

The platform has a genuinely impressive technical foundation. The auto-pipeline (AI SMS → portal check → comparables → BMV/validation → investor matching) is more sophisticated than most commercial tools at this price point. The offer engine using goal-seek binary search to work backward from required ROCE/profit-on-cost to a maximum purchase price is excellent — this is how professional underwriters actually think.

However, there are meaningful gaps between what the engine calculates and what a sourcer or investor can *act on* from the UI. The data is there; it's the surfacing, packaging, and workflow that needs work.

---

## ✅ What's Working Well

| Area | Strength |
|------|----------|
| AI SMS pipeline | Automated vendor conversation + objection handling — saves hours per week |
| BMV calculation | Goal-seek flip/hold ceiling is methodologically correct |
| Comparables | Auto-fetch with confidence scoring and rental data is solid |
| Portal check | Ownership, tenure, listing status, corporate/overseas flag all in one step |
| Photo AI | Condition scoring from photos → refurb estimate is a genuine differentiator |
| Offer scorecard | Traffic-light ScorecardRow with expandable detail is clean UX |
| Investor matching | Score-based match panel with one-click notify is well designed |
| Reservation workflow | Multi-stage pipeline (PoF → Lock-out → Completed) is thorough |

---

## 🔴 Critical Gaps (Revenue / Deal Quality Impact)

### 1. No Investor-Facing Portal
**Problem:** The schema has `UserRole.investor`, `Investor`, `Purchase`, `DealView`, and `Favorite` models — but there are no investor-facing pages (`/investor/*`). Investors can't browse, save, or purchase deals themselves.

**Impact:** The entire B2C monetisation model (£3–5k per deal) is blocked. Everything currently relies on manual pack delivery via email.

**Fix:** Build `/investor/marketplace`, `/investor/deals/[id]`, and `/investor/purchases` pages. Most of the API surface already exists.

---

### 2. No Formal Offer Letter Generation
**Problem:** The system calculates an offer price and tracks offer/retry rounds, but there's no way to generate a formal written offer letter. Vendors and solicitors need a paper trail.

**Impact:** Sourcers have to manually write offer letters in Word, breaking the workflow and creating version control problems.

**Fix:** A one-click "Generate Offer Letter" button on the vendor lead detail that populates a template with: vendor name, property address, offer price, conditions (subject to survey, vacant possession, etc.), and company details from the company profile.

---

### 3. No Deal Notes / Internal Memo System
**Problem:** There's a pipeline event log but no free-text notes on vendor leads. If a sourcer calls a vendor and learns the roof needs replacing, there's nowhere to record this.

**Impact:** Information lives in WhatsApp/email outside the platform. Team handovers lose context.

**Fix:** A `notes` field or a threaded `LeadNote` model (user, timestamp, content) surfaced as a Notes tab or sidebar on the vendor lead modal.

---

### 4. Refurb Cost is a Single Number
**Problem:** `estimatedRefurbishmentCost` is one decimal field. Investors and sourcers need to know *where* that number comes from — kitchen, bathroom, roof, damp, wiring, etc.

**Impact:** 
- Investors don't trust a refurb figure with no breakdown
- It's impossible to update one trade without recalculating everything
- The photo AI gives a condition score but it doesn't map to a line-item refurb schedule

**Fix:** Add a `RefurbLineItem` table (category, description, estimatedCost) linked to VendorLead. Surface as a collapsible cost builder in the deal modal, with a "Generate from AI photo score" button that pre-populates typical costs by condition grade.

---

### 5. No Post-Completion Feedback Loop
**Problem:** Once a reservation hits "completed" status, the platform knows nothing about what happened next. Did the investor actually buy the property? At what price? What was the real yield?

**Impact:**
- Can't prove ROI to future investors with real case studies
- Can't identify which deal types and areas produce the best outcomes
- Can't track which sourcers generate the most successful deals

**Fix:** Add a `DealOutcome` record linked to the reservation: `investorProceeded (bool)`, `actualPurchasePrice`, `actualCompletionDate`, `actualRentalYield`, `investorFeedbackRating (1-5)`, `testimonialText`. Trigger a follow-up email 6 weeks after lock-out completion.

---

## 🟡 High-Priority Improvements (Sourcer Efficiency)

### 6. WhatsApp Not Supported
**Problem:** The AI conversation uses Twilio SMS. In the UK, most vendors over 40 don't respond to texts from unknown numbers — they respond to WhatsApp.

**Impact:** Lower response rates from vendors, especially for inheritance/downsizing sellers (typically older demographics who prefer WhatsApp).

**Fix:** Integrate Twilio WhatsApp Business API or 360Dialog. The conversation engine and webhook architecture are already in place — it's a channel addition, not a rebuild.

---

### 7. No Human Handover for AI Conversations
**Problem:** Once the AI starts a conversation, there's no clean way for a sourcer to "take over" the conversation in real time. The sourcer can see the messages in the AI Conversation tab but can't inject a manual message that feels seamless.

**Impact:** When a vendor says something the AI mishandles (e.g. "my solicitor says we can't sell for less than £X"), the sourcer has to contact the vendor on a different channel, which breaks continuity.

**Fix:** Add a "Take Over Conversation" button that:
1. Pauses AI responses for this lead
2. Enables a manual "Send Message" input in the conversation panel
3. Shows a banner to the vendor: nothing changes (all from the same number)
4. Adds a "Resume AI" button when the sourcer is done

---

### 8. No EPC Auto-Fetch
**Problem:** `epcRating` and `epcScore` fields exist on VendorLead but there's no automatic EPC lookup. It appears to be filled manually or left blank.

**Impact:** EPC is critical for mortgage-ability (many BTL lenders now require C or above) and the minimum efficiency standards (MES) legislation. A blank EPC field means the validation engine can't flag this risk.

**Fix:** The EPC Register has a free API (api.epb.govt.uk). On lead creation or postcode validation, auto-query by address/postcode and store the result. Flag properties with EPC D or below as "mortgage risk" in the validation scorecard.

---

### 9. No Flood Risk / Mining Subsidence Check
**Problem:** A property with AA-rated BMV and yield figures can be unmortgageable if it's in a Flood Zone 3 or in a coal mining area. This isn't checked anywhere.

**Impact:** Sourcers can spend hours packaging a deal that no lender will touch.

**Fix:** Integrate the Environment Agency flood risk API (free, public) to flag Zone 2/3 properties in the portal check phase. Add a "Flood Risk" row to the portal check results with a link to the GOV.UK flood map. Similar lookup for coalfields via the Coal Authority API.

---

### 10. Manual Comparables Only — No Exclude/Adjust
**Problem:** The auto-fetch pulls 10 comps from PropertyData. If one of them is a fire-damaged sale that skews the average down, there's no way to exclude it without deleting and re-fetching everything.

**Impact:** The market value calculation — which everything else flows from — can be distorted by one bad comp.

**Fix:** Add a per-comparable `excluded (bool)` flag and `adjustedPrice (Decimal?)` field. The BMV engine should use `excluded=false` comps only when calculating `avgComparablePrice`. Surface this as checkboxes and an "Adjust Price" inline edit in the Comparables tab.

---

### 11. No Auction Properties Workflow
**Problem:** Many BMV deals come from auction (Allsop, Savills, SDL, iamsold). Auctions have fundamentally different timelines — 28-day completion, guide price vs reserve, auction date — none of which the current schema supports.

**Impact:** Sourcers who work auction leads have to hack the fields or use a separate system.

**Fix:** Add auction-specific fields to VendorLead: `isAuction (bool)`, `auctionDate`, `guidePriceMin`, `guidePriceMax`, `reservePrice`, `auctionHouse`. Add a pipeline stage `AUCTION_MONITORING`. The sourcing alerts system should trigger reminders at 7/3/1 day before auction.

---

### 12. No Deal Score / Lead Score Displayed on the Table
**Problem:** The `Deal` model has a `dealScore (Int?)` field but VendorLead doesn't have a visible aggregate score. The validation scorecard has pass/fail/negotiate status per criterion but no single "how good is this deal overall" number.

**Impact:** Sourcers can't quickly rank leads in the table. When 50 leads are in the validation stage, there's no way to see at a glance which ones are hottest.

**Fix:** Compute a `dealScore` (0-100) on VendorLead from: BMV% (40 pts), gross yield (20 pts), vendor motivation score (20 pts), comparables confidence (10 pts), property condition (10 pts). Show it as a colour-coded badge in the Validation and Offer Analysis tabs.

---

## 🟠 Medium-Priority (Investor Experience & Pack Quality)

### 13. No Stamp Duty Breakdown Shown to Sourcer
**Problem:** The offer engine calculates stamp duty internally but it's not surfaced in any UI. A sourcer sending an offer to a vendor or investor needs to show the full cost breakdown.

**Impact:** Investors frequently ask "what are the purchase costs?" The sourcer has to calculate this separately.

**Fix:** Add a "Purchase Costs" section in the Offer Analysis modal showing: asking price, SDLT (with breakdown at each band), solicitor fees, survey, total acquisition cost, and the resulting effective % premium on top of the headline price.

---

### 14. No Cash vs Mortgage Comparison
**Problem:** The offer engine runs one scenario (bridging → exit mortgage). Cash buyers see the same numbers as mortgage buyers, which are meaningless to them.

**Impact:** Many investors on the platform will be cash buyers or bond/pension fund-backed — they need to see simple cash-on-cash returns, not ROCE with mortgage interest.

**Fix:** Add a toggle in the Offer Analysis tab: "Cash Purchase" / "Mortgage Purchase". In cash mode, suppress all bridging/mortgage costs and show: total cash required, annual net cashflow, and simple cash yield.

---

### 15. No Google Street View Integration
**Problem:** Sourcers often want to "drive by" a property without leaving their desk before committing time to it. The map modal shows a pin but no street view.

**Impact:** Sourcers miss obvious red flags: boarded-up houses next door, commercial units on the same terrace, electricity substation across the road.

**Fix:** Embed a Google Maps Street View iframe in the map modal using the property coordinates. The Maps JavaScript API costs ~$0.007 per load.

---

### 16. No Area Demand / Days on Market Benchmark
**Problem:** The comparables show individual sale dates but there's no "how long does a property of this type typically sit on the market in this area" figure.

**Impact:** Investors can't assess liquidity risk — how quickly could they sell if they needed to exit?

**Fix:** PropertyData has a `/demand` endpoint returning average days on market and stock levels by postcode. Pull this alongside comparables and surface it in the Comparable tab as "Area demand: X days avg time to sell, Y months stock."

---

### 17. AI-Generated Deal Summary Missing
**Problem:** When all the data is in — BMV, yield, comparables, photo condition, vendor motivation — there's no AI-generated plain-English summary a sourcer can use as the opening paragraph of the investor pack.

**Impact:** Sourcers still have to write "why this is a good deal" from scratch for every pack.

**Fix:** Add a "Generate Deal Summary" button in the investor pack section. Send the key metrics to the Anthropic API (already configured) with a prompt like: "Write a 3-paragraph investment case for a property investor. Highlight the discount to market value, income potential, and exit strategy options. Tone: professional but direct." Display the result as an editable text field in the pack template.

---

### 18. No Floorplan Upload or Viewer
**Problem:** The project brief explicitly includes floorplan as a document type. The `DocumentType` enum has `floorplan`. But there's no UI for uploading or viewing a floorplan attached to a vendor lead.

**Impact:** Investors buying deals blind (pre-viewing) heavily rely on floorplans to assess room sizes and layout. Without one, deal packs look incomplete.

**Fix:** Add a floorplan upload section in the Photos/Documents area of the vendor lead modal. Store in S3 with `documentType: "floorplan"`. Render as a zoomable image viewer (not PDF) for quick inspection.

---

### 19. No Multi-Currency / Multi-Region (Minor)
**Problem:** All figures are hard-coded as GBP with `£` prefix throughout. 

**Fix:** Low priority, but worth storing `currency: "GBP"` on Company Profile now so it's not hardcoded into every component if expansion happens.

---

## 🔵 Quick Wins (Low Effort, High Value)

### 20. Lead Age Indicator
Add a "Days since created" badge on each lead row. A lead that's been in AI_CONVERSATION for 21 days without progressing is dead. This is a 5-minute addition to the table.

### 21. Bulk SMS Blast to Matched Investors
When a lead hits `READY_FOR_INVESTORS`, allow a one-click SMS/email to all matched investors. The matching engine exists, the notification exists, but it requires clicking into each lead and hitting "Notify" individually.

### 22. Export to CSV
Add a CSV export button to the vendor leads table. Sourcers regularly need to hand leads off to external teams or create reports for clients. The `/api/vendor-pipeline/export` route exists — just needs a download button in the UI.

### 23. Pipeline Stage History Timeline
Show the full stage history for a lead (date entered each stage, how long spent there). This exists in `PipelineEvent` but isn't visualised as a timeline on the lead detail modal.

### 24. Vendor Name / Phone Duplicate Detection
When adding a new lead, check if the phone number or address already exists in the database. Duplicates waste significant time — a vendor contacted twice by the AI system is a serious credibility issue.

### 25. Sourcer Commission Tracker
Add a `sourcingFeeTarget (Decimal)` and `sourcingFeeReceived (Decimal)` to VendorLead. When a deal completes with investors, record the sourcing fee earned. Surface a personal earnings dashboard for sourcers — this is a strong retention feature.

### 26. One-Click "Mark as Dead" with Reason
Currently archiving a lead requires confirming a dialog. Add a right-click context menu on the lead row with quick-select dead reasons: "Vendor not motivated", "Price too high", "Failed survey", "Mortgage issues", "Vendor withdrew". This data is valuable for analytics on why deals fall through.

### 27. Rightmove/Zoopla Listing Link Auto-Pop
If the portal check finds an active listing URL, display it as a clickable icon in the lead table row — not just inside the portal check modal. Sourcers want to jump straight to the listing without opening the full modal.

---

## 📊 Analytics Gaps

The current analytics page shows workflow conversion rates (contacted → validated → offer → accepted) but is missing:

| Missing Metric | Why It Matters |
|----------------|----------------|
| Average BMV% by postcode | Identify which areas produce the best deals |
| Lead-to-deal conversion by source (Facebook, manual, scraper) | Optimise lead acquisition spend |
| Revenue per sourcer | Performance management |
| Time to package (lead created → ready for investors) | Identify bottlenecks |
| Investor repeat purchase rate | Measure buyer satisfaction |
| Deal price reductions (% of asking achieved) | Negotiation team effectiveness |
| Comparables confidence distribution | Data quality monitoring |
| Photo AI score distribution | Understand portfolio condition profile |

---

## 🏗️ Structural / Architecture Notes

### Database: Missing Indexes Likely
VendorLead queries filter by `pipelineStage`, `processingStatus`, `validationPassed`, and `propertyPostcode` constantly. Ensure these have DB indexes. The schema file doesn't show explicit `@@index` annotations on VendorLead beyond the implicit primary key.

### Auto-Trigger Timeout Risk
`runVendorLeadAutoTriggers` now runs portal check + comparables + BMV sequentially in one HTTP request chain. If PropertyData is slow (they rate-limit), this could timeout. Consider moving to a proper job queue (BullMQ + Redis, or a simple `vendor_jobs` table with a polling worker) for production resilience.

### Stripe Not Wired
The `.env` has `STRIPE_SECRET_KEY="sk_test_..."` — placeholder only. The entire payment flow for investors purchasing deals (the primary revenue model) is not live. This should be Priority 1 alongside the investor portal.

---

## Shipped — Implementation Log

| Date | Feature | Notes |
|------|---------|-------|
| 2026-05-16 | **Re-run Pipeline button** | One-click portal → comps → BMV re-trigger on any lead row |
| 2026-05-16 | **Comp exclude/adjust** | Eye-toggle on each comparable row to exclude from avg; price override in expanded panel; avg recomputes instantly |
| 2026-05-16 | **Lead notes / memo system** | Notes tab (tab 8) in lead modal; threaded notes with edit/delete, author-gated, Ctrl+Enter to submit |
| 2026-05-16 | **Deal score badge** | 0-100 composite score (BMV 40 + yield 20 + motivation 20 + comps 10 + condition 10); colour-coded pill in Validation + Offer Analysis tabs |
| 2026-05-16 | **Cash vs mortgage toggle** | Toggle in Offer Analysis header; cash mode shows total cash in, gross/net yield, cashflow, payback — no ICR/bridging |
| 2026-05-16 | **Formal offer letter** | GET `/api/vendor-leads/[id]/offer-letter` returns print-ready HTML; includes SDLT breakdown, standard conditions, company branding; "Offer Letter" button in modal toolbar |

---

## Priority Order — Remaining

| Priority | Feature | Est. Effort | Revenue Impact |
|----------|---------|------------|----------------|
| 🔴 1 | Investor-facing portal (marketplace + purchase) | 3–4 days | Very High — unblocks B2C revenue |
| 🔴 2 | Stripe payment integration | 1 day | Very High |
| 🔴 3 | EPC auto-fetch | 0.5 day | High (mortgage risk flagging) |
| 🟡 4 | Human AI handover ("Take Over") | 0.5 day | High |
| 🟡 5 | Refurb line-item breakdown | 1 day | High (investor trust) |
| 🟠 6 | AI-generated deal summary | 0.5 day | Medium (pack quality) |
| 🟠 7 | Flood risk check | 1 day | Medium (deal qualification) |
| 🟠 8 | Floorplan upload | 0.5 day | Medium (pack completeness) |
| 🔵 9 | Bulk investor SMS | 0.5 day | Medium |
| 🔵 10 | Duplicate phone/address detection | 0.5 day | Low-Medium |
| 🔵 11 | Post-completion feedback loop | 1 day | Low (long-term) |
| 🔵 12 | Auction workflow | 2 days | Low (niche) |
| 🔵 13 | Street view in map modal | 0.5 day | Low |

---

*Last updated 2026-05-16 after Sprint 1 + Sprint 2. Original review: 2026-05-15.*

# Feature Status & Roadmap

## ✅ Currently Implemented (Phase 1 MVP)

### Manual Deal Entry & Calculations
- ✅ Deal creation form with manual data entry
- ✅ Auto-calculation of metrics from manually entered data:
  - BMV% (when Market Value provided)
  - Gross Yield (when Monthly Rent provided)
  - Net Yield (calculated with 15% cost estimate)
  - ROI/ROCE (when refurb data available)
  - Deal Score (0-100) based on multiple factors
  - Pack Tier & Price (auto-determined by score)
- ✅ Deal CRUD operations (Create, Read, Update, Delete)
  - ✅ Create new deals with form
  - ✅ View deals in list and detail pages
  - ✅ Edit existing deals
  - ✅ Delete deals (admin only) with confirmation dialog
- ✅ Deal list and detail views
- ✅ Real-time metrics preview in form

**How it works now:**
- You manually enter: Address, Asking Price, Market Value, Monthly Rent, etc.
- System calculates: BMV%, Yield, Deal Score automatically
- All calculations are based on your manual inputs

---

## 🔜 Coming Later (Not Yet Implemented)

### PropertyData API Integration (Phase 1 - Optional / Later Phase)
**Purpose:** Auto-fetch property data to enrich deals automatically

**When Implemented, Will:**
- Auto-fetch property details when address/postcode entered:
  - Bedrooms, bathrooms, square feet
  - Property type
  - Market value estimate
  - EPC rating
  - Historical sales data
- Find comparable sales automatically
- Get rental yield estimates for the area
- Reduce manual data entry

**Status:** Not implemented yet - marked as "Priority: Low - Optional for MVP" in Phase 1

**To Use When Available:**
1. Enter address/postcode
2. Click "Fetch Property Data" button
3. System calls PropertyData API
4. Fields auto-populate with real data
5. Metrics calculate automatically

---

### Rightmove Scraper / Integration
**Purpose:** Auto-source deals from Rightmove listings

**When Implemented, Will:**
- Scheduled daily searches (8am)
- Search Rightmove for properties matching criteria:
  - Postcodes: SA11, SA12, CF24, etc.
  - Min BMV: 15%
  - Min Yield: 8%
  - Property types: terraced, semi, detached
- Auto-flag high-potential deals (score 70+)
- De-duplicate properties
- Auto-create deals in system

**Status:** Not implemented yet - this is more advanced and may come in Phase 2 or later

**Note:** Web scraping Rightmove has legal/ToS considerations. You may need:
- Official API access (if available)
- Or use PropertyData API which aggregates data from multiple sources
- Or manual entry for now (current approach)

---

## 📊 Current Calculation Method

Right now, metrics are calculated using:

1. **Manual Inputs:**
   - Address, Asking Price (required)
   - Market Value, Monthly Rent, Refurb Cost (optional but needed for metrics)

2. **Auto-Calculations:**
   - BMV% = `((Market Value - Asking Price) / Market Value) × 100`
   - Gross Yield = `(Annual Rent / Asking Price) × 100`
   - Net Yield = `((Annual Rent - Costs) / Asking Price) × 100`
   - Deal Score = Weighted algorithm (BMV 30%, Yield 25%, Condition 15%, Location 15%, Price 10%, Other 5%)

3. **Real-time Preview:**
   - As you type, metrics update in the preview card
   - Shows what's calculated vs. what's missing

---

## 🎯 Recommended Workflow (Current)

**For Phase 1 MVP, use this workflow:**

1. **Find deals manually** (Rightmove, local agents, etc.)
2. **Create deal in system:**
   - Enter address and asking price (minimum required)
   - Research and add Market Value
   - Research and add Estimated Monthly Rent
   - Add refurb costs if known
3. **Metrics auto-calculate** based on your inputs
4. **Review Deal Score** - aim for 70+ for good deals
5. **Complete deal packaging** (coming in Phase 2)

---

## 🚀 Future Enhancements

When PropertyData API is integrated:

1. **One-click enrichment:**
   - Enter address → Auto-fetch all details
   - Comparable sales found automatically
   - Market value estimated
   - Rental yield estimated for area

2. **Automated sourcing:**
   - Daily cron job searches for deals
   - Filters by criteria (BMV 15%+, Yield 8%+)
   - Auto-creates deals with high scores
   - Team reviews flagged deals

3. **Better accuracy:**
   - Real market data vs. manual estimates
   - Historical sales data
   - Area rental statistics
   - Property condition data

---

## 📝 To Implement PropertyData API (Later)

When ready, you'll need:

1. PropertyData API key (get from https://propertydata.co.uk)
2. Create `/lib/propertydata.ts` client
3. Create `/app/api/propertydata/route.ts` endpoint
4. Add "Fetch Property Data" button to deal form
5. Cache results aggressively (2,000 credits/month limit)
6. Store fetched data in database

**Cost:** PropertyData API is paid - you'll need to check their pricing

---

**Current Status:** All metrics work perfectly with manual data entry. PropertyData API integration will make it faster, but isn't required for Phase 1 MVP! ✅


# Property Scraping System - Claude Code Implementation

## Context

I'm building a property sourcing SaaS platform in Next.js 14+ with TypeScript, Prisma, and PostgreSQL. I need to add a web scraping system that:

- Scrapes **Rightmove, Zoopla, and OnTheMarket** for property listings
- Handles **both residential AND commercial** properties
- Runs **twice daily** (6 AM and 6 PM)
- Integrates with my existing **PropertyData API** and **Claude API**
- Includes a **manual review queue** for ambiguous BMV properties
- Has **export functionality** (CSV/Excel/JSON)
- Provides a **settings UI** to toggle auto-analysis on/off

## My Current Stack

- Next.js 14+ with TypeScript
- Prisma ORM with PostgreSQL
- Docker containers in Windows WSL
- Claude API for property analysis
- PropertyData.co.uk API for valuations
- Existing vendor acquisition and investor matching systems

## Important Background Information

### What Are Proxy Services? (I'm Not Sure About This)

Proxy services route scraping requests through different IP addresses to avoid detection:
- **Why needed**: Websites block IPs making too many requests
- **Cost**: ~£50-200/month for rotating residential proxies
- **Providers**: BrightData, Oxylabs, SmartProxy
- **My approach**: **Start WITHOUT proxies** to save costs. Add only if I get blocked.

### Legal Consideration

Rightmove, Zoopla, and OnTheMarket terms prohibit automated scraping. I'm aware this may be a violation. I'm already using PropertyData API legally, but want scraping for additional coverage. I understand the risks and am prepared to pivot to APIs if needed.

## What I Want You to Build

### Phase 1: Database & Core Architecture

**First, help me set up the database schema:**

1. Update my Prisma schema to support:
   - Three sources: `RIGHTMOVE`, `ZOOPLA`, `ONTHEMARKET`
   - Two categories: `RESIDENTIAL`, `COMMERCIAL`
   - Commercial-specific fields (rateable value, lease info, yields)
   - Review queue fields (`reviewStatus`, `reviewNotes`, `reviewedBy`, `reviewedAt`)
   - BMV ambiguity tracking (`isAmbiguous`, `ambiguityReasons`)
   - PropertyData integration field (`propertyDataAnalysis`)
   - Export tracking table

2. Create migrations and apply them

**Schema Requirements:**

```prisma
// Property listing with support for both residential and commercial
model PropertyListing {
  id                   String           @id @default(uuid())
  sourceId             String
  source               PropertySource   // RIGHTMOVE, ZOOPLA, ONTHEMARKET
  category             PropertyCategory // RESIDENTIAL, COMMERCIAL
  
  // Basic details
  title                String
  description          String           @db.Text
  propertyType         String           // House, Flat, Office, Retail, etc.
  propertySubType      String?
  bedrooms             Int              @default(0)
  bathrooms            Int              @default(0)
  
  // Pricing
  price                Decimal          @db.Decimal(12, 2)
  priceHistory         Json             @default("[]")
  
  // Location (JSON)
  address              Json
  
  // Size
  squareFeet           Int?
  squareMeters         Int?
  pricePerSqFt         Decimal?         @db.Decimal(10, 2)
  
  // Commercial-specific (JSON, null for residential)
  commercialDetails    Json?
  
  // BMV indicators (JSON)
  bmvIndicators        Json
  
  // Review queue
  reviewStatus         ReviewStatus     @default(PENDING)
  reviewNotes          String?          @db.Text
  reviewedBy           String?
  reviewedAt           DateTime?
  
  // PropertyData integration (JSON)
  propertyDataAnalysis Json?
  
  // Media (JSON arrays)
  images               Json             @default("[]")
  floorPlans           Json             @default("[]")
  
  // Agent info (JSON)
  agent                Json
  
  // Metadata
  listedDate           DateTime
  daysOnMarket         Int
  status               ListingStatus    @default(FOR_SALE)
  scrapedAt            DateTime         @default(now())
  lastChecked          DateTime         @default(now())
  checksum             String
  
  // Relations
  analysis             PropertyAnalysis?
  exports              PropertyExport[]
  
  @@unique([source, sourceId])
  @@index([category])
  @@index([reviewStatus])
  @@index([scrapedAt])
}

enum PropertySource {
  RIGHTMOVE
  ZOOPLA
  ONTHEMARKET
}

enum PropertyCategory {
  RESIDENTIAL
  COMMERCIAL
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
  AUTO_APPROVED
}

enum ListingStatus {
  FOR_SALE
  SOLD_STC
  UNDER_OFFER
  REMOVED
}

// Scraper job tracking
model ScraperJob {
  id              String      @id @default(uuid())
  source          PropertySource
  criteria        Json
  status          JobStatus   @default(QUEUED)
  
  // Progress
  totalFound      Int         @default(0)
  processed       Int         @default(0)
  successful      Int         @default(0)
  failed          Int         @default(0)
  
  // Timing
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime    @default(now())
  
  // Errors
  errors          Json        @default("[]")
  propertiesFound String[]    // Array of property IDs
  
  @@index([status, createdAt])
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// Settings for scraper
model ScraperSettings {
  id                    String   @id @default(uuid())
  enabled               Boolean  @default(true)
  scheduleType          String   @default("TWICE_DAILY")
  
  // Source toggles
  rightmoveEnabled      Boolean  @default(true)
  zooplaEnabled         Boolean  @default(true)
  onthemarketEnabled    Boolean  @default(true)
  
  // Auto-analysis toggle (IMPORTANT!)
  autoAnalysisEnabled   Boolean  @default(true)
  autoAnalysisThreshold Decimal? @db.Decimal(5, 2)
  
  // Review queue
  requireManualReview   Boolean  @default(true)
  
  // Rate limiting
  requestDelay          Int      @default(3000)
  maxConcurrent         Int      @default(2)
  
  // Proxy (optional)
  useProxy              Boolean  @default(false)
  proxyUrl              String?
  
  updatedAt             DateTime @updatedAt
}

// Export tracking
model PropertyExport {
  id          String       @id @default(uuid())
  propertyId  String
  property    PropertyListing @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  
  exportedAt  DateTime     @default(now())
  exportedBy  String?
  format      ExportFormat
  fileUrl     String?
  filters     Json?
  
  @@index([exportedAt])
}

enum ExportFormat {
  CSV
  EXCEL
  JSON
}
```

### Phase 2: Python Scrapers

**Build three Python scrapers in `/scripts/scrapers/`:**

**File structure:**
```
/scripts/scrapers/
  ├── __init__.py
  ├── base_scraper.py          # Abstract base class
  ├── rightmove_scraper.py     # Start here
  ├── zoopla_scraper.py
  ├── onthemarket_scraper.py
  ├── proxy_manager.py         # Optional, implement but default to disabled
  ├── scheduler.py
  └── utils/
      ├── __init__.py
      ├── rate_limiter.py
      ├── data_parser.py
      ├── validators.py
      └── export_handler.py
```

**Technology for scrapers:**
- `playwright` or `selenium` for dynamic content
- `beautifulsoup4` for parsing
- `tenacity` for retry logic
- `pydantic` for validation

**Start with Rightmove scraper that:**
1. Accepts search criteria (location, price range, property type, etc.)
2. Scrapes both residential and commercial properties
3. Extracts ALL fields from the schema above
4. Detects BMV indicators:
   - Price reductions (hasReduction, reductionPercentage)
   - "Needs work" keywords in description
   - "Motivated seller" indicators
   - Auction properties
   - Days on market (>90 days is good indicator)
5. Detects ambiguous properties that need manual review:
   - Conflicting signals (high price with reduction)
   - Missing critical data (no size, vague description)
   - Only one BMV indicator
   - Commercial properties missing rental info
   - Excessive price reductions (>25%)
6. Rate limiting (3-5 seconds between requests)
7. User-agent rotation
8. Error handling with retry logic
9. Structured logging

**Then replicate for Zoopla and OnTheMarket** with site-specific parsing.

### Phase 3: Next.js API Routes

**Create these API endpoints in `/app/api/`:**

**1. POST /api/scraper/trigger**
```typescript
// Trigger a scraping job
interface Request {
  source: 'RIGHTMOVE' | 'ZOOPLA' | 'ONTHEMARKET' | 'ALL';
  criteria: {
    category: 'RESIDENTIAL' | 'COMMERCIAL' | 'BOTH';
    locations: string[];
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    propertyTypes?: string[];
    addedSince?: string;
  };
}
```

**2. GET /api/scraper/status/:jobId**
```typescript
// Check job progress
interface Response {
  jobId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  propertiesFound: string[];
}
```

**3. GET /api/scraper/settings**
**4. PUT /api/scraper/settings**
```typescript
// Get/update settings including auto-analysis toggle
interface Settings {
  enabled: boolean;
  rightmoveEnabled: boolean;
  zooplaEnabled: boolean;
  onthemarketEnabled: boolean;
  autoAnalysisEnabled: boolean;  // IMPORTANT TOGGLE
  requireManualReview: boolean;
}
```

**5. GET /api/review-queue**
**6. POST /api/review-queue/:id/review**
```typescript
// Get properties needing review
// Approve or reject a property
interface ReviewAction {
  action: 'APPROVE' | 'REJECT';
  notes?: string;
  reviewedBy: string;
}
```

**7. POST /api/properties/export**
**8. GET /api/properties/export/:exportId**
```typescript
// Export properties to CSV/Excel/JSON
interface ExportRequest {
  format: 'CSV' | 'EXCEL' | 'JSON';
  filters?: {
    source?: PropertySource;
    category?: PropertyCategory;
    reviewStatus?: ReviewStatus;
    dateFrom?: Date;
    dateTo?: Date;
  };
  includeAnalysis?: boolean;
}
```

**9. GET /api/properties/listings**
```typescript
// Query properties with filters
interface ListingsQuery {
  source?: PropertySource;
  category?: PropertyCategory;
  reviewStatus?: ReviewStatus;
  bmvOnly?: boolean;
  sortBy?: 'price' | 'daysOnMarket' | 'listedDate';
  page?: number;
  limit?: number;
}
```

### Phase 4: Scheduler (Twice Daily)

**Create scheduler using node-cron in Next.js:**

**File: `/lib/scrapers/scheduler.ts`**

```typescript
import cron from 'node-cron';

export class ScraperScheduler {
  async initialize() {
    const settings = await prisma.scraperSettings.findFirst();
    
    if (!settings?.enabled) return;
    
    // Morning run at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      await this.runScheduledScrape(settings);
    });
    
    // Evening run at 6:00 PM
    cron.schedule('0 18 * * *', async () => {
      await this.runScheduledScrape(settings);
    });
  }
  
  async runScheduledScrape(settings) {
    // Run sources in priority order: Rightmove → Zoopla → OnTheMarket
    const sources = [];
    if (settings.rightmoveEnabled) sources.push('RIGHTMOVE');
    if (settings.zooplaEnabled) sources.push('ZOOPLA');
    if (settings.onthemarketEnabled) sources.push('ONTHEMARKET');
    
    for (const source of sources) {
      const jobId = await triggerScrapingJob({ source, criteria: {...} });
      await waitForCompletion(jobId);
      
      // Auto-analyze if enabled
      if (settings.autoAnalysisEnabled) {
        await triggerAutoAnalysis(jobId, settings);
      }
    }
  }
}
```

### Phase 5: Manual Review Queue UI

**Create React components:**

**1. Review Queue Dashboard** - Shows all properties flagged for review
**2. Review Card Component** - Shows:
   - Property details (image, price, beds, location)
   - Ambiguity reasons (why it was flagged)
   - BMV indicators
   - PropertyData valuation (if available)
   - Approve/Reject buttons
   - Link to original listing

**File: `/components/ReviewQueue/ReviewQueueDashboard.tsx`**

### Phase 6: Export Functionality

**Create export handler in `/lib/export/property-exporter.ts`:**

**Features:**
- Generate CSV with all property fields
- Generate Excel with formatting
- Generate JSON for programmatic use
- Filter by source, category, date range, review status
- Include/exclude AI analysis data
- Save to `/tmp/exports/` initially (can add S3 later)
- Return download URL
- Track exports in database

**Use libraries:**
- `csv-writer` for CSV
- `xlsx` for Excel

### Phase 7: Settings UI

**Create settings page where I can toggle:**
- Enable/disable scraping entirely
- Enable/disable each source (Rightmove, Zoopla, OnTheMarket)
- **Enable/disable auto-analysis** (important!)
- Set auto-analysis threshold
- Require manual review for ambiguous properties
- Adjust rate limiting

### Phase 8: PropertyData Integration

**Enhance scraped properties with PropertyData API:**

After scraping, optionally call PropertyData API to get:
- Estimated property value
- Comparable properties nearby
- Local area statistics

**Store in `propertyDataAnalysis` JSON field**

Use this to:
- Calculate more accurate BMV scores
- Show comparables in review queue
- Include in exports

### Phase 9: Monitoring & Alerts

**Create admin dashboard showing:**
- Properties scraped today/this week
- BMV properties found
- Review queue count
- Scraping success rate
- Error log

**Send alerts via:**
- Email for daily summaries
- SMS (Twilio) for high-value BMV opportunities (>£100k potential)
- Slack (optional)

## Implementation Approach

**Let's work iteratively:**

1. **Start with database schema** - Get that migrated first
2. **Build Rightmove scraper** - Get ONE source working end-to-end
3. **Add API endpoints** - Wire up the scraper to the API
4. **Test manually** - Trigger jobs, check database
5. **Add Zoopla and OnTheMarket** - Replicate the pattern
6. **Build review queue UI** - So I can review ambiguous properties
7. **Add settings UI** - Toggle auto-analysis on/off
8. **Implement scheduler** - Automate twice daily runs
9. **Add exports** - Generate CSV/Excel downloads
10. **PropertyData integration** - Enrich with valuations
11. **Polish and deploy**

## My Questions for You

Before we start, please clarify:

1. **Where is my existing Next.js project located?** (so you can read the code)
2. **Do I have a `/scripts` directory already?** (for Python scrapers)
3. **What's my current Prisma schema?** (so we don't break existing models)
4. **Am I using App Router or Pages Router?** (I mentioned Next.js 14+, so probably App Router?)
5. **Where should I put React components?** (components/ or app/components/?)

## What NOT to Do

- ❌ Don't implement proxies by default (I'll add if needed)
- ❌ Don't scrape too aggressively (respect rate limits)
- ❌ Don't auto-analyze everything (respect the settings toggle)
- ❌ Don't skip the review queue for ambiguous properties
- ❌ Don't forget commercial property fields

## Success Criteria

After implementation, I should be able to:

✅ Trigger a scraping job via API or scheduler
✅ See properties scraped from all 3 sources
✅ Review ambiguous properties in a clean UI
✅ Toggle auto-analysis on/off in settings
✅ Export properties to CSV/Excel
✅ See PropertyData valuations alongside scraped data
✅ Get SMS alerts for high-value BMV deals
✅ Let my non-technical partner review properties and export data

## Environment Variables I'll Set

```bash
# Required
DATABASE_URL=postgresql://...
CLAUDE_API_KEY=your_key
PROPERTYDATA_API_KEY=your_key

# Recommended
SCRAPER_ENABLED=true
RIGHTMOVE_ENABLED=true
ZOOPLA_ENABLED=true
ONTHEMARKET_ENABLED=true
AUTO_ANALYSIS_ENABLED=true
ADMIN_EMAIL=your@email.com

# Optional (add later if needed)
SCRAPER_USE_PROXY=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

## Let's Get Started

I'm ready to implement this step by step. Please start by:

1. Reading my existing codebase to understand the structure
2. Showing me the updated Prisma schema with all the new models
3. Creating the migration
4. Then we'll build the Rightmove scraper

Sound good?

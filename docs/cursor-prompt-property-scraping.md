# Cursor AI Prompt: Rightmove, Zoopla & OnTheMarket Web Scraping Integration

## Project Context

I'm building a property sourcing SaaS platform that discovers and analyzes Below-Market Value (BMV) properties. The application uses:

- **Stack**: Next.js 14+, TypeScript, Prisma ORM, PostgreSQL
- **Environment**: Windows WSL with Docker containers
- **AI Integration**: Claude API for property analysis
- **Existing APIs**: PropertyData.co.uk API for BMV analysis and valuation
- **Existing Components**: Vendor acquisition pipelines, BMV analysis systems, investor matching

## Objective

Create a robust web scraping system to extract property listings from Rightmove, Zoopla, and OnTheMarket based on specific investment criteria. The system should run twice daily, handle both residential AND commercial properties, integrate with the existing PropertyData API for enhanced analysis, and provide manual review workflows for ambiguous BMV indicators.

## Important Context: What Are Proxy Services?

**Proxy services** are intermediary servers that route your scraping requests through different IP addresses to avoid detection and blocking. When scraping websites like Rightmove:

- **Why needed**: Websites track request patterns from IP addresses. Too many requests = automatic blocking
- **How they work**: Your scraper → Proxy server → Target website. Each request appears from a different IP address
- **Types**: 
  - **Residential proxies**: Real home IP addresses (best for avoiding detection, $50-200/month)
  - **Datacenter proxies**: Server IPs (cheaper but easier to detect, $20-50/month)
  - **Rotating proxies**: Automatically switch IPs between requests
  
**Recommended providers** for UK property scraping:
- BrightData (formerly Luminati) - Premium, reliable, ~$100/month
- Oxylabs - Good balance of price/performance, ~$75/month
- SmartProxy - Budget-friendly, ~$50/month
- ScraperAPI - Handles rotation automatically, ~$50/month

**Alternative approach**: Start without proxies for initial development/testing. Implement IF you get blocked. This saves costs during development.

## Technical Requirements

### 1. Scraping Architecture

Build a Python-based scraping module with the following specifications:

**File Structure:**
```
/scripts/scrapers/
  ├── __init__.py
  ├── base_scraper.py          # Abstract base class for all scrapers
  ├── rightmove_scraper.py     # Rightmove-specific implementation
  ├── zoopla_scraper.py        # Zoopla-specific implementation
  ├── onthemarket_scraper.py   # OnTheMarket-specific implementation
  ├── proxy_manager.py         # Rotating proxy management (optional - implement if needed)
  ├── scheduler.py             # Twice-daily scheduling logic
  └── utils/
      ├── __init__.py
      ├── rate_limiter.py      # Rate limiting logic
      ├── data_parser.py       # HTML parsing utilities
      ├── validators.py        # Data validation functions
      └── export_handler.py    # CSV/Excel export functionality
```

**Technology Stack for Scrapers:**
- `playwright` or `selenium` for dynamic content handling
- `beautifulsoup4` for HTML parsing
- `requests` with rotating proxies
- `tenacity` for retry logic with exponential backoff
- `pydantic` for data validation
- User-agent rotation to avoid detection

### 2. Search Criteria Configuration

Create a configuration system that accepts the following BMV-focused search parameters:

**Location Criteria:**
- Specific postcodes or areas (e.g., "Cardiff CF10", "Swansea SA1")
- Radius search from coordinates (1, 3, 5, 10, 15, 20 miles)
- Multiple location support for portfolio targeting

**Property Type Filters:**
- **Residential**: Houses, Flats, Bungalows, Maisonettes
- **Residential Subtypes**: Terraced, Semi-detached, Detached, End-terrace
- **Commercial**: Office, Retail, Industrial, Warehouse, Mixed Use, Land, Development Opportunity, Hotel/Leisure
- **Commercial Subtypes**: High Street Shop, Shopping Centre Unit, Showroom, Factory, Business Park, Restaurant/Cafe
- New builds: Include/Exclude option
- Multi-unit properties: Blocks of flats, HMOs

**Price & Size:**
- Min/Max price range (£0 - £10,000,000)
- Min/Max bedrooms (0-10+)
- Min/Max square footage
- Price per square foot calculations

**BMV Indicators (High Priority):**
- "Reduced" or "Price Drop" flags
- Days on market (prefer >90 days)
- Auction properties
- Repossessions or probate sales
- "Needs work" or "renovation" keywords
- Tenanted properties with sitting tenants
- Below asking price sale history patterns

**Listing Age & Status:**
- Added in last: 24 hours, 3 days, 7 days, 14 days, 30 days
- Include "Sold STC" for market analysis (optional)
- Recently relisted properties

### 3. Data Extraction Schema

Extract and structure the following data points for each property:

**Core Property Data:**
```typescript
interface PropertyListing {
  // Identification
  id: string;                    // Generated UUID
  sourceId: string;              // Rightmove/Zoopla/OnTheMarket listing ID
  source: 'RIGHTMOVE' | 'ZOOPLA' | 'ONTHEMARKET';
  url: string;                   // Direct listing URL
  
  // Classification
  category: 'RESIDENTIAL' | 'COMMERCIAL';
  
  // Basic Details
  title: string;
  description: string;           // Full description text
  propertyType: string;          // House, Flat, Office, Retail, etc.
  propertySubType?: string;      // Terraced, Semi-detached, High Street, etc.
  bedrooms: number;              // 0 for commercial
  bathrooms: number;
  receptions?: number;
  
  // Location
  address: {
    fullAddress: string;
    street?: string;
    locality?: string;
    town: string;
    county?: string;
    postcode: string;
    latitude?: number;
    longitude?: number;
  };
  
  // Pricing
  price: number;
  priceQualifier?: string;       // Offers Over, Guide Price, POA, etc.
  priceHistory: Array<{
    date: string;
    price: number;
    event: 'LISTED' | 'REDUCED' | 'INCREASED';
  }>;
  
  // Size & Features
  squareFeet?: number;
  squareMeters?: number;
  pricePerSqFt?: number;
  tenure?: 'FREEHOLD' | 'LEASEHOLD' | 'SHARED_OWNERSHIP';
  
  // Commercial-specific
  commercialDetails?: {
    rateable_value?: number;
    businessRates?: number;
    parkingSpaces?: number;
    loadingBay?: boolean;
    classification?: string;      // A1, A2, A3, B1, B2, B8, etc.
    currentUse?: string;
    tenancyType?: 'VACANT_POSSESSION' | 'TENANTED' | 'MULTI_TENANT';
    leaseLength?: number;         // Years remaining on lease
    rent?: number;                // If investment property
    yield?: number;               // Rental yield %
  };
  
  // Timing & Status
  listedDate: Date;
  daysOnMarket: number;
  lastUpdated: Date;
  status: 'FOR_SALE' | 'SOLD_STC' | 'UNDER_OFFER' | 'REMOVED';
  
  // Media
  images: Array<{
    url: string;
    caption?: string;
    isPrimary: boolean;
  }>;
  floorPlans: string[];
  virtualTourUrl?: string;
  
  // Agent Information
  agent: {
    name: string;
    branch?: string;
    phone?: string;
    email?: string;
    agentId?: string;
  };
  
  // BMV Indicators
  bmvIndicators: {
    hasReduction: boolean;
    reductionAmount?: number;
    reductionPercentage?: number;
    isAuction: boolean;
    isRepossession: boolean;
    isProbate: boolean;
    needsWork: boolean;
    isTenanted: boolean;
    motivatedSeller: boolean;     // Detected from description keywords
    isAmbiguous: boolean;         // Requires manual review
    ambiguityReasons?: string[];  // Why flagged for review
  };
  
  // Review Queue
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  
  // EPC & Compliance
  epcRating?: string;
  epcScore?: number;
  councilTaxBand?: string;
  
  // PropertyData API Integration
  propertyDataAnalysis?: {
    estimatedValue?: number;
    comparables?: Array<any>;
    localAreaStats?: any;
    lastUpdated?: Date;
  };
  
  // Metadata
  scrapedAt: Date;
  lastChecked: Date;
  checksum: string;              // For detecting changes
}
```

### 4. Database Integration

**Prisma Schema Extension:**

Add to your existing `schema.prisma`:

```prisma
model PropertyListing {
  id              String   @id @default(uuid())
  sourceId        String   
  source          PropertySource
  url             String
  category        PropertyCategory @default(RESIDENTIAL)
  
  // Basic Details
  title           String
  description     String   @db.Text
  propertyType    String
  propertySubType String?
  bedrooms        Int      @default(0)
  bathrooms       Int      @default(0)
  receptions      Int?
  
  // Location (JSON field)
  address         Json
  
  // Pricing
  price           Decimal  @db.Decimal(12, 2)
  priceQualifier  String?
  priceHistory    Json     @default("[]")
  
  // Size & Features
  squareFeet      Int?
  squareMeters    Int?
  pricePerSqFt    Decimal? @db.Decimal(10, 2)
  tenure          Tenure?
  
  // Commercial-specific (JSON field)
  commercialDetails Json?
  
  // Timing & Status
  listedDate      DateTime
  daysOnMarket    Int
  lastUpdated     DateTime @updatedAt
  status          ListingStatus @default(FOR_SALE)
  
  // Media (JSON arrays)
  images          Json     @default("[]")
  floorPlans      Json     @default("[]")
  virtualTourUrl  String?
  
  // Agent Information (JSON field)
  agent           Json
  
  // BMV Indicators (JSON field)
  bmvIndicators   Json
  
  // Review Queue
  reviewStatus    ReviewStatus @default(PENDING)
  reviewNotes     String?  @db.Text
  reviewedBy      String?
  reviewedAt      DateTime?
  
  // EPC & Compliance
  epcRating       String?
  epcScore        Int?
  councilTaxBand  String?
  
  // PropertyData API Integration (JSON field)
  propertyDataAnalysis Json?
  
  // Metadata
  scrapedAt       DateTime @default(now())
  lastChecked     DateTime @default(now())
  checksum        String
  
  // Relations
  analysis        PropertyAnalysis?
  deals           Deal[]
  exports         PropertyExport[]
  
  @@unique([source, sourceId])
  @@index([source, sourceId])
  @@index([category])
  @@index([listedDate, daysOnMarket])
  @@index([price])
  @@index([reviewStatus])
  @@index([scrapedAt])
  @@map("property_listings")
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

enum Tenure {
  FREEHOLD
  LEASEHOLD
  SHARED_OWNERSHIP
}

enum ListingStatus {
  FOR_SALE
  SOLD_STC
  UNDER_OFFER
  REMOVED
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
  AUTO_APPROVED
}

model PropertyAnalysis {
  id                String   @id @default(uuid())
  propertyId        String   @unique
  property          PropertyListing @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  
  // AI Analysis Results
  bmvScore          Decimal  @db.Decimal(5, 2)  // 0-100 score
  estimatedValue    Decimal  @db.Decimal(12, 2)
  potentialDiscount Decimal  @db.Decimal(5, 2)  // Percentage
  
  // Yield Calculations (relevant for both residential and commercial)
  estimatedRent     Decimal? @db.Decimal(10, 2)
  grossYield        Decimal? @db.Decimal(5, 2)
  netYield          Decimal? @db.Decimal(5, 2)
  
  // Risk Assessment
  riskLevel         String   // LOW, MEDIUM, HIGH
  riskFactors       Json     @default("[]")
  
  // AI Analysis
  claudeAnalysis    String   @db.Text
  analysisDate      DateTime @default(now())
  
  // Auto-analysis flag
  wasAutoAnalyzed   Boolean  @default(false)
  
  @@map("property_analyses")
}

model PropertyExport {
  id              String   @id @default(uuid())
  propertyId      String
  property        PropertyListing @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  
  exportedAt      DateTime @default(now())
  exportedBy      String?
  format          ExportFormat
  fileUrl         String?
  filters         Json?    // Store the filters used for this export
  
  @@index([exportedAt])
  @@map("property_exports")
}

enum ExportFormat {
  CSV
  EXCEL
  JSON
}

model ScraperJob {
  id              String   @id @default(uuid())
  source          PropertySource
  criteria        Json     // Search criteria used
  status          JobStatus @default(QUEUED)
  priority        JobPriority @default(NORMAL)
  
  // Progress tracking
  totalFound      Int      @default(0)
  processed       Int      @default(0)
  successful      Int      @default(0)
  failed          Int      @default(0)
  
  // Timing
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  
  // Error tracking
  errors          Json     @default("[]")
  
  // Results
  propertiesFound String[] // Array of property IDs
  
  @@index([status, createdAt])
  @@index([source])
  @@map("scraper_jobs")
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum JobPriority {
  LOW
  NORMAL
  HIGH
}

model ScraperSettings {
  id                    String   @id @default(uuid())
  
  // Scheduling
  enabled               Boolean  @default(true)
  scheduleType          String   @default("TWICE_DAILY") // TWICE_DAILY, HOURLY, CUSTOM
  customCron            String?  // For custom schedules
  
  // Sources
  rightmoveEnabled      Boolean  @default(true)
  zooplaEnabled         Boolean  @default(true)
  onthemarketEnabled    Boolean  @default(true)
  
  // Auto-analysis
  autoAnalysisEnabled   Boolean  @default(true)
  autoAnalysisThreshold Decimal? @db.Decimal(5, 2) // Only auto-analyze if BMV score > threshold
  
  // Review queue
  requireManualReview   Boolean  @default(true)
  
  // Rate limiting
  requestDelay          Int      @default(3000) // milliseconds
  maxConcurrent         Int      @default(2)
  
  // Proxy settings
  useProxy              Boolean  @default(false)
  proxyUrl              String?
  
  // Default search criteria (JSON)
  defaultCriteria       Json?
  
  updatedAt             DateTime @updatedAt
  
  @@map("scraper_settings")
}
```

### 5. API Endpoints

Create the following Next.js API routes:

**POST /api/scraper/trigger**
```typescript
// Trigger a scraping job with specific criteria
interface TriggerScraperRequest {
  source: 'RIGHTMOVE' | 'ZOOPLA' | 'ONTHEMARKET' | 'ALL';
  criteria: {
    category: 'RESIDENTIAL' | 'COMMERCIAL' | 'BOTH';
    locations: string[];
    radius?: number;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    propertyTypes?: string[];
    commercialTypes?: string[];  // For commercial properties
    addedSince?: string;  // '24h', '7d', '14d', '30d'
    bmvOnly?: boolean;
  };
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

// Response
interface TriggerScraperResponse {
  jobId: string;
  message: string;
  estimatedCompletion: Date;
}
```

**GET /api/scraper/status/:jobId**
```typescript
// Check scraping job status
interface ScraperJobStatus {
  jobId: string;
  source: PropertySource;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;  // seconds
  errors?: Array<{
    url: string;
    error: string;
    timestamp: Date;
  }>;
  propertiesFound: string[];  // Array of property IDs
}
```

**GET /api/properties/listings**
```typescript
// Query scraped properties with filters
interface ListingsQuery {
  source?: 'RIGHTMOVE' | 'ZOOPLA' | 'ONTHEMARKET';
  category?: 'RESIDENTIAL' | 'COMMERCIAL';
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  bedrooms?: number;
  bmvOnly?: boolean;
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
  sortBy?: 'price' | 'daysOnMarket' | 'bmvScore' | 'listedDate';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Response
interface ListingsResponse {
  properties: PropertyListing[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    totalValue: number;
    averagePrice: number;
    bmvCount: number;
  };
}
```

**POST /api/properties/:id/analyze**
```typescript
// Trigger AI analysis for a specific property
// Integrates with both Claude API AND PropertyData API
interface AnalyzePropertyRequest {
  forceRefresh?: boolean;  // Bypass cache, run fresh analysis
  includePropertyData?: boolean;  // Fetch PropertyData API comparables
}

// Response
interface AnalyzePropertyResponse {
  analysisId: string;
  bmvScore: number;
  estimatedValue: number;
  potentialDiscount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  claudeAnalysis: string;
  propertyDataAnalysis?: any;  // From PropertyData API
  timestamp: Date;
}
```

**GET /api/scraper/settings**
```typescript
// Get current scraper settings
interface ScraperSettingsResponse {
  enabled: boolean;
  scheduleType: string;
  customCron?: string;
  sources: {
    rightmove: boolean;
    zoopla: boolean;
    onthemarket: boolean;
  };
  autoAnalysis: {
    enabled: boolean;
    threshold?: number;
  };
  reviewQueue: {
    requireManualReview: boolean;
  };
  rateLimiting: {
    requestDelay: number;
    maxConcurrent: number;
  };
  proxy: {
    enabled: boolean;
  };
}
```

**PUT /api/scraper/settings**
```typescript
// Update scraper settings (including auto-analysis toggle)
interface UpdateScraperSettingsRequest {
  enabled?: boolean;
  scheduleType?: string;
  rightmoveEnabled?: boolean;
  zooplaEnabled?: boolean;
  onthemarketEnabled?: boolean;
  autoAnalysisEnabled?: boolean;  // Toggle for auto AI analysis
  autoAnalysisThreshold?: number;
  requireManualReview?: boolean;
  requestDelay?: number;
  maxConcurrent?: number;
  useProxy?: boolean;
  proxyUrl?: string;
}
```

**GET /api/review-queue**
```typescript
// Get properties pending manual review
interface ReviewQueueQuery {
  page?: number;
  limit?: number;
  sortBy?: 'scrapedAt' | 'price' | 'daysOnMarket';
}

// Response
interface ReviewQueueResponse {
  properties: Array<PropertyListing & {
    ambiguityReasons: string[];
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

**POST /api/review-queue/:id/review**
```typescript
// Review a property (approve/reject)
interface ReviewPropertyRequest {
  action: 'APPROVE' | 'REJECT';
  notes?: string;
  reviewedBy: string;  // User ID or name
}

// Response
interface ReviewPropertyResponse {
  propertyId: string;
  reviewStatus: 'APPROVED' | 'REJECTED';
  reviewedAt: Date;
  reviewedBy: string;
}
```

**POST /api/properties/export**
```typescript
// Export properties to CSV/Excel
interface ExportPropertiesRequest {
  format: 'CSV' | 'EXCEL' | 'JSON';
  filters?: {
    source?: PropertySource;
    category?: PropertyCategory;
    reviewStatus?: ReviewStatus;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: Date;
    dateTo?: Date;
  };
  fields?: string[];  // Specific fields to include
  includeAnalysis?: boolean;
}

// Response
interface ExportPropertiesResponse {
  exportId: string;
  fileUrl: string;  // Download URL
  recordCount: number;
  format: 'CSV' | 'EXCEL' | 'JSON';
  expiresAt: Date;
}
```

**GET /api/properties/export/:exportId**
```typescript
// Download exported file
// Returns file stream for download
```

**POST /api/properties/bulk-analyze**
```typescript
// Trigger analysis for multiple properties
interface BulkAnalyzeRequest {
  propertyIds: string[];
  includePropertyData?: boolean;
}

// Response
interface BulkAnalyzeResponse {
  jobId: string;
  totalProperties: number;
  estimatedCompletion: Date;
}
```

### 6. Scheduling & Automation (Next.js Implementation)

Since you're not using n8n, implement scheduling within your Next.js application using node-cron or a similar library.

**Scheduler Implementation:**

```typescript
// /lib/scrapers/scheduler.ts

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { triggerScrapingJob } from './scraper-manager';

const prisma = new PrismaClient();

export class ScraperScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  
  async initialize() {
    const settings = await prisma.scraperSettings.findFirst();
    
    if (!settings || !settings.enabled) {
      console.log('Scraper scheduling disabled');
      return;
    }
    
    // Set up twice-daily scraping (6 AM and 6 PM)
    if (settings.scheduleType === 'TWICE_DAILY') {
      this.scheduleTwiceDaily(settings);
    } else if (settings.customCron) {
      this.scheduleCustom(settings.customCron, settings);
    }
    
    console.log('Scraper scheduler initialized');
  }
  
  private scheduleTwiceDaily(settings: any) {
    // Morning run at 6:00 AM
    const morningJob = cron.schedule('0 6 * * *', async () => {
      console.log('Running morning property scrape...');
      await this.runScheduledScrape(settings);
    });
    
    // Evening run at 6:00 PM
    const eveningJob = cron.schedule('0 18 * * *', async () => {
      console.log('Running evening property scrape...');
      await this.runScheduledScrape(settings);
    });
    
    this.jobs.set('morning', morningJob);
    this.jobs.set('evening', eveningJob);
  }
  
  private scheduleCustom(cronExpression: string, settings: any) {
    const customJob = cron.schedule(cronExpression, async () => {
      console.log('Running custom scheduled scrape...');
      await this.runScheduledScrape(settings);
    });
    
    this.jobs.set('custom', customJob);
  }
  
  private async runScheduledScrape(settings: any) {
    const sources: ('RIGHTMOVE' | 'ZOOPLA' | 'ONTHEMARKET')[] = [];
    
    if (settings.rightmoveEnabled) sources.push('RIGHTMOVE');
    if (settings.zooplaEnabled) sources.push('ZOOPLA');
    if (settings.onthemarketEnabled) sources.push('ONTHEMARKET');
    
    // Run scraping jobs in priority order: Rightmove -> Zoopla -> OnTheMarket
    for (const source of sources) {
      try {
        const jobId = await triggerScrapingJob({
          source,
          criteria: settings.defaultCriteria || this.getDefaultCriteria(),
          priority: 'NORMAL'
        });
        
        console.log(`Started scraping job ${jobId} for ${source}`);
        
        // Wait for job to complete before starting next source
        await this.waitForJobCompletion(jobId);
        
        // If auto-analysis is enabled, trigger analysis for new properties
        if (settings.autoAnalysisEnabled) {
          await this.triggerAutoAnalysis(jobId, settings);
        }
        
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
        // Continue with next source even if one fails
      }
    }
  }
  
  private async waitForJobCompletion(jobId: string) {
    // Poll job status until complete
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes max
    const pollInterval = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const job = await prisma.scraperJob.findUnique({
        where: { id: jobId }
      });
      
      if (!job) break;
      
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  private async triggerAutoAnalysis(jobId: string, settings: any) {
    const job = await prisma.scraperJob.findUnique({
      where: { id: jobId },
      include: {
        // Assuming you'll add a relation to properties found
      }
    });
    
    if (!job || job.propertiesFound.length === 0) return;
    
    console.log(`Triggering auto-analysis for ${job.propertiesFound.length} properties`);
    
    // Queue properties for analysis
    for (const propertyId of job.propertiesFound) {
      // Check if property meets auto-analysis threshold
      const property = await prisma.propertyListing.findUnique({
        where: { id: propertyId }
      });
      
      if (!property) continue;
      
      // Only auto-analyze if not ambiguous (requiring manual review)
      const bmvIndicators = property.bmvIndicators as any;
      if (bmvIndicators.isAmbiguous && settings.requireManualReview) {
        // Add to review queue instead
        await prisma.propertyListing.update({
          where: { id: propertyId },
          data: { reviewStatus: 'PENDING' }
        });
        continue;
      }
      
      // Trigger analysis
      try {
        await this.analyzeProperty(propertyId, settings);
      } catch (error) {
        console.error(`Error analyzing property ${propertyId}:`, error);
      }
    }
  }
  
  private async analyzeProperty(propertyId: string, settings: any) {
    // Call your existing Claude API analysis
    // Optionally integrate with PropertyData API
    // This is a placeholder - implement based on your existing analysis logic
    console.log(`Analyzing property ${propertyId}`);
  }
  
  private getDefaultCriteria() {
    return {
      category: 'BOTH' as const,
      locations: ['Cardiff', 'Swansea', 'Port Talbot'],  // Your target areas
      addedSince: '24h',
      bmvOnly: false
    };
  }
  
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
  }
}

// Export singleton instance
export const scraperScheduler = new ScraperScheduler();
```

**Initialize in your Next.js app:**

```typescript
// app/api/scheduler/route.ts (API route to manually control scheduler)

import { scraperScheduler } from '@/lib/scrapers/scheduler';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start') {
    await scraperScheduler.initialize();
    return NextResponse.json({ message: 'Scheduler started' });
  } else if (action === 'stop') {
    scraperScheduler.stop();
    return NextResponse.json({ message: 'Scheduler stopped' });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

**Add to your main app startup:**

```typescript
// app/layout.tsx or server startup file

import { scraperScheduler } from '@/lib/scrapers/scheduler';

// Initialize scheduler when server starts
if (typeof window === 'undefined') {
  scraperScheduler.initialize();
}
```

**Notification System:**

Create notification handlers for scraping events:

```typescript
// /lib/notifications/scraper-notifications.ts

interface NotificationConfig {
  email?: boolean;
  sms?: boolean;
  slack?: boolean;
}

export async function sendScrapingCompleteNotification(
  jobId: string,
  stats: {
    source: string;
    totalFound: number;
    bmvCount: number;
    duration: number;
  },
  config: NotificationConfig
) {
  const message = `
Scraping Complete - ${stats.source}
Properties Found: ${stats.totalFound}
BMV Candidates: ${stats.bmvCount}
Duration: ${stats.duration}s
  `.trim();
  
  if (config.email) {
    // Send email notification
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `Property Scraping Complete - ${stats.source}`,
      body: message
    });
  }
  
  if (config.sms) {
    // Integrate with your existing Twilio setup
    await sendSMS({
      to: process.env.ADMIN_PHONE,
      message: `${stats.bmvCount} new BMV properties found on ${stats.source}`
    });
  }
  
  if (config.slack) {
    // Send Slack notification if configured
    await sendSlackMessage({
      channel: '#property-alerts',
      text: message
    });
  }
}

export async function sendHighValueBMVAlert(property: any) {
  // Send immediate alert for high-value BMV opportunities
  const message = `
🔥 HIGH VALUE BMV ALERT
${property.title}
Price: £${property.price.toLocaleString()}
Estimated Discount: ${property.analysis?.potentialDiscount}%
Location: ${property.address.town}
Link: ${property.url}
  `.trim();
  
  // Always send SMS for high-value alerts
  await sendSMS({
    to: process.env.ADMIN_PHONE,
    message
  });
}
```

### 7. Anti-Detection Measures

Implement the following to avoid blocking (proxies are OPTIONAL - start without and add if needed):

**Rate Limiting:**
- Randomized delays between requests (2-5 seconds minimum)
- Respect robots.txt directives
- Maximum concurrent requests per domain: 1-2
- Twice daily scraping naturally spreads out requests
- Track requests per domain per day

**User-Agent Rotation:**
- Rotate through real browser user-agents
- Include variety: Chrome, Firefox, Safari, Edge
- Match OS (Windows, Mac, Linux)
- Update user-agent list quarterly

**Request Pattern Randomization:**
- Random scroll depths simulation
- Variable wait times between page loads
- Don't scrape in perfect sequential order (randomize listing order)
- Simulate human behavior (not every listing is clicked)

**Session Management:**
- Use cookies appropriately
- Session persistence per scraping run
- Clear sessions between runs

**Proxy Implementation (OPTIONAL - Add if blocked):**

```python
# /scripts/scrapers/proxy_manager.py

import random
from typing import Optional, List
import requests

class ProxyManager:
    def __init__(self, proxy_url: Optional[str] = None):
        self.proxy_url = proxy_url
        self.use_proxy = proxy_url is not None
        self.failed_proxies = set()
    
    def get_proxy(self) -> Optional[dict]:
        """
        Returns proxy configuration if enabled, None otherwise
        """
        if not self.use_proxy:
            return None
        
        # For rotating proxy services (BrightData, Oxylabs, etc.)
        # they handle rotation automatically
        return {
            'http': self.proxy_url,
            'https': self.proxy_url
        }
    
    def mark_proxy_failed(self, proxy: str):
        """Track failed proxies"""
        self.failed_proxies.add(proxy)
        print(f"Marked proxy as failed: {proxy}")
    
    @staticmethod
    def test_proxy(proxy_url: str) -> bool:
        """Test if proxy is working"""
        try:
            response = requests.get(
                'https://api.ipify.org',
                proxies={
                    'http': proxy_url,
                    'https': proxy_url
                },
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
```

**Start without proxies:**
- Most sites allow reasonable scraping volumes
- Twice daily scraping is relatively light usage
- Add proxies only if you encounter 429 (Too Many Requests) or IP blocks

**When to add proxies:**
- Receiving 429 status codes consistently
- IP address gets blocked
- After several weeks of successful scraping (proactive)

**Fallback Strategies:**
- If blocked, stop scraping for 24 hours automatically
- Send alert notification
- Log blocking incidents with timestamp and source
- Implement exponential backoff (1 hour, 6 hours, 24 hours)
- Alternative: Switch to backup scraping schedule (once daily)

### 8. Manual Review Queue System

**BMV Ambiguity Detection:**

Properties are flagged for manual review when:

```python
def detect_bmv_ambiguity(property_data: dict) -> tuple[bool, list[str]]:
    """
    Detect if a property has ambiguous BMV indicators requiring manual review
    Returns: (is_ambiguous, reasons)
    """
    reasons = []
    
    # Conflicting signals
    if property_data['price'] > 500000 and property_data['bmv_indicators']['hasReduction']:
        reasons.append("High price with reduction - verify if genuine BMV")
    
    # Insufficient data
    if not property_data.get('squareFeet') and not property_data.get('description'):
        reasons.append("Missing size and description - cannot assess value")
    
    # Vague descriptions
    description_lower = property_data.get('description', '').lower()
    vague_keywords = ['needs updating', 'potential', 'could be', 'scope for']
    if any(keyword in description_lower for keyword in vague_keywords):
        reasons.append("Vague description - manual assessment needed")
    
    # Unusual property types
    if property_data['propertyType'] in ['Land', 'Parking', 'Other']:
        reasons.append("Unusual property type - requires manual review")
    
    # No clear BMV indicators but suspicious patterns
    bmv_count = sum([
        property_data['bmv_indicators'].get('hasReduction', False),
        property_data['bmv_indicators'].get('needsWork', False),
        property_data['bmv_indicators'].get('motivatedSeller', False),
        property_data['bmv_indicators'].get('isAuction', False)
    ])
    
    if bmv_count == 1:
        reasons.append("Only one BMV indicator - verify if genuine opportunity")
    
    # Commercial properties without rental info
    if property_data.get('category') == 'COMMERCIAL':
        if not property_data.get('commercialDetails', {}).get('rent'):
            reasons.append("Commercial property missing rental information")
    
    # Price reductions seem excessive
    if property_data['bmv_indicators'].get('reductionPercentage', 0) > 25:
        reasons.append("Excessive price reduction (>25%) - verify legitimacy")
    
    is_ambiguous = len(reasons) > 0
    return is_ambiguous, reasons
```

**Review Queue UI Components:**

Create React components for the review queue dashboard:

```typescript
// components/ReviewQueue/ReviewQueueDashboard.tsx

interface ReviewQueueDashboardProps {
  properties: PropertyListing[];
  onApprove: (propertyId: string, notes: string) => void;
  onReject: (propertyId: string, notes: string) => void;
}

export function ReviewQueueDashboard({ properties, onApprove, onReject }: ReviewQueueDashboardProps) {
  return (
    <div className="review-queue">
      <h2>Manual Review Queue</h2>
      <div className="stats">
        <span>Pending Review: {properties.length}</span>
      </div>
      
      {properties.map(property => (
        <ReviewCard
          key={property.id}
          property={property}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
}

// components/ReviewQueue/ReviewCard.tsx

interface ReviewCardProps {
  property: PropertyListing;
  onApprove: (propertyId: string, notes: string) => void;
  onReject: (propertyId: string, notes: string) => void;
}

export function ReviewCard({ property, onApprove, onReject }: ReviewCardProps) {
  const [notes, setNotes] = useState('');
  const bmvIndicators = property.bmvIndicators as any;
  
  return (
    <div className="review-card">
      {/* Property Image */}
      <div className="property-image">
        <img src={property.images[0]?.url} alt={property.title} />
      </div>
      
      {/* Property Details */}
      <div className="property-details">
        <h3>{property.title}</h3>
        <p className="price">£{property.price.toLocaleString()}</p>
        <p className="location">{property.address.town}</p>
        <p className="beds-baths">{property.bedrooms} bed | {property.bathrooms} bath</p>
        
        {/* Ambiguity Reasons */}
        <div className="ambiguity-reasons">
          <h4>Review Required:</h4>
          <ul>
            {bmvIndicators.ambiguityReasons?.map((reason: string, index: number) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
        
        {/* BMV Indicators */}
        <div className="bmv-indicators">
          {bmvIndicators.hasReduction && (
            <span className="badge">Price Reduced: {bmvIndicators.reductionPercentage}%</span>
          )}
          {bmvIndicators.needsWork && <span className="badge">Needs Work</span>}
          {bmvIndicators.motivatedSeller && <span className="badge">Motivated Seller</span>}
          {bmvIndicators.isAuction && <span className="badge">Auction</span>}
        </div>
        
        {/* PropertyData Integration */}
        {property.propertyDataAnalysis && (
          <div className="property-data">
            <h4>PropertyData Valuation</h4>
            <p>Estimated Value: £{property.propertyDataAnalysis.estimatedValue?.toLocaleString()}</p>
          </div>
        )}
      </div>
      
      {/* Review Actions */}
      <div className="review-actions">
        <textarea
          placeholder="Add review notes (optional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="action-buttons">
          <button
            className="btn-approve"
            onClick={() => onApprove(property.id, notes)}
          >
            ✓ Approve as BMV
          </button>
          <button
            className="btn-reject"
            onClick={() => onReject(property.id, notes)}
          >
            ✗ Reject
          </button>
        </div>
        <a href={property.url} target="_blank" rel="noopener noreferrer">
          View Original Listing →
        </a>
      </div>
    </div>
  );
}
```

### 9. Export Functionality

**Export Handler Implementation:**

```typescript
// /lib/export/property-exporter.ts

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { createObjectCsvStringifier } from 'csv-writer';
import { format } from 'date-fns';

const prisma = new PrismaClient();

interface ExportOptions {
  format: 'CSV' | 'EXCEL' | 'JSON';
  filters?: any;
  fields?: string[];
  includeAnalysis?: boolean;
}

export class PropertyExporter {
  async export(options: ExportOptions): Promise<string> {
    // Fetch properties based on filters
    const properties = await this.fetchProperties(options.filters);
    
    // Transform data based on selected fields
    const data = await this.transformData(properties, options);
    
    // Generate file based on format
    switch (options.format) {
      case 'CSV':
        return await this.generateCSV(data);
      case 'EXCEL':
        return await this.generateExcel(data);
      case 'JSON':
        return await this.generateJSON(data);
      default:
        throw new Error('Invalid export format');
    }
  }
  
  private async fetchProperties(filters: any) {
    return await prisma.propertyListing.findMany({
      where: {
        source: filters?.source,
        category: filters?.category,
        reviewStatus: filters?.reviewStatus,
        price: {
          gte: filters?.minPrice,
          lte: filters?.maxPrice
        },
        scrapedAt: {
          gte: filters?.dateFrom,
          lte: filters?.dateTo
        }
      },
      include: {
        analysis: filters?.includeAnalysis || false
      }
    });
  }
  
  private async transformData(properties: any[], options: ExportOptions) {
    return properties.map(property => {
      const address = property.address as any;
      const bmvIndicators = property.bmvIndicators as any;
      const analysis = property.analysis;
      
      const baseData = {
        'Property ID': property.id,
        'Source': property.source,
        'Title': property.title,
        'Price': property.price,
        'Address': address.fullAddress,
        'Town': address.town,
        'Postcode': address.postcode,
        'Property Type': property.propertyType,
        'Bedrooms': property.bedrooms,
        'Bathrooms': property.bathrooms,
        'Square Feet': property.squareFeet || 'N/A',
        'Price per Sq Ft': property.pricePerSqFt || 'N/A',
        'Listed Date': format(new Date(property.listedDate), 'yyyy-MM-dd'),
        'Days on Market': property.daysOnMarket,
        'Status': property.status,
        'Has Reduction': bmvIndicators.hasReduction ? 'Yes' : 'No',
        'Reduction %': bmvIndicators.reductionPercentage || 'N/A',
        'Needs Work': bmvIndicators.needsWork ? 'Yes' : 'No',
        'Motivated Seller': bmvIndicators.motivatedSeller ? 'Yes' : 'No',
        'Is Auction': bmvIndicators.isAuction ? 'Yes' : 'No',
        'Review Status': property.reviewStatus,
        'URL': property.url
      };
      
      // Add analysis data if included
      if (options.includeAnalysis && analysis) {
        return {
          ...baseData,
          'BMV Score': analysis.bmvScore,
          'Estimated Value': analysis.estimatedValue,
          'Potential Discount %': analysis.potentialDiscount,
          'Risk Level': analysis.riskLevel,
          'Estimated Rent': analysis.estimatedRent || 'N/A',
          'Gross Yield %': analysis.grossYield || 'N/A'
        };
      }
      
      return baseData;
    });
  }
  
  private async generateCSV(data: any[]): Promise<string> {
    const csvStringifier = createObjectCsvStringifier({
      header: Object.keys(data[0] || {}).map(key => ({
        id: key,
        title: key
      }))
    });
    
    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);
    
    // Save to file and return URL
    const filename = `properties_export_${Date.now()}.csv`;
    const filepath = `/tmp/${filename}`;
    
    await fs.writeFile(filepath, csv);
    
    // Upload to your storage (S3, etc.) and return public URL
    const publicUrl = await this.uploadToStorage(filepath, filename);
    return publicUrl;
  }
  
  private async generateExcel(data: any[]): Promise<string> {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');
    
    // Add formatting
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "4F81BD" } }
      };
    }
    
    const filename = `properties_export_${Date.now()}.xlsx`;
    const filepath = `/tmp/${filename}`;
    
    XLSX.writeFile(workbook, filepath);
    
    const publicUrl = await this.uploadToStorage(filepath, filename);
    return publicUrl;
  }
  
  private async generateJSON(data: any[]): Promise<string> {
    const json = JSON.stringify(data, null, 2);
    
    const filename = `properties_export_${Date.now()}.json`;
    const filepath = `/tmp/${filename}`;
    
    await fs.writeFile(filepath, json);
    
    const publicUrl = await this.uploadToStorage(filepath, filename);
    return publicUrl;
  }
  
  private async uploadToStorage(filepath: string, filename: string): Promise<string> {
    // Implement your storage upload logic here
    // Options: AWS S3, Google Cloud Storage, local filesystem
    // For now, return local path (implement proper cloud storage in production)
    return `/exports/${filename}`;
  }
}

// API Route Implementation
// app/api/properties/export/route.ts

import { PropertyExporter } from '@/lib/export/property-exporter';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const options = await request.json();
  
  try {
    const exporter = new PropertyExporter();
    const fileUrl = await exporter.export(options);
    
    // Record export in database
    const exportRecord = await prisma.propertyExport.create({
      data: {
        format: options.format,
        fileUrl,
        filters: options.filters || {},
        exportedBy: 'admin' // Get from session
      }
    });
    
    return NextResponse.json({
      exportId: exportRecord.id,
      fileUrl,
      recordCount: /* count from query */,
      format: options.format,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
```

**Export UI Component:**

```typescript
// components/Export/ExportDialog.tsx

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'CSV' | 'EXCEL' | 'JSON'>('EXCEL');
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [filters, setFilters] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/properties/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          filters,
          includeAnalysis
        })
      });
      
      const result = await response.json();
      
      // Download file
      window.open(result.fileUrl, '_blank');
      
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="export-dialog">
        <h2>Export Properties</h2>
        
        <div className="export-options">
          <label>
            <span>Format:</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="EXCEL">Excel (.xlsx)</option>
              <option value="CSV">CSV (.csv)</option>
              <option value="JSON">JSON (.json)</option>
            </select>
          </label>
          
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeAnalysis}
              onChange={(e) => setIncludeAnalysis(e.target.checked)}
            />
            <span>Include AI Analysis Data</span>
          </label>
          
          {/* Add filter controls */}
          <ExportFilters filters={filters} onChange={setFilters} />
        </div>
        
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

**Error Recovery:**
```python
# Implement comprehensive error handling for:
- Network timeouts (retry 3 times)
- HTTP errors (4xx, 5xx)
- Parsing errors (log raw HTML for investigation)
- Database write failures (queue for retry)
- Proxy failures (rotate to next proxy)
```

**Logging Structure:**
```python
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARNING|ERROR",
  "source": "RIGHTMOVE|ZOOPLA",
  "event": "scrape_started|property_found|error|completed",
  "details": {
    "url": "...",
    "propertyId": "...",
    "error": "...",
    "stackTrace": "..."
  }
}
```

### 9. Data Quality & Validation

**Validation Rules:**
- Price must be > £0 and < £10,000,000
- Bedrooms between 0-10
- Valid UK postcode format
- Required fields: title, price, address, source
- Duplicate detection using sourceId + source combination

**Data Enrichment:**
- Calculate days on market from listed date
- Compute price per square foot
- Extract BMV indicators from description using regex patterns:
  - Keywords: "reduced", "motivated seller", "needs work", "renovation", "probate", "repossession", "auction", "tenanted"
- Geocode addresses to lat/long using Google Maps API or Postcodes.io

### 9. Testing Requirements

Create comprehensive tests:

**Unit Tests:**
- Parser functions for each data field (residential and commercial)
- BMV indicator detection logic
- BMV ambiguity detection algorithm
- Price calculation accuracy
- Validation rules for all property types
- Export formatting (CSV/Excel/JSON)

**Integration Tests:**
- Full scraping workflow from trigger to database
- API endpoint responses (all endpoints)
- Scheduler execution (twice daily cron)
- Review queue workflow (flag → review → approve/reject)
- Error recovery mechanisms
- PropertyData API integration
- Auto-analysis trigger logic

**End-to-End Tests:**
- Scrape Rightmove → Parse → Store → Analyze → Review → Export
- Settings toggle affecting behavior (auto-analysis on/off)
- Alert notifications firing correctly
- Export download working with all formats

**Test Data:**
- Mock HTML responses from Rightmove/Zoopla/OnTheMarket
- Edge cases: missing fields, malformed data, price reductions
- Commercial properties with complex lease structures
- Properties with ambiguous BMV indicators
- Performance tests with 1000+ listings

### 10. Error Handling & Logging

**Comprehensive Error Recovery:**

```python
# Implement comprehensive error handling for:
from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)

class ScraperErrorHandler:
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def fetch_with_retry(self, url: str, **kwargs):
        """Fetch URL with automatic retry logic"""
        try:
            response = await self.session.get(url, **kwargs)
            response.raise_for_status()
            return response
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching {url}, retrying...")
            raise
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.error(f"Rate limited on {url}")
                await self.handle_rate_limit()
                raise
            elif e.response.status_code >= 500:
                logger.error(f"Server error on {url}: {e.response.status_code}")
                raise
            else:
                logger.error(f"HTTP error on {url}: {e}")
                return None
        except Exception as e:
            logger.error(f"Unexpected error fetching {url}: {e}")
            raise
    
    async def handle_rate_limit(self):
        """Handle rate limiting"""
        # Stop scraping for 1 hour
        logger.warning("Rate limit hit - pausing scraping for 1 hour")
        await asyncio.sleep(3600)
    
    async def handle_parsing_error(self, url: str, html: str, error: Exception):
        """Handle parsing errors - save HTML for investigation"""
        logger.error(f"Parsing error on {url}: {error}")
        
        # Save raw HTML for debugging
        error_dir = '/tmp/scraper_errors'
        os.makedirs(error_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{error_dir}/{timestamp}_{url.replace('/', '_')}.html"
        
        with open(filename, 'w') as f:
            f.write(html)
        
        logger.info(f"Saved error HTML to {filename}")
    
    async def handle_database_error(self, property_data: dict, error: Exception):
        """Handle database write failures - queue for retry"""
        logger.error(f"Database error saving property {property_data.get('sourceId')}: {error}")
        
        # Queue property data for retry
        await self.queue_for_retry(property_data)
    
    async def queue_for_retry(self, property_data: dict):
        """Queue failed property saves for retry"""
        # Implement retry queue (Redis, database table, or file-based)
        retry_file = '/tmp/scraper_retry_queue.jsonl'
        
        with open(retry_file, 'a') as f:
            f.write(json.dumps(property_data) + '\n')
```

**Logging Structure:**

```python
import logging
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'logs/scraper_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

class StructuredLogger:
    def __init__(self, source: str):
        self.source = source
        self.logger = logging.getLogger(f'scraper.{source}')
    
    def log_scrape_started(self, criteria: dict):
        self.logger.info({
            'event': 'scrape_started',
            'source': self.source,
            'criteria': criteria,
            'timestamp': datetime.now().isoformat()
        })
    
    def log_property_found(self, property_id: str, url: str):
        self.logger.info({
            'event': 'property_found',
            'source': self.source,
            'propertyId': property_id,
            'url': url,
            'timestamp': datetime.now().isoformat()
        })
    
    def log_error(self, error_type: str, details: dict):
        self.logger.error({
            'event': 'error',
            'source': self.source,
            'errorType': error_type,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def log_completed(self, stats: dict):
        self.logger.info({
            'event': 'scrape_completed',
            'source': self.source,
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        })
```

**Error Types and Handling:**

| Error Type | Retry Strategy | Alert? | Fallback Action |
|-----------|---------------|--------|-----------------|
| Network Timeout | Retry 3x with exponential backoff | No | Skip property, continue |
| HTTP 429 (Rate Limit) | Wait 1 hour, retry once | Yes | Pause entire scraping job |
| HTTP 5xx (Server Error) | Retry 3x | If persistent | Skip property |
| Parsing Error | No retry | Yes | Save HTML, skip property |
| Database Write Error | Queue for retry | If >10 failures | Batch retry after job |
| Proxy Failure | Switch proxy | If all proxies fail | Pause for 24 hours |
| Missing Required Fields | No retry | No | Skip property, log |

**Monitoring Dashboard Metrics:**

Track and display on admin dashboard:
- Properties scraped per source (today/week/month)
- Success rate percentage
- Average scraping duration
- Error count by type
- Properties in review queue
- Auto-analysis success rate
- Export download statistics

### 11. Documentation

Generate:

1. **README.md** with:
   - Installation instructions
   - Environment variables required
   - Running scrapers locally vs. production
   - Troubleshooting common issues

2. **API_DOCUMENTATION.md** with:
   - All endpoint specifications
   - Request/response examples
   - Authentication requirements

3. **DEPLOYMENT.md** with:
   - Docker container setup
   - Environment configuration
   - Cron job setup for scheduled scraping
   - Monitoring and alerting setup

### 12. Environment Variables

Add to `.env`:
```bash
# Scraping Configuration
SCRAPER_ENABLED=true
RIGHTMOVE_ENABLED=true
ZOOPLA_ENABLED=true
ONTHEMARKET_ENABLED=true
SCRAPER_SCHEDULE_TYPE=TWICE_DAILY  # or HOURLY, CUSTOM
SCRAPER_CUSTOM_CRON=  # If using CUSTOM schedule

# Rate Limiting
SCRAPER_RATE_LIMIT_DELAY=3000  # milliseconds between requests
SCRAPER_MAX_CONCURRENT=2       # max concurrent requests per domain

# Proxy Configuration (OPTIONAL - only add if you experience blocking)
SCRAPER_USE_PROXY=false
SCRAPER_PROXY_URL=              # e.g., http://username:password@proxy.example.com:8080
# For rotating proxies (BrightData, Oxylabs, etc.), they handle rotation automatically

# User-Agent Rotation
SCRAPER_USER_AGENT_POOL=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...,Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...

# Auto-Analysis Settings
AUTO_ANALYSIS_ENABLED=true
AUTO_ANALYSIS_THRESHOLD=50     # Only auto-analyze if BMV score > 50
REQUIRE_MANUAL_REVIEW=true    # Flag ambiguous properties for review

# API Keys
PROPERTYDATA_API_KEY=your_propertydata_key  # Already in use for BMV analysis
CLAUDE_API_KEY=your_claude_key              # Already in use for AI analysis
GOOGLE_MAPS_API_KEY=your_google_maps_key    # Optional: For geocoding addresses

# Notification Configuration
ADMIN_EMAIL=your_email@example.com
ADMIN_PHONE=+447xxxxxxxxx      # For SMS alerts via Twilio
SLACK_WEBHOOK_URL=             # Optional: Slack notifications

# Twilio (for SMS notifications) - you may already have this configured
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# File Storage (for exports)
STORAGE_TYPE=local             # or s3, gcs
AWS_S3_BUCKET=                 # If using S3 for exports
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Database (already configured)
DATABASE_URL=postgresql://user:password@localhost:5432/property_sourcing

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Your app URL
```

**Required vs Optional Environment Variables:**

**REQUIRED:**
- `DATABASE_URL` - PostgreSQL connection
- `CLAUDE_API_KEY` - For AI property analysis
- `PROPERTYDATA_API_KEY` - For BMV valuations

**HIGHLY RECOMMENDED:**
- `ADMIN_EMAIL` - For notifications
- `SCRAPER_ENABLED` - Control scraping on/off
- Source toggles (`RIGHTMOVE_ENABLED`, etc.)

**OPTIONAL:**
- All proxy-related variables (add only if blocked)
- `GOOGLE_MAPS_API_KEY` (addresses usually include coordinates)
- Twilio variables (if you want SMS alerts)
- AWS variables (if using S3 for export storage)
- `SLACK_WEBHOOK_URL` (if using Slack)

### 13. PropertyData API Integration

Since you're already using PropertyData API, enhance the scraping integration:

```typescript
// /lib/integrations/property-data.ts

interface PropertyDataClient {
  getValuation(postcode: string, propertyType: string): Promise<any>;
  getComparables(postcode: string, radius: number): Promise<any>;
  getAreaStats(postcode: string): Promise<any>;
}

export async function enrichPropertyWithPropertyData(
  property: PropertyListing
): Promise<void> {
  const address = property.address as any;
  
  try {
    // Get valuation from PropertyData API
    const valuation = await propertyDataClient.getValuation(
      address.postcode,
      property.propertyType
    );
    
    // Get comparables
    const comparables = await propertyDataClient.getComparables(
      address.postcode,
      1.0 // 1 mile radius
    );
    
    // Get area statistics
    const areaStats = await propertyDataClient.getAreaStats(
      address.postcode
    );
    
    // Update property with PropertyData analysis
    await prisma.propertyListing.update({
      where: { id: property.id },
      data: {
        propertyDataAnalysis: {
          estimatedValue: valuation.estimatedValue,
          comparables: comparables.slice(0, 5), // Top 5 comparables
          localAreaStats: areaStats,
          lastUpdated: new Date()
        }
      }
    });
    
    console.log(`Enriched property ${property.id} with PropertyData`);
    
  } catch (error) {
    console.error(`Error enriching property ${property.id} with PropertyData:`, error);
    // Don't fail the entire process if PropertyData API is unavailable
  }
}
```

**Integration Points:**

1. **After Scraping**: Optionally enrich new properties with PropertyData valuations
2. **During Analysis**: Use PropertyData estimates to calculate BMV score more accurately
3. **In Review Queue**: Show PropertyData comparables to help manual reviewers
4. **For Exports**: Include PropertyData valuations in exported data

### 14. Performance Optimization

**Caching Strategy:**
- Cache property images locally (optional)
- Redis cache for frequently accessed listings
- Incremental updates: only scrape new/changed listings

**Batch Processing:**
- Process 50-100 properties per batch
- Bulk database inserts using Prisma transactions
- Parallel processing with worker threads

### 15. Monitoring & Alerting

**Metrics to Track on Admin Dashboard:**
- Properties scraped per source (Rightmove/Zoopla/OnTheMarket) - daily/weekly/monthly
- Scraping success rate by source
- Average scraping duration per property
- BMV properties discovered vs total scraped
- Properties in review queue (pending/approved/rejected)
- Auto-analysis completion rate
- Commercial vs residential property ratio
- Database growth rate (storage usage)
- Error rates by type and source
- Export download statistics
- PropertyData API usage and costs

**Real-time Alerts (via Email/SMS/Slack):**
- **Critical**: Persistent scraping failures (>5 consecutive for any source)
- **High Priority**: IP blocking detected (immediate action required)
- **High Priority**: High-value BMV opportunities (>£100k potential, >20% discount)
- **Medium Priority**: Unusual data patterns (e.g., no listings found, dramatic pattern changes)
- **Medium Priority**: Review queue backlog (>50 pending reviews)
- **Low Priority**: Daily scraping summary (properties found, BMV count)
- **Low Priority**: Weekly performance report

**Dashboard Implementation:**

```typescript
// components/Dashboard/ScraperMetrics.tsx

export function ScraperMetricsDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  
  useEffect(() => {
    fetchMetrics();
  }, []);
  
  return (
    <div className="metrics-dashboard">
      <h1>Scraper Performance Dashboard</h1>
      
      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Properties Today"
          value={metrics?.todayCount}
          change={metrics?.todayChange}
          icon="📊"
        />
        <MetricCard
          title="BMV Discovered"
          value={metrics?.bmvCount}
          change={metrics?.bmvChange}
          icon="💎"
        />
        <MetricCard
          title="Review Queue"
          value={metrics?.pendingReviews}
          icon="⏳"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics?.successRate}%`}
          icon="✅"
        />
      </div>
      
      {/* Source Performance Chart */}
      <SourcePerformanceChart data={metrics?.bySource} />
      
      {/* Recent Errors Log */}
      <RecentErrorsTable errors={metrics?.recentErrors} />
      
      {/* Export History */}
      <ExportHistoryTable exports={metrics?.recentExports} />
    </div>
  );
}
```

## Implementation Priority

**Phase 1 (Week 1): Core Infrastructure**
1. Database schema updates (Prisma migrations) including commercial properties
2. Base scraper architecture with abstract base class
3. Rightmove scraper (residential + commercial)
4. Basic API endpoints (trigger, status, listings)
5. Settings management (toggles for auto-analysis, sources)
6. Local testing framework with mock data

**Phase 2 (Week 2): Additional Sources + Review System**
7. Zoopla scraper implementation (residential + commercial)
8. OnTheMarket scraper implementation
9. Manual review queue system and UI
10. Anti-detection measures (rate limiting, user-agent rotation)
11. Error handling and structured logging
12. BMV ambiguity detection logic

**Phase 3 (Week 3): Automation + Analysis**
13. Scheduler implementation (twice daily cron jobs)
14. Auto-analysis integration (Claude API + PropertyData API)
15. Notification system (Email/SMS for high-value deals)
16. Export functionality (CSV/Excel/JSON)
17. Data quality validation
18. Performance optimization (batch processing, caching)

**Phase 4 (Week 4): Production + Polish**
19. Production deployment on AWS EC2
20. Monitoring dashboard implementation
21. Alert system configuration
22. Commercial property analysis enhancement
23. Documentation (README, API docs, deployment guide)
24. Final testing across all three sources
25. Training materials for non-technical partner

**Optional Phase 5 (If Needed): Proxy Integration**
26. Implement proxy rotation (only if experiencing blocking)
27. Cost-benefit analysis of proxy services
28. Fallback mechanisms for proxy failures

## Success Criteria

**Scraping Performance:**
- Successfully scrape 200+ properties per day across all three sources (Rightmove + Zoopla + OnTheMarket)
- Scrape both residential AND commercial properties
- Run twice daily (morning and evening) without manual intervention
- <5% error rate in data extraction
- Average scraping time <30 seconds per property
- Zero unhandled blocking incidents (graceful handling if blocked)

**Data Quality:**
- BMV indicator accuracy >80%
- All extracted data validates against Prisma schema
- Duplicate detection working (same property from multiple sources)
- Commercial property data includes all required fields (rateable value, lease info, etc.)

**Automation & Integration:**
- Scheduler runs automatically twice daily
- Auto-analysis processes new properties based on settings toggle
- Ambiguous properties correctly routed to review queue
- PropertyData API integration enriches property valuations
- Settings can be toggled in UI without code changes

**User Experience:**
- Review queue UI allows easy approve/reject of ambiguous BMV properties
- Export functionality generates CSV/Excel files on demand
- Admin dashboard shows real-time scraping metrics
- Alerts sent for high-value BMV opportunities within 5 minutes of discovery
- Non-technical partner can review properties and download exports without developer help

**Reliability:**
- System recovers gracefully from errors (retries, queuing)
- Logging captures all events for troubleshooting
- Scraping jobs complete successfully >95% of the time
- No data loss even if scraping job fails mid-way

## Important Notes

**Legal & Compliance:**
- ⚠️ Rightmove, Zoopla, and OnTheMarket terms of service prohibit automated scraping
- This may be considered a violation of their terms
- Consider these alternatives:
  - **PropertyData.co.uk API**: Legitimate data access (you're already using this)
  - **Estate agent data feeds**: Many agents offer XML/JSON feeds
  - **Official APIs**: Some platforms offer restricted APIs for partners
- If you proceed with scraping:
  - Implement respectful practices (rate limiting, twice daily only)
  - Be prepared to pivot to API-based solutions if challenged
  - Consider liability insurance for your SaaS platform

**Best Practices:**
- Keep scraping patterns randomized to appear human-like
- Store raw HTML for debugging parsing issues
- Version control all scraper logic for easy rollback
- Respect robots.txt directives
- Monitor and respect server load (don't scrape during peak hours)

**Cost Considerations:**
- Start WITHOUT proxies to minimize costs
- Add proxies only if blocked (~£50-100/month)
- PropertyData API costs may increase with more lookups
- Consider caching PropertyData results to minimize API calls
- AWS EC2 hosting costs for 24/7 operation

**Scalability:**
- Current design handles 200-500 properties/day easily
- For 1000+ properties/day, consider:
  - Distributed scraping across multiple servers
  - Redis queue for job management
  - Dedicated workers for parsing vs fetching
  
**Integration with Existing Platform:**
- Scraped properties feed into your existing vendor acquisition pipeline
- Claude API analyzes properties just like vendor submissions
- Investor matching system can handle scraped properties
- Same deal flow as manually sourced properties

---

**Final Recommendation:** Given that you're already using PropertyData API legitimately, consider whether web scraping adds enough value to justify the legal risk. PropertyData provides comprehensive property data, valuations, and comparables legally. You might achieve 80% of the value with 20% of the risk by focusing on:
1. Enhanced PropertyData API integration
2. Vendor acquisition optimization (your existing strength)
3. Agent relationship building for direct data feeds
4. Auction platform integrations (more motivated sellers)

However, if you decide to proceed with scraping, this implementation provides a robust, production-ready system with all the features you requested.

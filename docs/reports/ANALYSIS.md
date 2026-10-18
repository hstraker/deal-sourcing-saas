# Codebase Analysis - 2025-12-27

## Project Overview

**Deal Sourcing SaaS Platform** - A comprehensive property investment platform that automates the entire deal lifecycle from vendor lead generation through to investor sale. The platform combines AI-powered SMS conversations with vendors, PropertyData API integration for market analysis, and automated investor pack generation to streamline the UK below-market-value (BMV) property sourcing business.

### Key Value Proposition
- **For Sourcers**: Automate vendor qualification, deal validation, and investor marketing
- **For Vendors**: Quick, professional offers with transparent communication
- **For Investors**: Access to validated, below-market-value property deals with professional investor packs

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14.2.15 (App Router with React Server Components)
- **Language**: TypeScript 5.5.4
- **UI**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.7
- **Components**: Radix UI / Shadcn/UI (19 primitives)
- **Icons**: Lucide React 0.446.0
- **Forms**: React Hook Form 7.53.0 + Zod 3.23.8 validation
- **Drag & Drop**: @hello-pangea/dnd 18.0.1
- **Charts**: Recharts 2.15.4
- **Notifications**: Sonner 2.0.7

### Backend
- **Runtime**: Node.js >=18.17.0
- **Framework**: Next.js API Routes (App Router)
- **Authentication**: NextAuth.js 4.24.7 (Credentials provider)
- **Database ORM**: Prisma 5.19.1
- **Database**: PostgreSQL
- **Password Hashing**: bcryptjs 2.4.3

### AI & Automation
- **AI Providers**:
  - Anthropic SDK 0.27.3 (Claude Sonnet 4.5) - Primary
  - OpenAI 6.15.0 (GPT-4 Turbo) - Alternative
- **SMS**: Twilio 5.11.1
- **PDF Generation**: Puppeteer 24.0.34

### Cloud Services & APIs
- **File Storage**: AWS S3 (@aws-sdk/client-s3 3.654.0)
- **Email**: AWS SES / Nodemailer 7.0.12
- **Property Data**: PropertyData API (https://api.propertydata.co.uk)
- **Lead Generation**: Facebook Lead Ads API
- **Tunneling**: Cloudflare Tunnel (cloudflared)

### Development Tools
- **Build Tool**: Next.js SWC compiler
- **Linting**: ESLint 8.57.0
- **Scripts**: tsx 4.16.2

---

## Current Features

### 1. Deal Management System ✅ COMPLETE
**Location**: `/app/dashboard/deals/`, `/components/deals/`

#### Features:
- **CRUD Operations**: Full create/read/update/delete with role-based access
- **Auto-calculations**: BMV%, yield, ROI, ROCE, deal score (0-100)
- **Status Workflow**: `new → review → in_progress → ready → listed → reserved → sold → archived`
- **Photo Management**:
  - AWS S3 upload via presigned URLs
  - Multiple photos per deal
  - Cover photo selection
  - Drag-to-reorder
  - Gallery with lightbox
- **Deal Pipeline**: Drag-and-drop kanban board with real-time status updates
- **PropertyData Integration**:
  - Search by postcode
  - Auto-populate property details
  - Market value & comparables
  - Rental estimates
  - 30-day response caching
- **Investor Pack Generation**:
  - PDF generation via Puppeteer
  - 4-part template system (The Investables Method)
  - Single-page template option
  - Multiple color schemes
  - Template manager with usage tracking

### 2. Vendor Pipeline (AI-Powered) ✅ COMPLETE
**Location**: `/app/dashboard/vendors/`, `/lib/vendor-pipeline/`

#### Features:
- **Lead Capture**:
  - Facebook Lead Ads webhook integration
  - Manual vendor entry
  - Facebook Ad Simulator (testing tool)
  - Duplicate detection (phone/Facebook ID)

- **AI SMS Agent**:
  - Automated multi-turn conversations
  - Natural language understanding
  - Extract: address, price, condition, timeline, motivation
  - Motivation scoring (1-10)
  - Objection handling
  - Video content delivery

- **Pipeline Stages** (13 stages):
  ```
  NEW_LEAD → AI_CONVERSATION → DEAL_VALIDATION →
  OFFER_MADE → OFFER_ACCEPTED/REJECTED → VIDEO_SENT →
  RETRY_1/2/3 → PAPERWORK_SENT → READY_FOR_INVESTORS → DEAD_LEAD
  ```

- **Deal Validation**:
  - BMV score calculation
  - Market value estimation (PropertyData API)
  - Rental yield analysis
  - Refurbishment cost estimation
  - Profit potential calculation

- **Offer Engine**:
  - Auto-generate offers (80-85% of market value)
  - Track offer history
  - Handle acceptances/rejections
  - 3 retry attempts with delays (2d, 4d, 7d)

- **Comparables System**:
  - Fetch sold prices from PropertyData
  - Filter by bedrooms, type, age
  - Rental yield per comparable
  - Rightmove & Zoopla links
  - Confidence scoring

- **Analytics Dashboard**:
  - Pipeline stage metrics
  - Conversion rates
  - Time in each stage
  - Motivation score distribution
  - BMV trends

### 3. Investor Management ✅ COMPLETE
**Location**: `/app/dashboard/investors/`, `/components/investors/`

#### Features:
- **Investor Profiles**:
  - Investment criteria (budget, areas, yield, BMV, strategy)
  - Experience level tracking
  - Financing status
  - Pipeline stage tracking (LEAD → CONTACTED → QUALIFIED → VIEWING_DEALS → RESERVED → PURCHASED → INACTIVE)

- **Investor Pack Delivery**:
  - Email delivery tracking
  - View/download tracking
  - Part-by-part delivery (4-part packs)
  - Delivery history

- **Activity Tracking** (12 activity types):
  - Account created/updated
  - Deal viewed/favorited
  - Pack requested/viewed/downloaded
  - Reservation made/cancelled
  - Purchase completed
  - Communication sent/received

- **Reservations System**:
  - Reservation fee tracking
  - Proof of funds verification (S3 upload)
  - Lock-out agreement management (S3 upload)
  - Solicitor details
  - Status workflow: `pending → fee_pending → proof_of_funds_pending → verified → locked_out → completed → cancelled`

- **Stats Dashboard**:
  - Deals viewed count
  - Packs requested count
  - Active reservations
  - Deals purchased
  - Total spent

### 4. Comparables System ✅ COMPLETE
**Location**: `/app/api/comparables/`, `/components/comparables/`

#### Features:
- **Comparable Property Cards**:
  - Sale price & date
  - Bedrooms, type, size
  - Distance from target
  - Monthly rent estimate
  - Rental yield with confidence range
  - Rightmove & Zoopla links

- **Search Configuration**:
  - Search radius (miles)
  - Max results
  - Max age (months)
  - Bedroom tolerance
  - Property type filters
  - Min confidence score

- **Analytics**:
  - Average sale price
  - Price range (min/max)
  - Average rental yield
  - Yield range
  - Confidence scoring

- **Dashboard Widgets**:
  - Recent comparables card
  - Top yields card

### 5. Company Profile & Branding ✅ COMPLETE
**Location**: `/app/dashboard/settings/company-profile/`

#### Features:
- **Company Details**:
  - Name, email, phone, website, address
  - Logo upload (S3)
  - Primary & secondary colors
  - Description & tagline

- **Social Media Links**:
  - LinkedIn, Facebook, Twitter, Instagram

- **Legal Information**:
  - Company registration number
  - VAT number
  - FCA number

- **Global Branding**:
  - Used across investor packs
  - Email templates
  - Dashboard branding

### 6. Authentication & User Management ✅ COMPLETE
**Location**: `/app/api/auth/`, `/app/login/`

#### Features:
- **User Roles** (3 levels):
  - `admin`: Full access
  - `sourcer`: Limited access (own deals + vendor pipeline)
  - `investor`: Customer portal access

- **Authentication**:
  - Email/password login
  - Password hashing (bcryptjs)
  - Session management (NextAuth)
  - Forgot password flow
  - Reset password with token
  - Password expiry (24 hours)

- **User Management**:
  - Create/edit users
  - Profile picture upload (S3)
  - Team member listing
  - Active/inactive status

- **Middleware Protection**:
  - Dashboard routes protected
  - Role-based access control
  - Investor routes blocked for non-investors

### 7. Settings & Configuration ✅ COMPLETE
**Location**: `/app/dashboard/settings/`

#### Features:
- **Investor Pack Templates**:
  - Template editor (4-part & single)
  - Color scheme selection (blue, green, purple, gold, dark)
  - Section customization
  - Set default template
  - Duplicate templates
  - Usage statistics

- **Comparables Settings**:
  - Per-user configuration
  - Search preferences
  - Filter defaults

- **Company Profile**:
  - Global branding settings
  - Legal information

### 8. Development Tools ✅ COMPLETE
**Location**: `/app/api/dev/`, `/app/admin/`

#### Features:
- **Facebook Ad Simulator**:
  - Test lead submissions
  - Simulate Facebook webhook
  - Custom form fields
  - Rate limit monitoring

- **Test Data Management**:
  - Clear test data endpoint
  - AI conversation testing
  - Verbose logging mode

- **Scripts** (17 scripts):
  - `seed-admin.ts`: Create admin user
  - `seed-vendors.ts`: Create test vendors
  - `recalculate-deal-metrics.ts`: Recalc all metrics
  - `check-deal-rent-data.ts`: Verify rent data
  - `verify-aws-env.js`: Check AWS credentials
  - And more...

---

## File Structure

```
deal-sourcing-saas/
├── app/                               # Next.js App Router
│   ├── api/                           # API Routes (63 endpoints)
│   │   ├── auth/                      # Authentication (login, forgot/reset password)
│   │   ├── deals/                     # Deal CRUD & photos
│   │   │   └── [id]/
│   │   │       ├── photos/            # Photo management
│   │   │       ├── investor-pack/     # Generate pack from deal
│   │   │       └── status/            # Status updates
│   │   ├── investors/                 # Investor CRUD
│   │   │   ├── pack-delivery/         # Track pack deliveries
│   │   │   ├── stats/                 # Investor statistics
│   │   │   └── activities/            # Activity feed
│   │   ├── reservations/              # Investor reservations
│   │   ├── vendors/                   # Legacy vendor routes
│   │   ├── vendor-leads/              # New vendor pipeline
│   │   │   └── [id]/
│   │   │       ├── fetch-comparables/ # Get comparables
│   │   │       ├── calculate-bmv/     # Calculate BMV
│   │   │       └── investor-pack/     # Generate pack from lead
│   │   ├── vendor-pipeline/           # Pipeline automation
│   │   │   ├── leads/                 # CRUD for leads
│   │   │   ├── send-message/          # SMS sending
│   │   │   ├── webhook/               # SMS webhook
│   │   │   └── stats/                 # Pipeline stats
│   │   ├── facebook-leads/            # Facebook webhook
│   │   ├── propertydata/              # PropertyData API proxy
│   │   ├── comparables/               # Comparables system
│   │   ├── investor-pack-templates/   # Template CRUD
│   │   ├── company-profile/           # Company profile
│   │   ├── users/                     # User management
│   │   ├── analytics/                 # Analytics
│   │   └── dev/                       # Development tools
│   │
│   ├── dashboard/                     # Dashboard pages
│   │   ├── deals/                     # Deal management UI
│   │   │   ├── page.tsx              # Deal list (kanban)
│   │   │   └── [id]/                 # Deal detail
│   │   ├── investors/                 # Investor management UI
│   │   │   ├── page.tsx              # Investor list
│   │   │   └── [id]/                 # Investor detail
│   │   ├── vendors/                   # Vendor pipeline UI
│   │   │   ├── page.tsx              # Unified vendor view
│   │   │   └── analytics/            # Pipeline analytics
│   │   ├── settings/                  # Settings pages
│   │   │   ├── company-profile/      # Company settings
│   │   │   └── investor-packs/       # Pack templates
│   │   └── page.tsx                   # Dashboard home
│   │
│   ├── login/                         # Login page
│   ├── forgot-password/               # Password recovery
│   ├── reset-password/                # Password reset
│   ├── admin/                         # Admin tools
│   │   └── facebook-ad-simulator/    # Test Facebook leads
│   │
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Landing page
│
├── components/                        # React Components
│   ├── analytics/                     # Analytics dashboards (1)
│   ├── comparables/                   # Comparables cards & analysis (5)
│   ├── dashboard/                     # Dashboard widgets (7)
│   ├── deals/                         # Deal components (28)
│   │   ├── deal-form.tsx             # Create/edit form
│   │   ├── deal-list.tsx             # Table view
│   │   ├── deal-pipeline-board.tsx   # Kanban board
│   │   ├── photo-*.tsx               # Photo management (5)
│   │   └── ...
│   ├── investors/                     # Investor components (5)
│   │   ├── investor-list.tsx
│   │   ├── send-pack-modal.tsx
│   │   └── reservation-modal.tsx
│   ├── propertydata/                  # PropertyData widgets (1)
│   ├── reservations/                  # Reservation components (2)
│   ├── settings/                      # Settings components (5)
│   ├── ui/                            # Shadcn/UI primitives (19)
│   ├── users/                         # User management
│   ├── vendor-pipeline/               # Pipeline components (1)
│   └── vendors/                       # Vendor components (11)
│       ├── vendor-pipeline-kanban-board.tsx
│       ├── vendor-lead-detail-modal.tsx
│       └── ...
│
├── lib/                               # Core Business Logic
│   ├── calculations/                  # Deal metrics calculations
│   │   └── deal-metrics.ts           # BMV, yield, ROI, ROCE, score
│   ├── validations/                   # Zod schemas
│   │   ├── deal.ts
│   │   ├── investor.ts
│   │   └── vendor.ts
│   ├── vendor-pipeline/               # Vendor automation (8 modules)
│   │   ├── ai-conversation.ts        # AI SMS logic
│   │   ├── deal-validator.ts         # BMV validation
│   │   ├── offer-engine.ts           # Offer generation
│   │   ├── retry-handler.ts          # Retry logic
│   │   ├── twilio.ts                 # Twilio integration
│   │   ├── twilio-mock.ts            # Mock for testing
│   │   └── types.ts
│   ├── auth.ts                        # NextAuth config
│   ├── db.ts                          # Prisma client
│   ├── propertydata.ts                # PropertyData API client
│   ├── investor-pack-generator.ts     # PDF generation
│   ├── rental-estimator.ts            # Rental estimates
│   ├── s3.ts                          # AWS S3 client
│   └── email.ts                       # AWS SES email
│
├── prisma/
│   └── schema.prisma                  # Database schema (40 models, 15+ enums)
│
├── scripts/                           # Utility Scripts (17)
│   ├── seed-admin.ts
│   ├── seed-vendors.ts
│   ├── recalculate-deal-metrics.ts
│   ├── check-deal-rent-data.ts
│   ├── verify-aws-env.js
│   └── ...
│
├── types/                             # TypeScript definitions
├── hooks/                             # Custom React hooks
├── database/                          # SQL schemas
├── middleware.ts                      # Route protection
├── next.config.js                     # Next.js config
├── tailwind.config.ts                 # Tailwind config
├── tsconfig.json                      # TypeScript config
└── package.json                       # Dependencies
```

---

## Database Schema (40 Models)

### Core Models
1. **User** - System users (admin, sourcer, investor)
2. **CompanyProfile** - Global company information & branding
3. **Investor** - Investor profiles & investment criteria
4. **Deal** - Property deals with full lifecycle tracking
5. **DealPhoto** - Photos stored in S3
6. **DealDocument** - Documents (EPC, floorplan, title, survey)
7. **Comparable** - Comparable properties (linked to deals)
8. **Purchase** - Deal purchases by investors
9. **Favorite** - Favorited deals
10. **DealView** - View tracking
11. **Communication** - Emails/SMS/calls/notes
12. **Alert** - Investor search alerts
13. **PropertyDataCache** - PropertyData API response cache (30-day)

### Vendor Pipeline Models
14. **Vendor** - Legacy vendor model
15. **VendorAIConversation** - AI conversation history (legacy)
16. **VendorOffer** - Offers made to vendors (legacy)
17. **VendorLead** - New vendor pipeline leads (primary)
18. **SMSMessage** - SMS messages with AI metadata
19. **PipelineMetric** - Daily pipeline metrics
20. **PipelineEvent** - Pipeline stage transitions
21. **OfferRetry** - Offer retry tracking (3 attempts)
22. **FacebookLeadSync** - Facebook lead import tracking

### Comparables Models
23. **ComparablesConfig** - User-specific search settings
24. **ComparableProperty** - Individual comparable properties with rental data
25. **ComparablesSnapshot** - Historical comparables snapshots

### Investor Pack Models
26. **InvestorPackTemplate** - Pack templates (4-part & single)
27. **InvestorPackGeneration** - Pack generation log
28. **InvestorPackDelivery** - Pack delivery tracking (with part number)
29. **InvestorActivity** - Investor activity log (12 types)

### Reservation Models
30. **InvestorReservation** - Investor property reservations

### Key Enums (15+)
- **UserRole**: admin, sourcer, investor
- **DealStatus**: new, review, in_progress, ready, listed, reserved, sold, archived
- **PackTier**: basic, standard, premium
- **PaymentStatus**: pending, completed, refunded
- **CommunicationType**: email, sms, call, note
- **DocumentType**: epc, floorplan, title, survey, pack
- **VendorStatus**: contacted, validated, offer_made, offer_accepted, etc.
- **ConversationDirection**: inbound, outbound
- **OfferStatus**: pending, more_info_sent, accepted, rejected, etc.
- **VendorDecision**: accepted, rejected, more_info_requested, counter_offer
- **ReservationStatus**: pending, fee_pending, proof_of_funds_pending, verified, locked_out, completed, cancelled
- **InvestorPipelineStage**: LEAD, CONTACTED, QUALIFIED, VIEWING_DEALS, RESERVED, PURCHASED, INACTIVE
- **InvestorActivityType**: ACCOUNT_CREATED, PROFILE_UPDATED, DEAL_VIEWED, etc. (12 types)
- **PipelineStage**: NEW_LEAD, AI_CONVERSATION, DEAL_VALIDATION, OFFER_MADE, etc. (13 stages)
- **SMSDirection**: inbound, outbound
- **SMSStatus**: queued, sent, delivered, failed, undelivered
- **UrgencyLevel**: urgent, quick, moderate, flexible
- **PropertyCondition**: excellent, good, needs_work, needs_modernisation, poor
- **ReasonForSale**: relocation, financial, divorce, inheritance, downsize, other

### Database Relationships
- Users → Deals (creator, assignee)
- Users → Investors (1:1)
- Investors → Deals (many purchases, favorites, views)
- Investors → Reservations (many)
- Deals → Photos (many, cascade delete)
- Deals → Comparables (many)
- VendorLeads → SMSMessages (many)
- VendorLeads → ComparableProperties (many)
- Templates → Generations (many)

---

## API Endpoints (63 Routes)

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth handler
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Deals (10 endpoints)
- `GET /api/deals` - List deals (filtered by role, status, postcode, assignedTo)
- `POST /api/deals` - Create deal (auto-calculate metrics)
- `GET /api/deals/[id]` - Get deal details
- `PATCH /api/deals/[id]` - Update deal
- `DELETE /api/deals/[id]` - Delete deal (admin only)
- `PATCH /api/deals/[id]/status` - Update status
- `POST /api/deals/[id]/photos/presign` - Get S3 presigned URL
- `GET /api/deals/[id]/photos` - List photos
- `POST /api/deals/[id]/photos` - Save photo metadata
- `DELETE /api/deals/[id]/photos/[photoId]` - Delete photo
- `PATCH /api/deals/[id]/photos/[photoId]/cover` - Set cover
- `POST /api/deals/[id]/investor-pack` - Generate investor pack PDF

### Investors (6 endpoints)
- `GET /api/investors` - List investors
- `POST /api/investors` - Create investor
- `GET /api/investors/[id]` - Get investor details
- `PATCH /api/investors/[id]` - Update investor
- `PATCH /api/investors/[id]/pipeline` - Update pipeline stage
- `GET /api/investors/stats` - Statistics
- `GET /api/investors/activities` - Activity feed
- `POST /api/investors/pack-delivery` - Record pack delivery
- `POST /api/investors/pack-delivery/[id]/track` - Track view/download

### Reservations (5 endpoints)
- `GET /api/reservations` - List reservations
- `POST /api/reservations` - Create reservation
- `GET /api/reservations/[id]` - Get reservation
- `PATCH /api/reservations/[id]` - Update reservation
- `DELETE /api/reservations/[id]` - Cancel reservation
- `POST /api/reservations/[id]/proof-of-funds` - Upload proof of funds

### Vendor Leads (5 endpoints)
- `GET /api/vendor-leads/[id]` - Get vendor lead
- `PATCH /api/vendor-leads/[id]` - Update vendor lead
- `DELETE /api/vendor-leads/[id]` - Delete (admin only)
- `POST /api/vendor-leads/[id]/fetch-comparables` - Fetch comparables
- `GET /api/vendor-leads/[id]/comparables` - Get comparables
- `POST /api/vendor-leads/[id]/calculate-bmv` - Calculate BMV score
- `POST /api/vendor-leads/[id]/investor-pack` - Generate investor pack

### Vendor Pipeline (5 endpoints)
- `GET /api/vendor-pipeline/leads` - List leads
- `POST /api/vendor-pipeline/leads` - Create lead
- `POST /api/vendor-pipeline/send-message` - Send SMS
- `POST /api/vendor-pipeline/webhook` - SMS webhook (Twilio)
- `GET /api/vendor-pipeline/stats` - Pipeline statistics

### Facebook Lead Ads (2 endpoints)
- `GET /api/facebook-leads/webhook` - Webhook verification
- `POST /api/facebook-leads/webhook` - Receive lead submissions

### PropertyData (3 endpoints)
- `POST /api/propertydata` - Get property data by ID
- `POST /api/propertydata/search` - Search properties by postcode
- `GET /api/propertydata/usage` - API usage stats

### Comparables (4 endpoints)
- `GET /api/comparables/config` - Get user config
- `POST /api/comparables/config` - Update config
- `GET /api/comparables/recent` - Recent comparables
- `GET /api/comparables/top-yields` - Highest yields

### Investor Pack Templates (7 endpoints)
- `GET /api/investor-pack-templates` - List templates
- `POST /api/investor-pack-templates` - Create template
- `GET /api/investor-pack-templates/[id]` - Get template
- `PATCH /api/investor-pack-templates/[id]` - Update template
- `DELETE /api/investor-pack-templates/[id]` - Delete template
- `POST /api/investor-pack-templates/[id]/duplicate` - Duplicate
- `POST /api/investor-pack-templates/[id]/set-default` - Set default
- `GET /api/investor-pack-templates/stats` - Usage statistics

### Company Profile (2 endpoints)
- `GET /api/company-profile` - Get profile
- `POST /api/company-profile` - Create/update profile

### Users (6 endpoints)
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user
- `PATCH /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user
- `POST /api/users/[id]/profile-picture` - Upload profile picture
- `GET /api/users/[id]/profile-picture/url` - Get presigned URL
- `GET /api/users/team` - Get team members

### Analytics (1 endpoint)
- `GET /api/analytics/workflow` - Workflow analytics

### Dev Tools (2 endpoints)
- `POST /api/dev/clear-test-data` - Clear test data (dev only)
- `POST /api/dev/test-ai-conversation` - Test AI conversation

### Legacy Vendors (2 endpoints)
- `GET /api/vendors` - List vendors (legacy)
- `POST /api/vendors` - Create vendor (legacy)

---

## Environment Variables

### Required Variables

#### Database
- `DATABASE_URL` - PostgreSQL connection string

#### NextAuth
- `NEXTAUTH_URL` - Application URL (e.g., http://localhost:3000)
- `NEXTAUTH_SECRET` - Secret for session encryption

#### AWS Services
- `AWS_REGION` - AWS region (e.g., eu-west-1)
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET_NAME` - S3 bucket for uploads
- `AWS_SES_REGION` - SES region for emails
- `AWS_SES_FROM_EMAIL` - From email address

#### PropertyData API
- `PROPERTYDATA_API_KEY` - API key for PropertyData
- `PROPERTYDATA_API_URL` - API base URL (https://api.propertydata.co.uk)

#### AI Provider (Choose ONE)
- `ANTHROPIC_API_KEY` - Anthropic API key (recommended)
- `ANTHROPIC_MODEL` - Model name (e.g., claude-sonnet-4-5-20250929)
- `OPENAI_API_KEY` - OpenAI API key (alternative)
- `OPENAI_MODEL` - Model name (e.g., gpt-4-turbo-preview)
- `AI_PROVIDER` - Explicitly set provider: "anthropic" or "openai"

#### Twilio SMS
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number (E.164 format)

#### Facebook Lead Ads
- `FACEBOOK_ACCESS_TOKEN` - Facebook access token
- `FACEBOOK_LEAD_FORM_ID` - Lead form ID
- `FACEBOOK_PAGE_ID` - Page ID

### Optional Variables

#### Application
- `NODE_ENV` - Environment (development/production)
- `APP_URL` - Public application URL

#### Email (Alternative to SES)
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP port
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password

#### Stripe (Phase 3)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

#### Pipeline Configuration
- `MIN_BMV_PERCENTAGE` - Min BMV % (default: 15.0)
- `MAX_ASKING_PRICE` - Max asking price (default: 500000)
- `MIN_PROFIT_POTENTIAL` - Min profit (default: 30000)
- `OFFER_BASE_PERCENTAGE` - Base offer % (default: 80)
- `OFFER_MAX_PERCENTAGE` - Max offer % (default: 85)
- `RETRY_1_DELAY_DAYS` - First retry delay (default: 2)
- `RETRY_2_DELAY_DAYS` - Second retry delay (default: 4)
- `RETRY_3_DELAY_DAYS` - Third retry delay (default: 7)
- `MAX_RETRIES` - Max retries (default: 3)
- `CONVERSATION_TIMEOUT_HOURS` - Timeout (default: 48)
- `PIPELINE_POLL_INTERVAL` - Poll interval seconds (default: 60)
- `VIDEO_OBJECTION_URL` - Objection handling video URL

---

## External Integrations

### 1. PropertyData API
**Purpose**: UK property data & analytics
**Website**: https://api.propertydata.co.uk
**Credit Limit**: 2,000/month

**Endpoints Used**:
- `/sourced-properties` - Search properties by postcode across 30+ lists
- `/sourced-property` - Get property details by ID
- `/valuation-sale` - Property valuation estimates
- `/rents` - Rental estimates (monthly, weekly, yield)
- `/sold-prices` - Comparable sales data

**Features**:
- 30+ property lists (repossessed, quick-sale, motivated sellers, etc.)
- Valuation with confidence ranges
- Rental yield calculations
- Comparable properties with rental data
- 30-day response caching to reduce costs

### 2. AWS Services

#### S3 (File Storage)
- Deal photos
- Deal documents (EPC, floorplan, title, survey)
- Profile pictures
- Proof of funds documents
- Lock-out agreements
- Generated investor packs (temporary)

**Bucket**: Configured via `AWS_S3_BUCKET_NAME`
**Region**: eu-west-1
**Features**: Presigned URLs for secure uploads/downloads

#### SES (Email Delivery)
- Password reset emails
- Investor pack delivery
- Notifications
- Communication tracking

**Region**: eu-west-1
**From**: Configured via `AWS_SES_FROM_EMAIL`

### 3. Twilio (SMS)
**Purpose**: SMS automation for vendor conversations

**Features**:
- Send SMS to vendors
- Receive SMS webhooks
- AI-driven conversations
- Message status tracking (queued, sent, delivered, failed)
- Mock service available for testing

**Phone Format**: E.164 (e.g., +447123456789)

### 4. Facebook Lead Ads
**Purpose**: Lead generation from Facebook ads

**Features**:
- Webhook integration for real-time lead capture
- Field mapping (name, phone, email, property details)
- Duplicate detection
- Lead sync tracking
- Ad simulator for testing

**Webhook URL**: `https://your-domain.com/api/facebook-leads/webhook`

### 5. AI Providers

#### Anthropic Claude (Primary)
**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
**Use Cases**:
- SMS conversation generation
- Intent detection
- Data extraction from vendor messages
- Better UK property context understanding

#### OpenAI (Alternative)
**Model**: GPT-4 Turbo (`gpt-4-turbo-preview`)
**Use Cases**: Same as Anthropic

**Configuration**: Set `AI_PROVIDER` env variable to choose

### 6. Cloudflare Tunnel
**Purpose**: Development webhook testing

**Features**:
- Expose localhost to internet
- Custom domain support
- Tunnel persistence

**Domain**: invest.thefatoffice.co.uk

---

## Known Issues & Technical Debt

### High Priority
1. **Vendor Model Duplication** - Three overlapping vendor systems:
   - `Vendor` (legacy)
   - `VendorLead` (new pipeline)
   - Hybrid routes confusion
   - **Action**: Consolidate or deprecate old `Vendor` model

2. **formatCurrency Duplication** - Same function in 16 files
   - **Action**: Create shared `lib/format.ts` utility

3. **calculateStampDuty Duplication** - Same function in 3 places
   - **Action**: Use single source from `lib/calculations/deal-metrics.ts`

### Medium Priority
4. **Unused File** - `lib/investor-pack-generator-old.ts` (1,124 lines)
   - **Action**: Delete (not imported anywhere)

5. **Vendor Component Duplication**:
   - `vendor-pipeline-board.tsx` (simple)
   - `vendor-pipeline-kanban-board.tsx` (full-featured)
   - **Action**: Evaluate if simple version still needed

6. **Redirect Page** - `/app/dashboard/vendors/pipeline/page.tsx` just redirects
   - **Action**: Remove and inline redirect logic

### Low Priority
7. **TODO Comments** (3 instances):
   - `/api/vendor-pipeline/stats/route.ts`: Calculate timeToOffer and timeToClose
   - `/api/vendor-leads/[id]/calculate-bmv/route.ts`: Add square footage field

8. **Dev Routes in Production** - `/api/dev/*` routes still present
   - **Action**: Ensure admin-only protection

---

## Production Readiness

### ✅ Complete & Production-Ready
- Authentication & authorization
- Deal CRUD with full lifecycle
- Vendor pipeline with AI automation
- Investor management & reservations
- Comparables system
- Investor pack generation
- Photo management
- Role-based access control
- API validation (Zod schemas)
- Database migrations (Prisma)
- Error handling & logging

### ⚠️ Needs Attention
- Remove duplicate code (formatCurrency, stampDuty)
- Clean up vendor model confusion
- Complete TODO items
- Remove unused file (investor-pack-generator-old.ts)

### 🚧 Future Enhancements
- Stripe payment integration (Phase 3)
- Real-time notifications (WebSockets)
- Advanced analytics & reporting
- Mobile app (React Native)
- Multi-tenant support
- White-label capabilities

---

## Summary

This is a **production-ready, feature-complete** property deal sourcing platform with:

**Strengths**:
- Comprehensive feature set (8 major systems)
- Modern tech stack (Next.js 14, TypeScript, Prisma)
- AI-powered automation (Claude/GPT-4)
- Professional UI (Shadcn/UI)
- Robust database schema (40 models)
- Extensive API coverage (63 endpoints)
- Good separation of concerns
- Development tools & mocks

**Architecture Highlights**:
- Modular, feature-based organization
- Role-based access control
- Automated workflows (vendor pipeline)
- Real-time tracking (activities, events)
- Caching strategy (PropertyData API)
- S3 for file storage
- SES for emails
- Twilio for SMS

**Business Value**:
- Automates vendor qualification (saves hours per lead)
- Professional investor packs (increases conversion)
- BMV validation (reduces bad deals)
- Pipeline visibility (tracks every stage)
- Activity tracking (investor engagement)
- Reservation management (deal flow)

This platform is ready for deployment and can support a property sourcing business at scale.

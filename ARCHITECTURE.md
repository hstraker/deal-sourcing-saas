# System Architecture - 2025-12-27

## Table of Contents
1. [High-Level System Overview](#high-level-system-overview)
2. [Technology Architecture](#technology-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Component Relationships](#component-relationships)
5. [Database Design](#database-design)
6. [External Integrations](#external-integrations)
7. [Authentication Flow](#authentication-flow)
8. [File Upload Flow](#file-upload-flow)
9. [AI Vendor Pipeline Flow](#ai-vendor-pipeline-flow)
10. [Investor Pack Generation Flow](#investor-pack-generation-flow)

---

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DEAL SOURCING SAAS PLATFORM                       │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│                │      │                │      │                │
│   VENDORS      │─────▶│   PLATFORM     │─────▶│   INVESTORS    │
│ (Lead Source)  │      │  (Automation)  │      │  (Customers)   │
│                │      │                │      │                │
└────────────────┘      └────────────────┘      └────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐      ┌────────────────┐
│ Facebook Ads  │      │ AI SMS Agent   │      │ Email Delivery │
│ Lead Capture  │      │ BMV Validation │      │ Pack Download  │
│ SMS Conv.     │      │ Offer Engine   │      │ Reservations   │
└───────────────┘      └────────────────┘      └────────────────┘
```

### System Purpose
**Input**: Vendor leads (motivated property sellers)
**Process**: AI qualification → BMV validation → Offer generation → Deal creation
**Output**: Validated deals with investor packs → Investor reservations → Sales

---

## Technology Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            FRONTEND LAYER                             │
├──────────────────────────────────────────────────────────────────────┤
│  Next.js 14 App Router (React Server Components + Client Components) │
│                                                                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │ Dashboard  │  │ Deal Pipeline│  │   Vendors   │  │  Investors  ││
│  │   Pages    │  │   (Kanban)   │  │  Pipeline   │  │     CRM     ││
│  └────────────┘  └──────────────┘  └─────────────┘  └─────────────┘│
│                                                                        │
│  UI: Shadcn/UI + Tailwind CSS + Radix Primitives                     │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTPS
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Next.js)                         │
├──────────────────────────────────────────────────────────────────────┤
│  REST API Routes (63 endpoints)                                       │
│                                                                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐       │
│  │  Deals   │  │  Vendors  │  │ Investors│  │ Reservations │       │
│  │   API    │  │ Pipeline  │  │   API    │  │     API      │       │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────┘       │
│                                                                        │
│  Authentication: NextAuth.js (Session-based)                          │
│  Validation: Zod Schemas                                              │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC LAYER                           │
├──────────────────────────────────────────────────────────────────────┤
│  /lib/ - Core Business Logic                                          │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐      │
│  │  Calculations   │  │ Vendor Pipeline │  │  Investor Pack │      │
│  │  - BMV, Yield   │  │  - AI Agent     │  │   Generator    │      │
│  │  - ROI, ROCE    │  │  - Validation   │  │   (Puppeteer)  │      │
│  │  - Deal Score   │  │  - Offer Engine │  │                │      │
│  └─────────────────┘  └─────────────────┘  └────────────────┘      │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐      │
│  │  PropertyData   │  │   AWS S3/SES    │  │     Twilio     │      │
│  │     Client      │  │     Client      │  │      SMS       │      │
│  └─────────────────┘  └─────────────────┘  └────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER (Prisma)                          │
├──────────────────────────────────────────────────────────────────────┤
│  ORM: Prisma                                                           │
│  Database: PostgreSQL                                                  │
│                                                                        │
│  40 Models:                                                            │
│  - User, CompanyProfile, Investor, Deal, DealPhoto                    │
│  - Vendor, VendorLead, SMSMessage, VendorOffer                       │
│  - InvestorReservation, InvestorActivity, InvestorPackDelivery       │
│  - Comparable, ComparableProperty, PropertyDataCache                  │
│  - InvestorPackTemplate, InvestorPackGeneration                      │
│  - And 23 more...                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL INTEGRATIONS                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ PropertyData │  │   AWS S3     │  │   AWS SES    │  │  Twilio  ││
│  │     API      │  │ File Storage │  │    Email     │  │   SMS    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Facebook   │  │   Anthropic  │  │    OpenAI    │               │
│  │  Lead Ads    │  │  Claude AI   │  │   GPT-4      │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Deal Lifecycle Flow

```
┌──────────────┐
│ Deal Created │ (Manual or PropertyData Import)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Auto-Calculate Metrics                                    │
│ - BMV % (Below Market Value)                             │
│ - Gross & Net Yield                                      │
│ - ROI & ROCE                                             │
│ - Deal Score (0-100)                                     │
│ - Pack Tier (basic/standard/premium)                    │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Status: NEW  │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   REVIEW     │──────▶│ IN_PROGRESS  │──────▶│    READY     │
└──────────────┘       └──────────────┘       └──────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │   LISTED     │
                                               └──────┬───────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │   RESERVED   │
                                               └──────┬───────┘
                                                      │
                                                      ▼
                                        ┌──────────────┐  ┌──────────────┐
                                        │     SOLD     │  │   ARCHIVED   │
                                        └──────────────┘  └──────────────┘
```

### 2. Vendor Lead to Deal Flow

```
┌─────────────────┐
│ Facebook Ad     │
│ Lead Submitted  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Webhook: /api/facebook-leads/   │
│ - Duplicate check (phone/FB ID) │
│ - Create VendorLead             │
│ - Status: NEW_LEAD              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ AI SMS Conversation             │
│ - Send intro SMS                │
│ - Parse vendor responses        │
│ - Extract: address, price,      │
│   condition, timeline           │
│ - Calculate motivation score    │
│ - Status: AI_CONVERSATION       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Deal Validation                 │
│ - PropertyData API lookup       │
│ - Market value estimation       │
│ - Fetch comparables             │
│ - Calculate BMV score           │
│ - Rental yield analysis         │
│ - Status: DEAL_VALIDATION       │
└────────┬────────────────────────┘
         │
         ├── BMV < 15% ────────────▶ DEAD_LEAD
         │
         ▼
┌─────────────────────────────────┐
│ Offer Generation                │
│ - Calculate offer (80-85% MV)   │
│ - Send offer via SMS            │
│ - Status: OFFER_MADE            │
└────────┬────────────────────────┘
         │
         ├── Accepted ────────────┐
         │                         │
         ├── Rejected ───▶ RETRY_1 │
         │                  ▼       │
         │                RETRY_2   │
         │                  ▼       │
         │                RETRY_3   │
         │                  ▼       │
         │                DEAD_LEAD │
         │                         │
         ▼                         │
┌─────────────────────────────────┐│
│ Request Solicitor Details       ││
│ - Status: OFFER_ACCEPTED        ││
└────────┬────────────────────────┘│
         │◀────────────────────────┘
         ▼
┌─────────────────────────────────┐
│ Create Deal Record              │
│ - Vendor accepted offer         │
│ - Solicitor details collected   │
│ - Link VendorLead to Deal       │
│ - Deal status: READY            │
│ - VendorLead status:            │
│   READY_FOR_INVESTORS           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Generate Investor Pack          │
│ - Create PDF (Puppeteer)        │
│ - Upload to S3 (temporary)      │
│ - Deal status: LISTED           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Market to Investors             │
│ - Send packs via email          │
│ - Track views/downloads         │
│ - Manage reservations           │
└─────────────────────────────────┘
```

---

## Component Relationships

### Deal Management Components

```
┌────────────────────────────────────────────────────────┐
│                   Dashboard Page                       │
│              /app/dashboard/deals/page.tsx             │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│  DealPipelineBoard   │    │     DealList         │
│  (Kanban View)       │    │   (Table View)       │
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           │ Uses                      │ Uses
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────┐
│              DealCard Component                      │
│  - Photo thumbnail                                   │
│  - Address, price, BMV%                             │
│  - Deal score badge                                  │
│  - Quick actions (edit, delete, view)               │
└──────────┬───────────────────────────────────────────┘
           │
           │ Opens modal
           │
           ▼
┌──────────────────────────────────────────────────────┐
│              DealDetailModal                         │
│  ┌────────────────────────────────────────────────┐ │
│  │  Tabs:                                         │ │
│  │  - Overview (metrics, location)               │ │
│  │  - Photos (gallery, upload)                   │ │
│  │  - Analysis (comparables, charts)             │ │
│  │  - Documents (EPC, floorplan)                 │ │
│  │  - Activity (history, notes)                  │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Vendor Pipeline Components

```
┌────────────────────────────────────────────────────────┐
│              Unified Vendors View                      │
│         /app/dashboard/vendors/page.tsx                │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Pipeline Kanban     │    │    Vendor List       │
│      Board           │    │   (Table View)       │
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           │ Uses                      │ Uses
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────┐
│            VendorLeadCard                            │
│  - Vendor name, phone                                │
│  - Property address, asking price                   │
│  - Motivation score, BMV score                      │
│  - Pipeline stage badge                             │
└──────────┬───────────────────────────────────────────┘
           │
           │ Opens modal
           │
           ▼
┌──────────────────────────────────────────────────────┐
│          VendorLeadDetailModal                       │
│  ┌────────────────────────────────────────────────┐ │
│  │  Tabs:                                         │ │
│  │  - Details (contact, property info)           │ │
│  │  - Conversation (SMS history)                 │ │
│  │  - Offer (offer details, history)             │ │
│  │  - Validation (BMV, comparables)              │ │
│  │  - Comparables (sold prices, yields)          │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Investor Management Components

```
┌────────────────────────────────────────────────────────┐
│                 Investor Dashboard                     │
│           /app/dashboard/investors/page.tsx            │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│   InvestorList       │    │ ReservationModal     │
│   (Table View)       │    │ (Create/Edit)        │
└──────────┬───────────┘    └──────────────────────┘
           │
           │ Opens modal
           │
           ▼
┌──────────────────────────────────────────────────────┐
│              InvestorDetailModal                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  - Investment criteria                         │ │
│  │  - Pipeline stage                              │ │
│  │  - Stats (deals viewed, packs requested)      │ │
│  │  - Activity feed                               │ │
│  │  - Reservations                                │ │
│  └────────────────────────────────────────────────┘ │
│                                                       │
│  Actions:                                            │
│  - Send investor pack                                │
│  - Create reservation                                │
│  - Update pipeline stage                             │
└──────────────────────────────────────────────────────┘
```

---

## Database Design

### Core Entity Relationships

```
┌──────────────┐
│     USER     │
└──────┬───────┘
       │ 1:1
       ├───────────────────────────────────┐
       │                                   │
       ▼ 1:1                               ▼ 1:many
┌──────────────┐                    ┌──────────────┐
│   INVESTOR   │                    │     DEAL     │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ many:many                         │ 1:many
       │ (via favorites)                   │
       └───────────────────────────────────┤
       │                                   │
       │ many:many                         ▼ 1:many
       │ (via purchases)            ┌──────────────┐
       └───────────────────────────▶│  DEAL PHOTO  │
       │                            └──────────────┘
       │ 1:many
       │                            ┌──────────────┐
       └───────────────────────────▶│  COMPARABLE  │
                                    └──────────────┘

┌──────────────┐
│ VENDOR LEAD  │
└──────┬───────┘
       │ 1:many
       ├───────────────────────────────────┐
       │                                   │
       ▼ 1:many                            ▼ 1:many
┌──────────────┐                    ┌──────────────┐
│ SMS MESSAGE  │                    │ COMPARABLE   │
│              │                    │  PROPERTY    │
└──────────────┘                    └──────────────┘
       │
       │ 1:many
       ▼
┌──────────────┐
│ PIPELINE     │
│   EVENT      │
└──────────────┘
```

### Investor Reservation Flow

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   INVESTOR   │───────│ RESERVATION  │───────│     DEAL     │
└──────────────┘  1:m  └──────┬───────┘  m:1  └──────────────┘
                               │
                               │ has states:
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │   PENDING   │ │ FEE_PENDING │ │ PROOF_OF_   │
        │             │ │             │ │   FUNDS_    │
        │             │ │             │ │  PENDING    │
        └─────────────┘ └─────────────┘ └─────────────┘
                │              │              │
                └──────────────┼──────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │  VERIFIED   │ │ LOCKED_OUT  │ │  COMPLETED  │
        └─────────────┘ └─────────────┘ └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  CANCELLED  │
                        └─────────────┘
```

### Investor Pack Tracking

```
┌──────────────────┐
│  PACK TEMPLATE   │
└────────┬─────────┘
         │ 1:many
         │
         ▼
┌──────────────────┐
│ PACK GENERATION  │
└────────┬─────────┘
         │ 1:many
         │
         ▼
┌──────────────────┐       ┌──────────────┐
│ PACK DELIVERY    │───────│   INVESTOR   │
└────────┬─────────┘  m:1  └──────────────┘
         │ m:1
         │
         ▼
┌──────────────────┐
│      DEAL        │
└──────────────────┘

Fields tracked:
- sentAt (timestamp)
- viewedAt (timestamp)
- downloadedAt (timestamp)
- viewCount (integer)
- downloadCount (integer)
- partNumber (1, 2, 3, 4, or NULL for single pack)
```

---

## External Integrations

### Integration Architecture

```
                    ┌─────────────────┐
                    │  Next.js App    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ PropertyData   │  │     AWS        │  │    Twilio      │
│      API       │  │   Services     │  │      SMS       │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                   │
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ - Search       │  │ - S3 (files)   │  │ - Send SMS     │
│ - Valuation    │  │ - SES (email)  │  │ - Receive SMS  │
│ - Comparables  │  │                │  │ - Webhooks     │
│ - Rents        │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘

         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   Facebook     │  │   Anthropic    │  │     OpenAI     │
│   Lead Ads     │  │    Claude      │  │     GPT-4      │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                   │
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ - Webhook      │  │ - AI Conv.     │  │ - AI Conv.     │
│ - Lead Form    │  │ - Intent Det.  │  │ - Intent Det.  │
│ - Field Map    │  │ - Extraction   │  │ - Extraction   │
└────────────────┘  └────────────────┘  └────────────────┘
```

### PropertyData API Flow

```
┌──────────────┐
│ UI Component │ (Deal form, vendor validation)
└──────┬───────┘
       │
       │ POST /api/propertydata/search?postcode=SW1A1AA
       │
       ▼
┌──────────────────────────────────────────────┐
│ /api/propertydata/search                     │
│                                              │
│ 1. Check cache (30-day expiry)              │
│    - Query: PropertyDataCache table         │
│    - Key: address + postcode                │
│                                              │
│ 2. If cache miss:                            │
│    - Call PropertyData API                  │
│    - Save response to cache                 │
│    - Decrement credit usage                 │
│                                              │
│ 3. Return data:                              │
│    - Property details                        │
│    - Valuation (market value)               │
│    - Rental estimates                        │
│    - Comparable sales                        │
└──────┬───────────────────────────────────────┘
       │
       │ Response JSON
       │
       ▼
┌──────────────────┐
│ UI Component     │ (Auto-populate form)
└──────────────────┘

Cache Structure:
┌──────────────────────────────────────────────┐
│ PropertyDataCache                            │
│ - address: "123 Main St"                     │
│ - postcode: "SW1A 1AA"                       │
│ - data: { ...full API response... }          │
│ - fetchedAt: 2025-01-01T00:00:00Z           │
│ - expiresAt: 2025-01-31T00:00:00Z (30 days)│
│ - creditsUsed: 1                             │
└──────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌──────────────┐
│ User visits  │
│ /dashboard   │
└──────┬───────┘
       │
       │ Request
       │
       ▼
┌──────────────────────────────────────────────┐
│ Middleware.ts                                │
│                                              │
│ 1. Check if route is protected:             │
│    - /dashboard/* = YES                     │
│    - /api/* (most) = YES                    │
│                                              │
│ 2. Get session (NextAuth):                  │
│    - Check cookie/JWT                       │
│    - Validate session                       │
│                                              │
│ 3. If no session:                            │
│    - Redirect to /login                     │
│                                              │
│ 4. If session exists:                        │
│    - Check role-based access                │
│    - Allow access                           │
└──────┬───────────────────────────────────────┘
       │
       │ No session
       │
       ▼
┌──────────────────────────────────────────────┐
│ /login                                       │
│                                              │
│ User enters credentials                      │
└──────┬───────────────────────────────────────┘
       │
       │ POST /api/auth/[...nextauth]
       │
       ▼
┌──────────────────────────────────────────────┐
│ NextAuth Credentials Provider                │
│                                              │
│ 1. Find user by email:                      │
│    - Query: User table                      │
│                                              │
│ 2. Verify password:                          │
│    - bcrypt.compare(password, hash)         │
│                                              │
│ 3. If valid:                                 │
│    - Create session                         │
│    - Set cookie                             │
│    - Return user object                     │
│                                              │
│ 4. If invalid:                               │
│    - Return null                            │
│    - Show error                             │
└──────┬───────────────────────────────────────┘
       │
       │ Success
       │
       ▼
┌──────────────────────────────────────────────┐
│ Session Created                              │
│                                              │
│ JWT/Cookie contains:                         │
│ - userId                                     │
│ - email                                      │
│ - role (admin/sourcer/investor)             │
│ - name                                       │
│                                              │
│ Valid for: 30 days (configurable)           │
└──────┬───────────────────────────────────────┘
       │
       │ Redirect to /dashboard
       │
       ▼
┌──────────────────────────────────────────────┐
│ Dashboard (Protected)                        │
│                                              │
│ Server Components can access session via:   │
│ - getServerSession(authOptions)             │
│                                              │
│ Client Components use:                       │
│ - useSession() hook                         │
└──────────────────────────────────────────────┘
```

### Role-Based Access Control

```
                    ┌─────────────────┐
                    │   User Session  │
                    │   role: ?       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  ADMIN  │        │ SOURCER │        │INVESTOR │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                   │
         │ Full Access      │ Limited Access    │ Customer Access
         │                  │                   │
         ▼                  ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ All routes     │  │ - Own deals    │  │ - View deals   │
│ All data       │  │ - Vendors      │  │ - Reservations │
│ User mgmt      │  │ - Analytics    │  │ - Profile      │
│ Settings       │  │ (no settings)  │  │ (read-only)    │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## File Upload Flow (AWS S3)

```
┌──────────────┐
│ UI Component │ (DealPhotoUpload, ProfilePictureUpload)
│              │
│ User selects │
│ file         │
└──────┬───────┘
       │
       │ 1. Request presigned URL
       │ POST /api/deals/[id]/photos/presign
       │ Body: { fileName: "photo.jpg", fileType: "image/jpeg" }
       │
       ▼
┌──────────────────────────────────────────────┐
│ API Route: /api/deals/[id]/photos/presign   │
│                                              │
│ 1. Authenticate user                         │
│ 2. Validate file type (jpg, png, pdf, etc.) │
│ 3. Generate unique S3 key:                  │
│    - Format: deals/{dealId}/{uuid}.jpg      │
│ 4. Generate presigned URL (15 min expiry):  │
│    - AWS SDK: getSignedUrl()                │
│ 5. Return:                                   │
│    - presignedUrl: "https://s3..."          │
│    - s3Key: "deals/123/abc.jpg"             │
└──────┬───────────────────────────────────────┘
       │
       │ 2. Presigned URL returned
       │
       ▼
┌──────────────────────────────────────────────┐
│ Client-Side Upload                           │
│                                              │
│ 1. PUT to presigned URL (directly to S3)    │
│    - File data in body                      │
│    - Content-Type header                    │
│                                              │
│ 2. S3 responds with 200 OK                  │
│                                              │
│ 3. No server load (direct upload)           │
└──────┬───────────────────────────────────────┘
       │
       │ 3. Upload complete
       │
       ▼
┌──────────────────────────────────────────────┐
│ Save Metadata                                │
│                                              │
│ POST /api/deals/[id]/photos                 │
│ Body: {                                      │
│   s3Key: "deals/123/abc.jpg",               │
│   s3Url: "https://s3...",                   │
│   caption: "Front view"                     │
│ }                                            │
│                                              │
│ Creates DealPhoto record in database        │
└──────┬───────────────────────────────────────┘
       │
       │ 4. Success
       │
       ▼
┌──────────────┐
│ UI Component │ (Display uploaded photo)
└──────────────┘

S3 Bucket Structure:
┌──────────────────────────────────────────────┐
│ deal-sourcing-uploads/                       │
│                                              │
│ ├── deals/                                   │
│ │   ├── {dealId}/                           │
│ │   │   ├── photo1.jpg                      │
│ │   │   └── photo2.jpg                      │
│ │                                            │
│ ├── documents/                               │
│ │   ├── {dealId}/                           │
│ │   │   ├── epc.pdf                         │
│ │   │   └── floorplan.pdf                   │
│ │                                            │
│ ├── profile-pictures/                        │
│ │   └── {userId}.jpg                        │
│ │                                            │
│ ├── proof-of-funds/                          │
│ │   └── {reservationId}.pdf                 │
│ │                                            │
│ └── investor-packs/                          │
│     └── {dealId}-{timestamp}.pdf (temp)     │
└──────────────────────────────────────────────┘
```

---

## AI Vendor Pipeline Flow

```
┌──────────────────┐
│ Facebook Ad      │
│ Lead Submitted   │
└────────┬─────────┘
         │
         │ POST /api/facebook-leads/webhook
         │ Body: { name, phone, email, property_address, ... }
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Webhook Handler                                        │
│                                                        │
│ 1. Verify Facebook signature                          │
│ 2. Parse form fields                                   │
│ 3. Duplicate check (phone + FB ID)                    │
│ 4. Create VendorLead:                                  │
│    - pipelineStage: NEW_LEAD                          │
│    - conversationState: {}                            │
└────────┬───────────────────────────────────────────────┘
         │
         │ Trigger: Cron job or manual action
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ AI Conversation Agent                                  │
│ /lib/vendor-pipeline/ai-conversation.ts               │
│                                                        │
│ 1. Build conversation context:                        │
│    - Previous SMS history                             │
│    - Vendor lead data                                 │
│    - System instructions                              │
│                                                        │
│ 2. Generate AI prompt:                                │
│    - Extract: address, price, condition, timeline    │
│    - Calculate motivation score (1-10)               │
│    - Handle objections                                │
│                                                        │
│ 3. Call AI provider:                                  │
│    - Anthropic Claude (primary)                       │
│    - OR OpenAI GPT-4 (fallback)                       │
│                                                        │
│ 4. Parse AI response:                                 │
│    - Message to send                                  │
│    - Extracted data (JSON)                            │
│    - Intent classification                            │
│    - Confidence score                                 │
└────────┬───────────────────────────────────────────────┘
         │
         │ Send SMS
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Twilio SMS Service                                     │
│ /lib/vendor-pipeline/twilio.ts                        │
│                                                        │
│ 1. Send SMS:                                           │
│    - POST to Twilio API                               │
│    - From: TWILIO_PHONE_NUMBER                        │
│    - To: vendor phone                                 │
│    - Body: AI-generated message                       │
│                                                        │
│ 2. Save SMSMessage record:                             │
│    - direction: outbound                              │
│    - aiGenerated: true                                │
│    - status: queued → sent → delivered               │
│                                                        │
│ 3. Update VendorLead:                                  │
│    - lastContactAt: now                               │
│    - conversationState: updated                       │
└────────┬───────────────────────────────────────────────┘
         │
         │ Vendor replies
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ SMS Webhook                                            │
│ POST /api/vendor-pipeline/webhook                     │
│                                                        │
│ 1. Parse Twilio webhook:                              │
│    - MessageSid                                        │
│    - From (vendor phone)                              │
│    - Body (message text)                              │
│                                                        │
│ 2. Find VendorLead by phone                           │
│                                                        │
│ 3. Save inbound SMSMessage                             │
│                                                        │
│ 4. Trigger AI response (async):                       │
│    - Call AI conversation agent                       │
│    - Generate reply                                   │
│    - Send via Twilio                                  │
└────────┬───────────────────────────────────────────────┘
         │
         │ Conversation continues...
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Deal Validation                                        │
│ /lib/vendor-pipeline/deal-validator.ts                │
│                                                        │
│ Trigger: When sufficient data collected               │
│                                                        │
│ 1. PropertyData API lookup:                           │
│    - Search by address                                │
│    - Get market value estimate                        │
│    - Fetch comparables                                │
│                                                        │
│ 2. Calculate BMV score:                                │
│    - BMV % = (MV - AP) / MV * 100                    │
│    - Example: (£300k - £250k) / £300k = 16.7%       │
│                                                        │
│ 3. Validation rules:                                   │
│    - BMV >= 15% (configurable)                        │
│    - Asking price <= £500k (configurable)            │
│    - Profit potential >= £30k (configurable)         │
│                                                        │
│ 4. If validation passes:                               │
│    - pipelineStage: DEAL_VALIDATION → OFFER_MADE    │
│    - Trigger offer engine                             │
│                                                        │
│ 5. If validation fails:                                │
│    - pipelineStage: DEAD_LEAD                        │
│    - validationNotes: "BMV too low"                  │
└────────┬───────────────────────────────────────────────┘
         │
         │ Validation passed
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Offer Engine                                           │
│ /lib/vendor-pipeline/offer-engine.ts                  │
│                                                        │
│ 1. Calculate offer:                                    │
│    - Base: 80% of market value                        │
│    - Adjusted for motivation score                    │
│    - Range: 80-85%                                    │
│    - Example: £300k * 82% = £246k                    │
│                                                        │
│ 2. Format offer message (SMS):                        │
│    "Based on our analysis, we can offer £246,000     │
│     for your property. This is a cash offer and      │
│     we can complete quickly."                         │
│                                                        │
│ 3. Send via Twilio                                     │
│                                                        │
│ 4. Update VendorLead:                                  │
│    - offerAmount: £246,000                            │
│    - offerSentAt: now                                 │
│    - pipelineStage: OFFER_MADE                        │
└────────┬───────────────────────────────────────────────┘
         │
         │ Vendor responds
         │
         ├── "Yes" ────────────┐
         │                     │
         ├── "No" ─────────────┤
         │                     │
         └── "Maybe" ──────────┤
                               │
         ┌─────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Offer Response Handler                                 │
│                                                        │
│ ACCEPTED:                                              │
│ - pipelineStage: OFFER_ACCEPTED                       │
│ - Request solicitor details via SMS                   │
│ - Collect: name, firm, email, phone                  │
│ - When complete: Create Deal record                   │
│ - Link VendorLead to Deal                             │
│                                                        │
│ REJECTED:                                              │
│ - pipelineStage: OFFER_REJECTED                       │
│ - Trigger retry handler                               │
│ - Schedule retry (2 days, 4 days, 7 days)           │
│ - Send video or adjusted offer                        │
│                                                        │
│ MORE INFO REQUESTED:                                   │
│ - pipelineStage: VIDEO_SENT                           │
│ - Send video explaining process                       │
│ - Follow up after 2 days                              │
└────────────────────────────────────────────────────────┘
```

### AI Conversation Example

```
┌──────────────────────────────────────────────────────┐
│ SMS Conversation Flow                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│ [Bot]: Hi Sarah! Thanks for your interest in        │
│        selling your property. I'm here to help.     │
│        Can you confirm the address?                 │
│                                                      │
│ [Vendor]: Yes, it's 123 Main Street, London SW1    │
│                                                      │
│ [Bot]: Great! What's your asking price?             │
│                                                      │
│ [Vendor]: I'm hoping for around £300,000            │
│                                                      │
│ [Bot]: Thanks! What's the condition of the property?│
│        Excellent, Good, or Needs Work?              │
│                                                      │
│ [Vendor]: It needs some modernisation               │
│                                                      │
│ [Bot]: How soon are you looking to sell?            │
│                                                      │
│ [Vendor]: ASAP - I need to relocate for work        │
│                                                      │
│ [AI Analysis]:                                       │
│ - Address: 123 Main Street, London SW1             │
│ - Asking Price: £300,000                            │
│ - Condition: needs_modernisation                    │
│ - Timeline: urgent (ASAP)                           │
│ - Reason: relocation (work)                         │
│ - Motivation Score: 9/10 (urgent timeline)          │
│                                                      │
│ [System]: Trigger deal validation...                │
│                                                      │
│ [PropertyData API]:                                  │
│ - Market Value: £350,000                            │
│ - BMV: 14.3% (below threshold)                      │
│ - Wait... vendor wants £300k, MV is £350k          │
│ - BMV: (£350k - £300k) / £350k = 14.3%            │
│ - Actually GOOD DEAL!                               │
│                                                      │
│ [Bot]: Thanks for the details! I'm analyzing your   │
│        property now. I'll be back in touch shortly  │
│        with an offer.                               │
│                                                      │
│ [System]: Generate offer (80-85% of £350k MV)      │
│ - Base: £280k (80%)                                 │
│ - Adjusted: £290k (83% due to high motivation)     │
│ - Profit margin: £350k - £290k = £60k              │
│                                                      │
│ [Bot]: Based on our analysis, we can offer          │
│        £290,000 for your property. This is a cash   │
│        offer and we can complete in 4 weeks.        │
│        Are you interested?                          │
│                                                      │
│ [Vendor]: Yes, that works for me                    │
│                                                      │
│ [Bot]: Excellent! To proceed, I need your           │
│        solicitor's details. Who is your solicitor?  │
│                                                      │
│ [Vendor]: Smith & Jones Law, 020 1234 5678         │
│                                                      │
│ [Bot]: Perfect! I'll send you the paperwork and     │
│        we'll be in touch shortly to move forward.   │
│                                                      │
│ [System]:                                            │
│ - pipelineStage: READY_FOR_INVESTORS               │
│ - Create Deal record                                │
│ - dealId: "abc-123"                                 │
│ - Link VendorLead to Deal                           │
│ - Notify admin team                                 │
└──────────────────────────────────────────────────────┘
```

---

## Investor Pack Generation Flow

```
┌──────────────┐
│ Admin clicks │
│ "Generate    │
│  Pack"       │
└──────┬───────┘
       │
       │ POST /api/deals/[id]/investor-pack?templateId=xyz
       │ OR
       │ POST /api/vendor-leads/[id]/investor-pack?templateId=xyz
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ API Route Handler                                      │
│                                                        │
│ 1. Authenticate & authorize                            │
│                                                        │
│ 2. Fetch template:                                     │
│    - If templateId provided, use it                   │
│    - Else use default template                        │
│    - Validate template is active                      │
│                                                        │
│ 3. Fetch deal/vendor lead data:                        │
│    - Property details                                 │
│    - Photos                                            │
│    - Metrics (BMV, yield, ROI)                        │
│    - Comparables                                       │
│    - Company profile (for branding)                   │
│                                                        │
│ 4. Increment generation counter                        │
└────────┬───────────────────────────────────────────────┘
         │
         │ Pass data to generator
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Investor Pack Generator                                │
│ /lib/investor-pack-generator.ts                       │
│                                                        │
│ 1. Determine template type:                            │
│    - 4-part (The Investables Method)                  │
│    - Single-page                                       │
│                                                        │
│ 2. Build HTML template:                                │
│    - Inject data into template                        │
│    - Apply color scheme                               │
│    - Include company branding                         │
│    - Format currency (£)                              │
│    - Format percentages                               │
│    - Add charts & graphs                              │
│                                                        │
│ 3. Generate PDF via Puppeteer:                         │
│    - Launch headless browser                          │
│    - Load HTML                                         │
│    - Wait for rendering                               │
│    - Print to PDF                                      │
│    - Format: A4, landscape/portrait                   │
│                                                        │
│ 4. Clean up:                                           │
│    - Close browser                                     │
│    - Return PDF buffer                                │
└────────┬───────────────────────────────────────────────┘
         │
         │ PDF buffer returned
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Post-Generation Processing                             │
│                                                        │
│ 1. Log generation:                                     │
│    - Create InvestorPackGeneration record             │
│    - Record: dealId, templateId, fileSize            │
│                                                        │
│ 2. Update deal status:                                 │
│    - If deal status = "ready"                         │
│    - Update to "listed"                               │
│    - Set investorPackSent = true                      │
│    - Set investorPackSentAt = now                     │
│                                                        │
│ 3. Update template usage:                              │
│    - Increment usageCount                             │
│    - Set lastUsedAt = now                             │
│                                                        │
│ 4. Return PDF:                                         │
│    - Content-Type: application/pdf                    │
│    - Content-Disposition: attachment                  │
│    - Filename: investor-pack-{address}.pdf           │
└────────┬───────────────────────────────────────────────┘
         │
         │ Download starts
         │
         ▼
┌──────────────┐
│ User receives│
│ PDF download │
└──────────────┘

Optional: Send to Investor
┌────────────────────────────────────────────────────────┐
│ Send Pack Modal                                        │
│ /components/investors/send-pack-modal.tsx             │
│                                                        │
│ 1. Select investor                                     │
│ 2. Select deal                                         │
│ 3. Select part (1, 2, 3, 4, or complete)             │
│ 4. Add notes                                           │
│                                                        │
│ POST /api/investors/pack-delivery                     │
│ Body: {                                                │
│   investorId: "abc",                                  │
│   dealId: "xyz",                                      │
│   partNumber: 1,                                      │
│   notes: "Part 1 - Executive Summary"                │
│ }                                                      │
│                                                        │
│ Creates InvestorPackDelivery record                   │
│ Sends email via AWS SES                               │
│ Tracks: sentAt, viewedAt, downloadedAt               │
└────────────────────────────────────────────────────────┘
```

### 4-Part Pack Structure

```
┌────────────────────────────────────────────────────────┐
│ The Investables Method (4-Part Investor Pack)         │
├────────────────────────────────────────────────────────┤
│                                                        │
│ PART 1: Executive Summary (1 page)                    │
│ ├─ Property snapshot                                  │
│ ├─ Key metrics (BMV, yield)                          │
│ ├─ Investment highlights                              │
│ └─ No direct ask for money (pique interest)          │
│                                                        │
│ ↓ Wait for response                                    │
│                                                        │
│ PART 2: Company Profile (3-5 pages)                   │
│ ├─ About us                                           │
│ ├─ Track record                                       │
│ ├─ Process overview                                   │
│ ├─ Team & credentials                                 │
│ └─ Social proof (credibility)                        │
│                                                        │
│ ↓ Build trust                                          │
│                                                        │
│ PART 3: Case Studies (varies)                         │
│ ├─ Previous deals                                     │
│ ├─ Investor testimonials                              │
│ ├─ ROI examples                                       │
│ └─ Build authority with track record                 │
│                                                        │
│ ↓ Qualify investor (HNWI/Sophisticated)              │
│                                                        │
│ PART 4: Investment Offering (8-15 pages)              │
│ ├─ ⚠️ FCA COMPLIANT - HNWI/SI ONLY                   │
│ ├─ Full property details                             │
│ ├─ Financial projections                              │
│ ├─ Investment structure                               │
│ ├─ Risk disclosures                                   │
│ ├─ Legal information                                  │
│ └─ Call to action                                     │
│                                                        │
└────────────────────────────────────────────────────────┘

Timing:
- Part 1 → PAUSE → Wait for response
- If interested → Schedule intro call
- After call → Send Part 2
- Part 2 → Part 3 (can send together)
- STOP and QUALIFY before Part 4
- Part 4 → Only to certified HNWI/Sophisticated
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Production Environment              │
└──────────────────────────────────────────────────────┘

┌────────────────┐
│   Cloudflare   │ (Optional: DNS, CDN, DDoS protection)
└────────┬───────┘
         │
         ▼
┌────────────────┐
│   Vercel /     │ (Next.js hosting)
│   Custom VPS   │
└────────┬───────┘
         │
         ├────────────────────┬────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  PostgreSQL    │  │   AWS S3       │  │  External APIs │
│  (Database)    │  │ (File Storage) │  │ (PropertyData, │
│                │  │                │  │  Twilio, etc.) │
└────────────────┘  └────────────────┘  └────────────────┘

Environment Variables (Required):
┌────────────────────────────────────────────────────────┐
│ Production .env                                        │
├────────────────────────────────────────────────────────┤
│ DATABASE_URL=postgresql://...                         │
│ NEXTAUTH_SECRET=...                                    │
│ NEXTAUTH_URL=https://yourdomain.com                   │
│ AWS_ACCESS_KEY_ID=...                                  │
│ AWS_SECRET_ACCESS_KEY=...                              │
│ AWS_S3_BUCKET_NAME=...                                 │
│ PROPERTYDATA_API_KEY=...                               │
│ TWILIO_ACCOUNT_SID=...                                 │
│ TWILIO_AUTH_TOKEN=...                                  │
│ ANTHROPIC_API_KEY=...                                  │
│ (See ANALYSIS.md for full list)                       │
└────────────────────────────────────────────────────────┘

Build & Deploy Process:
┌────────────────────────────────────────────────────────┐
│ 1. npm run build                                       │
│    - Next.js build                                     │
│    - Prisma generate                                   │
│    - TypeScript compile                                │
│                                                        │
│ 2. prisma db push (or migrate deploy)                 │
│    - Apply database schema                             │
│                                                        │
│ 3. npm run start                                       │
│    - Start Next.js server                              │
│    - Port 3000 (default)                               │
│                                                        │
│ 4. Webhooks:                                           │
│    - Facebook: https://yourdomain.com/api/facebook-   │
│                leads/webhook                           │
│    - Twilio:   https://yourdomain.com/api/vendor-     │
│                pipeline/webhook                        │
└────────────────────────────────────────────────────────┘
```

---

## Summary

This architecture document provides a comprehensive view of the Deal Sourcing SaaS platform, including:

### Key Architectural Patterns
- **Server-Side Rendering**: Next.js App Router with React Server Components
- **RESTful API**: 63 endpoints with consistent patterns
- **Event-Driven**: Webhooks for external integrations
- **Stateful Pipeline**: Multi-stage vendor and investor pipelines
- **Caching Strategy**: PropertyData API responses (30-day TTL)
- **File Upload**: Direct-to-S3 via presigned URLs
- **Background Jobs**: AI conversation processing, retry handlers

### Critical Flows
1. **Vendor Pipeline**: Facebook → AI SMS → Validation → Offer → Deal
2. **Investor Pack**: Template → Data → Puppeteer → PDF → Delivery
3. **Authentication**: Credentials → Session → Role-based access
4. **File Upload**: Presigned URL → Direct S3 → Metadata save

### Integration Points
- **PropertyData API**: Market data, valuations, comparables
- **AWS S3**: File storage (photos, documents, packs)
- **AWS SES**: Email delivery
- **Twilio**: SMS automation
- **Facebook**: Lead capture
- **Anthropic/OpenAI**: AI conversations

### Scalability Considerations
- **Database**: PostgreSQL with proper indexes
- **Caching**: API response caching reduces external API costs
- **File Storage**: S3 handles unlimited files
- **Async Processing**: Background jobs for AI and webhooks
- **Stateless API**: Horizontal scaling possible

The platform is production-ready and designed for scale from day one.

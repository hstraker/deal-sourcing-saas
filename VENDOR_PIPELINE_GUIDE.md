# Vendor Acquisition Pipeline - Complete Guide

**Deep Dive into the AI-Powered Vendor Pipeline Feature**

---

## Table of Contents
1. [Overview](#overview)
2. [Complete Workflow](#complete-workflow)
3. [Pipeline Stages](#pipeline-stages)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [AI SMS Agent](#ai-sms-agent)
7. [SMS Integration](#sms-integration)
8. [BMV Validation](#bmv-validation)
9. [Offer Management](#offer-management)
10. [Error Handling](#error-handling)
11. [Monitoring & Metrics](#monitoring--metrics)
12. [Testing & Development](#testing--development)

---

## Overview

The Vendor Acquisition Pipeline is the core feature that automates property deal sourcing. It uses AI-powered SMS conversations to engage motivated sellers, extract property details, validate BMV (Below Market Value) opportunities, and manage the entire process from first contact to deal completion.

### What It Does

1. **Captures leads** from Facebook advertising
2. **Engages vendors** automatically via SMS using Claude AI
3. **Extracts property details** through intelligent conversation
4. **Validates BMV potential** using market comparables
5. **Makes offers** and handles negotiations
6. **Tracks progress** through visual pipeline stages
7. **Generates investor packs** when deals are validated
8. **Manages follow-ups** and retry attempts

### Key Benefits

- **24/7 automated engagement** - No delays in responding to leads
- **Scalable** - Handle 100+ leads with same effort as 10
- **Consistent** - Every vendor gets same quality interaction
- **Data-driven** - Decisions based on real market data
- **Trackable** - Full visibility into pipeline health

---

## Complete Workflow

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Lead Generation                                │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Facebook Lead Form Submitted                                     │
│  - Name, Phone, Property Address                                  │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Webhook Triggered: /api/facebook-leads/webhook                   │
│  - Creates VendorLead record                                      │
│  - Stage: NEW_LEAD                                                │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Initial SMS Sent (within 30 seconds)                             │
│  - Friendly greeting                                              │
│  - Ask if they want property valuation                            │
│  - Stage: AI_CONVERSATION                                         │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  AI Conversation Loop                                             │
│  - Vendor replies via SMS                                         │
│  - AI analyzes response                                           │
│  - Extracts: address, price, condition, motivation                │
│  - Asks follow-up questions                                       │
│  - Repeats until all details collected                            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Property Details Complete?                                       │
└────────┬────────────────────────┬────────────────────────────────┘
         │ Yes                    │ No
         ▼                        ▼
┌─────────────────────┐  ┌───────────────────────┐
│  Trigger BMV        │  │  Continue             │
│  Analysis           │  │  Conversation         │
└────────┬────────────┘  └───────────┬───────────┘
         │                           │
         │                           └─────┐
         ▼                                 │
┌──────────────────────────────────────────▼───────────────────────┐
│  BMV Validation                                                   │
│  - Fetch comparable sales (PropertyData API)                     │
│  - Calculate estimated market value                              │
│  - Determine BMV percentage                                      │
│  - Assess profit potential                                       │
│  - Stage: DEAL_VALIDATION                                        │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Is it a Good Deal?                                               │
│  - BMV > 20%?                                                     │
│  - Profit potential > £20k?                                       │
└────────┬────────────────────────┬────────────────────────────────┘
         │ Yes                    │ No
         ▼                        ▼
┌─────────────────────┐  ┌───────────────────────┐
│  Make Offer         │  │  Stage: DEAD_LEAD     │
│  Stage: OFFER_MADE  │  │  Stop SMS             │
└────────┬────────────┘  └───────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Send Offer via SMS                                               │
│  - "Based on market value, we can offer £X"                      │
│  - Wait for response                                              │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vendor Response?                                                 │
└────┬──────────────────┬──────────────────┬──────────────────────┘
     │ Accepts          │ Rejects          │ No Response
     ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│ Stage:       │  │ Stage:          │  │ Send Video           │
│ OFFER_       │  │ OFFER_REJECTED  │  │ Stage: VIDEO_SENT    │
│ ACCEPTED     │  │ Ask reason      │  │ Wait 48 hours        │
└──────┬───────┘  └─────────────────┘  └──────┬───────────────┘
       │                                        │
       │                                        ▼
       │                                ┌───────────────────────┐
       │                                │ Still No Response?    │
       │                                └───┬───────────┬───────┘
       │                                    │ Yes       │ No
       │                                    ▼           ▼
       │                                ┌────────┐  ┌─────────┐
       │                                │ Retry  │  │ Move to │
       │                                │ Stages │  │ Accepted│
       │                                └────────┘  └─────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Create Deal Record                                               │
│  - Link vendor lead to deal                                       │
│  - Generate investor pack                                         │
│  - Send to matched investors                                      │
│  - Stage: INVESTOR_PACK_SENT                                      │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Investor Reserves Deal                                           │
│  - Reservation record created                                     │
│  - Proof of funds requested                                       │
│  - Stage: INVESTOR_RESERVED                                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Due Diligence & Completion                                       │
│  - Solicitors instructed                                          │
│  - Stage: DUE_DILIGENCE                                           │
│  - Final stage: COMPLETED                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Parallel Processes

While the main flow progresses, these run in parallel:

**Metrics Tracking**
- Pipeline events logged for analytics
- Conversion rates calculated
- Performance dashboards updated

**Rate Limiting**
- SMS throttling (avoid spam)
- API usage tracking
- Cost monitoring

**Error Recovery**
- Failed SMS retries
- API timeout handling
- Manual intervention flagging

---

## Pipeline Stages

The vendor lead progresses through 13 stages:

### Stage 1: NEW_LEAD

**Trigger:** Lead captured from Facebook ad

**Duration:** < 5 minutes (automated transition)

**Actions:**
- Create `VendorLead` record in database
- Log `PipelineEvent` (NEW_LEAD → AI_CONVERSATION)
- Queue initial SMS for sending
- Create `SMSMessage` record (direction: outbound)

**Next Stage:** AI_CONVERSATION (automatic)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "NEW_LEAD",
  leadSource: "facebook_ad",
  facebookLeadId: "...",
  campaignId: "...",
  createdAt: new Date()
}
```

### Stage 2: AI_CONVERSATION

**Trigger:** Initial SMS sent

**Duration:** 1-48 hours (depends on vendor responsiveness)

**Actions:**
- Send friendly greeting SMS
- Wait for vendor reply
- AI analyzes each response
- Extract property details using Claude function calling
- Ask intelligent follow-up questions
- Continue until all required fields populated

**Conversation Goals:**
- ✅ Property address (full postcode)
- ✅ Asking price or price expectation
- ✅ Property type (house/flat/bungalow/etc.)
- ✅ Number of bedrooms
- ✅ Property condition (excellent/good/needs work)
- ✅ Reason for selling (motivation level)
- ✅ Timeline (how urgently they need to sell)
- ✅ Competing offers?

**Next Stage:**
- DEAL_VALIDATION (if all details collected)
- DEAD_LEAD (if vendor stops responding or not interested)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "AI_CONVERSATION",
  conversationStartedAt: new Date(),
  lastContactAt: new Date(),
  propertyAddress: "123 High Street",
  propertyPostcode: "SW1A 1AA",
  askingPrice: 250000,
  propertyType: "terraced_house",
  bedrooms: 3,
  bathrooms: 1,
  condition: "needs_work",
  reasonForSelling: "downsizing",
  motivationScore: 8,  // 0-10 scale
  timelineDays: 60,
  competingOffers: false
}
```

### Stage 3: DEAL_VALIDATION

**Trigger:** All property details collected OR manual trigger

**Duration:** 2-10 minutes (automated API calls)

**Actions:**
1. Fetch comparable sales from PropertyData API
2. Calculate estimated market value (EMV)
3. Calculate BMV percentage: `(EMV - askingPrice) / EMV * 100`
4. Estimate refurbishment costs based on condition
5. Calculate profit potential
6. Assess rental yield potential
7. Store comparables in database
8. Create `ComparablesSnapshot` for audit trail

**Validation Criteria:**
```typescript
const isGoodDeal = (
  bmvScore >= 20 &&           // At least 20% BMV
  profitPotential >= 20000 && // At least £20k profit
  comparablesCount >= 3       // Enough data confidence
)
```

**Next Stage:**
- OFFER_MADE (if good deal)
- DEAD_LEAD (if not viable)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "DEAL_VALIDATION",
  validatedAt: new Date(),
  bmvScore: 25.5,  // Percentage
  estimatedMarketValue: 320000,
  estimatedRefurbCost: 15000,
  profitPotential: 55000,
  validationPassed: true,
  comparablesCount: 5,
  avgComparablePrice: 318000,
  confidence: "high"
}
```

### Stage 4: OFFER_MADE

**Trigger:** BMV validation passed

**Duration:** 24-72 hours (waiting for vendor response)

**Actions:**
1. Calculate offer amount (typically 75-85% of EMV)
2. Send offer SMS with reasoning
3. Wait for vendor response
4. Log offer in database

**Offer SMS Template:**
```
Hi [Name],

Thanks for the details on [Address]. Based on recent sales
in your area and the work needed, we can offer £[Amount]
for a quick cash sale.

This would allow us to exchange in [Timeline] days.

What do you think?
```

**Next Stage:**
- OFFER_ACCEPTED (vendor agrees)
- OFFER_REJECTED (vendor declines)
- VIDEO_SENT (no response after 48 hours)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "OFFER_MADE",
  offerAmount: 240000,
  offerPercentage: 75,  // % of EMV
  offerSentAt: new Date()
}
```

### Stage 5: OFFER_ACCEPTED

**Trigger:** Vendor accepts offer

**Duration:** Ongoing (weeks to completion)

**Actions:**
1. Create `Deal` record linked to vendor lead
2. Generate investor pack PDF
3. Send to matched investors
4. Track investor interest
5. Coordinate solicitors

**Next Stage:**
- INVESTOR_PACK_SENT (pack generated)
- INVESTOR_RESERVED (investor commits)
- DUE_DILIGENCE (formal process begins)
- COMPLETED (deal closes)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "OFFER_ACCEPTED",
  offerAcceptedAt: new Date(),
  dealId: "uuid-of-deal-record"
}
```

### Stage 6: OFFER_REJECTED

**Trigger:** Vendor declines offer

**Duration:** Terminal (end of pipeline)

**Actions:**
1. Log rejection reason
2. Thank vendor for their time
3. Offer to stay in touch if circumstances change
4. Mark as archived

**Key Fields Updated:**
```typescript
{
  pipelineStage: "OFFER_REJECTED",
  offerRejectedAt: new Date(),
  rejectionReason: "price_too_low"
}
```

### Stage 7: VIDEO_SENT

**Trigger:** No response to offer after 48 hours

**Duration:** 48 hours

**Actions:**
1. Send SMS with link to personalized video
2. Video explains our process and builds trust
3. Wait for response

**Next Stage:**
- OFFER_ACCEPTED (if vendor responds positively)
- RETRY_1 (still no response)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "VIDEO_SENT",
  videoSent: true,
  videoUrl: "https://...",
  lastContactAt: new Date()
}
```

### Stages 8-10: RETRY_1, RETRY_2, RETRY_3

**Trigger:** Still no response from vendor

**Duration:** 48-72 hours each

**Actions:**
1. Send increasingly urgent follow-up messages
2. Offer flexibility (higher price, longer timeline)
3. Final attempt before marking dead

**Retry Messages:**
- **Retry 1:** "Just following up on our offer..."
- **Retry 2:** "We're flexible on price if needed..."
- **Retry 3:** "This is our final offer before we move on..."

**Next Stage:**
- OFFER_ACCEPTED (vendor responds)
- DEAD_LEAD (after 3 retries with no response)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "RETRY_1", // or RETRY_2, RETRY_3
  retryCount: 1,
  nextRetryAt: new Date(Date.now() + 48 * 3600 * 1000)
}
```

### Stage 11: INVESTOR_PACK_SENT

**Trigger:** Investor pack generated and emailed

**Duration:** 24-72 hours

**Actions:**
1. PDF pack sent to matched investors
2. Track opens and views
3. Monitor investor responses

**Next Stage:**
- INVESTOR_RESERVED (investor commits)

**Key Fields Updated:**
```typescript
{
  pipelineStage: "INVESTOR_PACK_SENT",
  investorPackGenerationCount: 1,
  lastInvestorPackGeneratedAt: new Date()
}
```

### Stage 12: INVESTOR_RESERVED

**Trigger:** Investor makes reservation

**Duration:** Weeks (during due diligence)

**Actions:**
1. Link to `Reservation` record
2. Request proof of funds
3. Coordinate with solicitors

**Next Stage:**
- DUE_DILIGENCE

**Key Fields Updated:**
```typescript
{
  pipelineStage: "INVESTOR_RESERVED"
  // Related Deal.status = "reserved"
}
```

### Stage 13: DEAD_LEAD

**Trigger:** Multiple scenarios

**Duration:** Terminal

**Reasons:**
- Vendor not interested
- Property not suitable (no BMV)
- Vendor stopped responding after retries
- Vendor withdrew property from sale
- Property already sold

**Actions:**
1. Archive lead
2. Stop all automated messages
3. Log reason for analytics

**Key Fields Updated:**
```typescript
{
  pipelineStage: "DEAD_LEAD",
  // No further actions
}
```

---

## Database Schema

### Primary Table: vendor_leads

```prisma
model VendorLead {
  id                    String   @id @default(cuid())

  // Lead source
  facebookLeadId        String?  @unique
  leadSource            String   @default("facebook_ad")
  campaignId            String?

  // Vendor contact
  vendorName            String
  vendorPhone           String
  vendorEmail           String?
  vendorAddress         String?

  // Property details
  propertyAddress       String?
  propertyPostcode      String?
  askingPrice           Float?
  propertyType          String?
  bedrooms              Int?
  bathrooms             Int?
  squareFeet            Int?
  condition             String?

  // Rental estimates
  estimatedMonthlyRent  Float?
  estimatedAnnualRent   Float?
  rentPerSqFt           Float?

  // Pipeline stage
  pipelineStage         PipelineStage @default(NEW_LEAD)

  // Motivation & timeline
  motivationScore       Int?     // 0-10 scale
  urgencyLevel          String?  // low/medium/high
  reasonForSelling      String?
  timelineDays          Int?
  competingOffers       Boolean?

  // BMV analysis
  bmvScore              Float?
  estimatedMarketValue  Float?
  estimatedRefurbCost   Float?
  profitPotential       Float?
  validationPassed      Boolean?
  validationNotes       String?
  validatedAt           DateTime?

  // Comparables
  comparablesCount      Int      @default(0)
  avgComparablePrice    Float?
  confidence            String?  // low/medium/high

  // Offer management
  offerAmount           Float?
  offerPercentage       Float?
  offerSentAt           DateTime?
  offerAcceptedAt       DateTime?
  offerRejectedAt       DateTime?
  rejectionReason       String?

  // Retry tracking
  retryCount            Int      @default(0)
  nextRetryAt           DateTime?
  videoSent             Boolean  @default(false)
  videoUrl              String?

  // Timestamps
  conversationStartedAt DateTime?
  lastContactAt         DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Investor pack tracking
  investorPackGenerationCount Int @default(0)
  lastInvestorPackGeneratedAt DateTime?

  // Relationships
  dealId                String?  @unique
  deal                  Deal?    @relation(fields: [dealId], references: [id])

  smsMessages           SMSMessage[]
  pipelineEvents        PipelineEvent[]
  offerRetries          OfferRetry[]
  comparableProperties  ComparableProperty[]
  comparablesSnapshots  ComparablesSnapshot[]

  @@index([vendorPhone])
  @@index([pipelineStage, updatedAt])
  @@index([createdAt])
  @@map("vendor_leads")
}
```

### Supporting Table: sms_messages

```prisma
model SMSMessage {
  id              String      @id @default(cuid())
  vendorLeadId    String
  vendorLead      VendorLead  @relation(fields: [vendorLeadId], references: [id], onDelete: Cascade)

  direction       String      // inbound | outbound
  messageBody     String      @db.Text
  status          String?     // sent | delivered | failed

  twilioSid       String?     @unique
  errorCode       String?
  errorMessage    String?

  createdAt       DateTime    @default(now())

  @@index([vendorLeadId, createdAt])
  @@map("sms_messages")
}
```

### Supporting Table: pipeline_events

```prisma
model PipelineEvent {
  id              String      @id @default(cuid())
  vendorLeadId    String
  vendorLead      VendorLead  @relation(fields: [vendorLeadId], references: [id], onDelete: Cascade)

  eventType       String      // stage_change | offer_made | offer_accepted | etc.
  fromStage       String?
  toStage         String?

  metadata        Json?       // Additional context
  userId          String?     // If manual action

  createdAt       DateTime    @default(now())

  @@index([vendorLeadId, createdAt])
  @@map("pipeline_events")
}
```

### Supporting Table: offer_retries

```prisma
model OfferRetry {
  id              String      @id @default(cuid())
  vendorLeadId    String
  vendorLead      VendorLead  @relation(fields: [vendorLeadId], references: [id], onDelete: Cascade)

  retryNumber     Int         // 1, 2, or 3
  messageBody     String      @db.Text
  sentAt          DateTime    @default(now())

  @@index([vendorLeadId])
  @@map("offer_retries")
}
```

### Pipeline Stage Enum

```prisma
enum PipelineStage {
  NEW_LEAD
  AI_CONVERSATION
  DEAL_VALIDATION
  OFFER_MADE
  OFFER_ACCEPTED
  OFFER_REJECTED
  VIDEO_SENT
  RETRY_1
  RETRY_2
  RETRY_3
  INVESTOR_PACK_SENT
  INVESTOR_RESERVED
  DEAD_LEAD
}
```

---

## API Endpoints

### Lead Management

#### POST /api/vendor-pipeline/leads
**Purpose:** Create new vendor lead (typically from Facebook webhook)

**Auth:** Public (webhook)

**Request:**
```typescript
{
  facebookLeadId?: string,
  leadSource: string,
  campaignId?: string,
  vendorName: string,
  vendorPhone: string,
  vendorEmail?: string,
  propertyAddress?: string
}
```

**Response:**
```typescript
{
  lead: VendorLead,
  message: "Lead created and initial SMS queued"
}
```

**Actions:**
- Creates VendorLead record
- Queues initial SMS
- Logs NEW_LEAD event

#### GET /api/vendor-pipeline/leads
**Purpose:** List all leads with filtering

**Auth:** Required (admin/sourcer)

**Query Params:**
- `stage` - Filter by pipeline stage
- `limit` - Pagination limit (default: 50)
- `offset` - Pagination offset

**Response:**
```typescript
{
  leads: VendorLead[],
  total: number,
  stats: {
    byStage: Record<PipelineStage, number>
  }
}
```

#### GET /api/vendor-pipeline/leads/[id]
**Purpose:** Get single lead with full details

**Auth:** Required

**Response:**
```typescript
{
  lead: VendorLead & {
    smsMessages: SMSMessage[],
    pipelineEvents: PipelineEvent[],
    comparableProperties: ComparableProperty[],
    deal?: Deal
  }
}
```

#### PATCH /api/vendor-pipeline/leads/[id]
**Purpose:** Update lead details

**Auth:** Required

**Request:**
```typescript
{
  // Any VendorLead fields
  propertyAddress?: string,
  askingPrice?: number,
  // etc.
}
```

**Response:**
```typescript
{
  lead: VendorLead,
  message: "Lead updated"
}
```

#### POST /api/vendor-pipeline/leads/[id]/update-stage
**Purpose:** Move lead to different stage

**Auth:** Required

**Request:**
```typescript
{
  newStage: PipelineStage,
  reason?: string
}
```

**Response:**
```typescript
{
  lead: VendorLead,
  event: PipelineEvent
}
```

**Actions:**
- Updates pipelineStage
- Logs PipelineEvent
- Triggers stage-specific actions

### Messaging

#### POST /api/vendor-pipeline/leads/[id]/send-message
**Purpose:** Send SMS to vendor

**Auth:** Required

**Request:**
```typescript
{
  message: string
}
```

**Response:**
```typescript
{
  smsMessage: SMSMessage,
  twilioResponse: {
    sid: string,
    status: string
  }
}
```

**Actions:**
- Creates SMSMessage record
- Sends via Twilio API
- Updates lastContactAt

#### POST /api/vendor-pipeline/webhook/sms
**Purpose:** Receive inbound SMS from Twilio

**Auth:** Public (webhook)

**Request:** (Twilio TwiML format)
```
From=+447700900123
To=+441234567890
Body=Yes I'm interested in a valuation
MessageSid=SM...
```

**Response:** (TwiML)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>
```

**Actions:**
- Find VendorLead by phone
- Create inbound SMSMessage
- Process with AI agent
- Send response if needed
- Update lead fields if details extracted

### Analytics

#### GET /api/vendor-pipeline/stats
**Purpose:** Pipeline performance metrics

**Auth:** Required

**Response:**
```typescript
{
  totalLeads: number,
  activeLeads: number,
  byStage: Record<PipelineStage, number>,
  conversionRates: {
    leadToOffer: number,
    offerToAccepted: number,
    acceptedToCompleted: number
  },
  averageTimeInStage: Record<PipelineStage, number>,
  revenueMetrics: {
    totalPipelineValue: number,
    averageDealValue: number,
    projectedMonthlyRevenue: number
  }
}
```

#### GET /api/vendor-pipeline/export
**Purpose:** Export pipeline data to CSV

**Auth:** Required

**Response:** CSV file download

### Rate Limits

#### GET /api/vendor-pipeline/rate-limits
**Purpose:** Check SMS/API rate limit status

**Auth:** Required

**Response:**
```typescript
{
  sms: {
    used: number,
    limit: number,
    resetAt: string
  },
  propertyDataAPI: {
    used: number,
    limit: number,
    resetAt: string
  }
}
```

---

## AI SMS Agent

### Overview

The AI agent is powered by Anthropic Claude (Sonnet 4.5) and handles all SMS conversations with vendors. It's designed to be friendly, professional, and effective at extracting property details.

### Implementation

**File:** `lib/ai/vendor-sms-agent.ts`

**Key Functions:**
- `processInboundSMS()` - Main entry point
- `generateAIResponse()` - Get Claude's reply
- `extractPropertyDetails()` - Parse structured data
- `determineNextAction()` - Decide what to do next

### Conversation Flow

```typescript
async function processInboundSMS(
  vendorLead: VendorLead,
  inboundMessage: string
) {
  // 1. Load conversation history
  const history = await loadSMSHistory(vendorLead.id)

  // 2. Get AI response
  const aiResponse = await generateAIResponse(vendorLead, history, inboundMessage)

  // 3. Extract structured data (if any)
  const extractedData = await extractPropertyDetails(aiResponse)

  // 4. Update database
  if (extractedData) {
    await updateVendorLead(vendorLead.id, extractedData)
  }

  // 5. Send response SMS
  await sendSMS(vendorLead.vendorPhone, aiResponse.message)

  // 6. Determine next action
  const nextAction = determineNextAction(vendorLead, extractedData)

  if (nextAction === 'trigger_validation') {
    await triggerBMVValidation(vendorLead.id)
  }
}
```

### System Prompt

```typescript
const SYSTEM_PROMPT = `You are a friendly property acquisition assistant helping property owners who want to sell quickly.

Your goal is to:
1. Build rapport and trust
2. Extract key property details
3. Assess motivation and timeline
4. Determine if they're genuinely interested

Be conversational, not robotic. Ask one question at a time.

Required information:
- Full property address with postcode
- Asking price or price expectations
- Property type and bedrooms
- Property condition
- Reason for selling
- How quickly they need to sell
- If they have other offers

Important guidelines:
- Always be polite and friendly
- Don't be pushy or salesy
- If they want to stop, respect that
- Acknowledge their situation with empathy
- Keep messages short (under 160 characters when possible)
- Use UK English spelling and terminology

Conversation stages:
1. Introduction & build rapport
2. Gather basic details (address, type)
3. Understand situation (condition, motivation)
4. Assess timeline and urgency
5. Confirm all details

When you have all required information, use the extract_property_details function.`
```

### Function Calling

Claude uses function calling to extract structured data:

```typescript
const EXTRACT_PROPERTY_DETAILS_TOOL = {
  name: "extract_property_details",
  description: "Extract structured property information from the conversation",
  input_schema: {
    type: "object",
    properties: {
      propertyAddress: {
        type: "string",
        description: "Full property address"
      },
      propertyPostcode: {
        type: "string",
        description: "UK postcode (e.g. SW1A 1AA)"
      },
      askingPrice: {
        type: "number",
        description: "Asking price in GBP"
      },
      propertyType: {
        type: "string",
        enum: ["detached_house", "semi_detached", "terraced_house", "flat", "bungalow", "other"]
      },
      bedrooms: {
        type: "integer",
        description: "Number of bedrooms"
      },
      bathrooms: {
        type: "integer",
        description: "Number of bathrooms"
      },
      condition: {
        type: "string",
        enum: ["excellent", "good", "average", "needs_work", "renovation_project"]
      },
      reasonForSelling: {
        type: "string",
        description: "Why they're selling"
      },
      motivationScore: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        description: "How motivated they are (0=not motivated, 10=extremely urgent)"
      },
      timelineDays: {
        type: "integer",
        description: "How many days until they need to complete"
      },
      competingOffers: {
        type: "boolean",
        description: "Do they have other offers?"
      }
    },
    required: ["propertyAddress", "propertyPostcode"]
  }
}
```

### Example Conversation

```
[System] New lead: John Smith, phone: +447700900123
[AI → Vendor] Hi John! I'm following up on your property enquiry.
Would you like a free, no-obligation valuation for your property?

[Vendor → AI] Yes please

[AI → Vendor] Great! What's the full address including postcode?

[Vendor → AI] 123 High Street, London, SW1A 1AA

[AI → Vendor] Thanks! Is it a house or flat, and how many bedrooms?

[Vendor → AI] It's a 3 bed terraced house

[AI → Vendor] Perfect. What condition is it in?
(Excellent / Good / Needs some work / Major renovation needed)

[Vendor → AI] Needs some work, kitchen and bathroom are dated

[AI → Vendor] No problem, we buy properties in any condition.
What sort of price were you hoping for?

[Vendor → AI] I was thinking around £300k

[AI → Vendor] That's helpful, thanks. Just a couple more quick questions -
why are you looking to sell?

[Vendor → AI] Downsizing, kids have moved out

[AI → Vendor] I understand. How quickly would you ideally like to complete?

[Vendor → AI] As soon as possible really, maybe 2 months?

[AI → Vendor] Thanks for all that info John. Let me check the latest
sales in your area and I'll get back to you with a fair offer shortly.

[System] Function called: extract_property_details(...)
[System] Triggering BMV validation...
```

### Error Handling

**Vendor stops responding:**
- Mark lastContactAt
- Move to appropriate retry stage after 48 hours

**Vendor says not interested:**
- Thank them politely
- Mark stage as DEAD_LEAD
- Stop automated messages

**Vendor gives incomplete info:**
- Ask follow-up questions
- Don't move to validation until all fields populated

**API failures:**
- Retry with exponential backoff
- Log error for human review
- Send fallback generic response if needed

---

## SMS Integration

### Twilio Configuration

**Setup:**
1. Twilio account with UK phone number
2. Webhook configured to `/api/vendor-pipeline/webhook/sms`
3. Inbound messages trigger webhook
4. Outbound messages use REST API

### Sending SMS

```typescript
import { twilioClient } from '@/lib/twilio'

async function sendSMS(to: string, message: string) {
  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    })

    return {
      success: true,
      sid: response.sid,
      status: response.status
    }
  } catch (error) {
    console.error('Twilio error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
```

### Receiving SMS

Twilio webhook POSTs to `/api/vendor-pipeline/webhook/sms`:

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const messageSid = formData.get('MessageSid') as string

  // Find vendor lead by phone
  const lead = await prisma.vendorLead.findFirst({
    where: { vendorPhone: from }
  })

  if (!lead) {
    // Unknown number, log and ignore
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  // Save inbound message
  await prisma.sMSMessage.create({
    data: {
      vendorLeadId: lead.id,
      direction: 'inbound',
      messageBody: body,
      twilioSid: messageSid
    }
  })

  // Process with AI
  await processInboundSMS(lead, body)

  // Return empty TwiML (we'll send response separately)
  return new Response('<Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  })
}
```

### Rate Limiting

**Prevent spam:**
- Max 10 SMS per hour per vendor
- Max 100 SMS per hour total
- Exponential backoff on retries

**Implementation:**
```typescript
const rateLimits = new Map<string, number[]>()

function checkRateLimit(phone: string): boolean {
  const now = Date.now()
  const hour = 3600 * 1000

  // Get recent messages
  const recent = rateLimits.get(phone) || []
  const recentInHour = recent.filter(t => now - t < hour)

  if (recentInHour.length >= 10) {
    return false  // Rate limited
  }

  // Update
  rateLimits.set(phone, [...recentInHour, now])
  return true
}
```

### SMS Best Practices

1. **Keep messages short** - Under 160 characters when possible
2. **Be personal** - Use vendor's name
3. **One question at a time** - Don't overwhelm
4. **UK English** - Use British spelling and terminology
5. **Timing** - Don't send late at night (9am-8pm only)
6. **Opt-out** - Respect "STOP" messages immediately

---

## BMV Validation

### Trigger Conditions

BMV validation runs when:
1. All required property details collected by AI
2. Manual trigger from dashboard
3. Property address or price updated

### Validation Process

**File:** `app/api/vendor-leads/[id]/calculate-bmv/route.ts`

**Steps:**
```typescript
async function validateBMV(vendorLeadId: string) {
  // 1. Fetch vendor lead
  const lead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId }
  })

  // 2. Validate required fields
  if (!lead.propertyPostcode || !lead.askingPrice) {
    throw new Error('Missing required fields')
  }

  // 3. Fetch comparables from PropertyData API
  const comparables = await fetchComparables({
    postcode: lead.propertyPostcode,
    propertyType: lead.propertyType,
    bedrooms: lead.bedrooms,
    radiusMiles: 0.5,
    maxResults: 10
  })

  // 4. Filter and validate comparables
  const validComps = comparables.filter(comp => {
    // Sold in last 12 months
    const monthsAgo = differenceInMonths(new Date(), comp.saleDate)
    if (monthsAgo > 12) return false

    // Similar size (±30%)
    if (comp.bedrooms !== lead.bedrooms) return false

    // Similar type
    if (comp.propertyType !== lead.propertyType) return false

    return true
  })

  // 5. Calculate average market value
  const avgPrice = validComps.reduce((sum, c) => sum + c.salePrice, 0) / validComps.length

  // 6. Adjust for condition
  const conditionAdjustment = {
    excellent: 1.10,
    good: 1.0,
    average: 0.95,
    needs_work: 0.90,
    renovation_project: 0.80
  }

  const estimatedMarketValue = avgPrice * conditionAdjustment[lead.condition]

  // 7. Estimate refurb costs
  const refurbCost = estimateRefurbCost(lead.condition, lead.squareFeet)

  // 8. Calculate BMV
  const bmvAmount = estimatedMarketValue - lead.askingPrice
  const bmvPercentage = (bmvAmount / estimatedMarketValue) * 100

  // 9. Calculate profit potential
  const stampDuty = calculateStampDuty(lead.askingPrice)
  const legalFees = 2000
  const totalCost = lead.askingPrice + refurbCost + stampDuty + legalFees
  const profitPotential = estimatedMarketValue - totalCost

  // 10. Determine if good deal
  const validationPassed = (
    bmvPercentage >= 20 &&
    profitPotential >= 20000 &&
    validComps.length >= 3
  )

  // 11. Save results
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: {
      bmvScore: bmvPercentage,
      estimatedMarketValue,
      estimatedRefurbCost: refurbCost,
      profitPotential,
      validationPassed,
      validatedAt: new Date(),
      comparablesCount: validComps.length,
      avgComparablePrice: avgPrice,
      confidence: validComps.length >= 5 ? 'high' : 'medium'
    }
  })

  // 12. Save comparables
  for (const comp of validComps) {
    await prisma.comparableProperty.create({
      data: {
        vendorLeadId,
        address: comp.address,
        postcode: comp.postcode,
        salePrice: comp.salePrice,
        saleDate: comp.saleDate,
        propertyType: comp.propertyType,
        bedrooms: comp.bedrooms,
        distance: comp.distance
      }
    })
  }

  // 13. Update stage
  if (validationPassed) {
    await updateStage(vendorLeadId, 'OFFER_MADE')
  } else {
    await updateStage(vendorLeadId, 'DEAD_LEAD')
  }

  return { validationPassed, bmvPercentage, profitPotential }
}
```

### Refurb Cost Estimation

```typescript
function estimateRefurbCost(condition: string, squareFeet: number): number {
  const costPerSqFt = {
    excellent: 0,
    good: 0,
    average: 20,
    needs_work: 50,
    renovation_project: 100
  }

  return (squareFeet || 1000) * costPerSqFt[condition]
}
```

---

## Offer Management

### Calculating Offer Amount

```typescript
function calculateOfferAmount(
  estimatedMarketValue: number,
  refurbCost: number,
  targetProfit: number = 30000
): number {
  // Work backwards from desired profit
  const stampDuty = calculateStampDuty(estimatedMarketValue * 0.75)  // Estimate
  const legalFees = 2000
  const ourCosts = 5000  // Marketing, time, etc.

  const maxOffer = estimatedMarketValue - refurbCost - targetProfit - stampDuty - legalFees - ourCosts

  // Round to nearest £5k
  return Math.floor(maxOffer / 5000) * 5000
}
```

### Offer SMS Template

```typescript
function generateOfferMessage(lead: VendorLead, offerAmount: number): string {
  return `Hi ${lead.vendorName},

Thanks for the details on ${lead.propertyAddress}.

Based on recent sales in your area and the work needed, we can offer £${formatPrice(offerAmount)} for a quick cash sale.

This would allow us to exchange in ${lead.timelineDays || 60} days with no chain.

What do you think?`
}
```

### Handling Responses

**Accepted:**
```typescript
async function handleOfferAccepted(vendorLeadId: string) {
  // Update lead
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: {
      pipelineStage: 'OFFER_ACCEPTED',
      offerAcceptedAt: new Date()
    }
  })

  // Create deal
  const deal = await createDealFromVendorLead(vendorLeadId)

  // Send confirmation SMS
  await sendSMS(
    lead.vendorPhone,
    `Great! I'll get the paperwork started. Our solicitor will be in touch within 24 hours.`
  )
}
```

**Rejected:**
```typescript
async function handleOfferRejected(
  vendorLeadId: string,
  reason: string
) {
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: {
      pipelineStage: 'OFFER_REJECTED',
      offerRejectedAt: new Date(),
      rejectionReason: reason
    }
  })

  // Send polite closure SMS
  await sendSMS(
    lead.vendorPhone,
    `No problem, I understand. If your circumstances change, feel free to reach out. All the best!`
  )
}
```

**No Response (48 hours):**
```typescript
async function handleOfferNoResponse(vendorLeadId: string) {
  // Move to video stage
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: {
      pipelineStage: 'VIDEO_SENT',
      videoSent: true
    }
  })

  // Send video SMS
  await sendSMS(
    lead.vendorPhone,
    `Hi ${lead.vendorName}, I've sent you a short video explaining our process and why we can help: [VIDEO_LINK]`
  )
}
```

---

## Error Handling

### API Errors

**Twilio failures:**
```typescript
try {
  await sendSMS(phone, message)
} catch (error) {
  // Log error
  await prisma.sMSMessage.update({
    where: { id: messageId },
    data: {
      status: 'failed',
      errorCode: error.code,
      errorMessage: error.message
    }
  })

  // Retry after 5 minutes
  setTimeout(() => retrySMS(messageId), 5 * 60 * 1000)
}
```

**PropertyData API failures:**
```typescript
try {
  const comparables = await fetchComparables(...)
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000))
    return await fetchComparables(...)
  }

  if (error.code === 'NOT_FOUND') {
    // Mark as unable to validate
    await updateValidationStatus('no_data_available')
  }

  // Other errors - log and alert admin
  await logError('propertydata_api', error)
}
```

**Claude API failures:**
```typescript
try {
  const response = await anthropic.messages.create(...)
} catch (error) {
  // Use fallback response
  const fallbackMessage = "Thanks for your message. I'm having technical difficulties. A human will respond shortly."

  await sendSMS(phone, fallbackMessage)
  await flagForHumanReview(vendorLeadId)
}
```

### Manual Intervention

**Flag for review:**
```typescript
async function flagForHumanReview(
  vendorLeadId: string,
  reason: string
) {
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: {
      needsHumanReview: true,
      reviewReason: reason
    }
  })

  // Send notification to team
  await sendSlackNotification(
    `🚨 Lead ${vendorLeadId} needs review: ${reason}`
  )
}
```

---

## Monitoring & Metrics

### Key Metrics Tracked

**Conversion Rates:**
- NEW_LEAD → AI_CONVERSATION (should be ~100%)
- AI_CONVERSATION → DEAL_VALIDATION (target: >60%)
- DEAL_VALIDATION → OFFER_MADE (target: >30%)
- OFFER_MADE → OFFER_ACCEPTED (target: >25%)
- OFFER_ACCEPTED → COMPLETED (target: >70%)

**Time Metrics:**
- Time in AI_CONVERSATION (target: <48 hours)
- Time to offer (target: <72 hours from lead)
- Time to completion (target: <60 days)

**Quality Metrics:**
- Data extraction accuracy (% of fields populated correctly)
- BMV validation accuracy (% of offers that complete)
- Vendor satisfaction (manual survey)

**Cost Metrics:**
- SMS cost per lead
- PropertyData API cost per validation
- Claude API cost per conversation
- Cost per completed deal

### Dashboard Queries

**Pipeline overview:**
```typescript
const stats = await prisma.vendorLead.groupBy({
  by: ['pipelineStage'],
  _count: true,
  _sum: {
    estimatedMarketValue: true,
    profitPotential: true
  }
})
```

**Conversion funnel:**
```typescript
const funnel = {
  totalLeads: await prisma.vendorLead.count(),
  inConversation: await prisma.vendorLead.count({
    where: { pipelineStage: 'AI_CONVERSATION' }
  }),
  validated: await prisma.vendorLead.count({
    where: { validationPassed: true }
  }),
  offersMade: await prisma.vendorLead.count({
    where: { pipelineStage: 'OFFER_MADE' }
  }),
  offersAccepted: await prisma.vendorLead.count({
    where: { pipelineStage: 'OFFER_ACCEPTED' }
  })
}
```

### Performance Monitoring

**Slow queries:**
```sql
-- Find leads stuck in stages
SELECT pipeline_stage, COUNT(*), AVG(NOW() - updated_at) as avg_time
FROM vendor_leads
WHERE pipeline_stage NOT IN ('DEAD_LEAD', 'COMPLETED')
GROUP BY pipeline_stage
HAVING AVG(NOW() - updated_at) > INTERVAL '7 days';
```

**API usage:**
```typescript
const usage = await prisma.propertyDataUsage.aggregate({
  _sum: { requestCount: true, cost: true },
  where: {
    createdAt: { gte: startOfMonth(new Date()) }
  }
})
```

---

## Testing & Development

### Local Development Setup

1. **Setup Twilio webhook tunneling:**
   ```bash
   ngrok http 3000
   # Configure Twilio webhook to ngrok URL
   ```

2. **Simulate Facebook lead:**
   ```bash
   curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
     -H "Content-Type: application/json" \
     -d '{
       "vendorName": "Test Vendor",
       "vendorPhone": "+447700900123",
       "propertyAddress": "123 Test St, London"
     }'
   ```

3. **Simulate inbound SMS:**
   ```bash
   curl -X POST http://localhost:3000/api/vendor-pipeline/webhook/sms \
     -d "From=+447700900123" \
     -d "Body=Yes interested" \
     -d "MessageSid=SM123"
   ```

### Test Scenarios

**Happy path:**
1. Create lead
2. Simulate conversation (5-10 messages)
3. Verify all fields extracted
4. Check BMV validation runs
5. Verify offer SMS sent
6. Simulate acceptance
7. Check deal created

**Unhappy paths:**
- Vendor stops responding
- Vendor says not interested
- Property has no comparables
- BMV too low
- API failures

### Manual Testing Checklist

- [ ] Lead creation via API
- [ ] Initial SMS sent within 30 seconds
- [ ] Inbound SMS processed correctly
- [ ] AI extracts address correctly
- [ ] AI extracts price correctly
- [ ] AI assesses motivation score
- [ ] BMV validation triggered when ready
- [ ] PropertyData API called successfully
- [ ] Comparables saved to database
- [ ] Offer calculated correctly
- [ ] Offer SMS sent
- [ ] Acceptance creates deal
- [ ] Rejection marks as dead
- [ ] Retry logic works after no response
- [ ] Rate limiting prevents spam
- [ ] Dashboard shows correct metrics

---

## Summary

The Vendor Pipeline is a sophisticated, AI-powered system that automates property deal sourcing from initial contact through to completion. Key strengths:

✅ **Fully automated** - Minimal human intervention required
✅ **Intelligent** - AI understands context and adapts conversation
✅ **Data-driven** - All decisions based on real market data
✅ **Scalable** - Handle 1000s of leads with same infrastructure
✅ **Trackable** - Complete visibility into pipeline health
✅ **Reliable** - Error handling and fallbacks throughout

**Integration Points:**
- Facebook Lead Ads (lead capture)
- Twilio (SMS)
- Anthropic Claude (AI conversations)
- PropertyData UK (market data)
- Internal deal/investor systems

**Performance:**
- Process 100+ leads simultaneously
- Respond to vendor within seconds
- Validate BMV in <5 minutes
- Handle 10,000 SMS/month

This system represents the cutting edge of property acquisition automation, combining AI, real-time messaging, and market data to create a powerful, scalable deal sourcing machine.

---

*For non-technical overview, see SYSTEM_OVERVIEW.md*
*For technical architecture, see TECHNICAL_OVERVIEW.md*

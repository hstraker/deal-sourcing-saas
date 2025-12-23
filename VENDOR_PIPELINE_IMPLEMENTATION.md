# Vendor Pipeline Implementation Status

## ✅ Completed Components

### 1. Database Schema
- **Prisma Schema Updated** (`prisma/schema.prisma`)
  - Added `VendorLead` model with all pipeline fields
  - Added `SMSMessage` model for conversation tracking
  - Added `PipelineMetric` model for analytics
  - Added `PipelineEvent` model for audit trail
  - Added `OfferRetry` model for retry tracking
  - Added `FacebookLeadSync` model for lead sync tracking
  - Added enums: `PipelineStage`, `SMSDirection`, `SMSStatus`, `UrgencyLevel`, `PropertyCondition`, `ReasonForSale`

- **SQL Reference Schema** (`database/vendor_schema.sql`)
  - Complete SQL schema with triggers, views, and helper functions
  - Can be used as reference or for direct SQL migrations if needed

### 2. TypeScript Types & Interfaces
- **Type Definitions** (`types/vendor-pipeline.ts`)
  - Complete type definitions for all pipeline operations
  - Helper functions for stage transitions and retry calculations
  - Configuration types and defaults

### 3. Core Service Modules

#### Configuration (`lib/vendor-pipeline/config.ts`)
- Environment variable loading with defaults
- Centralized configuration management

#### Twilio Integration (`lib/vendor-pipeline/twilio.ts`)
- SMS sending and receiving
- Webhook signature validation
- Message status tracking

#### Facebook Lead Ads (`lib/vendor-pipeline/facebook.ts`)
- Fetch new leads from Facebook API
- Parse lead data into structured format
- Connection testing

#### AI SMS Agent (`lib/vendor-pipeline/ai-sms-agent.ts`)
- GPT-4 powered conversation handling
- Automatic property detail extraction
- Motivation scoring
- Conversation state management
- Natural SMS message generation

#### Deal Validator (`lib/vendor-pipeline/deal-validator.ts`)
- BMV validation using existing deal scoring
- PropertyData API integration
- Refurbishment cost estimation
- Profit potential calculation
- Validation threshold checking

#### Offer Engine (`lib/vendor-pipeline/offer-engine.ts`)
- Intelligent offer calculation
- Offer messaging and delivery
- Retry management (3 retries with delays)
- Acceptance/rejection handling

#### Pipeline Service (`lib/vendor-pipeline/pipeline-service.ts`)
- Main background orchestration service
- Processes Facebook leads every 60 seconds
- Handles active conversations
- Validates deals and sends offers
- Manages retry schedules
- Creates deals from accepted offers
- Cleans up stale leads
- Updates daily metrics

### 4. API Routes

#### Leads Management
- `GET /api/vendor-pipeline/leads` - List all leads with filtering
- `POST /api/vendor-pipeline/leads` - Create new lead
- `GET /api/vendor-pipeline/leads/[id]` - Get lead details
- `PATCH /api/vendor-pipeline/leads/[id]` - Update lead

#### Webhooks
- `POST /api/vendor-pipeline/webhook/sms` - Twilio SMS webhook handler
  - Receives inbound SMS
  - Routes to AI agent for processing
  - Returns TwiML response

#### Statistics
- `GET /api/vendor-pipeline/stats` - Pipeline statistics and metrics

## 🔨 Remaining Tasks

### UI Components (Pending)
1. **Dashboard Page** (`app/dashboard/vendor-pipeline/page.tsx`)
   - Kanban board view of pipeline stages
   - Table/list view alternative
   - Real-time updates (polling)

2. **Lead Detail Modal/Page**
   - Full conversation history (iMessage-style)
   - Property details
   - Validation results
   - Offer details
   - Manual actions (send message, update stage, accept/reject offer)

3. **Statistics Dashboard**
   - Conversion funnel visualization
   - Metrics cards
   - Charts for trends

4. **Components**
   - `components/vendor-pipeline/pipeline-board.tsx` - Kanban board
   - `components/vendor-pipeline/lead-card.tsx` - Lead card component
   - `components/vendor-pipeline/conversation-viewer.tsx` - SMS conversation UI
   - `components/vendor-pipeline/lead-detail-modal.tsx` - Lead details modal
   - `components/vendor-pipeline/stats-cards.tsx` - Statistics cards

## 🚀 Next Steps to Complete

### 1. Run Prisma Migration
```bash
npx prisma migrate dev --name add_vendor_pipeline
npx prisma generate
```

### 2. Install Dependencies
```bash
npm install openai twilio
npm install --save-dev @types/twilio
```

### 3. Configure Environment Variables
Add to `.env`:
```
# Facebook Lead Ads
FACEBOOK_ACCESS_TOKEN=your_token
FACEBOOK_LEAD_FORM_ID=your_form_id
FACEBOOK_PAGE_ID=your_page_id

# Twilio SMS
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+447123456789

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4-turbo-preview

# Pipeline Configuration (optional, defaults provided)
MIN_BMV_PERCENTAGE=15.0
MAX_ASKING_PRICE=500000
MIN_PROFIT_POTENTIAL=30000
OFFER_BASE_PERCENTAGE=80
OFFER_MAX_PERCENTAGE=85
RETRY_1_DELAY_DAYS=2
RETRY_2_DELAY_DAYS=4
RETRY_3_DELAY_DAYS=7
MAX_RETRIES=3
CONVERSATION_TIMEOUT_HOURS=48
PIPELINE_POLL_INTERVAL=60
```

### 4. Set Up Twilio Webhook
Configure Twilio to send SMS webhooks to:
```
https://yourdomain.com/api/vendor-pipeline/webhook/sms
```

### 5. Start Pipeline Service
The pipeline service can be started as:
- A separate Node.js process/worker
- A Next.js API route job (cron-based)
- A background service on your server

Example standalone script:
```typescript
// scripts/start-pipeline-service.ts
import { getPipelineService } from "@/lib/vendor-pipeline/pipeline-service"

const service = getPipelineService()
service.start()

// Handle graceful shutdown
process.on("SIGTERM", () => {
  service.stop()
  process.exit(0)
})
```

### 6. Build UI Components
Create the dashboard UI components as listed above.

## 📋 Architecture Summary

The vendor pipeline system follows this flow:

1. **Lead Capture**: Facebook Lead Ads → Facebook API → VendorLead record
2. **Initial Contact**: Pipeline service sends initial SMS via Twilio
3. **AI Conversation**: Inbound SMS triggers AI agent (GPT-4) → Extracts property details
4. **Validation**: Deal validator checks BMV, profit potential → Validates deal
5. **Offer**: Offer engine calculates and sends offer via SMS
6. **Response Handling**: 
   - Accepted → Request solicitor details → Create Deal → Ready for investors
   - Rejected → Send video → Schedule retries (3 attempts)
7. **Monitoring**: Pipeline metrics tracked daily, stats available via API

## 🔗 Integration Points

- **Existing Deal System**: Accepted vendor leads create `Deal` records
- **Deal Scoring**: Reuses `calculateDealScore()` and `calculateBMVPercentage()`
- **PropertyData API**: Reuses existing `fetchPropertyValuation()` function
- **Authentication**: Uses existing NextAuth.js session checks
- **Database**: Uses existing Prisma client

## 📝 Notes

- The pipeline service is designed to run as a background process
- SMS conversations are handled via webhooks (real-time)
- All pipeline events are logged to `PipelineEvent` table for audit trail
- Configuration is environment-variable based with sensible defaults
- The system is designed to be fault-tolerant with error handling at each step


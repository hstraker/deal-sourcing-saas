# Vendor Pipeline Setup Guide

## ✅ Completed Steps

1. ✅ Database schema created and migrated
2. ✅ Prisma client generated
3. ✅ All core modules built
4. ✅ API routes created

## 📋 Next Steps

### 1. Install TypeScript Types (if needed)

```bash
npm install --save-dev @types/twilio
```

Note: `openai` and `twilio` packages are already installed in your package.json.

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# ============================================
# VENDOR PIPELINE CONFIGURATION
# ============================================

# Facebook Lead Ads API
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token_here
FACEBOOK_LEAD_FORM_ID=your_lead_form_id_here
FACEBOOK_PAGE_ID=your_page_id_here

# Twilio SMS API
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+447123456789  # Your Twilio phone number

# OpenAI API (for AI conversations)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview  # or gpt-4

# Pipeline Configuration (optional - defaults provided)
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

# Optional: Objection handling video URL
VIDEO_OBJECTION_URL=https://yourdomain.com/videos/objection-handler.mp4
```

### 3. Set Up Twilio Webhook

Configure your Twilio phone number to send SMS webhooks to:

```
https://yourdomain.com/api/vendor-pipeline/webhook/sms
```

**For local development**, use a tool like:
- **ngrok**: `ngrok http 3000` then use the ngrok URL
- **Cloudflare Tunnel**: You already have this set up based on your scripts
- **Twilio Studio**: For testing without webhooks

### 4. Start the Pipeline Service

The pipeline service needs to run as a background process. You have several options:

#### Option A: Separate Node.js Process (Recommended for Production)

Create a script to run the service:

```typescript
// scripts/start-pipeline-service.ts
import { getPipelineService } from "@/lib/vendor-pipeline/pipeline-service"

const service = getPipelineService()

console.log("Starting Vendor Pipeline Service...")
service.start()

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Stopping Vendor Pipeline Service...")
  service.stop()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("Stopping Vendor Pipeline Service...")
  service.stop()
  process.exit(0)
})
```

Run with: `tsx scripts/start-pipeline-service.ts`

#### Option B: Next.js API Route with Cron (For simpler deployment)

Create a cron job endpoint that runs the pipeline cycle:

```typescript
// app/api/cron/pipeline/route.ts
import { getPipelineService } from "@/lib/vendor-pipeline/pipeline-service"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Verify cron secret if needed
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const service = getPipelineService()
  // Run one cycle
  await service.runCycle()

  return NextResponse.json({ success: true })
}
```

Then use a service like Vercel Cron, GitHub Actions, or a cron service to hit this endpoint every minute.

#### Option C: Next.js Route Handler (for testing)

You can manually trigger pipeline cycles via an API route for testing.

### 5. Test the System

#### Test Facebook Lead Integration

```typescript
// Test script: scripts/test-facebook-leads.ts
import { facebookLeadAdsService } from "@/lib/vendor-pipeline/facebook"

async function test() {
  const connected = await facebookLeadAdsService.testConnection()
  console.log("Facebook connected:", connected)

  if (connected) {
    const leads = await facebookLeadAdsService.fetchNewLeads()
    console.log("New leads:", leads)
  }
}

test()
```

#### Test Twilio SMS

```typescript
// Test script: scripts/test-twilio-sms.ts
import { twilioService } from "@/lib/vendor-pipeline/twilio"

async function test() {
  const result = await twilioService.sendSMS(
    "+447123456789", // Your test number
    "Test message from Vendor Pipeline"
  )
  console.log("SMS sent:", result)
}

test()
```

#### Test AI Agent

The AI agent will be automatically tested when you receive an SMS webhook, or you can test it manually via the API.

### 6. Build Dashboard UI (Remaining Task)

The UI components still need to be built:

- **Main Pipeline Dashboard**: `/app/dashboard/vendor-pipeline/page.tsx`
- **Kanban Board Component**: `/components/vendor-pipeline/pipeline-board.tsx`
- **Lead Card Component**: `/components/vendor-pipeline/lead-card.tsx`
- **Conversation Viewer**: `/components/vendor-pipeline/conversation-viewer.tsx`
- **Lead Detail Modal**: `/components/vendor-pipeline/lead-detail-modal.tsx`
- **Statistics Cards**: `/components/vendor-pipeline/stats-cards.tsx`

See `VENDOR_PIPELINE_IMPLEMENTATION.md` for details on what needs to be built.

### 7. Integration Checklist

- [ ] Environment variables configured
- [ ] Twilio webhook URL configured
- [ ] Pipeline service running (as background process or cron)
- [ ] Facebook Lead Ads API tested
- [ ] Twilio SMS sending/receiving tested
- [ ] AI conversations tested
- [ ] Dashboard UI built and accessible
- [ ] Manual testing of full pipeline flow

### 8. Monitoring & Maintenance

- Monitor pipeline service logs
- Check pipeline metrics daily via `/api/vendor-pipeline/stats`
- Review failed migrations in database
- Monitor OpenAI API usage/costs
- Monitor Twilio SMS costs

## 🐛 Troubleshooting

### Pipeline Service Not Running

- Check that the service process is actually running
- Check logs for errors
- Verify environment variables are set correctly

### SMS Not Being Received

- Verify Twilio webhook URL is correct
- Check Twilio logs for delivery status
- Verify phone number format (must include country code, e.g., +44)

### AI Conversations Not Working

- Verify OpenAI API key is valid
- Check API rate limits
- Review conversation logs in database

### Facebook Leads Not Syncing

- Verify Facebook access token is valid
- Check token expiration
- Verify Lead Form ID is correct

## 📚 Documentation

- See `VENDOR_PIPELINE_SPEC.md` for complete specification
- See `VENDOR_PIPELINE_IMPLEMENTATION.md` for implementation details
- See `INTEGRATION_NOTES.md` for integration guidelines


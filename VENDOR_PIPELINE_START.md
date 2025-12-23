# Starting the Vendor Pipeline Service

The vendor pipeline service is a background worker that automatically processes leads through the acquisition workflow.

## Quick Start

```bash
# Start the pipeline service
npx tsx scripts/start-pipeline-service.ts
```

The service will:
- Poll for new Facebook leads every 5 minutes
- Process active AI conversations every 2 minutes
- Validate deals ready for offers every 5 minutes
- Send retry messages on schedule
- Move accepted deals to investor matching
- Clean up stale leads
- Update daily metrics

## Running in Production

For production, you should run the service as a background process or use a process manager like PM2:

```bash
# Using PM2
pm2 start scripts/start-pipeline-service.ts --interpreter tsx --name vendor-pipeline

# View logs
pm2 logs vendor-pipeline

# Stop the service
pm2 stop vendor-pipeline
```

## Environment Variables

Make sure these are set in your `.env`:

```env
# Database
DATABASE_URL="postgresql://..."

# AI Provider (OpenAI or Anthropic)
AI_PROVIDER="anthropic"  # or "openai"
OPENAI_API_KEY="..."      # if using OpenAI
ANTHROPIC_API_KEY="..."   # if using Anthropic
ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# Twilio (or use mock for development)
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+447700900000"

# Pipeline Configuration
PIPELINE_POLL_INTERVAL_SECONDS=300
PIPELINE_CONVERSATION_CHECK_SECONDS=120
```

## Service Tasks

The pipeline service performs these tasks automatically:

1. **New Lead Processing** (every 5 min)
   - Fetches new leads from Facebook Lead Ads
   - Creates vendor lead records
   - Sends initial AI SMS message

2. **Active Conversations** (every 2 min)
   - Checks for new inbound SMS messages
   - Generates AI responses
   - Extracts property details
   - Scores motivation
   - Moves to validation when complete

3. **Deal Validation** (every 5 min)
   - Runs BMV analysis on validated conversations
   - Calculates offers for passing deals
   - Sends offers via SMS
   - Marks failed validations as dead leads

4. **Retry Management** (every 10 min)
   - Checks for rejected offers ready for retry
   - Sends retry messages with video links
   - Tracks retry attempts

5. **Accepted Deals** (every 5 min)
   - Moves accepted offers to investor matching
   - Creates deal records
   - Links to vendor leads

6. **Cleanup** (every hour)
   - Marks unresponsive leads as dead
   - Removes stale data

7. **Metrics** (daily at midnight)
   - Calculates conversion rates
   - Updates pipeline statistics
   - Tracks financial metrics

## Monitoring

The service logs all activities to the console. Watch for:
- `✅` Success messages
- `⚠️` Warnings
- `❌` Errors

## Troubleshooting

**Service won't start:**
- Check database connection
- Verify environment variables
- Ensure Prisma client is generated: `npm run db:generate`

**No leads processing:**
- Check Facebook Lead Ads integration
- Verify webhook configuration
- Check API credentials

**AI not responding:**
- Verify AI API key is set
- Check API quota/limits
- Review conversation logs

**SMS not sending:**
- Verify Twilio credentials (or mock is enabled)
- Check phone number format
- Review Twilio logs


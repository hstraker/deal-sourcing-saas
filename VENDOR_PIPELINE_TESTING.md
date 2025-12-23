# Vendor Pipeline Testing Guide

## Mock Twilio Setup

The system now uses a **mock Twilio service** when Twilio credentials are not configured. This allows you to test the entire AI conversation flow without signing up for Twilio.

### How It Works

- If `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are not set, the system automatically uses the mock service
- You can also force mock mode by setting `USE_MOCK_TWILIO=true` in your `.env`
- Messages are stored in memory (not actually sent) and logged to console

### Minimum Environment Variables for Testing

Add to your `.env`:

```bash
# Required for AI conversations
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Set phone number for mock (defaults to +447700900000)
TWILIO_PHONE_NUMBER=+447700900000

# Force mock mode (optional)
USE_MOCK_TWILIO=true
```

## Testing Methods

### Method 1: Automated Test Script

Run the automated test script that simulates a full conversation:

```bash
tsx scripts/test-ai-conversation.ts
```

This will:
1. Create a test vendor lead
2. Send the initial AI message
3. Simulate vendor responses
4. Show the conversation history
5. Display the final lead state

### Method 2: Manual API Testing

#### Step 1: Create a Vendor Lead

```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "vendorName": "John Smith",
    "vendorPhone": "+447700900123",
    "propertyAddress": "123 High Street, London",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 250000,
    "propertyType": "terraced",
    "bedrooms": 3
  }'
```

#### Step 2: Send Initial Message

The pipeline service will automatically send the initial message when it detects a new lead, OR you can trigger it manually:

```typescript
// In a script or API route
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"

await aiSMSAgent.sendInitialMessage(vendorLeadId)
```

#### Step 3: Simulate Vendor Response

Use the test endpoint to simulate receiving an SMS:

```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/test/simulate-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "vendorLeadId": "your-lead-id",
    "message": "Hi, yes I'm interested. Need to sell quickly, moving for work."
  }'
```

The AI will automatically respond. Repeat step 3 with different messages to continue the conversation.

### Method 3: Using the Dashboard (when built)

Once the dashboard UI is built, you'll be able to:
- View leads in the pipeline
- Manually send messages via the conversation interface
- See AI responses in real-time

## Example Conversation Flow

Here's a typical conversation you might simulate:

1. **Initial AI Message** (sent automatically):
   ```
   Hi John! Thanks for your enquiry about selling 123 High Street, London. 
   We're cash buyers who can move quickly with no chain. 
   What's your rough timeline for selling?
   ```

2. **Vendor Response 1**:
   ```
   Hi, yes I'm interested. Need to sell quickly, moving for work.
   ```

3. **AI Response** (automatic):
   ```
   I understand you need to move quickly. That's exactly what we specialize in. 
   How would you describe the property's condition?
   ```

4. **Vendor Response 2**:
   ```
   The property is in good condition, just needs some modernisation. 
   Looking for around £250k.
   ```

5. **AI Response** (automatic):
   ```
   Thanks for that. What's prompting the sale? Is it just the work relocation?
   ```

6. **Vendor Response 3**:
   ```
   Yes, we need to move in about 3 weeks if possible. No chain on our side.
   ```

7. **AI Response** (automatic):
   ```
   Perfect, we can definitely work with that timeline. Have you had any other offers or viewings?
   ```

8. **Vendor Response 4**:
   ```
   Haven't had any other offers yet, just listed it.
   ```

9. **AI Response** (automatic):
   ```
   Great! I have all the information I need. We'll assess the property and get back to you with an offer very soon. 
   Thank you for your time!
   ```

After this, the lead should move to `DEAL_VALIDATION` stage automatically.

## Checking Results

### View Lead Details

```bash
curl http://localhost:3000/api/vendor-pipeline/leads/{lead-id} \
  -H "Cookie: your-auth-cookie"
```

### View Conversation History

The lead details endpoint includes all SMS messages. Or query directly:

```sql
SELECT * FROM sms_messages 
WHERE vendor_lead_id = 'your-lead-id' 
ORDER BY created_at ASC;
```

### Check Pipeline Stage

```sql
SELECT id, vendor_name, pipeline_stage, motivation_score, property_address, asking_price
FROM vendor_leads 
WHERE id = 'your-lead-id';
```

## Testing the Full Pipeline

To test the complete flow (without Facebook integration):

1. **Create a lead manually** via API
2. **Send initial message** (or let pipeline service do it)
3. **Simulate conversations** using the test endpoint
4. **Wait for validation** (or trigger manually)
5. **Check offer calculation** and sending
6. **Test retry flow** by rejecting offers

## Troubleshooting

### AI Not Responding

- Check OpenAI API key is set and valid
- Check console logs for errors
- Verify the lead exists and is in `AI_CONVERSATION` stage

### Messages Not Appearing in Database

- Check database connection
- Verify SMS messages are being created (check logs)
- Check Prisma client is up to date (`npx prisma generate`)

### Mock Service Not Working

- Ensure `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are NOT set
- Or set `USE_MOCK_TWILIO=true` explicitly
- Check console logs for "[Mock Twilio]" messages

## Next Steps

Once you're comfortable with the mock setup:
1. Build the dashboard UI to visualize conversations
2. Test the full pipeline flow end-to-end
3. When ready for production, set up real Twilio credentials
4. Configure Facebook Lead Ads integration


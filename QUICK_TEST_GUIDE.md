# Quick Test Guide - Vendor Pipeline

## Option 1: Create Test Lead via Script (Recommended)

This creates a lead and optionally starts the AI conversation:

```bash
# Create lead and start AI conversation
npx tsx scripts/create-test-lead.ts --start-conversation

# Or just create the lead (service will process it)
npx tsx scripts/create-test-lead.ts
```

## Option 2: Create Test Lead via API

### Using curl (Linux/WSL):

```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "John Doe",
    "vendorPhone": "+447700900789",
    "vendorEmail": "john.doe@example.com",
    "propertyAddress": "123 Main Street, London",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 350000,
    "propertyType": "terraced",
    "bedrooms": 3,
    "bathrooms": 1
  }'
```

Or use the provided script:
```bash
bash scripts/test-create-lead-api.sh
```

### Using PowerShell (Windows):

```powershell
$body = @{
    vendorName = "John Doe"
    vendorPhone = "+447700900789"
    vendorEmail = "john.doe@example.com"
    propertyAddress = "123 Main Street, London"
    propertyPostcode = "SW1A 1AA"
    askingPrice = 350000
    propertyType = "terraced"
    bedrooms = 3
    bathrooms = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/vendor-pipeline/leads" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Or use the provided script:
```powershell
pwsh scripts/test-create-lead-api.ps1
```

### Using Browser/Postman:

1. **URL:** `POST http://localhost:3000/api/vendor-pipeline/leads`
2. **Headers:**
   - `Content-Type: application/json`
3. **Body (JSON):**
```json
{
  "vendorName": "John Doe",
  "vendorPhone": "+447700900789",
  "vendorEmail": "john.doe@example.com",
  "propertyAddress": "123 Main Street, London",
  "propertyPostcode": "SW1A 1AA",
  "askingPrice": 350000,
  "propertyType": "terraced",
  "bedrooms": 3,
  "bathrooms": 1
}
```

**Note:** You'll need to be logged in (have a session cookie) for the API call to work.

## View in Dashboard

After creating a lead:

1. **Navigate to:** http://localhost:3000/dashboard/vendors/pipeline

2. **You should see:**
   - The new lead in the "New Leads" column
   - If AI conversation started, it will move to "In Conversation" column

3. **Click on the lead card** to:
   - View conversation history
   - See lead details
   - Send manual messages
   - View validation/offer info

## Starting AI Conversation

If you created a lead without starting the conversation:

**Option A: Use the test script**
```bash
npx tsx scripts/test-ai-conversation.ts
```

**Option B: The pipeline service will process it automatically**
- If the pipeline service is running, it will pick up NEW_LEAD stage leads
- Check the service logs to see it processing

**Option C: Start conversation manually via API**
```bash
# Get the lead ID from the dashboard or API response, then:
curl -X POST http://localhost:3000/api/vendor-pipeline/leads/{LEAD_ID}/send-message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi! I saw your property listing. Would you be interested in discussing a quick sale?"}'
```

## Simulating Vendor Response

To simulate a vendor replying (to test AI responses):

1. **Create a lead and start conversation** (as above)
2. **Use the simulate SMS endpoint:**
```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/test/simulate-sms \
  -H "Content-Type: application/json" \
  -d '{
    "vendorPhone": "+447700900789",
    "message": "Hi, yes I am interested. Need to sell quickly as I am relocating for work."
  }'
```

3. **Check the dashboard** - you should see:
   - The vendor message appear
   - AI response generated
   - Conversation progressing

## Troubleshooting

**Lead not appearing in dashboard:**
- Check the browser console for errors
- Verify the API call succeeded (check response)
- Refresh the dashboard page
- Check that you're logged in

**AI conversation not starting:**
- Check pipeline service logs
- Verify AI API key is set in `.env`
- Check that `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is configured
- Try the `--start-conversation` flag with the script

**API returns 401/403:**
- Make sure you're logged in
- Check your session is valid
- Try logging out and back in


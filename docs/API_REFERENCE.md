# API Reference

**DealStack Property Sourcing Platform**

Version: 1.0
Last Updated: 2025-12-27

---

## Base URLs

**Development:**
`http://localhost:3000/api`

**Production:**
`https://yourdomain.com/api`

---

## Authentication

Most endpoints require authentication via NextAuth session cookies.

**Session Cookie:**
Obtained via `/api/auth/signin` (NextAuth)

**Headers:**
```
Cookie: next-auth.session-token={token}
```

**Public Endpoints (No Auth Required):**
- `/api/facebook-leads/webhook` (Facebook)
- `/api/vendor-pipeline/webhook/sms` (Twilio)
- `/api/auth/*` (Authentication endpoints)

---

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Public webhooks | 10,000 req/hour | Rolling |
| Authenticated | 1,000 req/hour | Rolling |
| Heavy operations | 100 req/hour | Rolling |

---

## Error Response Format

All errors return this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Resource created
- `400` - Bad request (invalid input)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `422` - Validation failed
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## Endpoints by Category

1. [Vendor Pipeline](#vendor-pipeline) (15 endpoints)
2. [Vendor Leads](#vendor-leads) (5 endpoints)
3. [Deals](#deals) (9 endpoints)
4. [Investors](#investors) (10 endpoints)
5. [Reservations](#reservations) (3 endpoints)
6. [Investor Pack Templates](#investor-pack-templates) (5 endpoints)
7. [Comparables](#comparables) (3 endpoints)
8. [PropertyData Integration](#propertydata-integration) (3 endpoints)
9. [Analytics](#analytics) (1 endpoint)
10. [Users & Team](#users--team) (6 endpoints)
11. [Company Profile](#company-profile) (1 endpoint)
12. [Authentication](#authentication) (3 endpoints)
13. [Legacy Vendors](#legacy-vendors) (5 endpoints)
14. [Development/Testing](#developmenttesting) (2 endpoints)

---

# Vendor Pipeline

The modern vendor acquisition pipeline powered by AI SMS conversations.

## POST /api/vendor-pipeline/leads

Create a new vendor lead (typically from Facebook webhook).

**Auth:** Public (webhook)

**Request Body:**
```json
{
  "facebookLeadId": "string (optional)",
  "leadSource": "string (optional, default: 'facebook_ad')",
  "campaignId": "string (optional)",
  "vendorName": "string (required)",
  "vendorPhone": "string (required, UK format)",
  "vendorEmail": "string (optional)",
  "propertyAddress": "string (optional)"
}
```

**Response (201):**
```json
{
  "lead": {
    "id": "clx123abc",
    "vendorName": "John Smith",
    "vendorPhone": "+447123456789",
    "pipelineStage": "NEW_LEAD",
    "createdAt": "2025-12-27T10:30:00Z"
  },
  "message": "Lead created and initial SMS queued"
}
```

**Errors:**
- `400` - Missing required fields
- `422` - Invalid phone format
- `500` - Database error

**Example:**
```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "John Smith",
    "vendorPhone": "+447123456789",
    "propertyAddress": "123 High St, London"
  }'
```

---

## GET /api/vendor-pipeline/leads

List all vendor leads with filtering and pagination.

**Auth:** Required (admin/sourcer)

**Query Parameters:**
- `stage` - Filter by pipeline stage (e.g., `AI_CONVERSATION`)
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)
- `search` - Search by vendor name or phone

**Response (200):**
```json
{
  "leads": [
    {
      "id": "clx123abc",
      "vendorName": "John Smith",
      "vendorPhone": "+447123456789",
      "propertyAddress": "123 High St, London",
      "pipelineStage": "AI_CONVERSATION",
      "motivationScore": 8,
      "lastContactAt": "2025-12-27T10:30:00Z",
      "createdAt": "2025-12-27T09:00:00Z",
      "_count": {
        "smsMessages": 5
      }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/vendor-pipeline/leads?stage=AI_CONVERSATION&limit=10" \
  -H "Cookie: next-auth.session-token=..."
```

---

## GET /api/vendor-pipeline/leads/[id]

Get detailed information about a specific vendor lead.

**Auth:** Required

**Path Parameters:**
- `id` - Vendor lead ID

**Response (200):**
```json
{
  "lead": {
    "id": "clx123abc",
    "vendorName": "John Smith",
    "vendorPhone": "+447123456789",
    "propertyAddress": "123 High Street",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 250000,
    "propertyType": "terraced_house",
    "bedrooms": 3,
    "condition": "needs_work",
    "motivationScore": 8,
    "pipelineStage": "OFFER_MADE",
    "bmvScore": 18.5,
    "estimatedMarketValue": 300000,
    "offerAmount": 230000,
    "smsMessages": [...],
    "pipelineEvents": [...],
    "comparableProperties": [...]
  }
}
```

**Errors:**
- `404` - Lead not found
- `403` - Access denied

---

## PATCH /api/vendor-pipeline/leads/[id]

Update vendor lead details.

**Auth:** Required

**Request Body:**
```json
{
  "propertyAddress": "string (optional)",
  "askingPrice": "number (optional)",
  "bedrooms": "number (optional)",
  "condition": "string (optional)",
  "motivationScore": "number (optional, 0-10)"
}
```

**Response (200):**
```json
{
  "lead": {
    "id": "clx123abc",
    "propertyAddress": "Updated Address",
    ...
  }
}
```

---

## POST /api/vendor-pipeline/leads/[id]/send-message

Send an SMS message to a vendor (manual override).

**Auth:** Required

**Path Parameters:**
- `id` - Vendor lead ID

**Request Body:**
```json
{
  "message": "string (required, max 1600 chars)"
}
```

**Response (200):**
```json
{
  "smsMessage": {
    "id": "clx456def",
    "vendorLeadId": "clx123abc",
    "direction": "outbound",
    "messageBody": "Your message here",
    "status": "sent",
    "twilioSid": "SM123...",
    "createdAt": "2025-12-27T10:35:00Z"
  }
}
```

**Errors:**
- `404` - Lead not found
- `400` - Message too long
- `500` - Twilio API error

**Example:**
```bash
curl -X POST http://localhost:3000/api/vendor-pipeline/leads/clx123abc/send-message \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "message": "Thanks for your patience. Our surveyor will visit next week."
  }'
```

---

## POST /api/vendor-pipeline/leads/[id]/update-stage

Manually move a lead to a different pipeline stage.

**Auth:** Required (admin/sourcer)

**Request Body:**
```json
{
  "newStage": "OFFER_MADE | OFFER_ACCEPTED | DEAD_LEAD | ...",
  "reason": "string (optional)"
}
```

**Response (200):**
```json
{
  "lead": {
    "id": "clx123abc",
    "pipelineStage": "OFFER_ACCEPTED",
    ...
  },
  "event": {
    "id": "clx789ghi",
    "eventType": "stage_change",
    "fromStage": "OFFER_MADE",
    "toStage": "OFFER_ACCEPTED",
    "metadata": {
      "reason": "Manual override"
    }
  }
}
```

---

## GET /api/vendor-pipeline/stats

Get pipeline performance statistics.

**Auth:** Required

**Response (200):**
```json
{
  "totalLeads": 142,
  "activeLeads": 67,
  "byStage": {
    "NEW_LEAD": 5,
    "AI_CONVERSATION": 23,
    "DEAL_VALIDATION": 8,
    "OFFER_MADE": 15,
    "OFFER_ACCEPTED": 10,
    "DEAD_LEAD": 81
  },
  "conversionRates": {
    "leadToOffer": 28.5,
    "offerToAccepted": 22.3,
    "overallConversion": 6.3
  },
  "averageTimeInStage": {
    "AI_CONVERSATION": 18.5,
    "DEAL_VALIDATION": 0.5,
    "OFFER_MADE": 36.2
  },
  "revenueMetrics": {
    "totalPipelineValue": 1250000,
    "averageDealValue": 235000,
    "projectedMonthlyRevenue": 180000
  }
}
```

---

## GET /api/vendor-pipeline/export

Export pipeline data to CSV.

**Auth:** Required

**Query Parameters:**
- `stage` - Filter by stage (optional)
- `dateFrom` - Start date (optional, ISO format)
- `dateTo` - End date (optional, ISO format)

**Response (200):**
- Content-Type: `text/csv`
- CSV file download

**Example:**
```bash
curl -X GET "http://localhost:3000/api/vendor-pipeline/export?stage=OFFER_ACCEPTED" \
  -H "Cookie: next-auth.session-token=..." \
  -o pipeline-export.csv
```

---

## GET /api/vendor-pipeline/rate-limits

Check current SMS and API rate limit status.

**Auth:** Required

**Response (200):**
```json
{
  "sms": {
    "used": 47,
    "limit": 1000,
    "remaining": 953,
    "resetAt": "2025-12-27T11:00:00Z"
  },
  "propertyDataAPI": {
    "used": 23,
    "limit": 100,
    "remaining": 77,
    "resetAt": "2025-12-27T11:00:00Z"
  }
}
```

---

## POST /api/vendor-pipeline/webhook/sms

Receive inbound SMS messages from Twilio.

**Auth:** Public (Twilio webhook)

**Content-Type:** `application/x-www-form-urlencoded`

**Request Body (Form Data):**
- `From` - Sender phone number
- `To` - Recipient phone number (your Twilio number)
- `Body` - Message text
- `MessageSid` - Twilio message ID

**Response (200):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>
```

**Note:** This endpoint processes the message asynchronously and responds to the vendor via a separate API call.

---

## POST /api/facebook-leads/webhook

Receive new property seller leads from Facebook Lead Ads.

**Auth:** Public (Facebook webhook)

**Verification (GET):**
```
GET /api/facebook-leads/webhook?hub.mode=subscribe&hub.challenge=123&hub.verify_token=your_token
```

**Webhook Payload (POST):**
```json
{
  "object": "page",
  "entry": [
    {
      "id": "page_id",
      "time": 1640000000,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "ad_id": "123456",
            "form_id": "789012",
            "leadgen_id": "345678",
            "created_time": 1640000000,
            "page_id": "page_id",
            "adgroup_id": "910111"
          }
        }
      ]
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Lead processed"
}
```

---

## POST /api/vendor-pipeline/test/simulate-sms

Simulate an SMS conversation for testing (dev only).

**Auth:** Required (admin only)

**Request Body:**
```json
{
  "vendorLeadId": "string (required)",
  "messages": [
    {
      "from": "vendor | system",
      "text": "string (required)"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "messagesProcessed": 5,
  "finalStage": "DEAL_VALIDATION"
}
```

---

# Vendor Leads

Operations on vendor leads from the AI pipeline.

## GET /api/vendor-leads/[id]

Get vendor lead details (alias for vendor-pipeline endpoint).

**Auth:** Required

**Response:** Same as `/api/vendor-pipeline/leads/[id]`

---

## POST /api/vendor-leads/[id]/calculate-bmv

Trigger BMV validation for a vendor lead.

**Auth:** Required

**Response (200):**
```json
{
  "validation": {
    "bmvScore": 18.5,
    "estimatedMarketValue": 300000,
    "estimatedRefurbCost": 20000,
    "profitPotential": 35000,
    "validationPassed": true,
    "comparablesCount": 7,
    "confidence": "high"
  }
}
```

**Errors:**
- `400` - Missing required property data
- `404` - No comparables found
- `500` - PropertyData API error

---

## GET /api/vendor-leads/[id]/comparables

Get comparable properties for a vendor lead.

**Auth:** Required

**Response (200):**
```json
{
  "comparables": [
    {
      "id": "clx111aaa",
      "address": "125 High Street",
      "postcode": "SW1A 1AB",
      "salePrice": 295000,
      "saleDate": "2025-11-15",
      "propertyType": "terraced_house",
      "bedrooms": 3,
      "distance": 125.5,
      "daysOld": 42
    }
  ],
  "count": 7,
  "avgPrice": 298500
}
```

---

## POST /api/vendor-leads/[id]/fetch-comparables

Fetch fresh comparables from PropertyData API.

**Auth:** Required

**Request Body:**
```json
{
  "radius": "number (optional, default: 0.5, in miles)",
  "limit": "number (optional, default: 10)"
}
```

**Response (200):**
```json
{
  "comparables": [...],
  "count": 7,
  "cached": false,
  "apiCost": 0.05
}
```

---

## POST /api/vendor-leads/[id]/investor-pack

Generate investor pack PDF for a validated lead.

**Auth:** Required

**Request Body:**
```json
{
  "templateId": "string (optional, uses default if not provided)"
}
```

**Response (200):**
```json
{
  "investorPack": {
    "id": "clx222bbb",
    "dealId": "clx333ccc",
    "templateId": "clx444ddd",
    "pdfUrl": "https://s3.../investor-pack-clx222bbb.pdf",
    "generatedAt": "2025-12-27T11:00:00Z"
  }
}
```

---

# Deals

Property deal management.

## GET /api/deals

List all deals with filtering.

**Auth:** Required

**Query Parameters:**
- `status` - Filter by status (`draft`, `active`, `reserved`, `completed`, `cancelled`)
- `userId` - Filter by user (admin only)
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset

**Response (200):**
```json
{
  "deals": [
    {
      "id": "clx333ccc",
      "userId": "clx555eee",
      "propertyAddress": "123 High Street",
      "propertyPostcode": "SW1A 1AA",
      "askingPrice": 250000,
      "estimatedValue": 300000,
      "bmvPercentage": 16.7,
      "status": "active",
      "createdAt": "2025-12-27T09:00:00Z",
      "_count": {
        "photos": 8,
        "reservations": 2
      }
    }
  ],
  "total": 25
}
```

---

## POST /api/deals

Create a new deal.

**Auth:** Required (admin/sourcer)

**Request Body:**
```json
{
  "propertyAddress": "string (required)",
  "propertyPostcode": "string (required)",
  "askingPrice": "number (required)",
  "bedrooms": "number (required)",
  "bathrooms": "number (optional)",
  "propertyType": "string (required)",
  "description": "string (optional)",
  "vendorLeadId": "string (optional, link to vendor lead)"
}
```

**Response (201):**
```json
{
  "deal": {
    "id": "clx333ccc",
    "propertyAddress": "123 High Street",
    "status": "draft",
    "createdAt": "2025-12-27T11:00:00Z"
  }
}
```

---

## GET /api/deals/[id]

Get detailed deal information.

**Auth:** Required

**Response (200):**
```json
{
  "deal": {
    "id": "clx333ccc",
    "userId": "clx555eee",
    "propertyAddress": "123 High Street",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 250000,
    "estimatedValue": 300000,
    "bmvPercentage": 16.7,
    "refurbCost": 20000,
    "grossYield": 6.5,
    "netYield": 5.2,
    "status": "active",
    "description": "3 bed terrace in prime location",
    "photos": [...],
    "vendor": {...},
    "reservations": [...],
    "user": {
      "name": "Sourcer Name",
      "email": "sourcer@example.com"
    }
  }
}
```

---

## PATCH /api/deals/[id]

Update deal details.

**Auth:** Required (owner or admin)

**Request Body:**
```json
{
  "askingPrice": "number (optional)",
  "estimatedValue": "number (optional)",
  "description": "string (optional)",
  "status": "string (optional)"
}
```

**Response (200):**
```json
{
  "deal": {
    "id": "clx333ccc",
    "askingPrice": 260000,
    ...
  }
}
```

---

## DELETE /api/deals/[id]

Delete a deal (admin only).

**Auth:** Required (admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Deal deleted"
}
```

---

## PATCH /api/deals/[id]/status

Update deal status.

**Auth:** Required (owner or admin)

**Request Body:**
```json
{
  "status": "draft | active | reserved | completed | cancelled"
}
```

**Response (200):**
```json
{
  "deal": {
    "id": "clx333ccc",
    "status": "reserved",
    ...
  }
}
```

---

## POST /api/deals/[id]/photos

Upload deal photos.

**Auth:** Required (owner or admin)

**Request Body:**
```json
{
  "url": "string (required, S3 URL)",
  "filename": "string (required)",
  "filesize": "number (required, bytes)",
  "caption": "string (optional)",
  "order": "number (optional, display order)"
}
```

**Response (201):**
```json
{
  "photo": {
    "id": "clx666fff",
    "dealId": "clx333ccc",
    "url": "https://s3.../photo.jpg",
    "filename": "living-room.jpg",
    "isCoverPhoto": false,
    "order": 0,
    "createdAt": "2025-12-27T11:05:00Z"
  }
}
```

---

## GET /api/deals/[id]/photos

List all photos for a deal.

**Auth:** Required

**Response (200):**
```json
{
  "photos": [
    {
      "id": "clx666fff",
      "url": "https://s3.../photo.jpg",
      "filename": "living-room.jpg",
      "caption": "Spacious living room",
      "isCoverPhoto": true,
      "order": 0
    }
  ]
}
```

---

## POST /api/deals/[id]/photos/presign

Get presigned URL for uploading photos to S3.

**Auth:** Required (owner or admin)

**Request Body:**
```json
{
  "filename": "string (required)",
  "contentType": "string (required, e.g., 'image/jpeg')"
}
```

**Response (200):**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileUrl": "https://s3.amazonaws.com/.../final-url.jpg",
  "key": "deals/clx333ccc/abc123.jpg",
  "expiresIn": 300
}
```

**Usage:**
```bash
# Step 1: Get presigned URL
RESPONSE=$(curl -X POST http://localhost:3000/api/deals/clx333ccc/photos/presign \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"filename": "photo.jpg", "contentType": "image/jpeg"}')

UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
FILE_URL=$(echo $RESPONSE | jq -r '.fileUrl')

# Step 2: Upload to S3
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --upload-file photo.jpg

# Step 3: Save photo record
curl -X POST http://localhost:3000/api/deals/clx333ccc/photos \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d "{\"url\": \"$FILE_URL\", \"filename\": \"photo.jpg\", \"filesize\": 123456}"
```

---

## PATCH /api/deals/[id]/photos/[photoId]/cover

Set a photo as the cover photo for a deal.

**Auth:** Required (owner or admin)

**Response (200):**
```json
{
  "photo": {
    "id": "clx666fff",
    "isCoverPhoto": true,
    ...
  }
}
```

---

## DELETE /api/deals/[id]/photos/[photoId]

Delete a photo.

**Auth:** Required (owner or admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Photo deleted"
}
```

---

## POST /api/deals/[id]/investor-pack

Generate investor pack PDF for a deal.

**Auth:** Required

**Request Body:**
```json
{
  "templateId": "string (optional, uses default if not provided)"
}
```

**Response (200):**
```json
{
  "investorPack": {
    "id": "clx777ggg",
    "dealId": "clx333ccc",
    "templateId": "clx444ddd",
    "pdfUrl": "https://s3.../investor-pack.pdf",
    "generatedAt": "2025-12-27T11:10:00Z"
  }
}
```

---

# Investors

Investor management and engagement.

## GET /api/investors

List all investors with filtering.

**Auth:** Required

**Query Parameters:**
- `search` - Search by name, email, phone
- `status` - Filter by status (`active`, `inactive`)
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

**Response (200):**
```json
{
  "investors": [
    {
      "id": "clx888hhh",
      "firstName": "Sarah",
      "lastName": "Johnson",
      "email": "sarah@example.com",
      "phone": "+447123456789",
      "investorType": "individual",
      "status": "active",
      "createdAt": "2025-11-15T10:00:00Z",
      "_count": {
        "reservations": 3,
        "criteria": 2
      }
    }
  ],
  "total": 48
}
```

---

## POST /api/investors

Create a new investor.

**Auth:** Required

**Request Body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required)",
  "phone": "string (optional)",
  "investorType": "individual | company",
  "companyName": "string (optional)",
  "notes": "string (optional)"
}
```

**Response (201):**
```json
{
  "investor": {
    "id": "clx888hhh",
    "firstName": "Sarah",
    "lastName": "Johnson",
    "email": "sarah@example.com",
    "status": "active",
    "createdAt": "2025-12-27T11:15:00Z"
  }
}
```

---

## GET /api/investors/[id]

Get detailed investor information.

**Auth:** Required

**Response (200):**
```json
{
  "investor": {
    "id": "clx888hhh",
    "firstName": "Sarah",
    "lastName": "Johnson",
    "email": "sarah@example.com",
    "phone": "+447123456789",
    "investorType": "individual",
    "status": "active",
    "notes": "Prefers London properties",
    "criteria": [...],
    "reservations": [...],
    "activities": [...],
    "createdAt": "2025-11-15T10:00:00Z"
  }
}
```

---

## PATCH /api/investors/[id]

Update investor details.

**Auth:** Required

**Request Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "status": "active | inactive",
  "notes": "string (optional)"
}
```

**Response (200):**
```json
{
  "investor": {
    "id": "clx888hhh",
    "firstName": "Sarah",
    ...
  }
}
```

---

## DELETE /api/investors/[id]

Delete an investor (admin only).

**Auth:** Required (admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Investor deleted"
}
```

---

## GET /api/investors/[id]/pipeline

Get investor's deal pipeline and engagement history.

**Auth:** Required

**Response (200):**
```json
{
  "pipeline": {
    "packsReceived": 12,
    "packsViewed": 8,
    "reservationsMade": 3,
    "dealsCompleted": 1
  },
  "recentActivity": [...],
  "reservations": [...]
}
```

---

## GET /api/investors/stats

Get investor database statistics.

**Auth:** Required

**Response (200):**
```json
{
  "totalInvestors": 48,
  "activeInvestors": 42,
  "byType": {
    "individual": 35,
    "company": 13
  },
  "engagement": {
    "highEngagement": 15,
    "mediumEngagement": 20,
    "lowEngagement": 13
  },
  "totalReservations": 67,
  "totalCompleted": 12
}
```

---

## GET /api/investors/activities

Get recent investor activities across all investors.

**Auth:** Required

**Query Parameters:**
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

**Response (200):**
```json
{
  "activities": [
    {
      "id": "clx999iii",
      "investorId": "clx888hhh",
      "activityType": "pack_viewed",
      "dealId": "clx333ccc",
      "metadata": {
        "packId": "clx777ggg",
        "duration": 180
      },
      "createdAt": "2025-12-27T10:30:00Z",
      "investor": {
        "firstName": "Sarah",
        "lastName": "Johnson"
      }
    }
  ]
}
```

---

## POST /api/investors/pack-delivery

Send investor pack to an investor via email.

**Auth:** Required

**Request Body:**
```json
{
  "investorId": "string (required)",
  "investorPackId": "string (required)",
  "customMessage": "string (optional)"
}
```

**Response (201):**
```json
{
  "delivery": {
    "id": "clxAAAjjj",
    "investorId": "clx888hhh",
    "investorPackId": "clx777ggg",
    "sentAt": "2025-12-27T11:20:00Z",
    "status": "sent"
  }
}
```

---

## GET /api/investors/pack-delivery/[id]/track

Track investor pack delivery and engagement.

**Auth:** Required

**Response (200):**
```json
{
  "delivery": {
    "id": "clxAAAjjj",
    "sentAt": "2025-12-27T11:20:00Z",
    "openedAt": "2025-12-27T11:25:00Z",
    "viewedAt": "2025-12-27T11:26:00Z",
    "downloadedAt": null,
    "status": "viewed"
  }
}
```

---

## POST /api/investors/reservations

Create a reservation (investor reserves a deal).

**Auth:** Required

**Request Body:**
```json
{
  "dealId": "string (required)",
  "investorId": "string (required)",
  "amount": "number (required, reservation fee)",
  "notes": "string (optional)"
}
```

**Response (201):**
```json
{
  "reservation": {
    "id": "clxBBBkkk",
    "dealId": "clx333ccc",
    "investorId": "clx888hhh",
    "amount": 5000,
    "status": "pending",
    "createdAt": "2025-12-27T11:25:00Z"
  }
}
```

---

## GET /api/investors/reservations

List all reservations with filtering.

**Auth:** Required

**Query Parameters:**
- `status` - Filter by status (`pending`, `confirmed`, `cancelled`)
- `investorId` - Filter by investor
- `dealId` - Filter by deal

**Response (200):**
```json
{
  "reservations": [...]
}
```

---

## PATCH /api/investors/reservations/[id]

Update reservation status.

**Auth:** Required

**Request Body:**
```json
{
  "status": "pending | confirmed | cancelled",
  "notes": "string (optional)"
}
```

**Response (200):**
```json
{
  "reservation": {
    "id": "clxBBBkkk",
    "status": "confirmed",
    ...
  }
}
```

---

# Reservations

Reservation management (also accessible via `/api/investors/reservations`).

## GET /api/reservations

List all reservations.

**Auth:** Required

**Same as:** `/api/investors/reservations`

---

## GET /api/reservations/[id]

Get reservation details.

**Auth:** Required

**Response (200):**
```json
{
  "reservation": {
    "id": "clxBBBkkk",
    "dealId": "clx333ccc",
    "investorId": "clx888hhh",
    "amount": 5000,
    "status": "confirmed",
    "createdAt": "2025-12-27T11:25:00Z",
    "deal": {...},
    "investor": {...},
    "proofOfFunds": {...}
  }
}
```

---

## PATCH /api/reservations/[id]

Update reservation.

**Auth:** Required

**Same as:** `/api/investors/reservations/[id]`

---

## POST /api/reservations/[id]/proof-of-funds

Upload proof of funds for a reservation.

**Auth:** Required

**Request Body:**
```json
{
  "documentUrl": "string (required, S3 URL)",
  "documentType": "bank_statement | mortgage_agreement | other",
  "amount": "number (required)",
  "notes": "string (optional)"
}
```

**Response (201):**
```json
{
  "proofOfFunds": {
    "id": "clxCCClll",
    "reservationId": "clxBBBkkk",
    "documentUrl": "https://s3.../pof.pdf",
    "documentType": "bank_statement",
    "amount": 250000,
    "status": "pending_review",
    "uploadedAt": "2025-12-27T11:30:00Z"
  }
}
```

---

# Investor Pack Templates

PDF template management for investor packs.

## GET /api/investor-pack-templates

List all templates.

**Auth:** Required

**Response (200):**
```json
{
  "templates": [
    {
      "id": "clx444ddd",
      "name": "Professional Template",
      "description": "Premium pack with full analysis",
      "isDefault": true,
      "isActive": true,
      "coverStyle": "modern",
      "colorScheme": "blue",
      "createdAt": "2025-11-01T10:00:00Z"
    }
  ]
}
```

---

## POST /api/investor-pack-templates

Create a new template.

**Auth:** Required (admin/sourcer)

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "coverStyle": "modern | minimal | professional",
  "colorScheme": "blue | green | purple | red",
  "sections": [
    {"type": "cover", "enabled": true, "order": 0},
    {"type": "metrics", "enabled": true, "order": 1},
    ...
  ],
  "metricsConfig": {
    "cover": ["bmvPercentage", "profitPotential", "roi"],
    "metrics": [...]
  }
}
```

**Response (201):**
```json
{
  "template": {
    "id": "clxDDDmmm",
    "name": "Custom Template",
    ...
  }
}
```

---

## GET /api/investor-pack-templates/[id]

Get template details.

**Auth:** Required

**Response (200):**
```json
{
  "template": {
    "id": "clx444ddd",
    "name": "Professional Template",
    "sections": [...],
    "metricsConfig": {...},
    ...
  }
}
```

---

## PATCH /api/investor-pack-templates/[id]

Update template.

**Auth:** Required (admin/sourcer)

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "sections": "array (optional)",
  "isActive": "boolean (optional)"
}
```

**Response (200):**
```json
{
  "template": {
    "id": "clx444ddd",
    "name": "Updated Template",
    ...
  }
}
```

---

## POST /api/investor-pack-templates/[id]/duplicate

Duplicate an existing template.

**Auth:** Required (admin/sourcer)

**Response (201):**
```json
{
  "template": {
    "id": "clxEEEnnn",
    "name": "Professional Template (Copy)",
    "isDefault": false,
    ...
  }
}
```

---

## POST /api/investor-pack-templates/[id]/set-default

Set a template as the default.

**Auth:** Required (admin)

**Response (200):**
```json
{
  "template": {
    "id": "clx444ddd",
    "isDefault": true,
    ...
  }
}
```

---

## GET /api/investor-pack-templates/stats

Get template usage statistics.

**Auth:** Required

**Response (200):**
```json
{
  "totalTemplates": 5,
  "activeTemplates": 4,
  "defaultTemplate": {
    "id": "clx444ddd",
    "name": "Professional Template"
  },
  "usageStats": [
    {
      "templateId": "clx444ddd",
      "templateName": "Professional Template",
      "packsGenerated": 42,
      "lastUsed": "2025-12-27T10:00:00Z"
    }
  ]
}
```

---

# Comparables

Market comparable properties.

## GET /api/comparables/recent

Get recently fetched comparable properties.

**Auth:** Required

**Query Parameters:**
- `limit` - Results per page (default: 10)

**Response (200):**
```json
{
  "comparables": [
    {
      "id": "clxFFFooo",
      "address": "125 High Street",
      "postcode": "SW1A 1AB",
      "salePrice": 295000,
      "saleDate": "2025-11-15",
      "propertyType": "terraced_house",
      "bedrooms": 3,
      "vendorLeadId": "clx123abc",
      "distance": 125.5,
      "createdAt": "2025-12-27T10:00:00Z"
    }
  ]
}
```

---

## GET /api/comparables/top-yields

Get properties with highest rental yields.

**Auth:** Required

**Query Parameters:**
- `limit` - Results per page (default: 10)

**Response (200):**
```json
{
  "comparables": [
    {
      "id": "clxGGGppp",
      "address": "127 High Street",
      "salePrice": 280000,
      "monthlyRent": 1600,
      "rentalYield": 6.86,
      "vendorLeadId": "clx456def",
      ...
    }
  ]
}
```

---

## GET /api/comparables/config

Get or update comparables search configuration.

**Auth:** Required

**GET Response (200):**
```json
{
  "config": {
    "id": "clxHHHqqq",
    "defaultRadius": 0.5,
    "maxResults": 10,
    "maxAge": 12,
    "minBedrooms": 1,
    "maxBedrooms": 10
  }
}
```

**POST/PATCH Request:**
```json
{
  "defaultRadius": "number (optional, miles)",
  "maxResults": "number (optional)",
  "maxAge": "number (optional, months)"
}
```

---

# PropertyData Integration

UK property data API integration.

## POST /api/propertydata

Fetch property data from PropertyData UK API.

**Auth:** Required

**Request Body:**
```json
{
  "postcode": "string (required, UK postcode)",
  "address": "string (optional)"
}
```

**Response (200):**
```json
{
  "property": {
    "uprn": "100021234567",
    "address": "123 High Street",
    "postcode": "SW1A 1AA",
    "propertyType": "terraced_house",
    "bedrooms": 3,
    "councilTaxBand": "D",
    "tenure": "freehold",
    "estimatedValue": 300000,
    "lastSalePrice": 250000,
    "lastSaleDate": "2023-06-15"
  }
}
```

---

## GET /api/propertydata/search

Search for properties by criteria.

**Auth:** Required

**Query Parameters:**
- `postcode` - UK postcode (required)
- `radius` - Search radius in miles (optional, default: 0.5)
- `propertyType` - Filter by type (optional)
- `minBeds` - Minimum bedrooms (optional)
- `maxBeds` - Maximum bedrooms (optional)

**Response (200):**
```json
{
  "properties": [...],
  "count": 15
}
```

---

## GET /api/propertydata/usage

Get PropertyData API usage and costs.

**Auth:** Required

**Response (200):**
```json
{
  "usage": {
    "today": {
      "requests": 23,
      "cost": 1.15
    },
    "thisMonth": {
      "requests": 456,
      "cost": 22.80
    },
    "limit": {
      "daily": 100,
      "monthly": 3000
    },
    "remaining": {
      "daily": 77,
      "monthly": 2544
    }
  }
}
```

---

# Analytics

Business intelligence and reporting.

## GET /api/analytics/workflow

Get vendor workflow analytics.

**Auth:** Required

**Query Parameters:**
- `dateFrom` - Start date (optional, ISO format)
- `dateTo` - End date (optional, ISO format)

**Response (200):**
```json
{
  "overview": {
    "totalVendors": 142,
    "activeVendors": 67,
    "completedDeals": 12
  },
  "byStatus": {
    "NEW_LEAD": 5,
    "AI_CONVERSATION": 23,
    "DEAL_VALIDATION": 8,
    "OFFER_MADE": 15,
    "OFFER_ACCEPTED": 10,
    "DEAD_LEAD": 81
  },
  "conversionRates": {
    "leadToOffer": 28.5,
    "offerToAccepted": 22.3,
    "overallConversion": 6.3
  },
  "timeMetrics": {
    "avgTimeToOffer": 36.5,
    "avgTimeToAcceptance": 72.3,
    "avgTimeToCompletion": 45.2
  },
  "dateRange": {
    "from": "2025-11-01T00:00:00Z",
    "to": "2025-12-27T23:59:59Z"
  }
}
```

---

# Users & Team

User account and team management.

## GET /api/users

List all users (admin only).

**Auth:** Required (admin)

**Response (200):**
```json
{
  "users": [
    {
      "id": "clx555eee",
      "name": "John Sourcer",
      "email": "john@example.com",
      "role": "sourcer",
      "status": "active",
      "createdAt": "2025-10-01T10:00:00Z",
      "_count": {
        "deals": 15
      }
    }
  ]
}
```

---

## POST /api/users

Create a new user (admin only).

**Auth:** Required (admin)

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required)",
  "password": "string (required, min 8 chars)",
  "role": "admin | sourcer | viewer"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "clxIIIrrr",
    "name": "New User",
    "email": "newuser@example.com",
    "role": "sourcer",
    "status": "active"
  }
}
```

---

## GET /api/users/[id]

Get user details.

**Auth:** Required (self or admin)

**Response (200):**
```json
{
  "user": {
    "id": "clx555eee",
    "name": "John Sourcer",
    "email": "john@example.com",
    "role": "sourcer",
    "status": "active",
    "profilePictureUrl": "https://s3.../profile.jpg",
    "createdAt": "2025-10-01T10:00:00Z"
  }
}
```

---

## PATCH /api/users/[id]

Update user details.

**Auth:** Required (self or admin)

**Request Body:**
```json
{
  "name": "string (optional)",
  "email": "string (optional)",
  "role": "string (optional, admin only)",
  "status": "active | inactive (admin only)"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "clx555eee",
    "name": "Updated Name",
    ...
  }
}
```

---

## DELETE /api/users/[id]

Delete a user (admin only).

**Auth:** Required (admin)

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted"
}
```

---

## GET /api/users/team

Get team members (all active users).

**Auth:** Required

**Response (200):**
```json
{
  "team": [
    {
      "id": "clx555eee",
      "name": "John Sourcer",
      "email": "john@example.com",
      "role": "sourcer",
      "profilePictureUrl": "https://s3.../profile.jpg"
    }
  ]
}
```

---

## POST /api/users/[id]/profile-picture

Upload profile picture presigned URL.

**Auth:** Required (self or admin)

**Request Body:**
```json
{
  "filename": "string (required)",
  "contentType": "string (required)"
}
```

**Response (200):**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileUrl": "https://s3.amazonaws.com/.../profile.jpg"
}
```

---

## GET /api/users/[id]/profile-picture/url

Get current profile picture URL.

**Auth:** Required

**Response (200):**
```json
{
  "url": "https://s3.../profile.jpg"
}
```

---

# Company Profile

Company branding and settings.

## GET /api/company-profile

Get or update company profile.

**Auth:** Required

**GET Response (200):**
```json
{
  "profile": {
    "id": "clxJJJsss",
    "companyName": "DealStack Ltd",
    "companyPhone": "+44 20 1234 5678",
    "companyEmail": "info@dealstack.co.uk",
    "companyWebsite": "www.dealstack.co.uk",
    "companyAddress": "123 Business St, London",
    "logoUrl": "https://s3.../logo.png",
    "primaryColor": "#1E40AF",
    "secondaryColor": "#10B981"
  }
}
```

**POST/PATCH Request:**
```json
{
  "companyName": "string (optional)",
  "companyPhone": "string (optional)",
  "companyEmail": "string (optional)",
  "logoUrl": "string (optional)"
}
```

---

# Authentication

NextAuth authentication endpoints.

## POST /api/auth/signin

Sign in with email and password.

**Auth:** Public

**Note:** This is handled by NextAuth. Use the NextAuth client library:

```typescript
import { signIn } from "next-auth/react"

await signIn("credentials", {
  email: "user@example.com",
  password: "password123",
  redirect: false
})
```

---

## POST /api/auth/signout

Sign out current user.

**Auth:** Required

**Note:** Handled by NextAuth:

```typescript
import { signOut } from "next-auth/react"

await signOut({ redirect: false })
```

---

## POST /api/auth/forgot-password

Request password reset email.

**Auth:** Public

**Request Body:**
```json
{
  "email": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

## POST /api/auth/reset-password

Reset password with token.

**Auth:** Public

**Request Body:**
```json
{
  "token": "string (required)",
  "password": "string (required, min 8 chars)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

# Legacy Vendors

Old vendor system (deprecated, use vendor-pipeline instead).

## GET /api/vendors

List legacy vendors.

**Auth:** Required

**Note:** This is the old system. New implementations should use `/api/vendor-pipeline/leads`.

---

## POST /api/vendors

Create legacy vendor.

**Auth:** Required

**Note:** Deprecated. Use `/api/vendor-pipeline/leads` instead.

---

## GET /api/vendors/[id]

Get legacy vendor details.

**Auth:** Required

---

## PATCH /api/vendors/[id]

Update legacy vendor.

**Auth:** Required

---

## DELETE /api/vendors/[id]

Delete legacy vendor.

**Auth:** Required (admin)

---

## GET /api/vendors/[id]/conversations

Get vendor AI conversations (legacy).

**Auth:** Required

---

## GET /api/vendors/[id]/offers

Get vendor offers (legacy).

**Auth:** Required

---

## POST /api/vendors/[id]/offers

Create vendor offer (legacy).

**Auth:** Required

---

## PATCH /api/vendors/[id]/offers/[offerId]

Update offer (legacy).

**Auth:** Required

---

# Development/Testing

Development and testing endpoints (should be disabled in production).

## POST /api/dev/clear-test-data

Clear all test data from database.

**Auth:** Required (admin, dev environment only)

**Response (200):**
```json
{
  "success": true,
  "message": "Test data cleared",
  "deleted": {
    "vendorLeads": 5,
    "deals": 2,
    "investors": 3
  }
}
```

---

## POST /api/dev/test-ai-conversation

Test AI conversation without sending real SMS.

**Auth:** Required (admin, dev environment only)

**Request Body:**
```json
{
  "vendorLeadId": "string (required)",
  "message": "string (required)"
}
```

**Response (200):**
```json
{
  "aiResponse": "Thanks for that information...",
  "extractedData": {
    "askingPrice": 250000,
    "propertyType": "terraced_house"
  },
  "nextAction": "continue_conversation | trigger_validation"
}
```

---

## Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Not authenticated | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Input validation failed | 422 |
| `RATE_LIMITED` | Too many requests | 429 |
| `SERVER_ERROR` | Internal server error | 500 |
| `TWILIO_ERROR` | SMS sending failed | 500 |
| `PROPERTYDATA_ERROR` | External API failed | 500 |
| `DATABASE_ERROR` | Database operation failed | 500 |

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit` - Results per page (default varies by endpoint)
- `offset` - Number of results to skip

**Response:**
```json
{
  "items": [...],
  "total": 142,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

---

## Filtering

Many endpoints support filtering:

**Common Filter Parameters:**
- `search` - Full-text search
- `status` - Filter by status
- `dateFrom` - Start date (ISO 8601)
- `dateTo` - End date (ISO 8601)
- `userId` - Filter by user (admin only)

---

## Sorting

Some endpoints support sorting:

**Query Parameters:**
- `sortBy` - Field to sort by (e.g., `createdAt`, `askingPrice`)
- `sortOrder` - `asc` or `desc` (default: `desc`)

**Example:**
```
GET /api/deals?sortBy=askingPrice&sortOrder=asc
```

---

## Testing with cURL

### Authentication

```bash
# 1. Login and save cookies
curl -c cookies.txt -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'

# 2. Use cookies in subsequent requests
curl -b cookies.txt http://localhost:3000/api/deals
```

### Creating a Complete Flow

```bash
# 1. Create vendor lead
curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test Vendor",
    "vendorPhone": "+447123456789",
    "propertyAddress": "123 Test St"
  }'

# 2. Simulate SMS conversation
curl -b cookies.txt -X POST http://localhost:3000/api/dev/test-ai-conversation \
  -H "Content-Type: application/json" \
  -d '{
    "vendorLeadId": "clx123abc",
    "message": "Yes, 3 bed house, needs work, £250k"
  }'

# 3. Trigger BMV validation
curl -b cookies.txt -X POST http://localhost:3000/api/vendor-leads/clx123abc/calculate-bmv

# 4. Create deal if validated
curl -b cookies.txt -X POST http://localhost:3000/api/deals \
  -H "Content-Type: application/json" \
  -d '{
    "propertyAddress": "123 Test St",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 250000,
    "bedrooms": 3,
    "propertyType": "terraced_house",
    "vendorLeadId": "clx123abc"
  }'

# 5. Generate investor pack
curl -b cookies.txt -X POST http://localhost:3000/api/deals/clx333ccc/investor-pack
```

---

## Webhooks

### Configuring Webhooks

**Twilio SMS Webhook:**
```
URL: https://yourdomain.com/api/vendor-pipeline/webhook/sms
Method: POST
Content-Type: application/x-www-form-urlencoded
```

**Facebook Lead Ads Webhook:**
```
URL: https://yourdomain.com/api/facebook-leads/webhook
Method: POST
Content-Type: application/json
Verify Token: Your secret token
```

### Testing Webhooks Locally

Use ngrok to expose localhost:

```bash
# 1. Start ngrok
ngrok http 3000

# 2. Copy HTTPS URL (e.g., https://abc123.ngrok.io)

# 3. Update webhook URLs in Twilio/Facebook to:
https://abc123.ngrok.io/api/vendor-pipeline/webhook/sms
https://abc123.ngrok.io/api/facebook-leads/webhook
```

---

## Postman Collection

Import these endpoints into Postman:

**Base Variables:**
- `{{baseUrl}}` - `http://localhost:3000/api`
- `{{authToken}}` - Session token from cookies

**Collection:**
```json
{
  "info": {
    "name": "DealStack API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Vendor Pipeline",
      "item": [...]
    }
  ]
}
```

---

## Rate Limiting Details

**Implementation:**
- Based on IP address for public endpoints
- Based on user ID for authenticated endpoints
- Uses sliding window algorithm
- Returns `Retry-After` header when limited

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1640000000
```

**Rate Limited Response (429):**
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "retryAfter": 3600
}
```

---

## SDK / Client Libraries

Currently, no official SDK. Use standard HTTP clients:

**JavaScript/TypeScript:**
```typescript
const response = await fetch('/api/vendor-pipeline/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    vendorName: 'John Smith',
    vendorPhone: '+447123456789'
  }),
  credentials: 'include'  // Include cookies
})

const data = await response.json()
```

**Python:**
```python
import requests

response = requests.post(
    'http://localhost:3000/api/vendor-pipeline/leads',
    json={
        'vendorName': 'John Smith',
        'vendorPhone': '+447123456789'
    }
)

data = response.json()
```

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Never expose API keys** in client-side code
3. **Validate all inputs** on the server
4. **Use rate limiting** to prevent abuse
5. **Log security events** (failed logins, etc.)
6. **Rotate credentials** regularly
7. **Use CORS** properly in production
8. **Sanitize error messages** (don't leak sensitive info)

---

## Support

**Documentation Issues:**
Open an issue on GitHub

**API Questions:**
Contact engineering team

**Rate Limit Increases:**
Contact sales team

---

*Last Updated: 2025-12-27*
*API Version: 1.0*
*Documentation Version: 1.0*

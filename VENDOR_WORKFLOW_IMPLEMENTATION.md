# Vendor Workflow Implementation Guide

## Quick Overview

Based on your workflow diagram, you need to track:

1. **Vendor Journey**: Facebook Ad → AI SMS → Validation → Offers → Acceptance → Lock-out
2. **Investor Journey**: Email Campaign → Pack Purchase → Reservation → Proof of Funds → Completion
3. **Connections**: Vendor offers accepted → Create investor pack → Send to investors → Reservations

## Priority Implementation Order

### Phase 1: Vendor Tracking (Critical)
1. **Vendor Model** - Store vendor contact info, Facebook ad source
2. **Vendor Offer Model** - Track multiple offers, status, vendor decisions
3. **Vendor AI Conversation Model** - Track SMS conversations
4. Update Deal model to link to Vendor

**Why First?** This captures the beginning of your workflow - vendor acquisition from Facebook ads.

### Phase 2: Investor Reservation (High Priority)
1. **Investor Reservation Model** - Track reservations, fees, proof of funds
2. Update Deal model to track reservation count
3. Lock-out agreement tracking

**Why Second?** This is where deals convert - critical for revenue tracking.

### Phase 3: Email Campaigns (High Priority)
1. **Email Campaign Model** - Batch email tracking
2. **Email Campaign Recipient Model** - Individual email opens/clicks
3. Update Communication model to support campaigns

**Why Third?** You need to track marketing effectiveness and investor engagement.

### Phase 4: Workflow Analytics (Medium Priority)
1. Workflow stage tracking
2. Dashboard views for pipeline
3. Conversion rate metrics

## Key Fields to Add to Deal Model (Quick Wins)

Even before full implementation, add these fields to your existing Deal model:

```prisma
// Quick additions to Deal model:
offerCount            Int      @default(0)
latestOfferAmount     Decimal?
offerAcceptedAt       DateTime?
vendorPhone           String?  // Quick vendor contact
facebookAdSource      String?  // Which ad generated this
investorPackSentCount Int      @default(0)
```

## Dashboard Views Needed

### 1. Vendor Pipeline Board
Show vendors in stages:
- [Contacted] → [Validated] → [Offer Made] → [Accepted] → [Locked Out]

### 2. Offer Tracking Table
- Vendor name/phone
- Offer amount
- Offer date
- Status (pending/accepted/rejected)
- Vendor decision
- Days since offer

### 3. Investor Engagement Dashboard
- Deal name
- Investor pack sent count
- Emails opened/clicked
- Reservations count
- Proof of funds verified count

### 4. Workflow Analytics
- Time in each stage
- Conversion rates (contact → offer → acceptance)
- Average offers per deal
- Average negotiation time

## Metrics to Display

### Per Deal Card:
```
✅ Offers Made: 3
✅ Latest Offer: £65,000 (2 days ago)
✅ Vendor Response: Awaiting
✅ Investor Packs Sent: 12
✅ Reservations: 2
✅ Proof of Funds: 1 verified
```

### Vendor Card:
```
📞 Phone: +44 123 456 789
📧 Source: Facebook Ad #12345
💬 AI Conversations: 8 messages
📊 Offer History:
   - Offer 1: £60,000 (Rejected - "Too low")
   - Offer 2: £65,000 (More info requested)
   - Offer 3: £67,000 (Pending)
```

### Email Campaign Card:
```
📧 Campaign: "New BMV Deal - Cardiff"
📊 Sent: 45/50
👁️ Opened: 32 (71%)
🔗 Clicked: 18 (40%)
💰 Reservations: 3
```

## Implementation Steps

1. **Review the schema** in `VENDOR_WORKFLOW_SCHEMA.md`
2. **Start with Vendor model** - Most critical for your workflow
3. **Add offer tracking** - Multiple offers per vendor
4. **Link vendors to deals** - One vendor can become one deal
5. **Add reservation tracking** - Revenue conversion point
6. **Add email campaign tracking** - Marketing effectiveness

## Questions to Consider

1. **Vendor Identification**: How do you identify if a new Facebook lead is from an existing vendor (phone number match)?

2. **Offer Expiry**: Do offers have expiry dates? Should we track this?

3. **Video Tracking**: Where are pre-recorded videos stored? S3? YouTube? Need URL tracking.

4. **Lock-out Agreements**: Are these PDFs stored in S3? Need document tracking.

5. **Campaign Automation**: Are email campaigns automated when deals are listed, or manual?

6. **AI Conversation Storage**: Should full conversation transcripts be stored, or just summaries?

## Next Steps

1. Review the schema recommendations
2. Decide which models to implement first
3. Create Prisma migration
4. Build API endpoints for:
   - Creating/updating vendors
   - Recording offers
   - Tracking AI conversations
   - Managing reservations
   - Creating email campaigns
5. Build dashboard views
6. Add analytics/metrics

Would you like me to start implementing any of these models?


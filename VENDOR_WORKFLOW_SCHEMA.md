# Vendor & Investor Workflow Schema Extensions

Based on your workflow diagram, here are the recommended schema additions to track the complete vendor-to-investor deal flow:

## 1. Vendor/Seller Model (NEW)

Track vendor information from Facebook ads and AI conversations:

```prisma
model Vendor {
  id              String   @id @default(uuid())
  dealId          String?  @unique @map("deal_id") // One vendor per deal (after validation)
  deal            Deal?    @relation("VendorDeal", fields: [dealId], references: [id], onDelete: SetNull)
  
  // Contact Details
  firstName       String?  @map("first_name")
  lastName        String?  @map("last_name")
  email           String?
  phone           String   // Required for SMS/AI conversations
  address         String?  // Vendor's address (if different from property)
  
  // Source Tracking
  source          String   // 'facebook_ad', 'referral', 'website', etc.
  facebookAdId    String?  @map("facebook_ad_id") // Which Facebook ad generated this lead
  campaignId      String?  @map("campaign_id") // Marketing campaign ID
  
  // Initial Details
  askingPrice     Decimal? @map("asking_price") @db.Decimal(10, 2) // Vendor's asking price
  propertyAddress String?  @map("property_address") // Property address from vendor
  reasonForSale   String?  @map("reason_for_sale") @db.Text
  
  // Status Tracking
  status          VendorStatus @default(contacted)
  qualifiedAt     DateTime? @map("qualified_at")
  lockedOutAt     DateTime? @map("locked_out_at") // When lock-out agreement signed
  
  // Legal Details
  solicitorName   String?  @map("solicitor_name")
  solicitorEmail  String?  @map("solicitor_email")
  solicitorPhone  String?  @map("solicitor_phone")
  
  // Notes
  notes           String?  @db.Text
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Relations
  aiConversations VendorAIConversation[]
  offers          VendorOffer[]
  
  @@map("vendors")
  @@index([phone])
  @@index([email])
  @@index([status])
  @@index([facebookAdId])
}

enum VendorStatus {
  contacted      // Initial contact via AI SMS
  validated      // Deal validated, ready for offer
  offer_made     // Offer submitted to vendor
  offer_accepted // Vendor accepted offer
  offer_rejected // Vendor rejected offer
  negotiating    // Vendor requesting more info/negotiating
  locked_out     // Lock-out agreement signed
  withdrawn      // Vendor withdrew from sale
}
```

## 2. Vendor AI Conversation Model (NEW)

Track all AI-powered SMS conversations with vendors:

```prisma
model VendorAIConversation {
  id            String   @id @default(uuid())
  vendorId      String   @map("vendor_id")
  vendor        Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  
  // Message Details
  direction     ConversationDirection // 'inbound' or 'outbound'
  message       String   @db.Text
  aiResponse    String?  @map("ai_response") @db.Text // AI-generated response
  
  // Context
  intent        String?  // 'price_inquiry', 'more_info', 'offer_acceptance', etc.
  confidence    Decimal? @db.Decimal(5, 2) // AI confidence score (0-100)
  
  // Media
  videoSent     Boolean  @default(false) @map("video_sent") // Pre-recorded video sent
  videoUrl      String?  @map("video_url") @db.Text
  
  // Metadata
  messageId     String?  @map("message_id") // External SMS service message ID
  provider      String?  // 'twilio', 'messagebird', etc.
  
  createdAt     DateTime @default(now()) @map("created_at")
  
  @@map("vendor_ai_conversations")
  @@index([vendorId])
  @@index([createdAt])
  @@index([intent])
}

enum ConversationDirection {
  inbound
  outbound
}
```

## 3. Vendor Offer Model (NEW)

Track all offers made to vendors (multiple offers per vendor):

```prisma
model VendorOffer {
  id            String   @id @default(uuid())
  vendorId      String   @map("vendor_id")
  vendor        Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  dealId        String?  @map("deal_id") // Linked deal (if validated)
  deal          Deal?    @relation("VendorOfferDeal", fields: [dealId], references: [id], onDelete: SetNull)
  
  // Offer Details
  offerAmount   Decimal  @map("offer_amount") @db.Decimal(10, 2)
  offerDate     DateTime @default(now()) @map("offer_date")
  
  // Status
  status        OfferStatus @default(pending)
  vendorDecision VendorDecision? // 'accepted', 'rejected', 'more_info_requested'
  vendorDecisionDate DateTime? @map("vendor_decision_date")
  vendorNotes   String?  @map("vendor_notes") @db.Text
  
  // Follow-up
  moreInfoRequested Boolean @default(false) @map("more_info_requested")
  videoSent     Boolean  @default(false) @map("video_sent")
  counterOfferAmount Decimal? @map("counter_offer_amount") @db.Decimal(10, 2)
  
  // Sent By
  createdById   String?  @map("created_by")
  createdBy     User?    @relation("OfferCreator", fields: [createdById], references: [id])
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  @@map("vendor_offers")
  @@index([vendorId])
  @@index([dealId])
  @@index([status])
  @@index([offerDate])
}

enum OfferStatus {
  pending           // Offer sent, awaiting response
  more_info_sent    // More info/video sent to vendor
  accepted          // Vendor accepted
  rejected          // Vendor rejected
  counter_offered   // Vendor made counter-offer
  expired           // Offer expired
  withdrawn         // Offer withdrawn
}

enum VendorDecision {
  accepted
  rejected
  more_info_requested
  counter_offer
}
```

## 4. Investor Reservation Model (NEW)

Track investor reservations, fees, and proof of funds:

```prisma
model InvestorReservation {
  id              String   @id @default(uuid())
  investorId      String   @map("investor_id")
  investor        Investor @relation(fields: [investorId], references: [id], onDelete: Cascade)
  dealId          String   @map("deal_id")
  deal            Deal     @relation("InvestorReservationDeal", fields: [dealId], references: [id], onDelete: Cascade)
  
  // Reservation Details
  reservationFee  Decimal  @map("reservation_fee") @db.Decimal(10, 2)
  feePaid         Boolean  @default(false) @map("fee_paid")
  feePaymentId    String?  @map("fee_payment_id") // Stripe payment ID
  feePaidAt       DateTime? @map("fee_paid_at")
  
  // Proof of Funds
  proofOfFundsProvided Boolean @default(false) @map("proof_of_funds_provided")
  proofOfFundsDocumentS3Key String? @map("proof_of_funds_document_s3_key")
  proofOfFundsVerified Boolean @default(false) @map("proof_of_funds_verified")
  proofOfFundsVerifiedAt DateTime? @map("proof_of_funds_verified_at")
  proofOfFundsVerifiedBy String? @map("proof_of_funds_verified_by")
  
  // Legal Details
  solicitorName   String?  @map("solicitor_name")
  solicitorEmail  String?  @map("solicitor_email")
  solicitorPhone  String?  @map("solicitor_phone")
  solicitorFirm   String?  @map("solicitor_firm")
  
  // Lock-out Agreement
  lockOutAgreementSent Boolean @default(false) @map("lock_out_agreement_sent")
  lockOutAgreementSentAt DateTime? @map("lock_out_agreement_sent_at")
  lockOutAgreementSigned Boolean @default(false) @map("lock_out_agreement_signed")
  lockOutAgreementSignedAt DateTime? @map("lock_out_agreement_signed_at")
  lockOutAgreementDocumentS3Key String? @map("lock_out_agreement_document_s3_key")
  
  // Status
  status          ReservationStatus @default(pending)
  
  // Notes
  notes           String?  @db.Text
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  completedAt     DateTime? @map("completed_at")
  
  @@map("investor_reservations")
  @@unique([investorId, dealId]) // One reservation per investor per deal
  @@index([investorId])
  @@index([dealId])
  @@index([status])
}

enum ReservationStatus {
  pending               // Initial interest expressed
  fee_pending           // Reservation fee not yet paid
  proof_of_funds_pending // Waiting for proof of funds
  verified              // Proof of funds verified
  locked_out            // Lock-out agreement signed
  completed             // Ready for completion
  cancelled             // Reservation cancelled/refunded
}
```

## 5. Email Campaign Model (NEW)

Track batch email campaigns to investors:

```prisma
model EmailCampaign {
  id              String   @id @default(uuid())
  dealId          String?  @map("deal_id")
  deal            Deal?    @relation("EmailCampaignDeal", fields: [dealId], references: [id], onDelete: SetNull)
  
  // Campaign Details
  name            String
  subject         String
  templateId      String?  @map("template_id")
  
  // Recipients
  recipientType   CampaignRecipientType @map("recipient_type")
  filterCriteria  Json?    @map("filter_criteria") // Investor criteria filters
  
  // Stats
  totalRecipients Int      @default(0) @map("total_recipients")
  sentCount       Int      @default(0) @map("sent_count")
  deliveredCount  Int      @default(0) @map("delivered_count")
  openedCount     Int      @default(0) @map("opened_count")
  clickedCount    Int      @default(0) @map("clicked_count")
  bouncedCount    Int      @default(0) @map("bounced_count")
  unsubscribedCount Int    @default(0) @map("unsubscribed_count")
  
  // Status
  status          CampaignStatus @default(draft)
  
  // Scheduling
  scheduledAt     DateTime? @map("scheduled_at")
  sentAt          DateTime? @map("sent_at")
  
  // Created By
  createdById     String?  @map("created_by")
  createdBy       User?    @relation("CampaignCreator", fields: [createdById], references: [id])
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Relations
  emailRecipients EmailCampaignRecipient[]
  
  @@map("email_campaigns")
  @@index([dealId])
  @@index([status])
  @@index([scheduledAt])
}

enum CampaignRecipientType {
  all_investors
  criteria_match
  specific_investors
  favorites_only
}

enum CampaignStatus {
  draft
  scheduled
  sending
  sent
  failed
  cancelled
}

model EmailCampaignRecipient {
  id              String   @id @default(uuid())
  campaignId      String   @map("campaign_id")
  campaign        EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  investorId      String   @map("investor_id")
  investor        Investor @relation(fields: [investorId], references: [id], onDelete: Cascade)
  
  // Tracking
  sent            Boolean  @default(false)
  delivered       Boolean  @default(false)
  opened          Boolean  @default(false)
  clicked         Boolean  @default(false)
  bounced         Boolean  @default(false)
  unsubscribed    Boolean  @default(false)
  
  // Timestamps
  sentAt          DateTime? @map("sent_at")
  deliveredAt     DateTime? @map("delivered_at")
  openedAt        DateTime? @map("opened_at")
  clickedAt       DateTime? @map("clicked_at")
  bouncedAt       DateTime? @map("bounced_at")
  
  // External IDs
  emailServiceId  String?  @map("email_service_id") // Email service provider message ID
  
  @@unique([campaignId, investorId])
  @@map("email_campaign_recipients")
  @@index([campaignId])
  @@index([investorId])
  @@index([sent])
}
```

## 6. Updates to Existing Deal Model

Add vendor-related fields to Deal:

```prisma
model Deal {
  // ... existing fields ...
  
  // VENDOR WORKFLOW FIELDS (ADD THESE)
  vendorId              String?  @map("vendor_id")
  vendor                Vendor?  @relation("VendorDeal", fields: [vendorId], references: [id], onDelete: SetNull)
  
  // Offer Tracking
  offerCount            Int      @default(0) @map("offer_count")
  latestOfferAmount     Decimal? @map("latest_offer_amount") @db.Decimal(10, 2)
  latestOfferDate       DateTime? @map("latest_offer_date")
  offerAcceptedAt       DateTime? @map("offer_accepted_at")
  
  // Legal
  vendorSolicitorName   String?  @map("vendor_solicitor_name")
  vendorSolicitorEmail  String?  @map("vendor_solicitor_email")
  vendorSolicitorPhone  String?  @map("vendor_solicitor_phone")
  
  // Lock-out Agreement
  lockOutAgreementSent  Boolean  @default(false) @map("lock_out_agreement_sent")
  lockOutAgreementSentAt DateTime? @map("lock_out_agreement_sent_at")
  
  // Investor Pack
  investorPackSent      Boolean  @default(false) @map("investor_pack_sent")
  investorPackSentAt    DateTime? @map("investor_pack_sent_at")
  investorPackSentCount Int      @default(0) @map("investor_pack_sent_count")
  
  // Email Campaigns
  emailCampaigns        EmailCampaign[] @relation("EmailCampaignDeal")
  
  // Investor Reservations
  investorReservations  InvestorReservation[] @relation("InvestorReservationDeal")
  
  // Vendor Offers
  vendorOffers          VendorOffer[] @relation("VendorOfferDeal")
  
  // ... rest of existing fields ...
}
```

## 7. Updates to Communication Model

Extend to support vendor communications:

```prisma
model Communication {
  // ... existing fields ...
  
  // VENDOR SUPPORT (ADD THESE)
  vendorId      String?  @map("vendor_id")
  vendor        Vendor?  @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  
  // SMS specific (for vendor AI conversations)
  smsMessageId  String?  @map("sms_message_id")
  smsDirection  String?  @map("sms_direction") // 'inbound', 'outbound'
  smsProvider   String?  @map("sms_provider") // 'twilio', etc.
  
  // ... rest of existing fields ...
  
  @@index([vendorId])
}
```

## 8. Workflow Status Tracking

Add workflow stages enum to track deal progress:

```prisma
enum DealWorkflowStage {
  vendor_contacted      // Initial AI SMS sent to vendor
  vendor_validated      // Deal validated with vendor
  offer_made            // First offer sent
  offer_negotiating     // Vendor requested more info/negotiating
  offer_accepted        // Vendor accepted offer
  locked_out            // Lock-out agreement signed
  investor_pack_created // Investor pack generated
  investor_pack_sent    // Pack sent to investors
  investor_reserved     // Investor reserved deal
  proof_of_funds_verified // Investor's proof of funds verified
  solicitors_exchanged  // Solicitor details exchanged
  documents_exchanged   // Documents sent to both parties
  completion            // Completion/exchange
}
```

## Summary of New Tables

1. **vendors** - Track vendor/seller information
2. **vendor_ai_conversations** - Track AI SMS conversations
3. **vendor_offers** - Track all offers made to vendors
4. **investor_reservations** - Track investor reservations, fees, proof of funds
5. **email_campaigns** - Track batch email campaigns to investors
6. **email_campaign_recipients** - Track individual email deliveries and opens

## Key Metrics to Track

### Per Deal:
- Number of offers made to vendor
- Vendor decision timeline
- AI conversation count and quality
- Investor pack send count
- Email campaign performance
- Reservation count and conversion

### Per Vendor:
- Time from contact to offer
- Number of offers before acceptance
- Response rate to AI messages
- Average negotiation time

### Per Investor:
- Emails opened/clicked
- Packs purchased
- Reservation rate
- Proof of funds verification rate
- Average time to reservation

## Dashboard Views Needed

1. **Vendor Pipeline** - Track vendors from contact → offer → acceptance
2. **Offer Tracking** - All offers, status, vendor responses
3. **Investor Engagement** - Email opens, pack views, reservations
4. **Workflow Analytics** - Time in each stage, conversion rates
5. **Campaign Performance** - Email campaign stats per deal


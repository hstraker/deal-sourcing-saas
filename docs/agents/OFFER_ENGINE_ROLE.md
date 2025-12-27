# Offer Engine Agent - Role Documentation

**Agent Type:** Decision & Communication Agent
**Model:** Rule-based algorithms + SMS templates
**Primary Interface:** SMS via Twilio + Database
**Status:** Active in Production

---

## Identity

You are the Offer Engine Agent responsible for calculating competitive property offers and managing the offer negotiation process with vendors. You determine optimal offer amounts based on market data, profit targets, and vendor motivation, then communicate offers professionally and handle responses.

---

## Primary Objective

Calculate and present fair, profitable offers to motivated vendors that maximize deal conversion while maintaining minimum profit margins. Handle negotiations, track responses, and progress accepted offers to the next pipeline stage.

---

## Your Capabilities

### Offer Calculation
- ✅ Calculate maximum viable offer based on market value
- ✅ Adjust offer based on vendor motivation score
- ✅ Factor in renovation costs and all fees
- ✅ Apply profit margin targets
- ✅ Consider market conditions and competition
- ✅ Generate multiple offer scenarios (aggressive, standard, conservative)

### Communication
- ✅ Compose professional offer SMS messages
- ✅ Explain offer rationale clearly
- ✅ Handle acceptance responses
- ✅ Manage rejection negotiations
- ✅ Send follow-up messages
- ✅ Escalate to human when needed

### Negotiation Logic
- ✅ Determine if counter-offers are viable
- ✅ Calculate walk-away threshold
- ✅ Assess vendor flexibility signals
- ✅ Decide when to increase offer
- ✅ Recognize when to move on

### Tracking & Reporting
- ✅ Log all offers made
- ✅ Track acceptance rates
- ✅ Monitor negotiation duration
- ✅ Calculate conversion metrics
- ✅ Identify successful patterns

---

## Your Workflow

### Stage 1: Receive Validated Deal

**Trigger:** Deal Validator Agent marks lead as `validationPassed: true`

```typescript
1. Receive notification:
   - vendorLeadId
   - validation results (BMV, profit, etc.)

2. Load complete lead data:
   - Vendor details (name, phone)
   - Property details
   - Market analysis results
   - Motivation score
   - Timeline requirements

3. Verify ready to make offer:
   - Has phone number ✓
   - Has asking price ✓
   - Has market value ✓
   - Validation passed ✓
```

### Stage 2: Calculate Offer Amount

```typescript
// Input data
const input = {
  estimatedMarketValue: 300000,
  askingPrice: 250000,
  estimatedRefurbCost: 20000,
  motivationScore: 8,
  timelineDays: 45,
  competingOffers: false
}

// Step 1: Calculate base offer (target profit)
const targetProfit = 30000  // Default target
const stampDuty = calculateStampDuty(estimatedMarketValue * 0.75)
const otherCosts = {
  legal: 1500,
  survey: 500,
  holding: 3000,  // 6 months average
  selling: estimatedMarketValue * 0.025  // 2.5% total
}

const totalCosts = sum(otherCosts)

// Work backwards from market value
const baseOffer =
  estimatedMarketValue -
  estimatedRefurbCost -
  totalCosts -
  stampDuty -
  targetProfit

// Step 2: Apply motivation multiplier
const motivationMultiplier = {
  0-3: 0.85,   // Low motivation - lower offer
  4-6: 0.90,   // Medium - standard offer
  7-8: 0.95,   // High - competitive offer
  9-10: 1.00   // Urgent - maximum offer
}

const motivationAdjustedOffer =
  baseOffer * motivationMultiplier[motivationScore]

// Step 3: Apply timeline adjustment
if (timelineDays < 30) {
  motivationAdjustedOffer *= 1.02  // +2% for urgency
}

// Step 4: Apply competition adjustment
if (competingOffers) {
  motivationAdjustedOffer *= 1.05  // +5% if competition
}

// Step 5: Ensure within bounds
const maxOffer = askingPrice * 0.92  // Never more than 92% of asking
const minOffer = estimatedMarketValue * 0.65  // Never less than 65% of EMV

finalOffer = clamp(motivationAdjustedOffer, minOffer, maxOffer)

// Step 6: Round to nearest £5k for psychology
finalOffer = Math.round(finalOffer / 5000) * 5000
```

### Stage 3: Prepare Offer Message

```typescript
// Generate personalized offer SMS
const message = generateOfferMessage({
  vendorName: lead.vendorName,
  propertyAddress: lead.propertyAddress,
  offerAmount: finalOffer,
  estimatedMarketValue: estimatedMarketValue,
  timelineDays: lead.timelineDays || 60,
  motivationScore: lead.motivationScore
})

// Different templates based on motivation
if (motivationScore >= 8) {
  // Urgent vendor - emphasize speed
  template = urgentOfferTemplate
} else if (askingPrice - finalOffer > 30000) {
  // Big discount - explain rationale
  template = explainedOfferTemplate
} else {
  // Standard offer
  template = standardOfferTemplate
}
```

### Stage 4: Send Offer

```typescript
1. Save offer to database:
   await prisma.vendorLead.update({
     where: { id: vendorLeadId },
     data: {
       offerAmount: finalOffer,
       offerPercentage: (finalOffer / estimatedMarketValue) * 100,
       offerSentAt: new Date(),
       pipelineStage: "OFFER_MADE"
     }
   })

2. Send SMS via Twilio:
   await sendSMS(lead.vendorPhone, message)

3. Log pipeline event:
   await logPipelineEvent({
     vendorLeadId,
     eventType: "offer_made",
     metadata: {
       offerAmount: finalOffer,
       offerPercentage: (finalOffer / askingPrice) * 100
     }
   })

4. Set follow-up reminder (48 hours):
   await scheduleFollowUp(vendorLeadId, Date.now() + 48 * 3600 * 1000)
```

### Stage 5: Wait for Response

**Monitoring Period:** 48 hours

**Possible Responses:**
1. **Acceptance** (positive keywords detected)
2. **Rejection** (negative keywords detected)
3. **Counter-offer** (new price mentioned)
4. **Questions** (needs clarification)
5. **No response** (timeout)

### Stage 6: Handle Response

**If Accepted:**
```typescript
1. Celebrate! 🎉
2. Update database:
   pipelineStage: "OFFER_ACCEPTED"
   offerAcceptedAt: Date.now()

3. Send confirmation SMS:
   "Great! I'll get the paperwork started. Our solicitor will contact you within 24 hours."

4. Trigger next stage:
   - Create Deal record
   - Generate investor pack
   - Notify admin
   - Instruct solicitors
```

**If Rejected:**
```typescript
1. Parse rejection reason
2. Determine if negotiation possible:
   - If vendor mentions higher price: assess viability
   - If vendor says "not interested": end gracefully
   - If vendor emotional (angry): escalate to human

3. If counter-offer viable:
   - Calculate if we can meet middle ground
   - Propose revised offer

4. If not viable:
   - Thank vendor professionally
   - Mark as OFFER_REJECTED
   - Log rejection reason
```

**If Counter-offer:**
```typescript
1. Extract their counter price
2. Evaluate against our maximum:
   maxAcceptable = estimatedMarketValue - minProfit - costs

3. If counter is < maxAcceptable:
   - Accept counter-offer
   - "We can do £[counter]. Let's proceed!"

4. If counter is slightly > maxAcceptable (<10% over):
   - Make final offer (split difference)
   - "We can stretch to £[final]. That's our best price."

5. If counter is way > maxAcceptable:
   - Politely decline
   - "I'm afraid we can only go to £[max]. Let me know if that works."
```

**If Questions:**
```typescript
1. Identify question type:
   - Timeline questions → Confirm completion date
   - Process questions → Explain next steps
   - Price justification → Explain calculation
   - Trust questions → Provide credentials

2. Send appropriate response
3. Reiterate offer
4. Ask for decision
```

**If No Response (48 hours):**
```typescript
1. Send follow-up:
   "Hi [Name], just following up on our offer of £[amount] for [Address]. Let me know your thoughts!"

2. If still no response after 48 more hours (96 hours total):
   - Move to VIDEO_SENT stage
   - Send video explaining our process
   - Give 48 more hours

3. If still no response after video (144 hours total):
   - Move to RETRY_1 stage
   - Start retry sequence
```

---

## Offer Calculation Rules

### Profit Targets

```typescript
const profitTargets = {
  minimum: 20000,        // Absolute minimum to proceed
  standard: 30000,       // Default target
  ideal: 40000,          // Great deal
  exceptional: 50000+    // Outstanding opportunity
}
```

### Offer Percentage Guidelines

```typescript
// Offer as % of Estimated Market Value (EMV)
const offerPercentages = {
  aggressive: 0.65,      // 65% of EMV - very motivated vendor
  standard: 0.70,        // 70% of EMV - typical offer
  conservative: 0.75,    // 75% of EMV - competitive market
  maximum: 0.80          // 80% of EMV - absolute max
}

// Offer as % of Asking Price
const askingPricePercentages = {
  minimum: 0.75,         // 75% of asking - big discount needed
  typical: 0.85,         // 85% of asking - standard
  generous: 0.92         // 92% of asking - very competitive
}
```

### Adjustment Factors

```typescript
const adjustments = {
  // Motivation adjustments
  motivationLow: -5%,      // Score 0-3
  motivationMedium: 0%,    // Score 4-6
  motivationHigh: +3%,     // Score 7-8
  motivationUrgent: +5%,   // Score 9-10

  // Timeline adjustments
  urgent: +2%,             // <30 days
  standard: 0%,            // 30-90 days
  flexible: -2%,           // >90 days

  // Competition adjustments
  competingOffers: +5%,    // Multiple offers
  noCompetition: 0%,

  // Market condition adjustments
  hotMarket: +3%,
  coldMarket: -3%,

  // Property condition adjustments
  excellent: +5%,          // Pristine condition
  renovationProject: -5%   // Major work needed
}
```

### Walk-Away Threshold

```typescript
function calculateWalkAwayPrice(
  estimatedMarketValue: number,
  estimatedRefurbCost: number
): number {
  const minProfit = 15000  // Absolute minimum
  const allCosts = calculateAllCosts(estimatedMarketValue)

  return estimatedMarketValue - estimatedRefurbCost - allCosts - minProfit
}

// If vendor's counter-offer > walk-away price, decline politely
```

---

## Message Templates

### Standard Offer Template

```
Hi [Name],

Thanks for the details on [Address].

Based on recent sales in your area and the [condition] condition, we can offer £[AMOUNT] for a quick cash sale.

This would allow you to complete in [TIMELINE] days with no chain.

What do you think?
```

### Urgent Vendor Template (Score 9-10)

```
Hi [Name],

I understand you need to move quickly.

We can offer £[AMOUNT] cash for [Address] and complete within [TIMELINE] days - no delays, no chain.

Ready to proceed?
```

### Explained Offer Template (Big Discount)

```
Hi [Name],

For [Address], we can offer £[AMOUNT].

This is based on:
- Recent sales: avg £[AVG_COMP]
- Work needed: ~£[REFURB]
- Quick cash sale (no estate agent fees for you)

We can complete in [TIMELINE] days. Interested?
```

### Counter-Offer Response (Split Difference)

```
Hi [Name],

I've spoken with my team. We can stretch to £[NEW_AMOUNT] - that's our absolute best price.

Can we proceed at that?
```

### Final Offer Template

```
Hi [Name],

Our maximum is £[FINAL_AMOUNT]. Unfortunately we can't go higher and still make the project work.

If that works for you, let's move forward. If not, no problem - I wish you the best with your sale.
```

### Acceptance Confirmation

```
Excellent, [Name]!

I'll get our solicitor to contact you within 24 hours to start the paperwork.

Completion in [TIMELINE] days as discussed. Exciting!
```

### Graceful Rejection

```
No problem, [Name]. I understand.

If your circumstances change or you'd like to revisit, feel free to reach out.

All the best with your sale!
```

---

## Response Detection

### Acceptance Keywords

```typescript
const acceptanceSignals = [
  // Direct acceptance
  "yes", "ok", "okay", "accept", "agreed", "deal", "yes please",

  // Positive phrases
  "sounds good", "let's do it", "let's proceed", "works for me",
  "that's fine", "happy with that", "go ahead",

  // Question indicating readiness
  "what's next", "what happens now", "when can we start"
]

function isAcceptance(message: string): boolean {
  const normalized = message.toLowerCase()
  return acceptanceSignals.some(signal => normalized.includes(signal))
}
```

### Rejection Keywords

```typescript
const rejectionSignals = [
  // Direct rejection
  "no", "not interested", "too low", "can't accept", "decline",

  // Negative phrases
  "that's not enough", "way too low", "nowhere near", "insulting",
  "not worth it", "I'll pass",

  // Already sold/decided
  "already sold", "accepted another offer", "going with someone else"
]
```

### Counter-Offer Detection

```typescript
const counterOfferPatterns = [
  /£(\d+[,.]?\d*)/,           // £250,000 or £250000
  /(\d+)k/,                   // 250k
  /(\d+) thousand/,           // 250 thousand
]

function extractCounterOffer(message: string): number | null {
  for (const pattern of counterOfferPatterns) {
    const match = message.match(pattern)
    if (match) {
      // Parse and return numeric value
      return parsePrice(match[0])
    }
  }
  return null
}
```

### Negotiation Keywords

```typescript
const negotiationSignals = [
  // Wants more
  "can you do better", "is that your best", "bit more", "higher",
  "need more", "expected more",

  // Considering
  "let me think", "need to discuss", "talk to my partner",
  "need time", "get back to you",

  // Questions
  "why so low", "how did you calculate", "what about",
  "can you explain"
]
```

---

## Database Tables You Use

### Read/Write: `vendor_leads`

```typescript
// Fields you read
{
  id: string,
  vendorName: string,
  vendorPhone: string,
  propertyAddress: string,
  askingPrice: number,
  estimatedMarketValue: number,
  estimatedRefurbCost: number,
  bmvScore: number,
  profitPotential: number,
  motivationScore: number,
  timelineDays: number,
  competingOffers: boolean,
  validationPassed: boolean
}

// Fields you write
{
  offerAmount: number,
  offerPercentage: number,
  offerSentAt: Date,
  offerAcceptedAt: Date,
  offerRejectedAt: Date,
  rejectionReason: string,
  pipelineStage: "OFFER_MADE" | "OFFER_ACCEPTED" | "OFFER_REJECTED"
}
```

### Write: `offer_history`

```typescript
// Log every offer made
{
  id: cuid(),
  vendorLeadId: string,
  offerAmount: number,
  offerType: "initial" | "counter" | "final",
  calculationInputs: Json,
  sentAt: Date,
  response: string | null,
  accepted: boolean | null,
  respondedAt: Date | null
}
```

---

## Success Metrics

### Conversion Metrics

**Offer Acceptance Rate**
- **Target:** >25% of offers accepted
- **Measurement:** `(offers accepted) / (offers made) × 100`
- **Current:** Track weekly

**First Offer Acceptance**
- **Target:** >15% accept first offer (no negotiation)
- **Measurement:** Track by motivation score
- **Current:** Monthly review

**Negotiation Success Rate**
- **Target:** >40% of counter-offers lead to acceptance
- **Measurement:** Successful negotiations / total counter-offers
- **Current:** Weekly tracking

### Financial Metrics

**Average Offer as % of Asking**
- **Target:** 85-87%
- **Measurement:** AVG(offerAmount / askingPrice)
- **Current:** Monitor daily

**Average Profit Per Deal**
- **Target:** >£30,000
- **Measurement:** Actual profit on completed deals
- **Current:** Post-completion review

**Maximum Offer Reached**
- **Target:** <10% of offers at maximum threshold
- **Measurement:** Offers at >90% of asking price
- **Current:** Weekly review

### Timing Metrics

**Response Time**
- **Target:** <24 hours for vendor to respond
- **Measurement:** Time from offer sent to first response
- **Current:** Real-time tracking

**Acceptance Time**
- **Target:** <72 hours to final acceptance
- **Measurement:** Time from offer to acceptance
- **Current:** Per-deal tracking

---

## Error Handling

### Calculation Errors

**Invalid Input Data:**
```typescript
if (!estimatedMarketValue || !askingPrice) {
  - Log error
  - Flag lead for human review
  - Don't make automatic offer
  - Alert admin
}
```

**Unrealistic Calculations:**
```typescript
if (offerAmount < estimatedMarketValue * 0.50) {
  // Offer is <50% of market value - too low
  - Add warning
  - Flag for human review before sending
}

if (offerAmount > estimatedMarketValue * 0.95) {
  // Offer is >95% of market value - too high
  - Recalculate
  - Flag for review
}
```

### Communication Errors

**SMS Send Failure:**
```typescript
- Retry 3 times
- If still failing:
  - Log error
  - Flag for manual follow-up
  - Don't update status to OFFER_MADE
  - Alert admin
```

**Unclear Vendor Response:**
```typescript
- If can't determine acceptance/rejection:
  - Send clarification request
  - "Thanks for getting back to me. Just to confirm - are you happy to proceed at £[AMOUNT]? (Yes/No)"
  - Wait for clear response
```

### Negotiation Errors

**Endless Negotiation Loop:**
```typescript
if (negotiationRounds > 3) {
  - Send final offer message
  - Set walk-away deadline (24 hours)
  - If no acceptance: close negotiation
  - Mark as OFFER_REJECTED
}
```

**Vendor Becomes Aggressive:**
```typescript
- Remain professional
- Don't engage emotionally
- Escalate to human immediately
- Send: "I'll have a senior team member call you to discuss."
```

---

## Integration Points

### Upstream (Who Triggers You)

**Deal Validator Agent** → Validation passes → Triggers offer calculation
**Admin Dashboard** → Manual offer trigger → Bypasses automation
**Retry Logic** → No response to previous offer → Triggers increased offer

### Downstream (Who You Trigger)

**Deal Creation** ← Offer accepted → Create Deal record
**Investor Pack Generator** ← Deal created → Generate PDF
**SMS Follow-up** ← No response → Schedule reminder
**Admin Alerts** ← Needs review → Notify team

---

## Quick Reference

### Offer Calculation Summary
```
Base Offer = EMV - RefurbCost - AllCosts - TargetProfit
Adjusted Offer = Base × MotivationMultiplier × TimelineMultiplier
Final Offer = ROUND(Adjusted, £5000) within [MinOffer, MaxOffer]
```

### Response Handling Flow
```
Acceptance → Confirm → Create Deal → Generate Pack
Rejection → Assess → Counter if viable OR Close
Counter-Offer → Evaluate → Accept/Counter/Decline
Questions → Answer → Reiterate → Request Decision
No Response → Wait 48h → Follow-up → Wait 48h → Video
```

### Critical Thresholds
```
Minimum Profit: £20,000
Walk-Away Price: EMV - Costs - £15,000
Maximum Offer: 92% of asking price
Negotiation Limit: 3 rounds
Response Timeout: 48 hours
```

---

*Last Updated: 2025-12-27*
*Owner: Engineering Team*
*Review Frequency: Monthly*

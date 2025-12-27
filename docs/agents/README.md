# AI Agents - Role Documentation Index

This directory contains comprehensive role documentation for all AI agents operating within the DealStack vendor acquisition pipeline.

---

## Overview

The DealStack system employs **4 specialized AI agents** that work together to automate property deal sourcing from initial lead capture through to completion. Each agent has a specific role and operates autonomously while coordinating with others through the Pipeline Orchestrator.

---

## Agent Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                  Pipeline Orchestrator Agent                    │
│  (Coordinates all agents, manages workflow, handles timeouts)  │
└──────┬──────────────────┬──────────────────┬───────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  AI SMS      │   │    Deal      │   │    Offer     │
│   Agent      │──>│  Validator   │──>│   Engine     │
│              │   │   Agent      │   │   Agent      │
└──────────────┘   └──────────────┘   └──────────────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
                          ▼
                   vendor_leads (database)
```

---

## The 4 Agents

### 1. AI SMS Agent
**File:** [AI_SMS_AGENT_ROLE.md](./AI_SMS_AGENT_ROLE.md)

**Role:** Conversational qualification of property vendors via SMS

**Key Responsibilities:**
- Send initial greeting to new leads
- Have natural, empathetic conversations via text
- Extract structured property details from unstructured messages
- Assess vendor motivation score (0-10)
- Trigger validation when data is complete

**Technology:**
- Anthropic Claude Sonnet 4.5
- Twilio SMS API
- Function calling for data extraction

**Success Metrics:**
- Data extraction rate: >90%
- Motivation scoring accuracy: >85%
- Average conversation length: <10 messages

---

### 2. Deal Validator Agent
**File:** [DEAL_VALIDATOR_ROLE.md](./DEAL_VALIDATOR_ROLE.md)

**Role:** Determine if properties are genuine BMV opportunities

**Key Responsibilities:**
- Fetch comparable sales from PropertyData UK API
- Calculate estimated market value
- Estimate renovation costs
- Compute BMV percentage and profit potential
- Apply validation thresholds (≥15% BMV, ≥£20k profit)

**Technology:**
- PropertyData UK API
- Deterministic algorithms
- Cost estimation models

**Success Metrics:**
- Validation accuracy: >95%
- BMV estimation accuracy: ±5%
- Processing time: <10 seconds

---

### 3. Offer Engine Agent
**File:** [OFFER_ENGINE_ROLE.md](./OFFER_ENGINE_ROLE.md)

**Role:** Calculate and present competitive property offers

**Key Responsibilities:**
- Calculate optimal offer amount based on market data and motivation
- Compose professional offer SMS messages
- Handle acceptance, rejection, and counter-offers
- Manage negotiation rounds (max 3)
- Trigger deal creation on acceptance

**Technology:**
- Rule-based calculation engine
- SMS templates
- Natural language understanding for response detection

**Success Metrics:**
- Offer acceptance rate: >25%
- First offer acceptance: >15%
- Average profit per deal: >£30k

---

### 4. Pipeline Orchestrator Agent
**File:** [PIPELINE_ORCHESTRATOR_ROLE.md](./PIPELINE_ORCHESTRATOR_ROLE.md)

**Role:** Coordinate the entire pipeline workflow

**Key Responsibilities:**
- Trigger appropriate agents at the right time
- Handle timeouts (conversations, offers, retries)
- Manage state transitions between 13 pipeline stages
- Detect and recover from errors
- Track metrics and generate alerts

**Technology:**
- Event-driven architecture
- Scheduled jobs (every 15 minutes)
- State machine validation

**Success Metrics:**
- Pipeline throughput: >100 leads/day
- Coordination failures: <1%
- Processing latency: <5 seconds

---

## Agent Interaction Flow

### End-to-End Example

```
1. NEW LEAD CAPTURED
   │
   ├─> Pipeline Orchestrator detects new lead
   │
   └─> Triggers AI SMS Agent

2. AI SMS AGENT
   │
   ├─> Sends greeting SMS: "Hi John! Are you looking to sell soon?"
   ├─> Vendor responds: "Yes, 3 bed house in Manchester"
   ├─> Agent asks follow-ups: address, price, condition, timeline
   ├─> Extracts data via Claude function calling
   │
   └─> Notifies Orchestrator: "Data complete"

3. PIPELINE ORCHESTRATOR
   │
   ├─> Updates stage: AI_CONVERSATION → DEAL_VALIDATION
   │
   └─> Triggers Deal Validator

4. DEAL VALIDATOR
   │
   ├─> Fetches comparables from PropertyData API
   ├─> Calculates: EMV = £300k, asking = £250k, BMV = 16.7%
   ├─> Estimates refurb: £20k
   ├─> Computes profit: £30k (after all costs)
   ├─> Validation PASSED (meets thresholds)
   │
   └─> Notifies Orchestrator: "Deal validated"

5. PIPELINE ORCHESTRATOR
   │
   ├─> Updates stage: DEAL_VALIDATION → OFFER_MADE
   │
   └─> Triggers Offer Engine

6. OFFER ENGINE
   │
   ├─> Calculates offer: £225k (75% of EMV)
   ├─> Adjusts for motivation (score: 8): +3% = £232k
   ├─> Sends SMS: "Based on recent sales, we can offer £230k..."
   │
   └─> Waits for response

7. VENDOR RESPONDS: "OK sounds good"

8. OFFER ENGINE
   │
   ├─> Detects acceptance
   ├─> Sends confirmation: "Great! Our solicitor will contact you..."
   │
   └─> Notifies Orchestrator: "Offer accepted"

9. PIPELINE ORCHESTRATOR
   │
   ├─> Updates stage: OFFER_MADE → OFFER_ACCEPTED
   ├─> Creates Deal record in database
   ├─> Triggers Investor Pack generation
   ├─> Notifies admin team
   │
   └─> Pipeline complete for this stage! ✓
```

---

## Stage Transitions

Each agent is responsible for specific stage transitions:

| Current Stage | Agent Responsible | Next Stage(s) |
|---------------|-------------------|---------------|
| NEW_LEAD | Pipeline Orchestrator | AI_CONVERSATION |
| AI_CONVERSATION | AI SMS Agent | DEAL_VALIDATION, DEAD_LEAD |
| DEAL_VALIDATION | Deal Validator | OFFER_MADE, DEAD_LEAD |
| OFFER_MADE | Offer Engine | OFFER_ACCEPTED, OFFER_REJECTED, VIDEO_SENT |
| OFFER_ACCEPTED | Pipeline Orchestrator | INVESTOR_PACK_SENT |
| VIDEO_SENT | Pipeline Orchestrator | RETRY_1, OFFER_ACCEPTED |
| RETRY_1/2/3 | Pipeline Orchestrator | Next retry, DEAD_LEAD |

---

## Communication Between Agents

### Direct Triggers

```typescript
// Pipeline Orchestrator → AI SMS Agent
await triggerAISMSAgent(vendorLeadId, "INITIAL_CONTACT")

// Pipeline Orchestrator → Deal Validator
await triggerDealValidator(vendorLeadId)

// Pipeline Orchestrator → Offer Engine
await triggerOfferEngine(vendorLeadId)
```

### Event-Based Communication

```typescript
// AI SMS Agent completes data extraction
emit("property_details_complete", { vendorLeadId })

// Deal Validator completes validation
emit("validation_complete", { vendorLeadId, passed: true })

// Offer Engine receives acceptance
emit("offer_accepted", { vendorLeadId })

// Pipeline Orchestrator listens for all events
on("property_details_complete", (data) => {
  updateStage(data.vendorLeadId, "DEAL_VALIDATION")
  triggerDealValidator(data.vendorLeadId)
})
```

---

## Shared Data Model

All agents read/write to the `vendor_leads` table:

```typescript
interface VendorLead {
  // Identity
  id: string
  vendorName: string
  vendorPhone: string

  // Property details (populated by AI SMS Agent)
  propertyAddress: string
  propertyPostcode: string
  askingPrice: number
  propertyType: string
  bedrooms: number
  condition: string
  motivationScore: number
  timelineDays: number

  // Validation results (populated by Deal Validator)
  estimatedMarketValue: number
  estimatedRefurbCost: number
  bmvScore: number
  profitPotential: number
  validationPassed: boolean
  comparablesCount: number

  // Offer details (populated by Offer Engine)
  offerAmount: number
  offerSentAt: Date
  offerAcceptedAt: Date
  offerRejectedAt: Date

  // Pipeline state (managed by Orchestrator)
  pipelineStage: PipelineStage
  lastContactAt: Date
  retryCount: number
  nextRetryAt: Date
}
```

---

## Error Handling Strategy

### Agent-Level Errors

Each agent handles its own errors:
- **AI SMS Agent**: Retry failed SMS, fallback to generic message, escalate to human
- **Deal Validator**: Retry API calls, flag for manual review if data unavailable
- **Offer Engine**: Ask clarifying questions, escalate unclear responses
- **Pipeline Orchestrator**: Retry failed agent triggers, flag persistent failures

### Escalation Path

```
1. Agent encounters error
   ↓
2. Agent retries 3 times with exponential backoff
   ↓
3. If still failing: Flag lead for human review
   ↓
4. Pipeline Orchestrator detects flag
   ↓
5. Send alert to admin dashboard
   ↓
6. Human intervenes to resolve
```

---

## Performance Considerations

### Parallel Processing

**Pipeline Orchestrator** processes leads in parallel:
- 100+ leads can be in conversation simultaneously
- Each agent operates independently
- No blocking operations

### Caching

**Deal Validator** caches results:
- Comparable properties cached for 24 hours
- Reduces PropertyData API calls by ~40%
- Saves cost and improves performance

### Rate Limiting

**AI SMS Agent** respects limits:
- Max 10 SMS per hour per vendor (anti-spam)
- Twilio rate limits automatically handled
- Claude API throttling with retry logic

---

## Monitoring & Observability

### Metrics Dashboard

Track key metrics for each agent:

**AI SMS Agent:**
- Messages sent/received per hour
- Data extraction success rate
- Average conversation length

**Deal Validator:**
- Validations per hour
- Pass/fail ratio
- API usage and costs

**Offer Engine:**
- Offers sent per day
- Acceptance rate
- Average negotiation time

**Pipeline Orchestrator:**
- Leads per stage
- Stage transition times
- Error rates

### Alerts

Automated alerts for:
- Agent execution failures (>3 retries)
- Pipeline stalls (leads stuck >48 hours)
- Low conversion rates (<5%)
- High API costs (>budget)
- Data integrity issues

---

## Development Guidelines

### Adding New Agents

To add a new agent to the system:

1. **Create role document** in this directory
2. **Define clear responsibility** boundaries
3. **Document interface** (inputs, outputs, events)
4. **Implement error handling** and retries
5. **Add metrics tracking**
6. **Update Pipeline Orchestrator** to coordinate new agent
7. **Add tests** for agent logic
8. **Update this README** with new agent info

### Modifying Existing Agents

When changing an agent:

1. **Update role document** to reflect changes
2. **Ensure backward compatibility** with database schema
3. **Test interaction** with other agents
4. **Update metrics** if KPIs change
5. **Version control** major changes
6. **Notify team** of breaking changes

---

## Testing Strategy

### Unit Testing

Test each agent in isolation:
- Mock database operations
- Mock external API calls
- Test business logic independently

### Integration Testing

Test agent coordination:
- Simulate full pipeline flow
- Test state transitions
- Verify event handling

### End-to-End Testing

Test complete scenarios:
- New lead → completion
- Various vendor responses
- Error recovery paths
- Timeout handling

---

## Common Questions

### Q: Can agents run in parallel?
**A:** Yes. The Pipeline Orchestrator manages multiple leads simultaneously. Each agent can process different leads at the same time.

### Q: What happens if an agent crashes?
**A:** The Pipeline Orchestrator detects the failure, retries 3 times, then flags the lead for human review.

### Q: How do agents communicate?
**A:** Through database updates and event emissions. The Orchestrator listens for events and triggers appropriate agents.

### Q: Can I manually trigger an agent?
**A:** Yes. The admin dashboard has manual trigger buttons that bypass automation.

### Q: How are agents deployed?
**A:** Agents are part of the main Next.js application. They run as API routes (serverless functions) or scheduled jobs.

### Q: Can I add custom agents?
**A:** Yes. Follow the guidelines in "Adding New Agents" above and update the Orchestrator to coordinate your new agent.

---

## Related Documentation

- **VENDOR_PIPELINE_GUIDE.md** - Complete pipeline workflow
- **TECHNICAL_OVERVIEW.md** - System architecture
- **SYSTEM_OVERVIEW.md** - Non-technical overview
- **ARCHITECTURE.md** - System design diagrams

---

## Agent Summary Table

| Agent | Model/Tech | Primary Function | Input | Output | Metrics |
|-------|-----------|------------------|-------|--------|---------|
| AI SMS Agent | Claude Sonnet 4.5 | Qualify vendors via SMS | Vendor phone, name | Structured property data | >90% extraction rate |
| Deal Validator | PropertyData API | Validate BMV deals | Property details | BMV score, profit | >95% accuracy |
| Offer Engine | Rule-based | Calculate & present offers | Validation results | Offer amount, SMS | >25% acceptance |
| Pipeline Orchestrator | Event-driven | Coordinate workflow | Stage transitions | Agent triggers, alerts | <1% failures |

---

## Version History

**v1.0 (Current)** - 2025-12-27
- Initial agent role documentation
- 4 core agents defined
- Basic coordination logic

**Planned v1.1**
- Add Investor Matching Agent
- Add Video Generation Agent
- Enhanced error recovery

**Planned v2.0**
- Multi-channel support (WhatsApp, email)
- Advanced ML for motivation scoring
- Predictive analytics for conversion

---

*Last Updated: 2025-12-27*
*Documentation Owner: Engineering Team*
*Review Frequency: Monthly*

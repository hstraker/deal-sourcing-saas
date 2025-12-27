# Pipeline Orchestrator Agent - Role Documentation

**Agent Type:** Workflow Management & Coordination Agent
**Model:** Event-driven state machine + Business rules
**Primary Interface:** Database triggers + Scheduled jobs
**Status:** Active in Production

---

## Identity

You are the Pipeline Orchestrator Agent, the "conductor" of the entire vendor acquisition pipeline. You coordinate all other agents (AI SMS Agent, Deal Validator, Offer Engine), manage stage transitions, handle timeouts, and ensure the pipeline flows smoothly from lead capture to deal completion.

---

## Primary Objective

Ensure every vendor lead progresses through the pipeline efficiently by triggering the right agents at the right time, handling edge cases, managing timeouts, and maintaining data integrity throughout the journey from NEW_LEAD to COMPLETED (or DEAD_LEAD).

---

## Your Capabilities

### Workflow Management
- ✅ Monitor pipeline stage for all active leads
- ✅ Trigger appropriate agent for each stage
- ✅ Handle stage transitions and validations
- ✅ Manage parallel processes (multiple leads simultaneously)
- ✅ Coordinate inter-agent communication

### Timeout Management
- ✅ Detect stalled leads (no activity for X hours)
- ✅ Send reminder messages
- ✅ Escalate to human when needed
- ✅ Auto-archive dead leads
- ✅ Retry failed operations

### Error Recovery
- ✅ Detect failed agent executions
- ✅ Retry with exponential backoff
- ✅ Roll back partial state changes
- ✅ Flag for human intervention when necessary
- ✅ Maintain audit trail of all actions

### Analytics & Monitoring
- ✅ Track time spent in each stage
- ✅ Calculate conversion rates
- ✅ Identify bottlenecks
- ✅ Generate performance reports
- ✅ Alert on anomalies

### Data Integrity
- ✅ Validate state transitions are legal
- ✅ Ensure required fields are populated
- ✅ Prevent duplicate processing
- ✅ Lock records during updates
- ✅ Maintain referential integrity

---

## Your Workflow

### Initialization

You run continuously as:
1. **Event Listeners** - Triggered by database changes
2. **Scheduled Jobs** - Run every 15 minutes
3. **Webhook Handlers** - Process external events

### Main Loop (Every 15 Minutes)

```typescript
async function orchestratorMainLoop() {
  // 1. Process new leads
  await processNewLeads()

  // 2. Check for stalled conversations
  await checkStalledConversations()

  // 3. Process validation queue
  await processValidationQueue()

  // 4. Check for offer timeouts
  await checkOfferTimeouts()

  // 5. Process retry stages
  await processRetryStages()

  // 6. Clean up dead leads
  await archiveDeadLeads()

  // 7. Update metrics
  await updatePipelineMetrics()

  // 8. Generate alerts
  await generateAlerts()
}
```

---

## Stage Management

### Stage Transition Rules

```typescript
// Legal transitions
const ALLOWED_TRANSITIONS = {
  NEW_LEAD: ["AI_CONVERSATION", "DEAD_LEAD"],
  AI_CONVERSATION: ["DEAL_VALIDATION", "DEAD_LEAD"],
  DEAL_VALIDATION: ["OFFER_MADE", "DEAD_LEAD"],
  OFFER_MADE: ["OFFER_ACCEPTED", "OFFER_REJECTED", "VIDEO_SENT", "DEAD_LEAD"],
  OFFER_ACCEPTED: ["INVESTOR_PACK_SENT", "DUE_DILIGENCE"],
  OFFER_REJECTED: ["DEAD_LEAD"],
  VIDEO_SENT: ["OFFER_ACCEPTED", "RETRY_1", "DEAD_LEAD"],
  RETRY_1: ["OFFER_ACCEPTED", "RETRY_2", "DEAD_LEAD"],
  RETRY_2: ["OFFER_ACCEPTED", "RETRY_3", "DEAD_LEAD"],
  RETRY_3: ["OFFER_ACCEPTED", "DEAD_LEAD"],
  INVESTOR_PACK_SENT: ["INVESTOR_RESERVED"],
  INVESTOR_RESERVED: ["DUE_DILIGENCE"],
  DUE_DILIGENCE: ["COMPLETED", "DEAD_LEAD"],
  DEAD_LEAD: [],  // Terminal state
  COMPLETED: []   // Terminal state
}

function validateTransition(from: Stage, to: Stage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}
```

### Stage Processors

#### NEW_LEAD → AI_CONVERSATION

```typescript
async function processNewLeads() {
  // Find all new leads
  const newLeads = await prisma.vendorLead.findMany({
    where: {
      pipelineStage: "NEW_LEAD",
      conversationStartedAt: null
    }
  })

  for (const lead of newLeads) {
    try {
      // Trigger AI SMS Agent to send initial message
      await triggerAISMSAgent(lead.id, "INITIAL_CONTACT")

      // Update stage
      await updateStage(lead.id, "AI_CONVERSATION", {
        conversationStartedAt: new Date()
      })

      // Log event
      await logPipelineEvent({
        vendorLeadId: lead.id,
        eventType: "stage_change",
        fromStage: "NEW_LEAD",
        toStage: "AI_CONVERSATION"
      })
    } catch (error) {
      console.error(`Failed to process new lead ${lead.id}:`, error)
      await flagForReview(lead.id, "Failed initial SMS")
    }
  }
}
```

#### AI_CONVERSATION → DEAL_VALIDATION

**Trigger:** AI SMS Agent calls `extract_property_details` function

```typescript
async function onPropertyDetailsComplete(vendorLeadId: string) {
  // Verify all required fields populated
  const lead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId }
  })

  const requiredFields = [
    "propertyAddress",
    "propertyPostcode",
    "askingPrice",
    "propertyType",
    "bedrooms",
    "condition"
  ]

  const missingFields = requiredFields.filter(field => !lead[field])

  if (missingFields.length > 0) {
    // Not ready yet
    console.log(`Lead ${vendorLeadId} missing fields:`, missingFields)
    return
  }

  // Trigger Deal Validator
  await updateStage(vendorLeadId, "DEAL_VALIDATION")
  await triggerDealValidator(vendorLeadId)
}
```

#### DEAL_VALIDATION → OFFER_MADE

**Trigger:** Deal Validator completes validation

```typescript
async function onValidationComplete(vendorLeadId: string, validationPassed: boolean) {
  if (validationPassed) {
    // Trigger Offer Engine
    await updateStage(vendorLeadId, "OFFER_MADE")
    await triggerOfferEngine(vendorLeadId)
  } else {
    // Send rejection SMS
    await sendRejectionSMS(vendorLeadId)
    await updateStage(vendorLeadId, "DEAD_LEAD")
  }
}
```

#### OFFER_MADE → OFFER_ACCEPTED/REJECTED

**Trigger:** Vendor responds to offer

```typescript
async function onOfferResponse(vendorLeadId: string, response: string) {
  const intent = detectIntent(response)  // acceptance | rejection | question | counter

  switch (intent) {
    case "acceptance":
      await updateStage(vendorLeadId, "OFFER_ACCEPTED", {
        offerAcceptedAt: new Date()
      })
      await triggerDealCreation(vendorLeadId)
      break

    case "rejection":
      await updateStage(vendorLeadId, "OFFER_REJECTED", {
        offerRejectedAt: new Date(),
        rejectionReason: extractReason(response)
      })
      break

    case "counter":
      // Handle counter-offer (stay in OFFER_MADE)
      await handleCounterOffer(vendorLeadId, response)
      break

    case "question":
      // Answer question, stay in OFFER_MADE
      await answerQuestion(vendorLeadId, response)
      break
  }
}
```

---

## Timeout Management

### Conversation Timeout (24 Hours)

```typescript
async function checkStalledConversations() {
  const stalled = await prisma.vendorLead.findMany({
    where: {
      pipelineStage: "AI_CONVERSATION",
      lastContactAt: {
        lt: new Date(Date.now() - 24 * 3600 * 1000)  // 24 hours ago
      }
    }
  })

  for (const lead of stalled) {
    // Send follow-up
    await sendFollowUpSMS(lead.id, "CONVERSATION_FOLLOW_UP")

    // If this is 2nd follow-up (72 hours total), mark dead
    const hoursSinceLastContact =
      (Date.now() - lead.lastContactAt.getTime()) / (3600 * 1000)

    if (hoursSinceLastContact > 72) {
      await updateStage(lead.id, "DEAD_LEAD", {
        deadReason: "No response to follow-ups"
      })
    }
  }
}
```

### Offer Timeout (48 Hours)

```typescript
async function checkOfferTimeouts() {
  const timedOut = await prisma.vendorLead.findMany({
    where: {
      pipelineStage: "OFFER_MADE",
      offerSentAt: {
        lt: new Date(Date.now() - 48 * 3600 * 1000)  // 48 hours ago
      }
    }
  })

  for (const lead of timedOut) {
    // Move to video stage
    await updateStage(lead.id, "VIDEO_SENT")
    await sendVideoSMS(lead.id)

    await logPipelineEvent({
      vendorLeadId: lead.id,
      eventType: "offer_timeout",
      metadata: { hoursWaited: 48 }
    })
  }
}
```

### Video Timeout (48 Hours)

```typescript
async function checkVideoTimeouts() {
  const videoTimedOut = await prisma.vendorLead.findMany({
    where: {
      pipelineStage: "VIDEO_SENT",
      updatedAt: {
        lt: new Date(Date.now() - 48 * 3600 * 1000)
      }
    }
  })

  for (const lead of videoTimedOut) {
    // Move to first retry
    await updateStage(lead.id, "RETRY_1")
    await sendRetrySMS(lead.id, 1)
  }
}
```

### Retry Stage Processing

```typescript
async function processRetryStages() {
  const retryStages = ["RETRY_1", "RETRY_2", "RETRY_3"]

  for (const stage of retryStages) {
    const leads = await prisma.vendorLead.findMany({
      where: {
        pipelineStage: stage,
        nextRetryAt: { lte: new Date() }
      }
    })

    for (const lead of leads) {
      const retryNumber = parseInt(stage.split("_")[1])

      if (retryNumber < 3) {
        // Send retry message
        await sendRetrySMS(lead.id, retryNumber)

        // Move to next retry stage
        const nextStage = `RETRY_${retryNumber + 1}`
        await updateStage(lead.id, nextStage, {
          retryCount: retryNumber + 1,
          nextRetryAt: new Date(Date.now() + 48 * 3600 * 1000)
        })
      } else {
        // Final retry failed, mark dead
        await updateStage(lead.id, "DEAD_LEAD", {
          deadReason: "No response after 3 retries"
        })
      }
    }
  }
}
```

---

## Error Handling

### Agent Execution Failure

```typescript
async function handleAgentFailure(
  agentName: string,
  vendorLeadId: string,
  error: Error
) {
  // Log error
  console.error(`Agent ${agentName} failed for lead ${vendorLeadId}:`, error)

  // Increment retry count
  const lead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId }
  })

  const retryCount = (lead.agentRetryCount || 0) + 1

  if (retryCount < 3) {
    // Retry with exponential backoff
    const delay = Math.pow(2, retryCount) * 1000  // 2s, 4s, 8s
    setTimeout(async () => {
      await retryAgentExecution(agentName, vendorLeadId)
    }, delay)

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: { agentRetryCount: retryCount }
    })
  } else {
    // Max retries exceeded, flag for human
    await flagForReview(vendorLeadId, `Agent ${agentName} failed after 3 retries`)

    await sendAdminAlert({
      type: "AGENT_FAILURE",
      message: `Agent ${agentName} failed for lead ${vendorLeadId}`,
      severity: "HIGH",
      vendorLeadId
    })
  }
}
```

### Invalid State Transition

```typescript
async function attemptStateTransition(
  vendorLeadId: string,
  newStage: PipelineStage
) {
  const lead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId }
  })

  const currentStage = lead.pipelineStage

  if (!validateTransition(currentStage, newStage)) {
    // Invalid transition
    console.error(`Invalid transition: ${currentStage} → ${newStage} for lead ${vendorLeadId}`)

    await logPipelineEvent({
      vendorLeadId,
      eventType: "invalid_transition_attempt",
      metadata: {
        from: currentStage,
        to: newStage
      }
    })

    await flagForReview(vendorLeadId, `Invalid transition: ${currentStage} → ${newStage}`)

    return false
  }

  return true
}
```

### Data Integrity Issues

```typescript
async function validateLeadData(vendorLeadId: string): Promise<string[]> {
  const lead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId }
  })

  const issues: string[] = []

  // Check for required fields
  if (!lead.vendorPhone) issues.push("Missing phone number")
  if (!lead.vendorName) issues.push("Missing vendor name")

  // Check for data consistency
  if (lead.offerAmount && lead.offerAmount > lead.estimatedMarketValue) {
    issues.push("Offer amount exceeds market value")
  }

  if (lead.bmvScore && lead.bmvScore < 0) {
    issues.push("Negative BMV score")
  }

  // Check for stale data
  const daysSinceUpdate = (Date.now() - lead.updatedAt.getTime()) / (86400 * 1000)
  if (daysSinceUpdate > 30 && lead.pipelineStage !== "DEAD_LEAD" && lead.pipelineStage !== "COMPLETED") {
    issues.push("Lead stale (>30 days with no update)")
  }

  return issues
}
```

---

## Pipeline Metrics

### Real-Time Metrics

```typescript
async function updatePipelineMetrics() {
  const metrics = {
    // Stage distribution
    byStage: await prisma.vendorLead.groupBy({
      by: ["pipelineStage"],
      _count: true
    }),

    // New leads today
    newToday: await prisma.vendorLead.count({
      where: {
        createdAt: { gte: startOfDay(new Date()) }
      }
    }),

    // Offers made today
    offersToday: await prisma.vendorLead.count({
      where: {
        pipelineStage: "OFFER_MADE",
        offerSentAt: { gte: startOfDay(new Date()) }
      }
    }),

    // Acceptances today
    acceptancesToday: await prisma.vendorLead.count({
      where: {
        offerAcceptedAt: { gte: startOfDay(new Date()) }
      }
    }),

    // Average time in each stage
    avgTimeInStage: await calculateAvgTimeInStage(),

    // Conversion rates
    conversionRates: await calculateConversionRates(),

    // Pipeline value
    pipelineValue: await calculatePipelineValue()
  }

  // Save to PipelineMetric table
  await prisma.pipelineMetric.create({
    data: {
      date: new Date(),
      metrics: metrics,
      ...metrics
    }
  })

  return metrics
}
```

### Conversion Funnel

```typescript
async function calculateConversionRates() {
  const total = await prisma.vendorLead.count()

  const byStage = {
    newLead: total,
    conversation: await prisma.vendorLead.count({
      where: { pipelineStage: { in: ["AI_CONVERSATION", ...LATER_STAGES] } }
    }),
    validation: await prisma.vendorLead.count({
      where: { validationPassed: true }
    }),
    offerMade: await prisma.vendorLead.count({
      where: { offerSentAt: { not: null } }
    }),
    offerAccepted: await prisma.vendorLead.count({
      where: { offerAcceptedAt: { not: null } }
    }),
    completed: await prisma.vendorLead.count({
      where: { pipelineStage: "COMPLETED" }
    })
  }

  return {
    conversationRate: (byStage.conversation / byStage.newLead) * 100,
    validationRate: (byStage.validation / byStage.conversation) * 100,
    offerRate: (byStage.offerMade / byStage.validation) * 100,
    acceptanceRate: (byStage.offerAccepted / byStage.offerMade) * 100,
    completionRate: (byStage.completed / byStage.offerAccepted) * 100,
    overallConversion: (byStage.completed / byStage.newLead) * 100
  }
}
```

### Time in Stage Analysis

```typescript
async function calculateAvgTimeInStage() {
  // Query pipeline events to calculate time spent
  const transitions = await prisma.pipelineEvent.findMany({
    where: { eventType: "stage_change" },
    orderBy: { createdAt: "asc" }
  })

  const timeByStage: Record<PipelineStage, number[]> = {}

  // Group by lead and calculate time between transitions
  const byLead = groupBy(transitions, "vendorLeadId")

  for (const [leadId, events] of Object.entries(byLead)) {
    for (let i = 0; i < events.length - 1; i++) {
      const stage = events[i].toStage
      const timeInStage = events[i + 1].createdAt - events[i].createdAt

      if (!timeByStage[stage]) timeByStage[stage] = []
      timeByStage[stage].push(timeInStage)
    }
  }

  // Calculate averages
  const avgByStage: Record<PipelineStage, number> = {}
  for (const [stage, times] of Object.entries(timeByStage)) {
    avgByStage[stage] = average(times)
  }

  return avgByStage
}
```

---

## Alert System

### Alert Conditions

```typescript
const ALERT_CONDITIONS = {
  // Performance alerts
  LOW_CONVERSION: {
    condition: () => conversionRates.overallConversion < 5,
    message: "Overall conversion rate below 5%",
    severity: "HIGH"
  },

  STALLED_PIPELINE: {
    condition: () => leadsInAI_CONVERSATION > 50,
    message: "More than 50 leads stuck in conversation",
    severity: "MEDIUM"
  },

  // Error alerts
  HIGH_FAILURE_RATE: {
    condition: () => failedAgentExecutions > 10,
    message: "High agent failure rate (>10 in last hour)",
    severity: "HIGH"
  },

  // Data quality alerts
  MISSING_DATA: {
    condition: () => leadsWithDataIssues > 5,
    message: "Multiple leads with data quality issues",
    severity: "MEDIUM"
  },

  // Cost alerts
  HIGH_API_USAGE: {
    condition: () => apiCallsToday > 500,
    message: "High API usage today (>500 calls)",
    severity: "LOW"
  }
}
```

### Alert Delivery

```typescript
async function generateAlerts() {
  for (const [alertType, config] of Object.entries(ALERT_CONDITIONS)) {
    if (config.condition()) {
      await sendAlert({
        type: alertType,
        message: config.message,
        severity: config.severity,
        timestamp: new Date()
      })
    }
  }
}

async function sendAlert(alert: Alert) {
  // Log to database
  await prisma.alert.create({ data: alert })

  // Send to admin dashboard
  await notifyAdminDashboard(alert)

  // Send email if HIGH severity
  if (alert.severity === "HIGH") {
    await sendAdminEmail(alert)
  }

  // Send Slack notification
  await sendSlackAlert(alert)
}
```

---

## Scheduled Jobs

### Hourly Jobs

```typescript
// Run every hour
async function hourlyJobs() {
  // 1. Process stalled conversations
  await checkStalledConversations()

  // 2. Process offer timeouts
  await checkOfferTimeouts()

  // 3. Process video timeouts
  await checkVideoTimeouts()

  // 4. Update metrics
  await updatePipelineMetrics()

  // 5. Generate alerts
  await generateAlerts()
}
```

### Daily Jobs

```typescript
// Run once per day at 2am
async function dailyJobs() {
  // 1. Archive old dead leads
  await archiveDeadLeads()

  // 2. Clean up stale data
  await cleanupStaleData()

  // 3. Generate daily report
  await generateDailyReport()

  // 4. Backup critical data
  await backupPipelineData()

  // 5. Optimize database
  await optimizeDatabaseIndexes()
}
```

### Weekly Jobs

```typescript
// Run once per week on Sunday
async function weeklyJobs() {
  // 1. Generate weekly summary
  await generateWeeklySummary()

  // 2. Analyze conversion trends
  await analyzeConversionTrends()

  // 3. Identify optimization opportunities
  await identifyBottlenecks()

  // 4. Clean up old logs
  await archiveOldLogs()
}
```

---

## Database Tables You Use

### Read/Write: `vendor_leads` (All fields)

You have full access to read and update any field on vendor leads.

### Write: `pipeline_events`

```typescript
// Log every significant event
{
  id: cuid(),
  vendorLeadId: string,
  eventType: string,  // stage_change, offer_made, offer_accepted, etc.
  fromStage: string,
  toStage: string,
  metadata: Json,
  userId: string | null,  // If human action
  createdAt: Date
}
```

### Write: `pipeline_metrics`

```typescript
// Daily snapshot of pipeline health
{
  id: cuid(),
  date: Date,
  totalLeads: number,
  newLeads: number,
  activeLeads: number,
  completedDeals: number,
  deadLeads: number,
  byStage: Json,  // Count per stage
  conversionRates: Json,
  avgTimeInStage: Json,
  pipelineValue: number
}
```

### Write: `alerts`

```typescript
// System alerts
{
  id: cuid(),
  type: string,
  message: string,
  severity: "LOW" | "MEDIUM" | "HIGH",
  acknowledged: boolean,
  acknowledgedBy: string | null,
  createdAt: Date
}
```

---

## Success Metrics

### Operational Metrics

**Pipeline Throughput**
- **Target:** Process 100+ leads per day
- **Measurement:** New leads + stage transitions per day
- **Current:** Real-time dashboard

**Agent Coordination**
- **Target:** <1% coordination failures
- **Measurement:** Failed agent triggers / total triggers
- **Current:** Hourly monitoring

**Timeout Handling**
- **Target:** <5% leads timeout with no action
- **Measurement:** Timeout events / active leads
- **Current:** Daily review

### Data Quality Metrics

**Data Integrity**
- **Target:** 100% data integrity (no orphaned records)
- **Measurement:** Referential integrity checks
- **Current:** Daily automated checks

**State Consistency**
- **Target:** 100% valid state transitions
- **Measurement:** Invalid transition attempts
- **Current:** Real-time monitoring

### Performance Metrics

**Processing Latency**
- **Target:** <5 seconds for stage transitions
- **Measurement:** Time from event to completion
- **Current:** Real-time tracking

**Error Recovery**
- **Target:** <10 minutes to recover from errors
- **Measurement:** Time from error to resolution
- **Current:** Per-incident tracking

---

## Integration Points

### Event Sources (What Triggers You)

**Database Triggers** → Stage updates → Process next action
**Scheduled Jobs** → Cron timers → Run periodic checks
**External Webhooks** → Facebook/Twilio → Process events
**Admin Actions** → Manual triggers → Override automation

### Event Sinks (What You Trigger)

**AI SMS Agent** ← New leads, follow-ups
**Deal Validator** ← Data complete
**Offer Engine** ← Validation passed
**Admin Alerts** ← Issues detected
**Analytics System** ← Metrics updates

---

## Quick Reference

### Core Responsibilities
- Stage transition management
- Agent coordination
- Timeout handling
- Error recovery
- Metrics tracking
- Alert generation
- Data integrity
- Performance monitoring

### Stage Flow Summary
```
NEW_LEAD
  → AI_CONVERSATION (AI SMS Agent)
    → DEAL_VALIDATION (Deal Validator)
      → OFFER_MADE (Offer Engine)
        → OFFER_ACCEPTED
          → INVESTOR_PACK_SENT
            → INVESTOR_RESERVED
              → DUE_DILIGENCE
                → COMPLETED ✓

Alternate paths:
- Any stage → DEAD_LEAD (various reasons)
- OFFER_MADE → VIDEO_SENT → RETRY_1/2/3 (no response)
```

### Timeout Thresholds
```
Conversation stalled: 24 hours
Offer no response: 48 hours
Video no response: 48 hours
Retry intervals: 48 hours each
Final deadline: 72 hours after RETRY_3
```

---

*Last Updated: 2025-12-27*
*Owner: Engineering Team*
*Review Frequency: Monthly*

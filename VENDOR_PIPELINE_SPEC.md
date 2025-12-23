# Vendor Pipeline Specification

## Project Overview
Build an AI-powered vendor acquisition pipeline for a BMV property business. This system runs as a background service alongside the existing deal dashboard, processing leads from Facebook ads through to investor matching via automated AI SMS conversations.

---

## Existing System Architecture

### Current Stack
- **Database**: PostgreSQL with existing `properties` table structure
- **Backend**: Flask API with routes in `/api/` endpoints
- **Frontend**: Deal dashboard with HTML/Bootstrap UI
- **Deployment**: AWS EC2 with Docker containers
- **Automation**: n8n workflows for property discovery and analysis

### Current Capabilities
- Property discovery from Rightmove/Zoopla
- BMV (Below Market Value) analysis
- Investor pack generation
- Deal dashboard for manual property management

---

## New System Requirements

### 1. Core Pipeline Engine

**File**: `vendor_pipeline_engine.py`

Build a Python background service that:
- Runs continuously as a separate process from the Flask app
- Polls for new Facebook ad leads every 60 seconds
- Manages the vendor qualification workflow state machine
- Triggers AI SMS conversations at appropriate stages
- Updates the database in real-time with pipeline status
- Handles graceful shutdown and restart
- Logs all activities to rotating log files

**Key Functions**:
```python
def process_new_facebook_leads():
    """Check Facebook Lead Ads API for new leads"""
    
def process_active_conversations():
    """Continue AI SMS conversations with vendors"""
    
def process_scheduled_retries():
    """Send retry messages to rejected offers"""
    
def process_accepted_deals():
    """Move accepted deals to investor matching"""
    
def update_pipeline_stage(lead_id, new_stage):
    """Update lead status in database"""
```

---

### 2. Workflow State Machine

Implement a state machine with these stages:

```
NEW_LEAD → AI_CONVERSATION → DEAL_VALIDATION → OFFER_MADE → 
OFFER_ACCEPTED / OFFER_REJECTED → PAPERWORK_SENT → READY_FOR_INVESTORS
```

**Rejection retry logic**:
```
OFFER_REJECTED → VIDEO_SENT → RETRY_1 → RETRY_2 → RETRY_3 → DEAD_LEAD
```

**State Definitions**:
- `NEW_LEAD`: Just captured from Facebook, no contact yet
- `AI_CONVERSATION`: Actively conversing via SMS to extract details
- `DEAL_VALIDATION`: Running BMV analysis on property
- `OFFER_MADE`: Offer sent, awaiting response
- `OFFER_ACCEPTED`: Vendor accepted offer
- `OFFER_REJECTED`: Vendor rejected offer
- `VIDEO_SENT`: Objection-handling video sent
- `RETRY_1/2/3`: Retry attempts with delays (2d, 4d, 7d)
- `PAPERWORK_SENT`: Solicitor details captured, lock-out sent
- `READY_FOR_INVESTORS`: Deal ready for investor matching
- `DEAD_LEAD`: Exhausted all retries or unresponsive

**State Transition Rules**:
- Automatic progression through AI conversation
- Manual override capability from dashboard
- Timeout handling for unresponsive leads (48 hours)
- Validation gates before progressing to offers

---

### 3. Database Schema Extensions

**File**: `database/vendor_schema.sql`

Create new tables:

```sql
-- Main vendor leads table
CREATE TABLE vendor_leads (
    id SERIAL PRIMARY KEY,
    
    -- Lead source
    facebook_lead_id VARCHAR(255) UNIQUE,
    lead_source VARCHAR(50) DEFAULT 'facebook_ads',
    
    -- Vendor information
    vendor_name VARCHAR(255) NOT NULL,
    vendor_phone VARCHAR(50) NOT NULL,
    vendor_email VARCHAR(255),
    
    -- Property details
    property_address TEXT,
    property_postcode VARCHAR(20),
    asking_price DECIMAL(12,2),
    property_type VARCHAR(50),
    bedrooms INTEGER,
    condition VARCHAR(50),
    
    -- Workflow status
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'NEW_LEAD',
    conversation_state JSONB,
    
    -- AI conversation data
    ai_conversation_history JSONB DEFAULT '[]'::jsonb,
    motivation_score INTEGER CHECK (motivation_score BETWEEN 0 AND 10),
    urgency_level VARCHAR(20), -- urgent, moderate, flexible
    reason_for_selling TEXT,
    timeline_days INTEGER,
    
    -- Deal validation
    bmv_score DECIMAL(5,2),
    estimated_market_value DECIMAL(12,2),
    profit_potential DECIMAL(12,2),
    validation_passed BOOLEAN,
    validation_notes TEXT,
    
    -- Offer management
    offer_amount DECIMAL(12,2),
    offer_percentage DECIMAL(5,2), -- % of asking price
    offer_sent_at TIMESTAMP,
    offer_accepted_at TIMESTAMP,
    offer_rejected_at TIMESTAMP,
    rejection_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    
    -- Solicitor details (when accepted)
    solicitor_name VARCHAR(255),
    solicitor_firm VARCHAR(255),
    solicitor_phone VARCHAR(50),
    solicitor_email VARCHAR(255),
    lockout_agreement_sent BOOLEAN DEFAULT FALSE,
    lockout_agreement_signed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_contact_at TIMESTAMP,
    conversation_started_at TIMESTAMP,
    deal_closed_at TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT valid_pipeline_stage CHECK (
        pipeline_stage IN (
            'NEW_LEAD', 'AI_CONVERSATION', 'DEAL_VALIDATION', 
            'OFFER_MADE', 'OFFER_ACCEPTED', 'OFFER_REJECTED',
            'VIDEO_SENT', 'RETRY_1', 'RETRY_2', 'RETRY_3',
            'PAPERWORK_SENT', 'READY_FOR_INVESTORS', 'DEAD_LEAD'
        )
    )
);

-- SMS conversation log
CREATE TABLE sms_messages (
    id SERIAL PRIMARY KEY,
    vendor_lead_id INTEGER REFERENCES vendor_leads(id) ON DELETE CASCADE,
    
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    message_sid VARCHAR(255) UNIQUE, -- Twilio message ID
    
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    message_body TEXT NOT NULL,
    
    -- AI context
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_prompt TEXT,
    ai_response_metadata JSONB,
    
    -- Status
    status VARCHAR(50), -- queued, sent, delivered, failed
    error_code VARCHAR(50),
    error_message TEXT,
    
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline metrics and analytics
CREATE TABLE pipeline_metrics (
    id SERIAL PRIMARY KEY,
    
    date DATE NOT NULL UNIQUE,
    
    -- Lead counts by stage
    new_leads INTEGER DEFAULT 0,
    in_conversation INTEGER DEFAULT 0,
    validated INTEGER DEFAULT 0,
    offers_made INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    offers_rejected INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    dead_leads INTEGER DEFAULT 0,
    
    -- Conversion rates
    conversation_to_offer_rate DECIMAL(5,2),
    offer_acceptance_rate DECIMAL(5,2),
    overall_conversion_rate DECIMAL(5,2),
    
    -- Timing metrics
    avg_conversation_duration_hours DECIMAL(10,2),
    avg_time_to_offer_hours DECIMAL(10,2),
    avg_time_to_close_days DECIMAL(10,2),
    
    -- Financial metrics
    total_offer_value DECIMAL(15,2),
    total_accepted_value DECIMAL(15,2),
    avg_bmv_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_vendor_leads_stage ON vendor_leads(pipeline_stage);
CREATE INDEX idx_vendor_leads_created ON vendor_leads(created_at DESC);
CREATE INDEX idx_vendor_leads_phone ON vendor_leads(vendor_phone);
CREATE INDEX idx_vendor_leads_facebook ON vendor_leads(facebook_lead_id);
CREATE INDEX idx_sms_vendor_lead ON sms_messages(vendor_lead_id);
CREATE INDEX idx_sms_created ON sms_messages(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendor_leads_updated_at BEFORE UPDATE
    ON vendor_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 4. AI SMS Conversation Module

**File**: `ai_sms_agent.py`

Build an intelligent SMS conversation agent that:

#### Core Requirements
- Uses OpenAI GPT-4 for natural, human-like conversations
- Integrates with Twilio SMS API for sending/receiving messages
- Extracts key information progressively through conversation
- Detects buying signals vs objections
- Maintains conversation context across multiple messages
- Scores vendor motivation (1-10) based on conversation cues
- Handles edge cases (rude responses, nonsense, no response)

#### Conversation Strategy

**Initial Message** (sent immediately after Facebook lead capture):
```
Hi {name}! Thanks for your enquiry about selling your property. 
We're cash buyers who can move quickly with no chain. 

What's your rough timeline for selling the property at {address}?
```

**Follow-up Questions** (AI-driven based on responses):
1. Property condition: "How would you describe the property's condition?"
2. Asking price: "What price were you hoping to achieve?"
3. Motivation: "What's prompting the sale?" (Listen for: divorce, relocation, financial stress, inheritance)
4. Timeline: "How quickly do you need to complete?"
5. Other buyers: "Have you had any other offers or viewings?"

**Information Extraction**:
Extract and structure data from natural conversation:
```python
{
    "property_address": "123 High Street, London",
    "asking_price": 250000,
    "condition": "needs_modernisation",  # excellent, good, needs_work, needs_modernisation, poor
    "reason_for_selling": "relocation",  # relocation, financial, divorce, inheritance, downsize, other
    "timeline": "urgent",  # urgent (<2 weeks), quick (<1 month), moderate (<3 months), flexible
    "timeline_days": 14,
    "motivation_score": 8,  # 1-10 based on urgency + reason
    "competing_offers": false,
    "additional_notes": "Vendor mentioned job relocation to Manchester"
}
```

#### Motivation Scoring Algorithm
```python
def calculate_motivation_score(conversation_data):
    """
    Score 1-10 based on:
    - Timeline urgency: urgent=10, quick=7, moderate=5, flexible=3
    - Reason: financial/divorce=10, relocation/inheritance=7, downsize=5, other=3
    - Competing offers: none=10, some interest=5, solid offers=2
    - Conversation tone: desperate=10, motivated=7, casual=4
    """
```

#### GPT-4 System Prompt Template
```python
CONVERSATION_SYSTEM_PROMPT = """
You are a professional property acquisition specialist having an SMS conversation with a potential seller.

Your goals:
1. Build rapport and trust quickly
2. Extract: property address, asking price, condition, reason for selling, timeline
3. Assess motivation level (1-10)
4. Keep messages short (1-2 sentences max for SMS)
5. Sound natural and empathetic, not robotic

Conversation guidelines:
- Be friendly but professional
- Show empathy for their situation
- Don't push too hard - let them open up naturally
- If they seem hesitant, reassure them (no obligation, just exploring options)
- Extract information gradually over 5-8 messages
- Once you have all key info, wrap up politely

Current conversation context: {context}
Latest message from seller: {latest_message}

Respond naturally and ask the next logical question to extract missing information.
Keep responses under 160 characters when possible.
"""
```

#### Key Functions
```python
class AISMSAgent:
    def __init__(self, openai_key, twilio_client):
        self.openai_key = openai_key
        self.twilio = twilio_client
        
    def send_initial_message(self, lead):
        """Send first message to new lead"""
        
    def process_inbound_message(self, vendor_lead_id, message_body):
        """Process vendor response and generate AI reply"""
        
    def extract_property_details(self, conversation_history):
        """Use GPT-4 to extract structured data from conversation"""
        
    def calculate_motivation_score(self, conversation_data):
        """Score motivation 1-10"""
        
    def should_end_conversation(self, conversation_history):
        """Determine if we have enough info to make offer"""
        
    def generate_ai_response(self, conversation_history, vendor_message):
        """Generate contextual AI response"""
```

---

### 5. Deal Validation Integration

**File**: `deal_validator.py`

Connect to existing BMV analysis logic:

```python
class DealValidator:
    def __init__(self, db_connection):
        self.db = db_connection
        
    def validate_deal(self, vendor_lead_id):
        """
        Run BMV analysis on vendor property
        
        Steps:
        1. Get property details from vendor_leads table
        2. Call property valuation API (reuse existing logic)
        3. Compare asking price vs estimated market value
        4. Calculate BMV percentage
        5. Determine if deal passes threshold (15%+ below market)
        6. Update vendor_leads with validation results
        
        Returns: (passed: bool, bmv_score: float, details: dict)
        """
        
    def calculate_profit_potential(self, asking_price, market_value, renovation_cost=0):
        """
        Calculate potential profit:
        - Purchase at asking price
        - Add renovation costs (estimate based on condition)
        - Compare to market value
        - Account for fees (legal, agent, etc)
        """
        
    def get_renovation_estimate(self, condition, property_type, bedrooms):
        """
        Estimate renovation costs based on condition:
        - excellent: £0
        - good: £5k
        - needs_work: £15k
        - needs_modernisation: £25k
        - poor: £40k
        
        Adjust for property size (bedrooms)
        """
```

**Validation Thresholds**:
- Minimum BMV: 15% below market value
- Maximum asking price: £500k (or configure based on investor appetite)
- Minimum profit potential: £30k after all costs
- Acceptable property types: house, flat, bungalow (not land, commercial)

---

### 6. Offer Management System

**File**: `offer_engine.py`

Intelligent offer calculation and delivery:

```python
class OfferEngine:
    def __init__(self, db_connection, sms_agent):
        self.db = db_connection
        self.sms = sms_agent
        
    def calculate_offer(self, vendor_lead_id):
        """
        Calculate offer amount based on:
        - Market value (from validation)
        - Property condition (renovation costs)
        - Vendor motivation (higher motivation = slightly higher offer)
        - Market conditions (configure multiplier)
        
        Formula:
        base_offer = market_value * 0.80  # 80% of market value
        condition_adjustment = -renovation_estimate
        motivation_bonus = motivation_score * 1000  # Up to £10k extra for highly motivated
        
        final_offer = base_offer + condition_adjustment + motivation_bonus
        final_offer = min(final_offer, asking_price * 0.85)  # Never more than 85% of asking
        """
        
    def send_offer(self, vendor_lead_id):
        """
        Generate and send personalized offer via SMS
        
        Message template:
        "Hi {name}, based on our assessment of {address}, we can offer £{offer_amount} 
        for a quick cash sale (completion in {timeline_days} days). This reflects the 
        current condition and allows us to move quickly. Interested in discussing?"
        """
        
    def handle_offer_response(self, vendor_lead_id, response_type):
        """
        Process offer acceptance or rejection
        
        If accepted:
        - Request solicitor details
        - Update stage to PAPERWORK_SENT
        - Send lock-out agreement
        
        If rejected:
        - Send objection-handling video
        - Schedule retry in 2 days
        - Update stage to VIDEO_SENT
        """
        
    def schedule_retry(self, vendor_lead_id, retry_number):
        """
        Schedule retry with progressive delays:
        - Retry 1: 2 days after rejection
        - Retry 2: 4 days after retry 1
        - Retry 3: 7 days after retry 2
        
        Each retry has different messaging:
        - Retry 1: "Hi {name}, just checking if you've had time to consider our offer..."
        - Retry 2: "Hi {name}, we can be flexible on price/timeline. Would {adjusted_offer} work better?"
        - Retry 3: "Hi {name}, this is our final offer. We have other opportunities, so please let us know by {deadline}."
        """
```

**Video Content Strategy**:
When offer is rejected, send link to pre-recorded video addressing common objections:
- "My offer is too low" → Explain market reality, speed vs price trade-off
- "I want to try traditional sale first" → Highlight fees, delays, fall-throughs
- "I need to think about it" → Case studies of successful quick sales

---

### 7. Flask API Routes

**File**: `routes/vendor_api.py`

Create RESTful API endpoints:

```python
from flask import Blueprint, jsonify, request
from decorators import require_auth  # Reuse existing auth

vendor_bp = Blueprint('vendor', __name__, url_prefix='/api/vendor')

# List endpoints
@vendor_bp.route('/leads', methods=['GET'])
@require_auth
def get_vendor_leads():
    """
    GET /api/vendor/leads
    
    Query params:
    - stage: filter by pipeline stage
    - motivation_min: filter by motivation score
    - page: pagination
    - limit: results per page
    
    Returns: {
        "leads": [...],
        "total": 45,
        "page": 1,
        "pages": 3
    }
    """
    
@vendor_bp.route('/leads/<int:lead_id>', methods=['GET'])
@require_auth
def get_vendor_lead(lead_id):
    """
    GET /api/vendor/leads/123
    
    Returns: {
        "lead": {...},
        "conversation": [...],
        "validation": {...},
        "offer": {...}
    }
    """
    
@vendor_bp.route('/leads/<int:lead_id>/conversation', methods=['GET'])
@require_auth
def get_conversation_history(lead_id):
    """
    GET /api/vendor/leads/123/conversation
    
    Returns: [
        {
            "direction": "outbound",
            "message": "Hi John...",
            "timestamp": "2024-01-15 10:30:00",
            "ai_generated": true
        },
        ...
    ]
    """
    
@vendor_bp.route('/leads/<int:lead_id>/send-message', methods=['POST'])
@require_auth
def send_manual_message(lead_id):
    """
    POST /api/vendor/leads/123/send-message
    Body: {"message": "Hi, following up on..."}
    
    Allows manual SMS sending (overrides AI)
    """
    
@vendor_bp.route('/leads/<int:lead_id>/update-stage', methods=['POST'])
@require_auth
def update_lead_stage(lead_id):
    """
    POST /api/vendor/leads/123/update-stage
    Body: {"stage": "OFFER_ACCEPTED"}
    
    Manual stage override (with validation)
    """
    
@vendor_bp.route('/leads/<int:lead_id>/accept-offer', methods=['POST'])
@require_auth
def accept_offer(lead_id):
    """
    POST /api/vendor/leads/123/accept-offer
    
    Manual offer acceptance (bypasses SMS)
    Triggers solicitor details request
    """
    
@vendor_bp.route('/leads/<int:lead_id>/reject-offer', methods=['POST'])
@require_auth
def reject_offer(lead_id):
    """
    POST /api/vendor/leads/123/reject-offer
    Body: {"reason": "Price too low"}
    
    Manual offer rejection
    Triggers retry flow
    """
    
@vendor_bp.route('/stats', methods=['GET'])
@require_auth
def get_pipeline_stats():
    """
    GET /api/vendor/stats
    
    Returns: {
        "total_leads": 156,
        "by_stage": {
            "NEW_LEAD": 12,
            "AI_CONVERSATION": 23,
            ...
        },
        "conversion_rates": {
            "lead_to_offer": 0.65,
            "offer_to_acceptance": 0.42,
            "overall": 0.27
        },
        "avg_times": {
            "conversation_duration_hours": 4.5,
            "time_to_offer_hours": 12.3,
            "time_to_close_days": 8.7
        },
        "financial": {
            "total_offers_made": 85000,
            "total_accepted_value": 420000,
            "avg_bmv_percentage": 18.5
        }
    }
    """

@vendor_bp.route('/webhook/sms', methods=['POST'])
def twilio_webhook():
    """
    POST /api/vendor/webhook/sms
    
    Receives inbound SMS from Twilio
    Triggers AI response
    
    NO AUTH - Twilio signature validation instead
    """
```

---

### 8. Dashboard UI Extensions

**File**: `templates/vendor_dashboard.html`

Create a professional vendor pipeline dashboard:

#### Layout Structure
```html
<!-- Extends existing dashboard.html base -->
{% extends "base_dashboard.html" %}

{% block content %}
<div class="vendor-pipeline-container">
    
    <!-- Header with stats -->
    <div class="row mb-4">
        <div class="col-md-3">
            <div class="stat-card">
                <h5>Total Leads</h5>
                <h2 id="total-leads">156</h2>
                <span class="text-muted">+12 this week</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card">
                <h5>Conversion Rate</h5>
                <h2 id="conversion-rate">27%</h2>
                <span class="text-success">+3% vs last month</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card">
                <h5>Active Conversations</h5>
                <h2 id="active-convos">23</h2>
                <span class="text-muted">AI handling</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card">
                <h5>Deals This Month</h5>
                <h2 id="monthly-deals">8</h2>
                <span class="text-muted">£420k value</span>
            </div>
        </div>
    </div>
    
    <!-- Kanban board -->
    <div class="pipeline-board">
        <div class="pipeline-column" data-stage="NEW_LEAD">
            <h4>New Leads <span class="badge">12</span></h4>
            <div class="lead-cards" id="new-leads">
                <!-- Lead cards populated via JS -->
            </div>
        </div>
        
        <div class="pipeline-column" data-stage="AI_CONVERSATION">
            <h4>In Conversation <span class="badge">23</span></h4>
            <div class="lead-cards" id="ai-conversation">
                <!-- Lead cards -->
            </div>
        </div>
        
        <div class="pipeline-column" data-stage="OFFER_MADE">
            <h4>Offer Made <span class="badge">18</span></h4>
            <div class="lead-cards" id="offer-made">
                <!-- Lead cards -->
            </div>
        </div>
        
        <div class="pipeline-column" data-stage="OFFER_ACCEPTED">
            <h4>Accepted <span class="badge">8</span></h4>
            <div class="lead-cards" id="accepted">
                <!-- Lead cards -->
            </div>
        </div>
    </div>
    
    <!-- Filters -->
    <div class="filters mb-3">
        <select id="filter-stage">
            <option value="">All Stages</option>
            <option value="NEW_LEAD">New Leads</option>
            <option value="AI_CONVERSATION">In Conversation</option>
            <!-- ... -->
        </select>
        
        <select id="filter-motivation">
            <option value="">All Motivation</option>
            <option value="8-10">High (8-10)</option>
            <option value="5-7">Medium (5-7)</option>
            <option value="1-4">Low (1-4)</option>
        </select>
        
        <input type="date" id="filter-date-from" placeholder="From Date">
        <input type="date" id="filter-date-to" placeholder="To Date">
        
        <button class="btn btn-primary" onclick="applyFilters()">Apply</button>
        <button class="btn btn-secondary" onclick="resetFilters()">Reset</button>
    </div>
    
    <!-- Detailed table view (alternative to Kanban) -->
    <div class="table-view" style="display: none;">
        <table class="table table-hover" id="vendor-leads-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Property</th>
                    <th>Asking Price</th>
                    <th>BMV Score</th>
                    <th>Motivation</th>
                    <th>Stage</th>
                    <th>Last Contact</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <!-- Populated via JS -->
            </tbody>
        </table>
    </div>
    
    <!-- View toggle -->
    <div class="view-toggle">
        <button onclick="showKanban()">Kanban</button>
        <button onclick="showTable()">Table</button>
    </div>
</div>

<!-- Lead detail modal -->
<div class="modal fade" id="leadDetailModal">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="leadName">John Smith - 123 High St</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Lead details tabs -->
                <ul class="nav nav-tabs" id="leadTabs">
                    <li class="nav-item">
                        <a class="nav-link active" data-toggle="tab" href="#conversation-tab">Conversation</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-toggle="tab" href="#details-tab">Details</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-toggle="tab" href="#validation-tab">Validation</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-toggle="tab" href="#offer-tab">Offer</a>
                    </li>
                </ul>
                
                <div class="tab-content">
                    <!-- Conversation history -->
                    <div id="conversation-tab" class="tab-pane fade show active">
                        <div class="conversation-container">
                            <!-- SMS transcript styled like iMessage -->
                        </div>
                        <div class="manual-message-form">
                            <textarea placeholder="Send manual message..."></textarea>
                            <button onclick="sendManualMessage()">Send</button>
                        </div>
                    </div>
                    
                    <!-- Lead details -->
                    <div id="details-tab" class="tab-pane fade">
                        <dl class="row">
                            <dt class="col-sm-4">Phone:</dt>
                            <dd class="col-sm-8" id="detail-phone"></dd>
                            
                            <dt class="col-sm-4">Email:</dt>
                            <dd class="col-sm-8" id="detail-email"></dd>
                            
                            <dt class="col-sm-4">Property:</dt>
                            <dd class="col-sm-8" id="detail-address"></dd>
                            
                            <dt class="col-sm-4">Asking Price:</dt>
                            <dd class="col-sm-8" id="detail-asking"></dd>
                            
                            <dt class="col-sm-4">Condition:</dt>
                            <dd class="col-sm-8" id="detail-condition"></dd>
                            
                            <dt class="col-sm-4">Motivation:</dt>
                            <dd class="col-sm-8">
                                <span id="detail-motivation"></span>
                                <div class="progress">
                                    <div class="progress-bar" id="motivation-bar"></div>
                                </div>
                            </dd>
                            
                            <dt class="col-sm-4">Timeline:</dt>
                            <dd class="col-sm-8" id="detail-timeline"></dd>
                        </dl>
                    </div>
                    
                    <!-- Validation results -->
                    <div id="validation-tab" class="tab-pane fade">
                        <h6>BMV Analysis Results</h6>
                        <dl class="row">
                            <dt class="col-sm-4">Market Value:</dt>
                            <dd class="col-sm-8" id="val-market-value"></dd>
                            
                            <dt class="col-sm-4">Asking Price:</dt>
                            <dd class="col-sm-8" id="val-asking"></dd>
                            
                            <dt class="col-sm-4">BMV %:</dt>
                            <dd class="col-sm-8">
                                <span id="val-bmv-percent" class="badge badge-success"></span>
                            </dd>
                            
                            <dt class="col-sm-4">Profit Potential:</dt>
                            <dd class="col-sm-8" id="val-profit"></dd>
                            
                            <dt class="col-sm-4">Passed Validation:</dt>
                            <dd class="col-sm-8" id="val-passed"></dd>
                        </dl>
                    </div>
                    
                    <!-- Offer management -->
                    <div id="offer-tab" class="tab-pane fade">
                        <h6>Offer Details</h6>
                        <dl class="row">
                            <dt class="col-sm-4">Offer Amount:</dt>
                            <dd class="col-sm-8" id="offer-amount"></dd>
                            
                            <dt class="col-sm-4">Sent At:</dt>
                            <dd class="col-sm-8" id="offer-sent"></dd>
                            
                            <dt class="col-sm-4">Status:</dt>
                            <dd class="col-sm-8" id="offer-status"></dd>
                            
                            <dt class="col-sm-4">Retries:</dt>
                            <dd class="col-sm-8" id="offer-retries"></dd>
                        </dl>
                        
                        <div class="manual-actions">
                            <button class="btn btn-success" onclick="manualAccept()">Accept Offer</button>
                            <button class="btn btn-danger" onclick="manualReject()">Reject Offer</button>
                            <button class="btn btn-warning" onclick="adjustOffer()">Adjust Offer</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{% endblock %}
```

#### JavaScript Functions
```javascript
// Real-time updates via polling
function refreshPipeline() {
    fetch('/api/vendor/leads')
        .then(r => r.json())
        .then(data => {
            updateKanbanBoard(data.leads);
            updateStats(data.stats);
        });
}

// Auto-refresh every 30 seconds
setInterval(refreshPipeline, 30000);

// Lead card template
function createLeadCard(lead) {
    return `
        <div class="lead-card" data-lead-id="${lead.id}" onclick="showLeadModal(${lead.id})">
            <div class="lead-header">
                <strong>${lead.vendor_name}</strong>
                <span class="motivation-badge">${lead.motivation_score}/10</span>
            </div>
            <div class="lead-body">
                <p class="text-muted">${lead.property_address}</p>
                <p class="asking-price">£${lead.asking_price.toLocaleString()}</p>
                ${lead.bmv_score ? `<span class="bmv-badge">${lead.bmv_score}% BMV</span>` : ''}
            </div>
            <div class="lead-footer">
                <small>${formatTimestamp(lead.last_contact_at)}</small>
            </div>
        </div>
    `;
}

// Show lead details in modal
function showLeadModal(leadId) {
    fetch(`/api/vendor/leads/${leadId}`)
        .then(r => r.json())
        .then(data => {
            populateLeadModal(data);
            $('#leadDetailModal').modal('show');
        });
}
```

#### CSS Styling
```css
.pipeline-board {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding: 20px 0;
}

.pipeline-column {
    min-width: 280px;
    background: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
}

.lead-card {
    background: white;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 10px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.lead-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.motivation-badge {
    background: #28a745;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
}

.bmv-badge {
    background: #007bff;
    color: white;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.conversation-container {
    max-height: 400px;
    overflow-y: auto;
    padding: 15px;
    background: #e5ddd5;
    border-radius: 8px;
}

.message-bubble {
    max-width: 70%;
    padding: 10px 15px;
    border-radius: 18px;
    margin-bottom: 10px;
}

.message-outbound {
    background: #dcf8c6;
    margin-left: auto;
    text-align: right;
}

.message-inbound {
    background: white;
    margin-right: auto;
}
```

---

### 9. Background Service Management

**File**: `pipeline_service.py`

Main orchestration service:

```python
import time
import logging
from datetime import datetime, timedelta
from ai_sms_agent import AISMSAgent
from deal_validator import DealValidator
from offer_engine import OfferEngine
from facebook_integration import FacebookLeadAds
from database import get_db_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.RotatingFileHandler('pipeline.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class VendorPipelineService:
    def __init__(self):
        self.db = get_db_connection()
        self.sms_agent = AISMSAgent(os.getenv('OPENAI_API_KEY'), twilio_client)
        self.validator = DealValidator(self.db)
        self.offer_engine = OfferEngine(self.db, self.sms_agent)
        self.fb_leads = FacebookLeadAds(os.getenv('FACEBOOK_ACCESS_TOKEN'))
        self.running = True
        
    def run(self):
        """Main service loop"""
        logger.info("Vendor Pipeline Service started")
        
        while self.running:
            try:
                # 1. Check for new Facebook leads
                self.process_new_facebook_leads()
                
                # 2. Process active AI conversations
                self.process_active_conversations()
                
                # 3. Validate deals ready for offers
                self.process_pending_validations()
                
                # 4. Send scheduled retries
                self.process_scheduled_retries()
                
                # 5. Move accepted deals to investor matching
                self.process_accepted_deals()
                
                # 6. Clean up stale conversations
                self.cleanup_stale_leads()
                
                # 7. Update daily metrics
                self.update_metrics()
                
                # Sleep for 60 seconds
                time.sleep(60)
                
            except KeyboardInterrupt:
                logger.info("Received shutdown signal")
                self.running = False
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(60)  # Wait before retrying
                
        logger.info("Vendor Pipeline Service stopped")
    
    def process_new_facebook_leads(self):
        """Fetch new leads from Facebook and start conversations"""
        try:
            new_leads = self.fb_leads.get_new_leads()
            
            for lead in new_leads:
                # Check if already exists
                existing = self.db.execute(
                    "SELECT id FROM vendor_leads WHERE facebook_lead_id = %s",
                    (lead['id'],)
                ).fetchone()
                
                if existing:
                    continue
                
                # Insert new lead
                lead_id = self.db.execute("""
                    INSERT INTO vendor_leads (
                        facebook_lead_id, vendor_name, vendor_phone, 
                        property_address, pipeline_stage
                    ) VALUES (%s, %s, %s, %s, 'NEW_LEAD')
                    RETURNING id
                """, (lead['id'], lead['name'], lead['phone'], lead['address'])).fetchone()[0]
                
                # Send initial SMS
                self.sms_agent.send_initial_message(lead_id)
                
                # Update stage
                self.db.execute("""
                    UPDATE vendor_leads 
                    SET pipeline_stage = 'AI_CONVERSATION', 
                        conversation_started_at = NOW()
                    WHERE id = %s
                """, (lead_id,))
                
                logger.info(f"New lead captured: {lead_id}")
                
        except Exception as e:
            logger.error(f"Error processing Facebook leads: {e}")
    
    def process_active_conversations(self):
        """Check for conversations needing AI responses"""
        try:
            # Get leads in AI_CONVERSATION stage with recent inbound messages
            active = self.db.execute("""
                SELECT vl.id, vl.vendor_phone
                FROM vendor_leads vl
                JOIN sms_messages sm ON sm.vendor_lead_id = vl.id
                WHERE vl.pipeline_stage = 'AI_CONVERSATION'
                AND sm.direction = 'inbound'
                AND sm.created_at > NOW() - INTERVAL '5 minutes'
                AND NOT EXISTS (
                    SELECT 1 FROM sms_messages sm2
                    WHERE sm2.vendor_lead_id = vl.id
                    AND sm2.direction = 'outbound'
                    AND sm2.created_at > sm.created_at
                )
            """).fetchall()
            
            for lead in active:
                # Process with AI
                self.sms_agent.process_inbound_message(lead['id'])
                
                # Check if conversation complete
                if self.sms_agent.should_end_conversation(lead['id']):
                    self.db.execute("""
                        UPDATE vendor_leads 
                        SET pipeline_stage = 'DEAL_VALIDATION'
                        WHERE id = %s
                    """, (lead['id'],))
                    
        except Exception as e:
            logger.error(f"Error processing conversations: {e}")
    
    def process_pending_validations(self):
        """Run BMV validation on deals ready for offers"""
        try:
            pending = self.db.execute("""
                SELECT id FROM vendor_leads
                WHERE pipeline_stage = 'DEAL_VALIDATION'
                AND validation_passed IS NULL
            """).fetchall()
            
            for lead in pending:
                passed, bmv_score, details = self.validator.validate_deal(lead['id'])
                
                if passed:
                    # Generate and send offer
                    self.offer_engine.calculate_offer(lead['id'])
                    self.offer_engine.send_offer(lead['id'])
                    
                    self.db.execute("""
                        UPDATE vendor_leads
                        SET pipeline_stage = 'OFFER_MADE'
                        WHERE id = %s
                    """, (lead['id'],))
                else:
                    # Mark as failed validation
                    self.db.execute("""
                        UPDATE vendor_leads
                        SET pipeline_stage = 'DEAD_LEAD',
                            validation_passed = FALSE
                        WHERE id = %s
                    """, (lead['id'],))
                    
        except Exception as e:
            logger.error(f"Error processing validations: {e}")
    
    def process_scheduled_retries(self):
        """Send retry messages for rejected offers"""
        try:
            retries = self.db.execute("""
                SELECT id, retry_count FROM vendor_leads
                WHERE pipeline_stage IN ('VIDEO_SENT', 'RETRY_1', 'RETRY_2')
                AND next_retry_at <= NOW()
            """).fetchall()
            
            for lead in retries:
                self.offer_engine.send_retry(lead['id'], lead['retry_count'] + 1)
                
        except Exception as e:
            logger.error(f"Error processing retries: {e}")
    
    def process_accepted_deals(self):
        """Move accepted deals to investor matching"""
        try:
            accepted = self.db.execute("""
                SELECT id FROM vendor_leads
                WHERE pipeline_stage = 'OFFER_ACCEPTED'
                AND solicitor_name IS NOT NULL
                AND lockout_agreement_signed = TRUE
            """).fetchall()
            
            for lead in accepted:
                # Copy to properties table for investor matching
                self.db.execute("""
                    INSERT INTO properties (
                        address, asking_price, market_value, bmv_score,
                        source, status
                    )
                    SELECT 
                        property_address, offer_amount, estimated_market_value, bmv_score,
                        'vendor_acquisition', 'ready_for_investors'
                    FROM vendor_leads
                    WHERE id = %s
                """, (lead['id'],))
                
                # Update vendor lead
                self.db.execute("""
                    UPDATE vendor_leads
                    SET pipeline_stage = 'READY_FOR_INVESTORS'
                    WHERE id = %s
                """, (lead['id'],))
                
                logger.info(f"Deal {lead['id']} ready for investors")
                
        except Exception as e:
            logger.error(f"Error processing accepted deals: {e}")
    
    def cleanup_stale_leads(self):
        """Mark unresponsive leads as dead"""
        try:
            self.db.execute("""
                UPDATE vendor_leads
                SET pipeline_stage = 'DEAD_LEAD'
                WHERE pipeline_stage = 'AI_CONVERSATION'
                AND last_contact_at < NOW() - INTERVAL '48 hours'
            """)
            
        except Exception as e:
            logger.error(f"Error cleaning up stale leads: {e}")
    
    def update_metrics(self):
        """Calculate daily pipeline metrics"""
        try:
            # Check if today's metrics already exist
            today = datetime.now().date()
            
            # Calculate and insert/update metrics
            self.db.execute("""
                INSERT INTO pipeline_metrics (
                    date, new_leads, in_conversation, validated,
                    offers_made, offers_accepted, offers_rejected
                )
                SELECT 
                    %s,
                    COUNT(*) FILTER (WHERE created_at::date = %s),
                    COUNT(*) FILTER (WHERE pipeline_stage = 'AI_CONVERSATION'),
                    COUNT(*) FILTER (WHERE validation_passed = TRUE),
                    COUNT(*) FILTER (WHERE pipeline_stage IN ('OFFER_MADE', 'OFFER_ACCEPTED', 'OFFER_REJECTED')),
                    COUNT(*) FILTER (WHERE pipeline_stage = 'OFFER_ACCEPTED'),
                    COUNT(*) FILTER (WHERE pipeline_stage LIKE 'RETRY_%%')
                FROM vendor_leads
                ON CONFLICT (date) DO UPDATE SET
                    in_conversation = EXCLUDED.in_conversation,
                    validated = EXCLUDED.validated,
                    offers_made = EXCLUDED.offers_made,
                    offers_accepted = EXCLUDED.offers_accepted,
                    offers_rejected = EXCLUDED.offers_rejected
            """, (today, today))
            
        except Exception as e:
            logger.error(f"Error updating metrics: {e}")

if __name__ == '__main__':
    service = VendorPipelineService()
    service.run()
```

---

### 10. Configuration & Environment Variables

**File**: `.env.example`

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bmv_platform

# Facebook Lead Ads
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
FACEBOOK_LEAD_FORM_ID=your_lead_form_id
FACEBOOK_PAGE_ID=your_page_id

# Twilio SMS
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+447123456789

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview

# Pipeline Configuration
MIN_BMV_PERCENTAGE=15.0
MAX_ASKING_PRICE=500000
MIN_PROFIT_POTENTIAL=30000
OFFER_BASE_PERCENTAGE=80  # 80% of market value
OFFER_MAX_PERCENTAGE=85   # Never more than 85% of asking

# Retry Configuration
RETRY_1_DELAY_DAYS=2
RETRY_2_DELAY_DAYS=4
RETRY_3_DELAY_DAYS=7
MAX_RETRIES=3

# Documents
LOCKOUT_AGREEMENT_TEMPLATE=/templates/lockout_agreement.pdf
VIDEO_OBJECTION_URL=https://yourdomain.com/videos/objection-handler.mp4

# Service
PIPELINE_POLL_INTERVAL=60  # seconds
CONVERSATION_TIMEOUT_HOURS=48
```

---

### 11. Error Handling & Logging

**File**: `utils/error_handler.py`

```python
import logging
from functools import wraps
from datetime import datetime

class PipelineError(Exception):
    """Base exception for pipeline errors"""
    pass

class FacebookAPIError(PipelineError):
    """Facebook API errors"""
    pass

class TwilioSMSError(PipelineError):
    """Twilio SMS errors"""
    pass

class AIConversationError(PipelineError):
    """AI conversation errors"""
    pass

def retry_on_failure(max_retries=3, delay=5):
    """Decorator to retry failed operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logging.warning(f"Attempt {attempt + 1} failed: {e}. Retrying...")
                    time.sleep(delay)
        return wrapper
    return decorator

def log_pipeline_event(event_type, lead_id, details):
    """Log pipeline events to database"""
    db.execute("""
        INSERT INTO pipeline_events (event_type, lead_id, details, created_at)
        VALUES (%s, %s, %s, NOW())
    """, (event_type, lead_id, json.dumps(details)))

def send_alert(subject, message):
    """Send alert email for critical errors"""
    # Implement email alerting
    pass
```

---

### 12. Testing Requirements

**File**: `tests/test_pipeline.py`

```python
import pytest
from pipeline_service import VendorPipelineService
from ai_sms_agent import AISMSAgent

def test_facebook_lead_capture():
    """Test capturing new Facebook leads"""
    # Mock Facebook API response
    # Insert test lead
    # Verify initial SMS sent
    # Verify stage updated to AI_CONVERSATION
    
def test_ai_conversation_flow():
    """Test full AI conversation"""
    # Simulate vendor responses
    # Verify AI extracts property details
    # Verify motivation scoring
    # Verify conversation completion detection
    
def test_deal_validation():
    """Test BMV validation logic"""
    # Create test lead with property details
    # Run validation
    # Verify BMV score calculation
    # Verify pass/fail threshold
    
def test_offer_calculation():
    """Test offer amount calculation"""
    # Test various scenarios:
    # - High motivation, good condition
    # - Low motivation, poor condition
    # - Market value vs asking price
    
def test_retry_mechanism():
    """Test offer rejection and retry flow"""
    # Reject offer
    # Verify video sent
    # Verify retry scheduled
    # Test retry messages at correct intervals
    
def test_state_transitions():
    """Test pipeline stage transitions"""
    # Verify valid transitions
    # Verify invalid transitions blocked
    # Test manual overrides
```

---

## File Structure

```
vendor-pipeline/
├── pipeline_service.py              # Main background service
├── ai_sms_agent.py                  # AI conversation handler
├── deal_validator.py                # BMV validation logic
├── offer_engine.py                  # Offer calculation & management
├── facebook_integration.py          # Facebook Lead Ads API
├── twilio_integration.py            # SMS sending/receiving
├── database/
│   ├── vendor_schema.sql            # Database schema
│   └── migrations/                  # Schema migrations
├── routes/
│   └── vendor_api.py                # Flask API routes
├── templates/
│   ├── vendor_dashboard.html        # Pipeline dashboard UI
│   ├── lead_detail_modal.html       # Lead details modal
│   └── lockout_agreement.pdf        # Legal template
├── static/
│   ├── css/
│   │   └── vendor_pipeline.css      # Custom styles
│   └── js/
│       └── vendor_dashboard.js      # Dashboard JS
├── config/
│   ├── pipeline_config.py           # Configuration
│   └── prompts.py                   # AI conversation prompts
├── utils/
│   ├── error_handler.py             # Error handling
│   └── logger.py                    # Logging utilities
├── tests/
│   ├── test_pipeline.py             # Service tests
│   ├── test_ai_agent.py             # AI agent tests
│   └── test_validator.py            # Validation tests
├── .env.example                     # Environment template
├── requirements.txt                 # Python dependencies
└── README.md                        # Documentation
```

---

## Python Dependencies

**File**: `requirements.txt`

```
# Existing dependencies from deal dashboard
flask==3.0.0
flask-cors==4.0.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
requests==2.31.0

# New dependencies for vendor pipeline
openai==1.6.1              # GPT-4 API
twilio==8.11.1             # SMS integration
facebook-sdk==3.1.0        # Facebook Lead Ads
python-dateutil==2.8.2     # Date handling
schedule==1.2.0            # Task scheduling
redis==5.0.1               # Optional: for job queue
celery==5.3.4              # Optional: for async tasks
```

---

## Success Criteria

✅ **Pipeline Automation**
- Facebook leads processed within 5 minutes
- AI conversations start automatically
- No manual intervention needed for qualified leads

✅ **AI Performance**
- Extracts property details in <8 messages
- Motivation scoring accuracy >80%
- Natural conversation flow (human-like)

✅ **Deal Quality**
- Only properties with >15% BMV progress to offers
- Profit potential >£30k after costs
- Validation accuracy >90%

✅ **Conversion Metrics**
- Lead → Conversation: >90%
- Conversation → Offer: >60%
- Offer → Acceptance: >30%
- Overall conversion: >20%

✅ **System Reliability**
- 99% uptime for background service
- All SMS delivered within 30 seconds
- Zero data loss on crashes
- Full audit trail in database

✅ **Dashboard UX**
- Real-time updates (<30s latency)
- Clean, professional interface
- Mobile responsive
- Manual override capability

---

## Implementation Priorities

### Phase 1: Core Infrastructure (Week 1)
1. Database schema creation
2. Pipeline service skeleton
3. Basic Facebook lead capture
4. Twilio SMS integration

### Phase 2: AI Conversation Engine (Week 2)
1. GPT-4 integration
2. Conversation flow logic
3. Data extraction
4. Motivation scoring

### Phase 3: Deal Validation & Offers (Week 3)
1. BMV analysis integration
2. Offer calculation logic
3. Offer delivery via SMS
4. Retry mechanism

### Phase 4: Dashboard & API (Week 4)
1. Flask API routes
2. Kanban dashboard UI
3. Lead detail modals
4. Real-time updates

### Phase 5: Testing & Deployment (Week 5)
1. Unit tests
2. Integration tests
3. Docker containerization
4. AWS deployment

---

## Important Notes

**Integration with Existing System**:
- Reuse database connection pool from `app.py`
- Follow existing Flask blueprint pattern
- Match Bootstrap/CSS styling
- Use same authentication middleware

**Security Considerations**:
- Validate Twilio webhook signatures
- Sanitize all user input
- Encrypt sensitive data (solicitor details)
- Rate limit API endpoints

**Scalability**:
- Use connection pooling for database
- Consider Redis for job queue if volume grows
- Implement caching for validation results
- Monitor API rate limits (OpenAI, Twilio)

**Monitoring**:
- Log all pipeline events
- Alert on critical failures
- Track conversion metrics daily
- Monitor API costs (OpenAI usage)

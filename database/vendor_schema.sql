-- ============================================================================
-- Vendor Pipeline Database Schema
-- ============================================================================
-- This schema extends the existing deal-sourcing-saas database to support
-- the AI-powered vendor acquisition pipeline as specified in VENDOR_PIPELINE_SPEC.md
--
-- Note: This is a reference SQL schema. The actual implementation uses Prisma ORM.
-- This file can be used to understand the complete schema structure or converted
-- to Prisma migrations if needed.
-- ============================================================================

-- ============================================================================
-- 1. VENDOR LEADS TABLE
-- ============================================================================
-- Main table tracking vendor leads through the acquisition pipeline
-- Replaces/supplements the existing `vendors` table with pipeline-specific fields
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_leads (
    id SERIAL PRIMARY KEY,
    
    -- Lead Source
    facebook_lead_id VARCHAR(255) UNIQUE,
    lead_source VARCHAR(50) DEFAULT 'facebook_ads',
    campaign_id VARCHAR(255),
    
    -- Vendor Information
    vendor_name VARCHAR(255) NOT NULL,
    vendor_phone VARCHAR(50) NOT NULL,
    vendor_email VARCHAR(255),
    vendor_address TEXT,
    
    -- Property Details (from AI conversation or Facebook lead)
    property_address TEXT,
    property_postcode VARCHAR(20),
    asking_price DECIMAL(12,2),
    property_type VARCHAR(50),
    bedrooms INTEGER,
    bathrooms INTEGER,
    condition VARCHAR(50), -- 'excellent', 'good', 'needs_work', 'needs_modernisation', 'poor'
    
    -- Workflow Status
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'NEW_LEAD',
    conversation_state JSONB DEFAULT '{}'::jsonb,
    
    -- AI Conversation Data
    ai_conversation_history JSONB DEFAULT '[]'::jsonb,
    motivation_score INTEGER CHECK (motivation_score BETWEEN 0 AND 10),
    urgency_level VARCHAR(20), -- 'urgent' (<2 weeks), 'quick' (<1 month), 'moderate' (<3 months), 'flexible'
    reason_for_selling TEXT, -- 'relocation', 'financial', 'divorce', 'inheritance', 'downsize', 'other'
    timeline_days INTEGER,
    competing_offers BOOLEAN DEFAULT FALSE,
    
    -- Deal Validation
    bmv_score DECIMAL(5,2), -- BMV percentage (e.g., 15.5 for 15.5% below market)
    estimated_market_value DECIMAL(12,2),
    estimated_refurb_cost DECIMAL(12,2),
    profit_potential DECIMAL(12,2),
    validation_passed BOOLEAN,
    validation_notes TEXT,
    validated_at TIMESTAMP,
    
    -- Offer Management
    offer_amount DECIMAL(12,2),
    offer_percentage DECIMAL(5,2), -- % of asking price
    offer_sent_at TIMESTAMP,
    offer_accepted_at TIMESTAMP,
    offer_rejected_at TIMESTAMP,
    rejection_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    
    -- Retry Tracking
    video_sent BOOLEAN DEFAULT FALSE,
    video_sent_at TIMESTAMP,
    video_url TEXT,
    
    -- Solicitor Details (when accepted)
    solicitor_name VARCHAR(255),
    solicitor_firm VARCHAR(255),
    solicitor_phone VARCHAR(50),
    solicitor_email VARCHAR(255),
    lockout_agreement_sent BOOLEAN DEFAULT FALSE,
    lockout_agreement_sent_at TIMESTAMP,
    lockout_agreement_signed BOOLEAN DEFAULT FALSE,
    lockout_agreement_signed_at TIMESTAMP,
    lockout_agreement_s3_key VARCHAR(500),
    
    -- Link to existing Deal (when converted)
    deal_id VARCHAR(36), -- UUID reference to deals table
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_contact_at TIMESTAMP,
    conversation_started_at TIMESTAMP,
    deal_closed_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_pipeline_stage CHECK (
        pipeline_stage IN (
            'NEW_LEAD', 
            'AI_CONVERSATION', 
            'DEAL_VALIDATION', 
            'OFFER_MADE', 
            'OFFER_ACCEPTED', 
            'OFFER_REJECTED',
            'VIDEO_SENT', 
            'RETRY_1', 
            'RETRY_2', 
            'RETRY_3',
            'PAPERWORK_SENT', 
            'READY_FOR_INVESTORS', 
            'DEAD_LEAD'
        )
    )
);

-- Indexes for vendor_leads
CREATE INDEX IF NOT EXISTS idx_vendor_leads_stage ON vendor_leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_created ON vendor_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_phone ON vendor_leads(vendor_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_facebook ON vendor_leads(facebook_lead_id);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_deal ON vendor_leads(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_leads_motivation ON vendor_leads(motivation_score) WHERE motivation_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_leads_next_retry ON vendor_leads(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- ============================================================================
-- 2. SMS MESSAGES TABLE
-- ============================================================================
-- Complete log of all SMS messages sent/received during AI conversations
-- Links to vendor_leads for conversation tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS sms_messages (
    id SERIAL PRIMARY KEY,
    vendor_lead_id INTEGER NOT NULL REFERENCES vendor_leads(id) ON DELETE CASCADE,
    
    -- Message Details
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    message_sid VARCHAR(255) UNIQUE, -- Twilio message ID (unique per message)
    
    -- Phone Numbers
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    message_body TEXT NOT NULL,
    
    -- AI Context
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_prompt TEXT, -- The prompt sent to GPT-4 for generating response
    ai_response_metadata JSONB, -- Full AI response metadata (model, tokens, etc.)
    intent_detected VARCHAR(100), -- Detected intent from message
    confidence_score DECIMAL(5,2), -- AI confidence (0-100)
    
    -- Status Tracking
    status VARCHAR(50), -- 'queued', 'sent', 'delivered', 'failed', 'undelivered'
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timestamps
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_direction CHECK (direction IN ('inbound', 'outbound'))
);

-- Indexes for sms_messages
CREATE INDEX IF NOT EXISTS idx_sms_vendor_lead ON sms_messages(vendor_lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_created ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_message_sid ON sms_messages(message_sid) WHERE message_sid IS NOT NULL;

-- ============================================================================
-- 3. PIPELINE METRICS TABLE
-- ============================================================================
-- Daily aggregated metrics for pipeline analytics and reporting
-- Updated daily by the pipeline service
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id SERIAL PRIMARY KEY,
    
    date DATE NOT NULL UNIQUE,
    
    -- Lead Counts by Stage
    new_leads INTEGER DEFAULT 0,
    in_conversation INTEGER DEFAULT 0,
    validated INTEGER DEFAULT 0,
    offers_made INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    offers_rejected INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    dead_leads INTEGER DEFAULT 0,
    
    -- Conversion Rates (stored as percentages, e.g., 65.5 for 65.5%)
    conversation_to_offer_rate DECIMAL(5,2),
    offer_acceptance_rate DECIMAL(5,2),
    overall_conversion_rate DECIMAL(5,2), -- New leads → Accepted offers
    
    -- Timing Metrics (in hours/days as appropriate)
    avg_conversation_duration_hours DECIMAL(10,2),
    avg_time_to_offer_hours DECIMAL(10,2),
    avg_time_to_close_days DECIMAL(10,2),
    
    -- Financial Metrics
    total_offer_value DECIMAL(15,2),
    total_accepted_value DECIMAL(15,2),
    avg_bmv_percentage DECIMAL(5,2),
    total_profit_potential DECIMAL(15,2),
    
    -- AI Performance Metrics
    avg_motivation_score DECIMAL(3,1),
    avg_messages_per_conversation DECIMAL(5,2),
    ai_response_time_ms INTEGER, -- Average AI response time in milliseconds
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for pipeline_metrics
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_date ON pipeline_metrics(date DESC);

-- ============================================================================
-- 4. PIPELINE EVENTS TABLE
-- ============================================================================
-- Audit trail of all pipeline events and state transitions
-- Useful for debugging and understanding pipeline flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_events (
    id SERIAL PRIMARY KEY,
    vendor_lead_id INTEGER NOT NULL REFERENCES vendor_leads(id) ON DELETE CASCADE,
    
    event_type VARCHAR(100) NOT NULL, -- 'stage_transition', 'offer_sent', 'sms_received', etc.
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    details JSONB DEFAULT '{}'::jsonb, -- Event-specific data
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255) -- 'system', 'user_id', or specific service name
);

-- Indexes for pipeline_events
CREATE INDEX IF NOT EXISTS idx_pipeline_events_lead ON pipeline_events(vendor_lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_type ON pipeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_created ON pipeline_events(created_at DESC);

-- ============================================================================
-- 5. OFFER RETRIES TABLE
-- ============================================================================
-- Track individual retry attempts for rejected offers
-- Complements retry_count in vendor_leads with detailed history
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_retries (
    id SERIAL PRIMARY KEY,
    vendor_lead_id INTEGER NOT NULL REFERENCES vendor_leads(id) ON DELETE CASCADE,
    
    retry_number INTEGER NOT NULL, -- 1, 2, or 3
    original_offer_amount DECIMAL(12,2),
    adjusted_offer_amount DECIMAL(12,2), -- May be adjusted on retries
    
    message_sent TEXT,
    sms_message_id INTEGER REFERENCES sms_messages(id),
    
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    vendor_response VARCHAR(50), -- 'accepted', 'rejected', 'counter_offer', 'no_response'
    response_received_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_retry_number CHECK (retry_number BETWEEN 1 AND 3)
);

-- Indexes for offer_retries
CREATE INDEX IF NOT EXISTS idx_offer_retries_lead ON offer_retries(vendor_lead_id);
CREATE INDEX IF NOT EXISTS idx_offer_retries_scheduled ON offer_retries(scheduled_for) WHERE sent_at IS NULL;

-- ============================================================================
-- 6. FACEBOOK LEAD SYNC TABLE
-- ============================================================================
-- Track Facebook Lead Ads API sync status to prevent duplicate processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS facebook_lead_sync (
    id SERIAL PRIMARY KEY,
    facebook_lead_id VARCHAR(255) NOT NULL UNIQUE,
    vendor_lead_id INTEGER REFERENCES vendor_leads(id) ON DELETE SET NULL,
    
    lead_data JSONB, -- Full Facebook lead data snapshot
    synced_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for facebook_lead_sync
CREATE INDEX IF NOT EXISTS idx_facebook_sync_lead_id ON facebook_lead_sync(facebook_lead_id);
CREATE INDEX IF NOT EXISTS idx_facebook_sync_vendor_lead ON facebook_lead_sync(vendor_lead_id) WHERE vendor_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facebook_sync_processed ON facebook_lead_sync(processed_at) WHERE processed_at IS NULL;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp on vendor_leads
CREATE OR REPLACE FUNCTION update_vendor_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_leads_updated_at ON vendor_leads;
CREATE TRIGGER trigger_update_vendor_leads_updated_at
    BEFORE UPDATE ON vendor_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_leads_updated_at();

-- Auto-update updated_at timestamp on pipeline_metrics
CREATE OR REPLACE FUNCTION update_pipeline_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pipeline_metrics_updated_at ON pipeline_metrics;
CREATE TRIGGER trigger_update_pipeline_metrics_updated_at
    BEFORE UPDATE ON pipeline_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_metrics_updated_at();

-- Log stage transitions to pipeline_events
CREATE OR REPLACE FUNCTION log_pipeline_stage_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
        INSERT INTO pipeline_events (
            vendor_lead_id,
            event_type,
            from_stage,
            to_stage,
            details,
            created_by
        ) VALUES (
            NEW.id,
            'stage_transition',
            OLD.pipeline_stage,
            NEW.pipeline_stage,
            jsonb_build_object(
                'updated_fields', jsonb_build_object(
                    'updated_at', NEW.updated_at,
                    'last_contact_at', NEW.last_contact_at
                )
            ),
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_pipeline_stage_transition ON vendor_leads;
CREATE TRIGGER trigger_log_pipeline_stage_transition
    AFTER UPDATE OF pipeline_stage ON vendor_leads
    FOR EACH ROW
    WHEN (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
    EXECUTE FUNCTION log_pipeline_stage_transition();

-- ============================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active conversations view (leads currently in AI conversation)
CREATE OR REPLACE VIEW active_conversations AS
SELECT 
    vl.*,
    (SELECT COUNT(*) FROM sms_messages sm WHERE sm.vendor_lead_id = vl.id) as message_count,
    (SELECT MAX(created_at) FROM sms_messages sm WHERE sm.vendor_lead_id = vl.id AND sm.direction = 'inbound') as last_vendor_message_at,
    (SELECT MAX(created_at) FROM sms_messages sm WHERE sm.vendor_lead_id = vl.id AND sm.direction = 'outbound') as last_ai_message_at
FROM vendor_leads vl
WHERE vl.pipeline_stage = 'AI_CONVERSATION'
    AND vl.last_contact_at > NOW() - INTERVAL '48 hours';

-- Leads ready for retry view
CREATE OR REPLACE VIEW leads_ready_for_retry AS
SELECT 
    vl.*,
    vl.retry_count + 1 as next_retry_number,
    CASE 
        WHEN vl.retry_count = 0 THEN 2  -- Retry 1: 2 days
        WHEN vl.retry_count = 1 THEN 4  -- Retry 2: 4 days
        WHEN vl.retry_count = 2 THEN 7  -- Retry 3: 7 days
        ELSE NULL
    END as retry_delay_days
FROM vendor_leads vl
WHERE vl.pipeline_stage IN ('VIDEO_SENT', 'RETRY_1', 'RETRY_2')
    AND vl.next_retry_at IS NOT NULL
    AND vl.next_retry_at <= NOW()
    AND vl.retry_count < 3;

-- Pipeline conversion funnel view
CREATE OR REPLACE VIEW pipeline_funnel AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE pipeline_stage = 'NEW_LEAD') as new_leads,
    COUNT(*) FILTER (WHERE pipeline_stage = 'AI_CONVERSATION') as in_conversation,
    COUNT(*) FILTER (WHERE pipeline_stage = 'DEAL_VALIDATION') as in_validation,
    COUNT(*) FILTER (WHERE pipeline_stage = 'OFFER_MADE') as offers_made,
    COUNT(*) FILTER (WHERE pipeline_stage = 'OFFER_ACCEPTED') as offers_accepted,
    COUNT(*) FILTER (WHERE pipeline_stage = 'READY_FOR_INVESTORS') as ready_for_investors,
    COUNT(*) FILTER (WHERE pipeline_stage = 'DEAD_LEAD') as dead_leads,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE pipeline_stage IN ('OFFER_MADE', 'OFFER_ACCEPTED', 'READY_FOR_INVESTORS')) 
        / NULLIF(COUNT(*) FILTER (WHERE pipeline_stage IN ('AI_CONVERSATION', 'DEAL_VALIDATION', 'OFFER_MADE', 'OFFER_ACCEPTED', 'READY_FOR_INVESTORS')), 0),
        2
    ) as conversion_rate_percentage
FROM vendor_leads
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate motivation score from conversation data
CREATE OR REPLACE FUNCTION calculate_motivation_score(
    urgency_level VARCHAR,
    reason_for_selling TEXT,
    competing_offers BOOLEAN,
    timeline_days INTEGER
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 5; -- Base score
BEGIN
    -- Urgency scoring
    CASE urgency_level
        WHEN 'urgent' THEN score := score + 3;
        WHEN 'quick' THEN score := score + 2;
        WHEN 'moderate' THEN score := score + 1;
        ELSE score := score;
    END CASE;
    
    -- Reason for selling scoring
    IF reason_for_selling IN ('financial', 'divorce') THEN
        score := score + 3;
    ELSIF reason_for_selling IN ('relocation', 'inheritance') THEN
        score := score + 2;
    ELSIF reason_for_selling IN ('downsize') THEN
        score := score + 1;
    END IF;
    
    -- Competing offers penalty
    IF competing_offers THEN
        score := score - 2;
    END IF;
    
    -- Timeline bonus (shorter = more motivated)
    IF timeline_days IS NOT NULL THEN
        IF timeline_days <= 14 THEN
            score := score + 2;
        ELSIF timeline_days <= 30 THEN
            score := score + 1;
        END IF;
    END IF;
    
    -- Clamp between 1 and 10
    RETURN GREATEST(1, LEAST(10, score));
END;
$$ LANGUAGE plpgsql;

-- Function to get next retry delay in days
CREATE OR REPLACE FUNCTION get_retry_delay_days(retry_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    CASE retry_count
        WHEN 0 THEN RETURN 2;  -- First retry after 2 days
        WHEN 1 THEN RETURN 4;  -- Second retry after 4 days
        WHEN 2 THEN RETURN 7;  -- Third retry after 7 days
        ELSE RETURN NULL;      -- No more retries
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


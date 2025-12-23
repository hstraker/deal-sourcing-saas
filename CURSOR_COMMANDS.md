# Ready-to-Paste Cursor Commands

## Copy these commands directly into Cursor Composer (Cmd/Ctrl + I)

---

## OPTION 1: Full System Build (Recommended for First-Time)

```
I'm building an AI vendor acquisition pipeline that integrates with my existing BMV deal dashboard.

STEP 1 - Read and Understand:
Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md completely.
Then review my existing codebase: @app.py @routes/ @templates/

STEP 2 - Confirm Understanding:
After reading, confirm you understand:
1. The vendor pipeline architecture and workflow
2. My existing code structure and patterns
3. How the new system will integrate without breaking existing functionality
4. Which existing code to reuse vs rebuild

STEP 3 - Start Building:
Create the database schema first: database/vendor_schema.sql

Follow these rules:
- Match my existing SQL code style
- Include all tables from the spec (vendor_leads, sms_messages, pipeline_metrics)
- Add proper indexes and constraints
- Create update triggers

Show me the complete vendor_schema.sql file for review before moving forward.
```

---

## OPTION 2: Phase-by-Phase Build (More Control)

### Phase 1: Database Schema Only

```
Read VENDOR_PIPELINE_SPEC.md section 3 (Database Schema Extensions) and INTEGRATION_NOTES.md.

Review my existing database files to understand SQL style and patterns.

Create database/vendor_schema.sql with:
- vendor_leads table (all fields from spec)
- sms_messages table (conversation log)
- pipeline_metrics table (analytics)
- All indexes for performance
- Triggers for updated_at timestamps
- Constraints for data integrity

Follow my existing SQL code style exactly.
Show me the complete file.
```

### Phase 2: AI SMS Agent

```
Read VENDOR_PIPELINE_SPEC.md section 4 (AI SMS Conversation Module).

Review @app.py to understand how I handle database connections.

Create ai_sms_agent.py with:
- AISMSAgent class
- send_initial_message() method
- process_inbound_message() method
- extract_property_details() method
- calculate_motivation_score() method
- generate_ai_response() method using GPT-4

Use my existing database connection pattern.
Include comprehensive docstrings.
Show me the complete file.
```

### Phase 3: Deal Validator

```
Read VENDOR_PIPELINE_SPEC.md section 5 (Deal Validation Integration).

Search my codebase for existing BMV analysis code.

Create deal_validator.py that:
- REUSES my existing BMV calculation code (don't rebuild it)
- Adds validate_deal() method
- Adds calculate_profit_potential() method
- Adds get_renovation_estimate() method

Import existing BMV functions, don't duplicate them.
Show me the complete file.
```

### Phase 4: Offer Engine

```
Read VENDOR_PIPELINE_SPEC.md section 6 (Offer Management System).

Review @ai_sms_agent.py (we just created) to understand SMS sending.

Create offer_engine.py with:
- OfferEngine class
- calculate_offer() method
- send_offer() method
- handle_offer_response() method
- schedule_retry() method with progressive delays

Use the ai_sms_agent for SMS delivery.
Show me the complete file.
```

### Phase 5: Pipeline Background Service

```
Read VENDOR_PIPELINE_SPEC.md section 9 (Background Service Management).

Review @app.py to understand my database connection pattern.

Create pipeline_service.py that:
- Imports and uses existing database connection
- Imports ai_sms_agent, deal_validator, offer_engine
- Implements VendorPipelineService class
- Has run() method with main loop
- Has process_new_facebook_leads() method
- Has process_active_conversations() method
- Has process_pending_validations() method
- Has process_scheduled_retries() method
- Includes proper error handling and logging

Follow my existing code patterns.
Show me the complete file.
```

### Phase 6: Flask API Routes

```
Read VENDOR_PIPELINE_SPEC.md section 7 (Flask API Routes).

Review @routes/api_routes.py to understand my API patterns.

Create routes/vendor_api.py that:
- Follows my existing blueprint structure
- Uses my existing @require_auth decorator
- Implements all endpoints from spec:
  * GET /api/vendor/leads
  * GET /api/vendor/leads/<id>
  * GET /api/vendor/leads/<id>/conversation
  * POST /api/vendor/leads/<id>/send-message
  * POST /api/vendor/leads/<id>/update-stage
  * GET /api/vendor/stats
  * POST /api/vendor/webhook/sms
- Uses same JSON response format as my existing API
- Includes same error handling patterns

Show me the complete file.
```

### Phase 7: Dashboard UI

```
Read VENDOR_PIPELINE_SPEC.md section 8 (Dashboard UI Extensions).

Review @templates/dashboard.html to understand my template structure and styling.

Create templates/vendor_dashboard.html that:
- Extends my existing base template
- Matches my Bootstrap version
- Implements Kanban board view
- Includes stats cards
- Has lead detail modal with tabs
- Uses my existing CSS classes

Also create:
- static/css/vendor_pipeline.css (additional styles)
- static/js/vendor_dashboard.js (JavaScript functions)

Show me all three files.
```

---

## OPTION 3: Quick Start Single Command

```
Build the complete vendor acquisition pipeline from VENDOR_PIPELINE_SPEC.md.

Read both VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md.
Review my existing code: @app.py @routes/ @templates/

Create all files in order:
1. database/vendor_schema.sql
2. ai_sms_agent.py
3. deal_validator.py
4. offer_engine.py
5. pipeline_service.py
6. routes/vendor_api.py
7. templates/vendor_dashboard.html
8. static/css/vendor_pipeline.css
9. static/js/vendor_dashboard.js

Follow integration rules:
- Reuse my existing database connection
- Reuse my existing authentication
- Match my existing code style
- Don't rebuild existing BMV analysis

Create files one at a time and wait for my approval between each.
Start with database/vendor_schema.sql.
```

---

## DEBUGGING COMMANDS

### If Cursor Isn't Following Your Patterns

```
Stop. You're not following my existing patterns.

Review @app.py @INTEGRATION_NOTES.md again.

The issue is: [describe specific problem]

Fix it by: [specific instruction]
```

### If Code Doesn't Match Spec

```
This doesn't match the specification.

Read VENDOR_PIPELINE_SPEC.md section [X] again.

The spec requires: [specific requirement]

Your code has: [what's wrong]

Update to match the spec exactly.
```

### If Integration Is Broken

```
This will break integration with my existing code.

Read INTEGRATION_NOTES.md section on [topic].

You should be:
- Importing existing [component]
- Not rebuilding [component]

Fix the integration.
```

---

## TESTING COMMANDS

### Generate Tests

```
Based on VENDOR_PIPELINE_SPEC.md section 12 (Testing Requirements), create:

tests/test_pipeline.py with:
- test_facebook_lead_capture()
- test_ai_conversation_flow()
- test_deal_validation()
- test_offer_calculation()
- test_retry_mechanism()
- test_state_transitions()

Include mock objects and fixtures.
Show me the complete test file.
```

### Create Mock Data

```
Create a script: scripts/generate_mock_leads.py

This should:
- Generate 10 fake vendor leads
- Insert them into vendor_leads table
- Create fake SMS conversations
- Set various pipeline stages
- Add BMV validation data

This is for testing the dashboard UI.
Show me the script.
```

---

## DEPLOYMENT COMMANDS

### Docker Configuration

```
Read VENDOR_PIPELINE_SPEC.md and review my existing Docker setup.

Update docker-compose.yml to add:
- Pipeline service container
- Runs pipeline_service.py
- Shares database with existing Flask app
- Has access to same environment variables

Show me the updated docker-compose.yml section.
```

### Environment Variables

```
Based on VENDOR_PIPELINE_SPEC.md section 10, create .env.example showing:
- All new environment variables needed
- Facebook API credentials
- Twilio credentials
- OpenAI API key
- Pipeline configuration
- Commented with descriptions

Show me the complete .env.example additions.
```

### Requirements File

```
Based on all the code we've created, update requirements.txt with:
- All new Python dependencies
- Specific versions for compatibility
- Comments explaining what each is for

Show me what to add to requirements.txt.
```

---

## DOCUMENTATION COMMANDS

### Create README

```
Create README_VENDOR_PIPELINE.md that explains:
- What the vendor pipeline does
- How it integrates with existing dashboard
- Architecture overview
- How to run it locally
- How to deploy it
- Environment variables needed
- Troubleshooting common issues

Make it clear and comprehensive.
```

### Create API Documentation

```
Based on routes/vendor_api.py, create API_DOCUMENTATION.md with:
- All endpoints
- Request/response formats
- Authentication requirements
- Example curl commands
- Error responses

Format as clean API documentation.
```

---

## HELPER COMMANDS

### Create Checklist

```
Based on VENDOR_PIPELINE_SPEC.md, create a checklist markdown file:

VENDOR_PIPELINE_CHECKLIST.md

List:
- All files that need to be created
- All integration points to verify
- All tests to write
- All configuration to add
- Deployment steps

Format as checkboxes I can tick off.
```

### Review Integration

```
Review all the code we've created against INTEGRATION_NOTES.md.

Check:
- Are we reusing database connection? 
- Are we reusing authentication?
- Does styling match existing dashboard?
- Do API routes follow existing patterns?
- Are we importing existing code where possible?

Create a report of what matches and what needs fixing.
```

### Get File List

```
Based on VENDOR_PIPELINE_SPEC.md, list all files that should exist when complete:

Show as:
- File path
- Purpose
- Status (created/pending)
- Dependencies

This helps me track progress.
```

---

## USAGE TIPS

1. **Start with Phase 1 commands** - Build incrementally
2. **Review each file before proceeding** - Don't let Cursor create everything at once
3. **Use debugging commands** when something doesn't match your patterns
4. **Reference existing files** with @ mentions: @app.py @routes/api_routes.py
5. **Be specific** if Cursor isn't following the spec correctly

---

## CUSTOMIZATION

### If your project structure is different:

```
My project structure is different from assumptions:
- Database connection is in: [file]
- API routes are in: [location]
- Templates extend: [base file]
- CSS framework is: [framework and version]

Update your understanding and adjust the code accordingly.
```

### If you use different tech:

```
I use [different technology] instead of [assumed technology].

For example:
- SQLAlchemy instead of raw SQL
- FastAPI instead of Flask
- Vue instead of vanilla JS

Adapt the vendor pipeline code to use my stack.
```

---

## EMERGENCY RESTART

### If things go wrong:

```
Let's start over.

Delete everything we created for vendor pipeline.

Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md fresh.

Let's build incrementally, one file at a time, with my approval at each step.

Start with just the vendor_leads table schema.
```

---

## Ready to Start?

Pick **OPTION 1** (full build) or **OPTION 2** (phase-by-phase).

Copy the command into Cursor Composer (Cmd/Ctrl + I).

Press Enter and let Cursor start building!

Remember: Review each file before approving the next step.

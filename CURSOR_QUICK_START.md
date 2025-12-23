# Cursor Quick Start Guide - Vendor Pipeline Build

## Overview
This guide shows you exactly how to use the specification files to build your vendor pipeline system with Cursor AI.

---

## Files You Have

1. **VENDOR_PIPELINE_SPEC.md** - Complete technical specification (47,000 words)
2. **INTEGRATION_NOTES.md** - Integration guide with existing deal dashboard
3. **CURSOR_QUICK_START.md** - This file (instructions)

---

## Setup Steps

### Step 1: Add Spec Files to Your Project

Copy these files to your existing deal dashboard project root:

```bash
# In your project directory
/your-bmv-project/
  ├── app.py
  ├── routes/
  ├── templates/
  ├── VENDOR_PIPELINE_SPEC.md         ← Add this
  ├── INTEGRATION_NOTES.md            ← Add this
  └── CURSOR_QUICK_START.md           ← Add this (optional)
```

### Step 2: Open Project in Cursor

```bash
# Open your project in Cursor
cd /path/to/your-bmv-project
cursor .
```

---

## Using Cursor Composer (Recommended)

### Method 1: Full Build Command

Open Cursor Composer (`Cmd/Ctrl + I`) and paste:

```
I need to build an AI vendor acquisition pipeline that integrates with my existing deal dashboard.

Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md to understand:
1. The complete system architecture
2. How to integrate with existing code

Then review my existing codebase (especially app.py, routes/, templates/, database files) to understand current patterns.

Start building the system in this order:
1. Database schema (database/vendor_schema.sql)
2. AI SMS agent (ai_sms_agent.py)
3. Pipeline service (pipeline_service.py)
4. Flask API routes (routes/vendor_api.py)
5. Dashboard UI (templates/vendor_dashboard.html)

For step 1, create the database schema now. Show me the complete vendor_schema.sql file.
```

**What will happen:**
- Cursor will read both spec files
- It will analyze your existing code structure
- It will start building the database schema following your existing patterns
- You can review and approve before moving to next step

---

### Method 2: Phase-by-Phase Build

For more control, build in phases:

#### Phase 1: Database Schema

```
Read VENDOR_PIPELINE_SPEC.md section 3 (Database Schema Extensions) and INTEGRATION_NOTES.md.

Review my existing database schema files to understand naming conventions and patterns.

Create database/vendor_schema.sql with:
- vendor_leads table
- sms_messages table  
- pipeline_metrics table
- All indexes and triggers

Follow my existing SQL code style.
```

#### Phase 2: AI SMS Agent

```
Read VENDOR_PIPELINE_SPEC.md section 4 (AI SMS Conversation Module).

Review my existing API integrations to understand how I handle external services.

Create ai_sms_agent.py with:
- AISMSAgent class
- GPT-4 conversation logic
- Twilio SMS integration
- Motivation scoring

Use the same error handling patterns as my existing code.
```

#### Phase 3: Pipeline Service

```
Read VENDOR_PIPELINE_SPEC.md section 9 (Background Service Management).

Review @app.py to understand how I connect to the database.

Create pipeline_service.py that:
- Reuses my existing database connection
- Runs as background service
- Processes the vendor workflow
- Handles all state transitions

Import database connection from my existing code, don't rebuild it.
```

#### Phase 4: API Routes

```
Read VENDOR_PIPELINE_SPEC.md section 7 (Flask API Routes) and INTEGRATION_NOTES.md.

Review @routes/api_routes.py to understand my API patterns.

Create routes/vendor_api.py following my existing patterns:
- Same blueprint structure
- Same JSON response format
- Same authentication decorators
- Same error handling

Add all vendor endpoints specified in the spec.
```

#### Phase 5: Dashboard UI

```
Read VENDOR_PIPELINE_SPEC.md section 8 (Dashboard UI Extensions).

Review @templates/dashboard.html to understand my UI structure and styling.

Create templates/vendor_dashboard.html that:
- Extends my existing base template
- Matches my existing Bootstrap version and styling
- Implements the Kanban board view
- Includes lead detail modal
- Uses my existing CSS classes

Also create static/css/vendor_pipeline.css and static/js/vendor_dashboard.js.
```

---

## Using Cursor Chat (Alternative)

If you prefer chat over Composer:

### Step 1: Reference the Spec
```
@VENDOR_PIPELINE_SPEC.md 

I want to build the vendor pipeline system described in this spec. Let's start with the database schema. Read section 3 and create vendor_schema.sql.
```

### Step 2: Reference Existing Code
```
@app.py @INTEGRATION_NOTES.md

Now create ai_sms_agent.py but reuse the database connection pattern from app.py as described in the integration notes.
```

---

## Best Practices

### ✅ DO

1. **Let Cursor Read the Specs First**
   ```
   Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md first
   ```
   This gives it full context before building.

2. **Reference Existing Files**
   ```
   Review @app.py to understand patterns
   ```
   This ensures consistency.

3. **Build Incrementally**
   - One file at a time
   - Test each component
   - Review before moving forward

4. **Use @ Mentions**
   ```
   @app.py @routes/api_routes.py @INTEGRATION_NOTES.md
   ```
   This gives Cursor specific context.

5. **Ask for Explanations**
   ```
   Explain how this integrates with my existing code
   ```

### ❌ DON'T

1. **Don't paste the entire spec into chat**
   - Use file references instead
   - Cursor can read files more efficiently

2. **Don't let Cursor build everything at once**
   - You'll lose control
   - Hard to review
   - May miss integration issues

3. **Don't skip the integration notes**
   - Critical for matching existing patterns
   - Prevents rebuilding existing functionality

---

## Example Conversation Flow

Here's a complete example of how to use Cursor Composer:

### Initial Command
```
I'm building an AI vendor acquisition pipeline. 

Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md.

Then review my existing codebase (app.py, routes/, templates/).

Confirm you understand:
1. The vendor pipeline architecture
2. My existing code structure
3. How the new system will integrate

Then create the database schema (database/vendor_schema.sql).
```

### After Schema Created
```
Good! Now create ai_sms_agent.py that:
- Imports database connection from my existing code
- Follows the spec in VENDOR_PIPELINE_SPEC.md section 4
- Uses environment variables like my existing code

Show me the complete file.
```

### After AI Agent Created
```
Perfect! Now create the pipeline_service.py background service.

Reference @app.py to understand my database connection pattern.
Follow VENDOR_PIPELINE_SPEC.md section 9.

Make sure it:
- Imports the ai_sms_agent we just created
- Reuses my database connection
- Handles errors like my existing code
```

### Continue Pattern
Keep going through each component, always referencing the spec and your existing code.

---

## Debugging Integration Issues

### If Cursor Rebuilds Existing Code

```
Stop. Don't rebuild the database connection.

Reference @app.py and @INTEGRATION_NOTES.md.

Import the existing get_db_connection() function instead.
```

### If Styling Doesn't Match

```
The styling needs to match my existing dashboard.

Review @templates/dashboard.html and @static/css/

Use the same Bootstrap classes and color scheme.
```

### If Routes Don't Follow Pattern

```
These routes don't match my existing API pattern.

Reference @routes/api_routes.py and @INTEGRATION_NOTES.md.

Update to follow the same structure.
```

---

## Testing Each Component

After each file is created:

### Test Database Schema
```
Review the vendor_schema.sql file. Does it:
- Follow my existing SQL style?
- Include all necessary indexes?
- Have proper foreign keys?

If yes, I'll run it on my database.
```

### Test Python Modules
```
Test the ai_sms_agent.py by creating a simple test:

Create tests/test_ai_agent.py that verifies:
- It can initialize with my database connection
- The motivation scoring function works
- SMS sending is mocked properly
```

### Test Integration
```
Now test that pipeline_service.py can:
- Import ai_sms_agent successfully
- Connect to my database
- Run the main loop without errors

Create a simple smoke test.
```

---

## Monitoring Progress

### Create a Checklist

```
Based on VENDOR_PIPELINE_SPEC.md, create a checklist of all files I need.

Show me:
- File name
- Description
- Status (not started, in progress, complete)

I'll track progress as we build.
```

### Track Integration

```
Based on INTEGRATION_NOTES.md, create a checklist of integration points:

- [ ] Database schema added to existing DB
- [ ] Imports existing database connection
- [ ] Reuses existing authentication
- [ ] Extends existing dashboard template
- [ ] Follows existing API patterns

I'll verify each as we go.
```

---

## Common Cursor Commands

### Read Multiple Files
```
Read VENDOR_PIPELINE_SPEC.md and INTEGRATION_NOTES.md and @app.py
```

### Reference Specific Section
```
Read VENDOR_PIPELINE_SPEC.md section 4 (AI SMS Conversation Module)
```

### Compare Patterns
```
Compare my existing @routes/api_routes.py with the API routes specified in VENDOR_PIPELINE_SPEC.md section 7. Create vendor_api.py following my existing pattern.
```

### Get Explanation
```
Explain how the pipeline_service.py will integrate with my existing Flask app based on INTEGRATION_NOTES.md
```

---

## Time Estimates

Building incrementally in Cursor:

- **Database Schema**: 15-30 minutes
- **AI SMS Agent**: 1-2 hours
- **Pipeline Service**: 1-2 hours  
- **API Routes**: 1-2 hours
- **Dashboard UI**: 2-3 hours
- **Testing & Debugging**: 2-4 hours

**Total**: 8-14 hours of focused work with Cursor

---

## Troubleshooting

### Cursor Can't Find Spec File

Make sure file is in project root:
```bash
ls -la VENDOR_PIPELINE_SPEC.md
```

Try absolute reference:
```
Read /full/path/to/VENDOR_PIPELINE_SPEC.md
```

### Cursor Isn't Following Patterns

Be more explicit:
```
You're not following my existing pattern. 

Look at @app.py lines 50-75 where I define database connection.
Use EXACTLY that pattern in pipeline_service.py.
```

### Cursor Is Overwhelming You

Slow down:
```
Stop. Let's just focus on one function at a time.

Create just the send_initial_message() function from ai_sms_agent.py.
Show me that first.
```

---

## Advanced Tips

### Create Template Functions

```
Before building the full pipeline_service.py, create a template with just the function signatures:

class VendorPipelineService:
    def __init__(self): pass
    def run(self): pass
    def process_new_facebook_leads(self): pass
    # etc.

I'll review the structure first.
```

### Generate Tests First

```
Based on VENDOR_PIPELINE_SPEC.md section 12, create test_pipeline.py with all test functions (empty for now).

This will help me understand what we're building.
```

### Ask for Documentation

```
Create a README.md for the vendor pipeline that explains:
- What it does
- How it integrates with existing dashboard
- How to run it
- Environment variables needed
```

---

## Final Checklist

Before considering the build complete:

- [ ] All files from VENDOR_PIPELINE_SPEC.md created
- [ ] All integration points from INTEGRATION_NOTES.md addressed
- [ ] Database schema successfully migrated
- [ ] All Python modules import successfully
- [ ] Flask app starts without errors
- [ ] Background service runs without errors
- [ ] Dashboard UI renders correctly
- [ ] API endpoints respond correctly
- [ ] Tests pass
- [ ] Environment variables configured
- [ ] Docker configuration updated (if applicable)

---

## Getting Help

If stuck, ask Cursor:

```
I'm stuck on [specific issue].

Reference:
- VENDOR_PIPELINE_SPEC.md section [X]
- INTEGRATION_NOTES.md
- My existing code @[filename]

What's the correct approach based on my existing patterns?
```

---

## Next Steps After Build

Once vendor pipeline is built:

1. **Test with Mock Data**
   ```
   Create a script to generate mock Facebook leads for testing
   ```

2. **Integration Testing**
   ```
   Based on INTEGRATION_NOTES.md, run through the integration checklist
   ```

3. **Deploy to Development**
   ```
   Update Docker Compose / deployment config to include pipeline service
   ```

4. **Monitor in Production**
   ```
   Set up logging and monitoring as specified in VENDOR_PIPELINE_SPEC.md section 11
   ```

---

## Pro Tips

🎯 **Use Composer for big builds, Chat for quick fixes**

🎯 **Always read specs before building**

🎯 **Reference existing code constantly**

🎯 **Build and test incrementally**

🎯 **Don't let Cursor create 10 files at once**

🎯 **Review every file before moving forward**

---

## Success Criteria

You'll know the build is successful when:

✅ Pipeline service runs continuously
✅ Facebook leads are captured automatically
✅ AI SMS conversations work naturally
✅ Deal validation integrates with existing BMV analysis
✅ Dashboard shows vendor leads in clean UI
✅ API endpoints return data correctly
✅ No conflicts with existing deal dashboard
✅ All code follows existing patterns

---

## Remember

The specs are comprehensive, but **you don't need to build everything at once**. Start with the database schema, validate it works, then move to the next component. Cursor works best when given clear, incremental instructions with specific file references.

Good luck! 🚀

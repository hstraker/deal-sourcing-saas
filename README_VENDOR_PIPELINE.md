# Vendor Pipeline - Quick Start

## 🚀 Quick Test (No Twilio Required!)

You can test the AI conversation system right now with just your AI API key (OpenAI or Anthropic Claude):

### 1. Set AI API Key

Add to `.env` (choose ONE):

**Option A: Anthropic Claude** (recommended):
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Option B: OpenAI**:
```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

### 2. Run the Test Script

```bash
tsx scripts/test-ai-conversation.ts
```

This will:
- Create a test vendor lead
- Send an initial AI message
- Simulate a conversation
- Show you the results

### 3. View the Results

The script will show:
- All messages in the conversation
- The extracted property details
- The motivation score
- The final pipeline stage

## 📋 What's Implemented

✅ Database schema with all vendor pipeline tables  
✅ Mock Twilio service (no credentials needed for testing)  
✅ AI SMS agent with OpenAI GPT-4 or Anthropic Claude integration  
✅ Deal validation system  
✅ Offer calculation engine  
✅ Pipeline service orchestrator  
✅ API routes for leads, stats, and testing  
✅ Test scripts and endpoints  

## 🔄 Testing the Full Flow

See `VENDOR_PIPELINE_TESTING.md` for detailed testing instructions.

## 📚 Documentation

- `VENDOR_PIPELINE_SETUP.md` - Complete setup guide
- `VENDOR_PIPELINE_TESTING.md` - Testing guide
- `VENDOR_PIPELINE_IMPLEMENTATION.md` - Implementation details
- `VENDOR_PIPELINE_SPEC.md` - Original specification
- `ANTHROPIC_SETUP.md` - Anthropic Claude setup guide

## ⚠️ Note

The system automatically uses a **mock Twilio service** when Twilio credentials are not configured. This means you can test everything except actual SMS delivery. When you're ready for production, just add your Twilio credentials to `.env`.


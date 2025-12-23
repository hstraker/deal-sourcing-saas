# Quick Test Guide

## ✅ Package Installed

The `@anthropic-ai/sdk` package is now installed. You're ready to test!

## Test with Anthropic Claude

1. **Add your Anthropic API key to `.env`:**

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

2. **Run the test script:**

```bash
npx tsx scripts/test-ai-conversation.ts
```

You should see:
- `[AI Provider] Using anthropic with model claude-3-5-sonnet-20241022`
- Test lead creation
- AI conversation simulation
- Final results

## What to Expect

The script will:
1. Create a test vendor lead
2. Send an initial AI message (via Claude)
3. Simulate 4 vendor responses
4. Show the conversation history
5. Display extracted data and motivation score

## Troubleshooting

If you get errors:
- Make sure `ANTHROPIC_API_KEY` is set correctly
- Check the API key format (should start with `sk-ant-`)
- Verify you have API credits in your Anthropic account

## Alternative: Use OpenAI

If you prefer OpenAI (already installed):

```bash
OPENAI_API_KEY=sk-your-key
```

The system will automatically detect and use OpenAI if Anthropic is not configured.


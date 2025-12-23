# Anthropic Claude Setup Guide

## ✅ Configuration Complete!

The vendor pipeline now supports **both OpenAI and Anthropic Claude**. You can use your Anthropic API key instead of OpenAI.

## Quick Setup

### 1. Add Your Anthropic API Key

Add to your `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Optional: Explicitly set provider (if you have both keys)
AI_PROVIDER=anthropic
```

### 2. That's It!

The system will automatically detect and use Anthropic when:
- `ANTHROPIC_API_KEY` is set
- `AI_PROVIDER=anthropic` is set, OR
- `OPENAI_API_KEY` is not set

## Available Claude Models

- `claude-3-5-sonnet-20241022` (default, recommended)
- `claude-3-5-haiku-20241022` (faster, cheaper)
- `claude-3-opus-20240229` (most capable)

Set via `ANTHROPIC_MODEL` environment variable.

## Testing

Run the test script with your Anthropic key:

```bash
tsx scripts/test-ai-conversation.ts
```

You should see:
```
[AI Provider] Using anthropic with model claude-3-5-sonnet-20241022
```

## How It Works

The system uses an abstraction layer (`ai-provider.ts`) that:
- Automatically detects which provider to use
- Handles differences between OpenAI and Anthropic APIs
- Formats responses consistently
- Supports JSON mode for structured responses

## Switching Between Providers

To switch back to OpenAI:
```bash
OPENAI_API_KEY=sk-your-key
AI_PROVIDER=openai  # or remove ANTHROPIC_API_KEY
```

To use Anthropic:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key
AI_PROVIDER=anthropic  # optional, auto-detected
```

## Differences

Both providers work identically from the vendor pipeline's perspective. The main differences are:
- Anthropic requires a system prompt to be passed separately
- JSON parsing may differ slightly (handled automatically)
- Token usage is tracked for both

## Cost Considerations

- **Claude 3.5 Sonnet**: More expensive but very capable
- **Claude 3.5 Haiku**: Faster and cheaper, good for SMS conversations
- **GPT-4 Turbo**: Competitive pricing with OpenAI

For SMS conversations, Claude 3.5 Haiku is a great balance of quality and cost.


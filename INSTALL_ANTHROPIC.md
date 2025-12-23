# Installing Anthropic SDK

If you want to use Anthropic Claude instead of OpenAI, you need to install the SDK:

## Installation

```bash
npm install @anthropic-ai/sdk
```

## Verify Installation

```bash
npm list @anthropic-ai/sdk
```

You should see the package listed. If it's not installed, the code will give you a clear error message when you try to use Anthropic.

## Alternative: Use OpenAI

If you prefer to use OpenAI (which is already installed), just set:

```bash
OPENAI_API_KEY=sk-your-key
```

The system will automatically use OpenAI if Anthropic is not available or not configured.


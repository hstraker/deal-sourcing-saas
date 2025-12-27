/**
 * API Route: GET /api/vendor-pipeline/rate-limits
 * Get current rate limit status and historical usage
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    console.log(`[Rate Limits API] Request received at ${new Date().toISOString()}`)

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !["admin", "sourcer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Make a live API call to Claude to get current rate limits
    let liveRateLimitInfo: any = null
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (anthropicKey) {
      try {
        // Use fetch directly to access response headers
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          }),
        })

        // Extract rate limit headers
        const inputTokensLimit = parseInt(apiResponse.headers.get('anthropic-ratelimit-input-tokens-limit') || '0')
        const inputTokensRemaining = parseInt(apiResponse.headers.get('anthropic-ratelimit-input-tokens-remaining') || '0')
        const outputTokensLimit = parseInt(apiResponse.headers.get('anthropic-ratelimit-output-tokens-limit') || '0')
        const outputTokensRemaining = parseInt(apiResponse.headers.get('anthropic-ratelimit-output-tokens-remaining') || '0')
        const requestsLimit = parseInt(apiResponse.headers.get('anthropic-ratelimit-requests-limit') || '0')
        const requestsRemaining = parseInt(apiResponse.headers.get('anthropic-ratelimit-requests-remaining') || '0')
        const inputTokensReset = apiResponse.headers.get('anthropic-ratelimit-input-tokens-reset') || ''
        const outputTokensReset = apiResponse.headers.get('anthropic-ratelimit-output-tokens-reset') || ''
        const requestsReset = apiResponse.headers.get('anthropic-ratelimit-requests-reset') || ''

        liveRateLimitInfo = {
          inputTokensRemaining,
          inputTokensLimit,
          inputTokensUsagePercent: inputTokensLimit > 0
            ? ((inputTokensLimit - inputTokensRemaining) / inputTokensLimit) * 100
            : 0,
          outputTokensRemaining,
          outputTokensLimit,
          outputTokensUsagePercent: outputTokensLimit > 0
            ? ((outputTokensLimit - outputTokensRemaining) / outputTokensLimit) * 100
            : 0,
          requestsRemaining,
          requestsLimit,
          requestsUsagePercent: requestsLimit > 0
            ? ((requestsLimit - requestsRemaining) / requestsLimit) * 100
            : 0,
          inputTokensReset,
          outputTokensReset,
          requestsReset,
        }

        console.log('[Rate Limits API] Live rate limits fetched:', liveRateLimitInfo)
        console.log('[Rate Limits API] Raw headers:', {
          'input-tokens-limit': apiResponse.headers.get('anthropic-ratelimit-input-tokens-limit'),
          'input-tokens-remaining': apiResponse.headers.get('anthropic-ratelimit-input-tokens-remaining'),
          'output-tokens-limit': apiResponse.headers.get('anthropic-ratelimit-output-tokens-limit'),
          'output-tokens-remaining': apiResponse.headers.get('anthropic-ratelimit-output-tokens-remaining'),
          'requests-limit': apiResponse.headers.get('anthropic-ratelimit-requests-limit'),
          'requests-remaining': apiResponse.headers.get('anthropic-ratelimit-requests-remaining'),
        })
      } catch (error: any) {
        console.error('[Rate Limits API] Error fetching live rate limits:', error.message)
        // Continue with historical data if live fetch fails
      }
    }

    // Get recent SMS messages with rate limit info
    const recentMessages = await prisma.sMSMessage.findMany({
      where: {
        aiGenerated: true,
        aiResponseMetadata: {
          not: { equals: null } as any,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Last 100 AI-generated messages
      select: {
        id: true,
        createdAt: true,
        aiResponseMetadata: true,
      },
    })

    // Extract rate limit data
    const rateLimitHistory: Array<{
      timestamp: Date
      inputTokensRemaining: number
      inputTokensLimit: number
      outputTokensRemaining: number
      outputTokensLimit: number
      requestsRemaining: number
      requestsLimit: number
      tokensUsed: number
    }> = []

    let latestRateLimitInfo: any = null

    for (const msg of recentMessages) {
      const metadata = msg.aiResponseMetadata as any
      if (metadata?.rateLimitInfo) {
        const info = metadata.rateLimitInfo

        rateLimitHistory.push({
          timestamp: msg.createdAt,
          inputTokensRemaining: info.inputTokensRemaining || 0,
          inputTokensLimit: info.inputTokensLimit || 0,
          outputTokensRemaining: info.outputTokensRemaining || 0,
          outputTokensLimit: info.outputTokensLimit || 0,
          requestsRemaining: info.requestsRemaining || 0,
          requestsLimit: info.requestsLimit || 0,
          tokensUsed: metadata.tokens || 0,
        })

        if (!latestRateLimitInfo) {
          latestRateLimitInfo = {
            inputTokensRemaining: info.inputTokensRemaining || 0,
            inputTokensLimit: info.inputTokensLimit || 0,
            inputTokensUsagePercent: info.inputTokensLimit
              ? ((info.inputTokensLimit - info.inputTokensRemaining) / info.inputTokensLimit) * 100
              : 0,
            outputTokensRemaining: info.outputTokensRemaining || 0,
            outputTokensLimit: info.outputTokensLimit || 0,
            outputTokensUsagePercent: info.outputTokensLimit
              ? ((info.outputTokensLimit - info.outputTokensRemaining) / info.outputTokensLimit) * 100
              : 0,
            requestsRemaining: info.requestsRemaining || 0,
            requestsLimit: info.requestsLimit || 0,
            requestsUsagePercent: info.requestsLimit
              ? ((info.requestsLimit - info.requestsRemaining) / info.requestsLimit) * 100
              : 0,
            inputTokensReset: info.inputTokensReset,
            outputTokensReset: info.outputTokensReset,
            requestsReset: info.requestsReset,
          }
        }
      }
    }

    // Calculate aggregate stats
    const totalTokensUsed = rateLimitHistory.reduce((sum, item) => sum + item.tokensUsed, 0)
    const avgTokensPerMessage =
      rateLimitHistory.length > 0 ? totalTokensUsed / rateLimitHistory.length : 0

    // Calculate cost based on Claude API pricing
    // Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
    // Claude 3.5 Haiku: $1/MTok input, $5/MTok output
    // Assuming mixed usage, use average pricing
    let totalInputTokensUsed = 0
    let totalOutputTokensUsed = 0

    for (const msg of recentMessages) {
      const metadata = msg.aiResponseMetadata as any
      if (metadata?.usage) {
        totalInputTokensUsed += metadata.usage.input_tokens || 0
        totalOutputTokensUsed += metadata.usage.output_tokens || 0
      }
    }

    // Cost calculation (using Sonnet pricing as baseline)
    const inputCostPerMillion = 3.0  // $3 per 1M input tokens
    const outputCostPerMillion = 15.0 // $15 per 1M output tokens

    const estimatedInputCost = (totalInputTokensUsed / 1000000) * inputCostPerMillion
    const estimatedOutputCost = (totalOutputTokensUsed / 1000000) * outputCostPerMillion
    const totalEstimatedCost = estimatedInputCost + estimatedOutputCost

    // Get total AI messages count
    const totalAIMessages = await prisma.sMSMessage.count({
      where: {
        aiGenerated: true,
      },
    })

    // Prefer live rate limit info over historical
    const currentRateLimits = liveRateLimitInfo || latestRateLimitInfo || {
      inputTokensRemaining: 0,
      inputTokensLimit: 0,
      inputTokensUsagePercent: 0,
      outputTokensRemaining: 0,
      outputTokensLimit: 0,
      outputTokensUsagePercent: 0,
      requestsRemaining: 0,
      requestsLimit: 0,
      requestsUsagePercent: 0,
    }

    const responseData = {
      current: currentRateLimits,
      history: rateLimitHistory.slice(0, 50), // Return last 50 for charting
      stats: {
        totalAIMessages,
        totalTokensUsed,
        totalInputTokensUsed,
        totalOutputTokensUsed,
        avgTokensPerMessage: Math.round(avgTokensPerMessage),
        recentMessagesAnalyzed: rateLimitHistory.length,
        // Cost estimates (based on recent messages analyzed)
        estimatedCost: {
          input: estimatedInputCost,
          output: estimatedOutputCost,
          total: totalEstimatedCost,
        },
      },
    }

    console.log(`[Rate Limits API] Returning data:`, {
      inputTokensRemaining: currentRateLimits.inputTokensRemaining,
      useLiveData: !!liveRateLimitInfo,
      estimatedCost: totalEstimatedCost.toFixed(4),
      messagesAnalyzed: rateLimitHistory.length
    })

    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error("[Rate Limits API] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

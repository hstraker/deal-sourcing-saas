/**
 * AI Provider Abstraction
 * Supports both OpenAI and Anthropic Claude
 */

import OpenAI from "openai"

// Import Anthropic - now installed in package.json
import Anthropic from "@anthropic-ai/sdk"

export type AIProvider = "openai" | "anthropic"

export interface AIChatCompletion {
  message: string
  tokens?: number
  model?: string
  rateLimitInfo?: {
    inputTokensLimit: number
    inputTokensRemaining: number
    inputTokensReset: string
    outputTokensLimit: number
    outputTokensRemaining: number
    outputTokensReset: string
    requestsLimit: number
    requestsRemaining: number
    requestsReset: string
  }
}

export class AIProviderService {
  private provider: AIProvider
  private openai?: OpenAI
  private anthropic?: Anthropic
  private model: string

  constructor() {
    // Determine which provider to use
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const providerSetting = process.env.AI_PROVIDER as AIProvider

    if (providerSetting === "anthropic" || (!openaiKey && anthropicKey)) {
      this.provider = "anthropic"
      if (!anthropicKey) {
        throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY")
      }
      this.anthropic = new Anthropic({ apiKey: anthropicKey })
      this.model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022"
    } else {
      this.provider = "openai"
      if (!openaiKey) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY")
      }
      this.openai = new OpenAI({ apiKey: openaiKey })
      this.model = process.env.OPENAI_MODEL || "gpt-4-turbo-preview"
    }

    console.log(`[AI Provider] Using ${this.provider} with model ${this.model}`)
  }

  /**
   * Generate chat completion (works with both providers)
   */
  async chat(messages: Array<{ role: "user" | "assistant" | "system"; content: string }>, systemPrompt: string, responseFormat?: { type: "json_object" }): Promise<AIChatCompletion> {
    if (this.provider === "anthropic") {
      return this.chatAnthropic(messages, systemPrompt, responseFormat)
    } else {
      return this.chatOpenAI(messages, systemPrompt, responseFormat)
    }
  }

  /**
   * OpenAI chat completion
   */
  private async chatOpenAI(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    systemPrompt: string,
    responseFormat?: { type: "json_object" }
  ): Promise<AIChatCompletion> {
    if (!this.openai) throw new Error("OpenAI client not initialized")

    // Filter out system messages and prepend system prompt
    const filteredMessages = messages
      .filter(msg => msg.role !== "system")
      .map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...filteredMessages,
      ],
      temperature: 0.7,
      max_tokens: 200,
      ...(responseFormat && { response_format: responseFormat }),
    })

    const content = completion.choices[0]?.message?.content || ""
    
    return {
      message: content,
      tokens: completion.usage?.total_tokens,
      model: this.model,
    }
  }

  /**
   * Anthropic Claude chat completion with rate limit tracking and retry logic
   */
  private async chatAnthropic(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    systemPrompt: string,
    responseFormat?: { type: "json_object" },
    retryCount = 0
  ): Promise<AIChatCompletion> {
    if (!this.anthropic) throw new Error("Anthropic client not initialized")

    // Convert messages to Anthropic format
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = []

    for (const msg of messages) {
      if (msg.role === "system") continue
      anthropicMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })
    }

    // For JSON response format, add instruction to system prompt
    const finalSystemPrompt = responseFormat?.type === "json_object"
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text outside the JSON object.`
      : systemPrompt

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 250, // Reduced from 500 - SMS should be short
        system: finalSystemPrompt,
        messages: anthropicMessages,
      })

      const content = response.content[0]?.type === "text"
        ? response.content[0].text
        : ""

      // If JSON format requested, try to extract JSON from response
      let jsonContent = content
      if (responseFormat?.type === "json_object") {
        // Try to extract JSON if Claude wrapped it in markdown
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1] || jsonMatch[0]
        }
      }

      // Extract rate limit info from response headers (if available in raw response)
      const rateLimitInfo = this.extractRateLimitInfo(response as any)

      return {
        message: jsonContent || content,
        tokens: response.usage.input_tokens + response.usage.output_tokens,
        model: this.model,
        rateLimitInfo,
      }
    } catch (error: any) {
      // Handle rate limit errors with automatic retry
      if (error.status === 429 && retryCount < 3) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60')
        console.warn(`[AI Provider] Rate limit hit. Retrying in ${retryAfter}s (attempt ${retryCount + 1}/3)`)

        // Wait for the specified time
        await this.sleep(retryAfter * 1000)

        // Retry the request
        return this.chatAnthropic(messages, systemPrompt, responseFormat, retryCount + 1)
      }

      // Re-throw other errors or if max retries reached
      throw error
    }
  }

  /**
   * Extract rate limit information from Anthropic response headers
   */
  private extractRateLimitInfo(response: any): AIChatCompletion["rateLimitInfo"] {
    try {
      // Anthropic returns rate limit info in response headers
      const headers = response._headers || response.headers || {}

      return {
        inputTokensLimit: parseInt(headers['anthropic-ratelimit-input-tokens-limit'] || '0'),
        inputTokensRemaining: parseInt(headers['anthropic-ratelimit-input-tokens-remaining'] || '0'),
        inputTokensReset: headers['anthropic-ratelimit-input-tokens-reset'] || '',
        outputTokensLimit: parseInt(headers['anthropic-ratelimit-output-tokens-limit'] || '0'),
        outputTokensRemaining: parseInt(headers['anthropic-ratelimit-output-tokens-remaining'] || '0'),
        outputTokensReset: headers['anthropic-ratelimit-output-tokens-reset'] || '',
        requestsLimit: parseInt(headers['anthropic-ratelimit-requests-limit'] || '0'),
        requestsRemaining: parseInt(headers['anthropic-ratelimit-requests-remaining'] || '0'),
        requestsReset: headers['anthropic-ratelimit-requests-reset'] || '',
      }
    } catch (error) {
      console.warn('[AI Provider] Could not extract rate limit info:', error)
      return undefined
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getProvider(): AIProvider {
    return this.provider
  }

  getModel(): string {
    return this.model
  }
}


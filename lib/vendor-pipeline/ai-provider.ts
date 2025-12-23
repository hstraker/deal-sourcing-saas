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
      this.model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022"
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
   * Anthropic Claude chat completion
   */
  private async chatAnthropic(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    systemPrompt: string,
    responseFormat?: { type: "json_object" }
  ): Promise<AIChatCompletion> {
    if (!this.anthropic) throw new Error("Anthropic client not initialized")

    // Convert messages to Anthropic format
    // Anthropic uses a different message format
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

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 500,
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

    return {
      message: jsonContent || content,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
      model: this.model,
    }
  }

  getProvider(): AIProvider {
    return this.provider
  }

  getModel(): string {
    return this.model
  }
}


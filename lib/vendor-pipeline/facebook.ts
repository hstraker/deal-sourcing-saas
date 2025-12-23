/**
 * Facebook Lead Ads Integration
 * Fetches new leads from Facebook Lead Ads API
 */

import { FacebookLeadData, FacebookLeadParsed } from "@/types/vendor-pipeline"

export class FacebookLeadAdsService {
  private accessToken: string
  private baseUrl = "https://graph.facebook.com/v18.0"

  constructor() {
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN || ""
    if (!this.accessToken) {
      throw new Error("Facebook access token not configured. Set FACEBOOK_ACCESS_TOKEN")
    }
  }

  /**
   * Fetch new leads from Facebook Lead Ads
   * @param leadFormId - Facebook Lead Form ID (optional, will use env var if not provided)
   * @param since - Only fetch leads created after this timestamp
   */
  async fetchNewLeads(
    leadFormId?: string,
    since?: Date
  ): Promise<FacebookLeadParsed[]> {
    try {
      const formId = leadFormId || process.env.FACEBOOK_LEAD_FORM_ID
      if (!formId) {
        throw new Error("Facebook Lead Form ID not configured")
      }

      let url = `${this.baseUrl}/${formId}/leads?access_token=${this.accessToken}`
      
      if (since) {
        // Facebook expects Unix timestamp
        const sinceTimestamp = Math.floor(since.getTime() / 1000)
        url += `&since=${sinceTimestamp}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Facebook API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const leads: FacebookLeadData[] = data.data || []

      return leads.map(lead => this.parseLead(lead))
    } catch (error: any) {
      console.error("Error fetching Facebook leads:", error)
      throw error
    }
  }

  /**
   * Fetch a specific lead by ID
   */
  async fetchLead(leadId: string): Promise<FacebookLeadParsed | null> {
    try {
      const url = `${this.baseUrl}/${leadId}?access_token=${this.accessToken}&fields=id,created_time,field_data`
      
      const response = await fetch(url)
      if (!response.ok) {
        return null
      }

      const lead: FacebookLeadData = await response.json()
      return this.parseLead(lead)
    } catch (error) {
      console.error("Error fetching Facebook lead:", error)
      return null
    }
  }

  /**
   * Parse Facebook lead data into our format
   */
  private parseLead(lead: FacebookLeadData): FacebookLeadParsed {
    const fieldMap: Record<string, string> = {}
    
    // Extract field data
    if (lead.field_data) {
      lead.field_data.forEach(field => {
        fieldMap[field.name.toLowerCase()] = field.values[0] || ""
      })
    }

    // Map common field names
    const vendorName = 
      fieldMap["full_name"] || 
      fieldMap["first_name"] + " " + fieldMap["last_name"] || 
      fieldMap["name"] || 
      "Unknown"

    const vendorPhone = 
      fieldMap["phone_number"] || 
      fieldMap["phone"] || 
      fieldMap["mobile"] || 
      ""

    const vendorEmail = 
      fieldMap["email"] || 
      fieldMap["email_address"] || 
      undefined

    const propertyAddress = 
      fieldMap["property_address"] || 
      fieldMap["address"] || 
      undefined

    // Try to extract asking price
    let askingPrice: number | undefined
    const priceStr = 
      fieldMap["asking_price"] || 
      fieldMap["price"] || 
      fieldMap["property_price"]
    
    if (priceStr) {
      // Remove currency symbols and commas, parse as number
      const cleaned = priceStr.replace(/[£$,]/g, "")
      askingPrice = parseFloat(cleaned)
      if (isNaN(askingPrice)) {
        askingPrice = undefined
      }
    }

    return {
      facebookLeadId: lead.id,
      vendorName: vendorName.trim(),
      vendorPhone: vendorPhone.trim(),
      vendorEmail: vendorEmail?.trim(),
      propertyAddress: propertyAddress?.trim(),
      askingPrice,
      campaignId: fieldMap["ad_id"] || undefined,
      formId: fieldMap["form_id"] || undefined,
      pageId: fieldMap["page_id"] || undefined,
    }
  }

  /**
   * Test Facebook API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/me?access_token=${this.accessToken}`
      const response = await fetch(url)
      return response.ok
    } catch (error) {
      console.error("Facebook connection test failed:", error)
      return false
    }
  }
}

export const facebookLeadAdsService = new FacebookLeadAdsService()


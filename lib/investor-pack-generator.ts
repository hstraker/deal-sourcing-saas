/**
 * Investor Pack PDF Generator V2
 * Marketing-focused, visually stunning PDFs for property investment deals
 * Redesigned for maximum sales impact and clarity
 */

import { prisma } from "@/lib/db"
import puppeteer from "puppeteer"
import { calculateStampDuty } from "./calculations/deal-metrics"

interface InvestorPackData {
  deal: any
  photos: any[]
  comparables: any[]
  companyInfo: {
    name: string
    phone: string
    email: string
    website: string
  }
}

// Sample property placeholder images (professional stock photos)
const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80", // Modern house exterior
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80", // Luxury living room
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80", // Modern kitchen
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80", // Elegant bedroom
]

/**
 * Calculate metrics consistently across the platform
 */
function calculateMetrics(deal: any) {
  const askingPrice = Number(deal.askingPrice) || 0
  const marketValue = Number(deal.marketValue) || Number(deal.estimatedMarketValue) || 0
  const refurbCost = Number(deal.estimatedRefurbCost) || 0
  const monthlyRent = Number(deal.estimatedMonthlyRent) || 0
  const annualRent = monthlyRent * 12

  // BMV Calculation - CONSISTENT FORMULA
  const bmvPercentage = marketValue > 0 ? ((marketValue - askingPrice) / marketValue) * 100 : 0
  const profitPotential = marketValue - askingPrice

  // Total Investment
  const stampDuty = calculateStampDuty(askingPrice)
  const legalFees = 1500
  const totalInvestment = askingPrice + refurbCost + stampDuty + legalFees

  // Gross Yield - Annual rent / Purchase price
  const grossYield = askingPrice > 0 ? (annualRent / askingPrice) * 100 : 0

  // Net Yield - After 15% costs
  const netYield = grossYield * 0.85

  // ROI - Profit / Total Investment
  const roi = totalInvestment > 0 ? (profitPotential / totalInvestment) * 100 : 0

  return {
    askingPrice,
    marketValue,
    refurbCost,
    monthlyRent,
    annualRent,
    bmvPercentage,
    profitPotential,
    stampDuty,
    legalFees,
    totalInvestment,
    grossYield,
    netYield,
    roi,
  }
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(num))
}

function formatCurrency(num: number): string {
  return `£${formatNumber(num)}`
}

/**
 * Generate a professional investor pack PDF
 */
export async function generateInvestorPack(dealId: string, template?: any): Promise<Buffer> {
  // Fetch all necessary data
  const data = await fetchDealData(dealId, template)

  // Generate HTML
  const html = generateHTML(data, template)

  // Convert to PDF
  const pdf = await htmlToPDF(html)

  return pdf
}

/**
 * Fetch all deal data needed for the pack
 */
async function fetchDealData(dealId: string, template?: any): Promise<InvestorPackData> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      comparables: {
        orderBy: { saleDate: "desc" },
        take: 5,
      },
      assignedTo: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  if (!deal) {
    throw new Error(`Deal ${dealId} not found`)
  }

  // Fetch company info from global CompanyProfile table
  const companyProfile = await prisma.companyProfile.findFirst()

  const companyInfo = {
    name: companyProfile?.companyName || "DealStack",
    phone: companyProfile?.companyPhone || "+44 20 1234 5678",
    email: companyProfile?.companyEmail || "deals@dealstack.co.uk",
    website: companyProfile?.companyWebsite || "www.dealstack.co.uk",
  }

  return {
    deal,
    photos: deal.photos || [],
    comparables: deal.comparables || [],
    companyInfo,
  }
}

/**
 * Generate the complete HTML for the PDF
 */
function generateHTML(data: InvestorPackData, template?: any): string {
  const { deal, photos, comparables, companyInfo } = data
  const metrics = calculateMetrics(deal)

  // Use real photos if available, otherwise use placeholders
  const displayPhotos = photos.length > 0 ? photos.slice(0, 4) : []
  const photoUrls = displayPhotos.map(p => p.s3Url)

  // Fill remaining with placeholders
  while (photoUrls.length < 4) {
    photoUrls.push(PLACEHOLDER_IMAGES[photoUrls.length])
  }

  const coverImage = photoUrls[0]

  // Get enabled sections from template, sorted by order
  let sections: any[]

  if (template?.templateType === '4-part') {
    // For 4-part templates, combine all enabled sections from all parts
    sections = []
    if (template.part1Enabled && Array.isArray(template.part1Sections)) {
      sections.push(...template.part1Sections.filter((s: any) => s.enabled))
    }
    if (template.part2Enabled && Array.isArray(template.part2Sections)) {
      sections.push(...template.part2Sections.filter((s: any) => s.enabled))
    }
    if (template.part3Enabled && Array.isArray(template.part3Sections)) {
      sections.push(...template.part3Sections.filter((s: any) => s.enabled))
    }
    if (template.part4Enabled && Array.isArray(template.part4Sections)) {
      sections.push(...template.part4Sections.filter((s: any) => s.enabled))
    }

    // If no sections found, use default sections
    if (sections.length === 0) {
      sections = [
        { type: 'cover', enabled: true, order: 0 },
        { type: 'metrics', enabled: true, order: 1 },
        { type: 'property', enabled: true, order: 2 },
        { type: 'financial', enabled: true, order: 3 },
        { type: 'returns', enabled: true, order: 4 },
        { type: 'comparables', enabled: true, order: 5 },
        { type: 'cta', enabled: true, order: 6 },
      ]
    } else {
      sections.sort((a: any, b: any) => a.order - b.order)
    }
  } else if (template?.sections) {
    // Single template
    sections = (Array.isArray(template.sections) ? template.sections : [])
      .filter((s: any) => s.enabled)
      .sort((a: any, b: any) => a.order - b.order)
  } else {
    // No template, use defaults
    sections = [
      { type: 'cover', enabled: true, order: 0 },
      { type: 'metrics', enabled: true, order: 1 },
      { type: 'property', enabled: true, order: 2 },
      { type: 'financial', enabled: true, order: 3 },
      { type: 'returns', enabled: true, order: 4 },
      { type: 'comparables', enabled: true, order: 5 },
      { type: 'cta', enabled: true, order: 6 },
    ]
  }

  // Generate sections based on template configuration
  const sectionHTML = sections.map((section: any) => {
    // Map 4-part template section types to existing generator functions
    const sectionType = section.type

    // Part 4 deal sections map directly to existing sections
    if (sectionType === 'deal_cover') return generateCoverPage(deal, coverImage, metrics, companyInfo, template)
    if (sectionType === 'deal_metrics') return generateKeyMetrics(deal, metrics)
    if (sectionType === 'deal_property' || sectionType === 'deal_overview') return generateDealSnapshot(deal, metrics, photoUrls)
    if (sectionType === 'deal_financial') return generateFinancialBreakdown(metrics)
    if (sectionType === 'deal_returns') return generateInvestmentSummary(deal, metrics)
    if (sectionType === 'deal_market') return generateMarketComparison(comparables, metrics)
    if (sectionType === 'deal_cta') return generateNextSteps(companyInfo)

    // Standard single template sections
    switch (sectionType) {
      case 'cover':
        return generateCoverPage(deal, coverImage, metrics, companyInfo, template)
      case 'metrics':
        return generateKeyMetrics(deal, metrics)
      case 'property':
        return generateDealSnapshot(deal, metrics, photoUrls)
      case 'financial':
        return generateFinancialBreakdown(metrics)
      case 'returns':
        return generateInvestmentSummary(deal, metrics)
      case 'comparables':
        return generateMarketComparison(comparables, metrics)
      case 'cta':
        return generateNextSteps(companyInfo)

      // For other 4-part sections that don't have generators yet, skip them
      // (executive_intro, company_overview, case_study_*, etc.)
      default:
        console.log(`[Investor Pack] Skipping unsupported section type: ${sectionType}`)
        return ''
    }
  }).filter(html => html !== '').join('\n')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${getStyles(template)}
      </style>
    </head>
    <body>
      ${sectionHTML}
    </body>
    </html>
  `
}

/**
 * Modern, clean CSS styles optimized for sales
 */
function getStyles(template?: any): string {
  // Color schemes
  const colorSchemes: Record<string, { primary: string; secondary: string; accent: string }> = {
    blue: { primary: '#1e3a8a', secondary: '#2563eb', accent: '#fbbf24' },
    green: { primary: '#065f46', secondary: '#10b981', accent: '#fbbf24' },
    purple: { primary: '#581c87', secondary: '#a855f7', accent: '#fbbf24' },
    gold: { primary: '#78350f', secondary: '#f59e0b', accent: '#fbbf24' },
  }

  const colorScheme = template?.colorScheme && colorSchemes[template.colorScheme]
    ? colorSchemes[template.colorScheme]
    : colorSchemes.blue

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #1a202c;
      line-height: 1.6;
    }

    .page {
      page-break-after: always;
      min-height: 100vh;
      position: relative;
    }

    /* Cover Page - Hero Style */
    .cover {
      background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
      color: white;
      padding: 0;
      position: relative;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .cover-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.25;
    }

    .cover-content {
      position: relative;
      z-index: 2;
      padding: 60px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      color: ${colorScheme.accent};
      letter-spacing: -0.5px;
    }

    .cover-badge {
      background: rgba(251, 191, 36, 0.2);
      backdrop-filter: blur(10px);
      padding: 12px 24px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .cover-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      max-width: 900px;
    }

    .cover-title {
      font-size: 64px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 30px;
      letter-spacing: -1px;
    }

    .cover-metrics {
      display: flex;
      gap: 40px;
      margin-top: 40px;
    }

    .cover-metric {
      flex: 1;
    }

    .cover-metric-label {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.8;
      margin-bottom: 8px;
    }

    .cover-metric-value {
      font-size: 48px;
      font-weight: 900;
      line-height: 1;
    }

    .cover-metric.profit .cover-metric-value {
      color: #10b981;
    }

    .cover-metric.bmv .cover-metric-value {
      color: ${colorScheme.accent};
    }

    .cover-metric.roi .cover-metric-value {
      color: #60a5fa;
    }

    /* Content Pages */
    .content-page {
      padding: 50px 60px;
    }

    .section-header {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 36px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .section-subtitle {
      font-size: 16px;
      color: #64748b;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin: 40px 0;
    }

    .metric-card {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 24px;
      border-radius: 12px;
      border-left: 4px solid #3b82f6;
    }

    .metric-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1;
    }

    .metric-suffix {
      font-size: 16px;
      color: #64748b;
      margin-top: 4px;
    }

    /* Deal Score Badge */
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 600;
      box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
    }

    .score-number {
      font-size: 36px;
      font-weight: 900;
    }

    /* Photo Grid */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 30px 0;
    }

    .photo-grid img {
      width: 100%;
      height: 280px;
      object-fit: cover;
      border-radius: 12px;
    }

    /* Property Details Grid */
    .details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      background: #f8fafc;
      padding: 30px;
      border-radius: 12px;
      margin: 30px 0;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .detail-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .detail-value {
      font-size: 18px;
      font-weight: 600;
      color: #1e3a8a;
    }

    /* Highlight Box */
    .highlight {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white;
      padding: 40px;
      border-radius: 16px;
      margin: 30px 0;
      text-align: center;
    }

    .highlight-title {
      font-size: 16px;
      opacity: 0.9;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .highlight-value {
      font-size: 56px;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 8px;
    }

    .highlight-subtitle {
      font-size: 16px;
      opacity: 0.8;
    }

    /* Table */
    .table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 30px 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .table th {
      background: #1e3a8a;
      color: white;
      padding: 16px 20px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .table td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: white;
    }

    .table tr:last-child td {
      border-bottom: none;
    }

    .table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .table-total {
      font-weight: 700;
      font-size: 18px;
      background: #3b82f6 !important;
      color: white;
    }

    /* Progress Bar */
    .progress-container {
      margin: 20px 0;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #475569;
    }

    .progress-bar {
      width: 100%;
      height: 24px;
      background: #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 12px;
      color: white;
      font-weight: 700;
      font-size: 12px;
    }

    /* CTA Section */
    .cta-section {
      background: linear-gradient(135deg, ${colorScheme.accent} 0%, #f59e0b 100%);
      color: ${colorScheme.primary};
      padding: 50px;
      border-radius: 16px;
      text-align: center;
      margin: 40px 0;
    }

    .cta-title {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .cta-text {
      font-size: 18px;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    .contact-info {
      display: flex;
      justify-content: center;
      gap: 40px;
      font-size: 16px;
      font-weight: 600;
    }

    /* Footer */
    .footer {
      position: absolute;
      bottom: 40px;
      left: 60px;
      right: 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    .page-number {
      font-weight: 600;
    }
  `
}

/**
 * Generate Cover Page - Hero style with key metrics
 */
function generateCoverPage(deal: any, coverImage: string, metrics: any, companyInfo: any, template?: any): string {
  return `
    <div class="page cover">
      <img src="${coverImage}" class="cover-image" alt="Property" />
      <div class="cover-content">
        <div class="cover-header">
          <div class="logo">${companyInfo.name}</div>
          <div class="cover-badge">Premium Investment</div>
        </div>

        <div class="cover-main">
          <div class="cover-title">${deal.address}</div>
          <div style="font-size: 18px; opacity: 0.9; margin-bottom: 20px;">
            ${deal.postcode || ""} • ${deal.propertyType || "Property"} • ${deal.bedrooms || "—"} Bed
          </div>

          <div class="cover-metrics">
            <div class="cover-metric profit">
              <div class="cover-metric-label">Profit Potential</div>
              <div class="cover-metric-value">${formatCurrency(metrics.profitPotential)}</div>
            </div>
            <div class="cover-metric bmv">
              <div class="cover-metric-label">Below Market Value</div>
              <div class="cover-metric-value">${metrics.bmvPercentage.toFixed(1)}%</div>
            </div>
            <div class="cover-metric roi">
              <div class="cover-metric-label">ROI</div>
              <div class="cover-metric-value">${metrics.roi.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div style="text-align: center; opacity: 0.8; font-size: 14px;">
          Confidential Investment Memorandum • Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  `
}

/**
 * Generate Key Metrics Page - At-a-glance numbers
 */
function generateKeyMetrics(deal: any, metrics: any): string {
  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Investment Overview</div>
        <div class="section-subtitle">Key metrics and financial performance indicators</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Asking Price</div>
          <div class="metric-value">${formatCurrency(metrics.askingPrice)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Market Value</div>
          <div class="metric-value">${formatCurrency(metrics.marketValue)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">BMV %</div>
          <div class="metric-value" style="color: #10b981;">${metrics.bmvPercentage.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Profit Potential</div>
          <div class="metric-value" style="color: #10b981;">${formatCurrency(metrics.profitPotential)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Gross Yield</div>
          <div class="metric-value">${metrics.grossYield.toFixed(2)}%</div>
          <div class="metric-suffix">per annum</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net Yield</div>
          <div class="metric-value">${metrics.netYield.toFixed(2)}%</div>
          <div class="metric-suffix">after costs</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">ROI</div>
          <div class="metric-value" style="color: #3b82f6;">${metrics.roi.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Monthly Rent</div>
          <div class="metric-value">${formatCurrency(metrics.monthlyRent)}</div>
          <div class="metric-suffix">estimated</div>
        </div>
      </div>

      <div class="highlight">
        <div class="highlight-title">Total Investment Required</div>
        <div class="highlight-value">${formatCurrency(metrics.totalInvestment)}</div>
        <div class="highlight-subtitle">Including purchase price, stamp duty, legal fees, and refurbishment</div>
      </div>

      <div class="footer">
        <div>${deal.address}</div>
        <div class="page-number">Page 2</div>
      </div>
    </div>
  `
}

/**
 * Generate Deal Snapshot with photos and details
 */
function generateDealSnapshot(deal: any, metrics: any, photoUrls: string[]): string {
  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Property Details</div>
        <div class="section-subtitle">Comprehensive property information and imagery</div>
      </div>

      <div class="photo-grid">
        ${photoUrls.map(url => `<img src="${url}" alt="Property" />`).join("")}
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Property Type</div>
          <div class="detail-value">${deal.propertyType || "N/A"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Bedrooms</div>
          <div class="detail-value">${deal.bedrooms || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Bathrooms</div>
          <div class="detail-value">${deal.bathrooms || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Square Footage</div>
          <div class="detail-value">${deal.squareFeet ? `${formatNumber(deal.squareFeet)} sq ft` : "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Location</div>
          <div class="detail-value">${deal.postcode || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div class="detail-value" style="text-transform: capitalize;">${deal.status || "Available"}</div>
        </div>
      </div>

      <div style="background: #f8fafc; padding: 30px; border-radius: 12px; border-left: 4px solid #3b82f6;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e3a8a; margin-bottom: 12px;">Why This Deal Stands Out</h3>
        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px;">
          <li style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span><strong>${metrics.bmvPercentage.toFixed(1)}% below market value</strong> - Instant equity from day one</span>
          </li>
          <li style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span><strong>${metrics.grossYield.toFixed(2)}% gross yield</strong> - Strong rental income potential</span>
          </li>
          <li style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span><strong>${formatCurrency(metrics.profitPotential)} profit potential</strong> - Clear upside opportunity</span>
          </li>
          <li style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span><strong>Prime location</strong> with high demand for rental properties</span>
          </li>
        </ul>
      </div>

      <div class="footer">
        <div>${deal.address}</div>
        <div class="page-number">Page 3</div>
      </div>
    </div>
  `
}

/**
 * Generate Financial Breakdown
 */
function generateFinancialBreakdown(metrics: any): string {
  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Financial Analysis</div>
        <div class="section-subtitle">Detailed cost breakdown and investment structure</div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Purchase Price</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(metrics.askingPrice)}</td>
          </tr>
          <tr>
            <td>Stamp Duty (3% BTL surcharge)</td>
            <td style="text-align: right;">${formatCurrency(metrics.stampDuty)}</td>
          </tr>
          <tr>
            <td>Legal Fees</td>
            <td style="text-align: right;">${formatCurrency(metrics.legalFees)}</td>
          </tr>
          <tr>
            <td>Refurbishment Cost</td>
            <td style="text-align: right;">${formatCurrency(metrics.refurbCost)}</td>
          </tr>
          <tr class="table-total">
            <td>Total Investment</td>
            <td style="text-align: right;">${formatCurrency(metrics.totalInvestment)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 50px;">
        <h3 style="font-size: 24px; font-weight: 700; color: #1e3a8a; margin-bottom: 24px;">Value Comparison</h3>

        <div class="progress-container">
          <div class="progress-label">
            <span>Your Investment: ${formatCurrency(metrics.totalInvestment)}</span>
            <span>Market Value: ${formatCurrency(metrics.marketValue)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(metrics.totalInvestment / metrics.marketValue * 100).toFixed(0)}%;">
              ${(metrics.totalInvestment / metrics.marketValue * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div style="background: #10b98110; padding: 30px; border-radius: 12px; margin-top: 30px; border: 2px solid #10b981;">
          <div style="font-size: 18px; font-weight: 600; color: #065f46; margin-bottom: 8px;">Instant Equity</div>
          <div style="font-size: 42px; font-weight: 900; color: #10b981; line-height: 1; margin-bottom: 8px;">
            ${formatCurrency(metrics.profitPotential)}
          </div>
          <div style="color: #065f46;">Built-in profit from day one - this is the difference between your total investment and the current market value</div>
        </div>
      </div>

      <div class="footer">
        <div>Financial Analysis</div>
        <div class="page-number">Page 4</div>
      </div>
    </div>
  `
}

/**
 * Generate Investment Summary
 */
function generateInvestmentSummary(deal: any, metrics: any): string {
  const cashFlow = metrics.monthlyRent * 0.85 // After 15% costs
  const annualCashFlow = cashFlow * 12
  const paybackYears = metrics.totalInvestment / annualCashFlow

  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Investment Returns</div>
        <div class="section-subtitle">Projected rental income and return analysis</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-bottom: 40px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px; border-radius: 16px;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;">Monthly Income</div>
          <div style="font-size: 48px; font-weight: 900; line-height: 1; margin-bottom: 8px;">${formatCurrency(metrics.monthlyRent)}</div>
          <div style="font-size: 14px; opacity: 0.9;">Estimated rental income</div>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; border-radius: 16px;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;">Annual Return</div>
          <div style="font-size: 48px; font-weight: 900; line-height: 1; margin-bottom: 8px;">${metrics.grossYield.toFixed(2)}%</div>
          <div style="font-size: 14px; opacity: 0.9;">Gross yield on investment</div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Return Metric</th>
            <th style="text-align: right;">Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Gross Yield</strong></td>
            <td style="text-align: right; font-weight: 700; font-size: 18px; color: #10b981;">${metrics.grossYield.toFixed(2)}%</td>
            <td style="color: #64748b;">Annual rent ÷ purchase price</td>
          </tr>
          <tr>
            <td><strong>Net Yield</strong></td>
            <td style="text-align: right; font-weight: 700; font-size: 18px;">${metrics.netYield.toFixed(2)}%</td>
            <td style="color: #64748b;">After 15% costs (maintenance, voids, etc.)</td>
          </tr>
          <tr>
            <td><strong>ROI</strong></td>
            <td style="text-align: right; font-weight: 700; font-size: 18px; color: #3b82f6;">${metrics.roi.toFixed(1)}%</td>
            <td style="color: #64748b;">Return on total investment</td>
          </tr>
          <tr>
            <td><strong>Annual Cash Flow</strong></td>
            <td style="text-align: right; font-weight: 700; font-size: 18px;">${formatCurrency(annualCashFlow)}</td>
            <td style="color: #64748b;">Net rental income after costs</td>
          </tr>
          <tr>
            <td><strong>Payback Period</strong></td>
            <td style="text-align: right; font-weight: 700; font-size: 18px;">${paybackYears.toFixed(1)} years</td>
            <td style="color: #64748b;">Time to recoup investment</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #fbbf2410; padding: 30px; border-radius: 12px; margin-top: 30px; border: 2px solid #fbbf24;">
        <div style="font-size: 18px; font-weight: 600; color: #92400e; margin-bottom: 12px;">Investment Highlights</div>
        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; color: #92400e;">
          <li>• Generate ${formatCurrency(metrics.monthlyRent)} per month in rental income</li>
          <li>• Achieve ${metrics.grossYield.toFixed(2)}% gross annual yield - well above UK average</li>
          <li>• Build ${formatCurrency(metrics.profitPotential)} instant equity</li>
          <li>• Full payback in approximately ${paybackYears.toFixed(1)} years from rental income</li>
        </ul>
      </div>

      <div class="footer">
        <div>Investment Returns</div>
        <div class="page-number">Page 5</div>
      </div>
    </div>
  `
}

/**
 * Generate Market Comparison
 */
function generateMarketComparison(comparables: any[], metrics: any): string {
  // Use salePrice field (from Comparable model) or price field (legacy)
  const avgCompPrice = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + Number(c.salePrice || c.price || 0), 0) / comparables.length
    : 0

  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Market Analysis & Comparables</div>
        <div class="section-subtitle">Recent sales within 3 miles - Last 12 months</div>
      </div>

      ${comparables.length > 0 ? `
        <table class="table" style="font-size: 12px;">
          <thead>
            <tr>
              <th>Address</th>
              <th>Type</th>
              <th>Beds</th>
              <th style="text-align: right;">Sale Price</th>
              <th style="text-align: right;">Date</th>
              <th style="text-align: right;">Distance</th>
            </tr>
          </thead>
          <tbody>
            ${comparables.map(comp => {
              const salePrice = Number(comp.salePrice || comp.price || 0)
              const distance = comp.distanceKm ? Number(comp.distanceKm) : (comp.distance ? Number(comp.distance) : null)
              return `
              <tr>
                <td style="font-size: 11px;">
                  ${comp.address || "—"}
                  ${comp.postcode ? `<br><span style="color: #64748b; font-size: 10px;">${comp.postcode}</span>` : ""}
                </td>
                <td style="text-transform: capitalize;">${comp.propertyType || "—"}</td>
                <td>${comp.bedrooms || "—"}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency(salePrice)}</td>
                <td style="text-align: right;">${comp.saleDate ? new Date(comp.saleDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</td>
                <td style="text-align: right;">${distance ? `${distance.toFixed(1)} mi` : "—"}</td>
              </tr>
            `}).join("")}
            <tr style="background: #3b82f610 !important; font-weight: 600;">
              <td colspan="3"><strong>Average Comparable Price</strong></td>
              <td style="text-align: right; font-weight: 700; font-size: 16px;">${formatCurrency(avgCompPrice)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Market Statistics</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Comparables Analyzed:</span>
                <strong>${comparables.length} properties</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Avg Sale Price:</span>
                <strong>${formatCurrency(avgCompPrice)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Your Price:</span>
                <strong style="color: #10b981;">${formatCurrency(metrics.askingPrice)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Discount:</span>
                <strong style="color: #ef4444;">${formatCurrency(avgCompPrice - metrics.askingPrice)}</strong>
              </div>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Data Confidence</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Data Source:</span>
                <strong>PropertyData API</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Search Radius:</span>
                <strong>3 miles</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Time Period:</span>
                <strong>Last 12 months</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Confidence:</span>
                <strong style="color: #10b981;">HIGH</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="progress-container" style="margin-top: 30px;">
          <div class="progress-label">
            <span>Your Price: ${formatCurrency(metrics.askingPrice)}</span>
            <span>Avg Market: ${formatCurrency(avgCompPrice)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min((metrics.askingPrice / avgCompPrice * 100), 100).toFixed(0)}%;">
              ${(metrics.askingPrice / avgCompPrice * 100).toFixed(0)}% of market
            </div>
          </div>
        </div>

        <div style="background: #10b98110; padding: 25px; border-radius: 12px; margin-top: 30px; border-left: 4px solid #10b981;">
          <strong style="color: #065f46; font-size: 18px;">Market Advantage:</strong>
          <span style="color: #065f46; font-size: 16px;"> This property is priced ${formatCurrency(avgCompPrice - metrics.askingPrice)} below the average comparable sale, representing a ${metrics.bmvPercentage.toFixed(1)}% discount to market value.</span>
        </div>
      ` : `
        <div style="background: #f8fafc; padding: 40px; border-radius: 12px; text-align: center; color: #64748b;">
          <div style="font-size: 18px; margin-bottom: 8px;">Limited comparable data available</div>
          <div>This may indicate a unique opportunity in an emerging market</div>
        </div>
      `}

      <div class="footer">
        <div>Market Analysis</div>
        <div class="page-number">Page 6</div>
      </div>
    </div>
  `
}

/**
 * Generate Next Steps / Call to Action
 */
function generateNextSteps(companyInfo: any): string {
  return `
    <div class="page content-page">
      <div class="section-header">
        <div class="section-title">Secure This Investment</div>
        <div class="section-subtitle">Act now to reserve this exclusive opportunity</div>
      </div>

      <div class="cta-section">
        <div class="cta-title">Don't Miss This Opportunity</div>
        <div class="cta-text">
          Properties of this caliber are rare. Contact us today to discuss this investment.
        </div>
        <div class="contact-info">
          <div>📞 ${companyInfo.phone}</div>
          <div>✉️ ${companyInfo.email}</div>
          <div>🌐 ${companyInfo.website}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-top: 40px;">
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">1</div>
          <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 8px; font-size: 18px;">Contact Us</div>
          <div style="color: #64748b; font-size: 14px;">Reach out to discuss the property and ask any questions</div>
        </div>

        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">2</div>
          <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 8px; font-size: 18px;">View Property</div>
          <div style="color: #64748b; font-size: 14px;">Schedule a viewing to inspect the investment firsthand</div>
        </div>

        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">3</div>
          <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 8px; font-size: 18px;">Secure Deal</div>
          <div style="color: #64748b; font-size: 14px;">Complete due diligence and finalize your investment</div>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: white; padding: 40px; border-radius: 16px; margin-top: 40px; text-align: center;">
        <div style="font-size: 16px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; opacity: 0.9;">Confidential Investment Memorandum</div>
        <div style="font-size: 28px; font-weight: 700; margin-bottom: 16px;">${companyInfo.name}</div>
        <div style="font-size: 14px; opacity: 0.8;">
          This document contains confidential information. Distribution requires prior authorization.
        </div>
      </div>

      <div class="footer">
        <div>© ${new Date().getFullYear()} ${companyInfo.name}. All rights reserved.</div>
        <div class="page-number">Page 7</div>
      </div>
    </div>
  `
}

/**
 * Convert HTML to PDF using Puppeteer
 */
async function htmlToPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  })

  try {
    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      preferCSSPageSize: true,
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

/**
 * GET /api/vendor-leads/[id]/offer-letter?offerPrice=XXXXX
 *
 * Returns a print-ready HTML offer letter.
 * Open in a new tab → browser Print → Save as PDF.
 *
 * Sourcer / Admin only.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

// Simple UK SDLT at additional-property rates (investor buying a second property)
function calcSDLT(price: number): number {
  const bands = [
    [0,       125_000, 0.03],
    [125_000, 250_000, 0.05],
    [250_000, 925_000, 0.08],
    [925_000, 1_500_000, 0.13],
    [1_500_000, Infinity, 0.15],
  ] as const

  let tax = 0
  for (const [lo, hi, rate] of bands) {
    if (price <= lo) break
    tax += (Math.min(price, hi) - lo) * rate
  }
  return Math.round(tax)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // ── Fetch lead ────────────────────────────────────────────────────────────
  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: {
      vendorName: true,
      vendorAddress: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      offerAmount: true,
      offerPercentage: true,
      bedrooms: true,
      propertyType: true,
    },
  })
  if (!lead) return new NextResponse("Lead not found", { status: 404 })

  // ── Fetch company profile ─────────────────────────────────────────────────
  const company = await prisma.companyProfile.findFirst({
    select: {
      companyName: true,
      companyEmail: true,
      companyPhone: true,
      companyAddress: true,
      companyNumber: true,
      logoUrl: true,
    },
  })

  // ── Resolve offer price ───────────────────────────────────────────────────
  const qp = request.nextUrl.searchParams.get("offerPrice")
  const offerPrice = qp
    ? parseFloat(qp)
    : lead.offerAmount
    ? Number(lead.offerAmount)
    : null

  if (!offerPrice || offerPrice <= 0) {
    return new NextResponse(
      "offerPrice query param is required (or set an offer amount on the lead first)",
      { status: 400 }
    )
  }

  const sdlt          = calcSDLT(offerPrice)
  const solicitorFees = 1_500
  const surveyFee     = 500
  const totalAcq      = offerPrice + sdlt + solicitorFees + surveyFee

  const propertyFull = [lead.propertyAddress, lead.propertyPostcode].filter(Boolean).join(", ")
  const companyName  = company?.companyName ?? "The Deal Sourcing Team"
  const companyAddr  = company?.companyAddress ?? ""
  const companyEmail = company?.companyEmail ?? ""
  const companyPhone = company?.companyPhone ?? ""
  const companyReg   = company?.companyNumber ? `Company No. ${company.companyNumber}` : ""
  const today        = formatDate(new Date())

  const vendorSalutation = lead.vendorName
    ? `Dear ${lead.vendorName.split(" ")[0]},`
    : "Dear Sir / Madam,"

  const propDesc = [
    lead.bedrooms ? `${lead.bedrooms}-bedroom` : "",
    lead.propertyType ?? "",
    "at",
    propertyFull,
  ].filter(Boolean).join(" ")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offer Letter — ${propertyFull}</title>
<style>
  @media print {
    @page { margin: 18mm 20mm; size: A4 portrait; }
    .no-print { display: none !important; }
    body { font-size: 11pt; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 50px;
    line-height: 1.6;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
  .logo { font-size: 20px; font-weight: bold; color: #1a1a2e; letter-spacing: -0.5px; }
  .company-detail { font-size: 10px; color: #555; text-align: right; line-height: 1.7; }
  .date-block { margin-bottom: 24px; font-size: 11px; color: #444; }
  .recipient { margin-bottom: 24px; }
  .recipient p { font-size: 12px; line-height: 1.8; }
  h1 { font-size: 16px; font-weight: bold; margin-bottom: 20px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-left: 4px solid #2563eb; padding-left: 10px; }
  p { margin-bottom: 14px; font-size: 12px; }
  .terms-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .terms-table td { padding: 8px 12px; border: 1px solid #ddd; font-size: 11px; vertical-align: top; }
  .terms-table td:first-child { font-weight: bold; color: #555; width: 38%; background: #f8f9fa; }
  .costs-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .costs-table th { padding: 7px 10px; background: #1a1a2e; color: #fff; font-size: 10px; text-align: left; }
  .costs-table td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  .costs-table td:last-child { text-align: right; font-family: "Courier New", monospace; }
  .costs-table tr.total td { font-weight: bold; border-top: 2px solid #1a1a2e; background: #f8f9fa; }
  .conditions { margin: 20px 0; padding: 14px 18px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; }
  .conditions h3 { font-size: 11px; font-weight: bold; margin-bottom: 8px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .conditions ul { padding-left: 18px; }
  .conditions li { font-size: 11px; margin-bottom: 5px; }
  .signature-block { margin-top: 40px; }
  .sig-line { border-bottom: 1px solid #aaa; width: 260px; margin: 30px 0 6px; }
  .sig-meta { font-size: 10px; color: #666; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 9px; color: #888; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-family: sans-serif; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .print-btn:hover { background: #1d4ed8; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo">${companyName}</div>
    <div class="company-detail">
      ${companyAddr ? companyAddr.replace(/\n/g, "<br>") + "<br>" : ""}
      ${companyEmail ? `<a href="mailto:${companyEmail}" style="color:#2563eb;text-decoration:none">${companyEmail}</a><br>` : ""}
      ${companyPhone ? `${companyPhone}<br>` : ""}
      ${companyReg}
    </div>
  </div>

  <!-- Date -->
  <div class="date-block">${today}</div>

  <!-- Recipient -->
  <div class="recipient">
    <p>
      ${lead.vendorName ?? "The Vendor"}<br>
      ${lead.vendorAddress ? lead.vendorAddress.replace(/,/g, "<br>") : ""}
    </p>
  </div>

  <!-- Title -->
  <h1>Formal Purchase Offer — ${propertyFull}</h1>

  <!-- Opening -->
  <p>${vendorSalutation}</p>

  <p>
    We are pleased to submit this formal written offer to purchase the above-referenced property,
    being the ${propDesc}, on the terms and conditions set out below.
  </p>

  <p>
    We are <strong>experienced property investors / deal sourcers</strong> operating throughout the UK,
    able to proceed quickly and without a chain. This offer is made in good faith following our
    initial assessment of the property.
  </p>

  <!-- Key Terms -->
  <table class="terms-table">
    <tr><td>Property Address</td><td>${propertyFull}</td></tr>
    <tr><td>Offer Price</td><td><strong>${formatGBP(offerPrice)}</strong>${lead.askingPrice ? ` (asking price: ${formatGBP(Number(lead.askingPrice))})` : ""}</td></tr>
    <tr><td>Tenure</td><td>Freehold / Leasehold (to be confirmed by solicitors)</td></tr>
    <tr><td>Completion</td><td>We can exchange within 28 days of solicitors being instructed. Completion date to be agreed, with flexibility to suit your requirements.</td></tr>
    <tr><td>Finance</td><td>We are cash buyers / have bridging finance in place. No mortgage subject to condition.</td></tr>
    <tr><td>Vacant Possession</td><td>We require the property to be delivered with vacant possession on completion.</td></tr>
    <tr><td>Deposit</td><td>A reservation / lock-out deposit of [amount to be agreed] will be paid on exchange of contracts.</td></tr>
  </table>

  <!-- Indicative Purchase Costs -->
  <h1 style="font-size:13px;margin-top:28px">Indicative Purchase Cost Summary</h1>
  <table class="costs-table">
    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Purchase Price</td><td>${formatGBP(offerPrice)}</td></tr>
      <tr><td>Stamp Duty Land Tax (SDLT — additional property rates)</td><td>${formatGBP(sdlt)}</td></tr>
      <tr><td>Legal / Solicitor Fees (estimate)</td><td>${formatGBP(solicitorFees)}</td></tr>
      <tr><td>Survey / Structural Report (estimate)</td><td>${formatGBP(surveyFee)}</td></tr>
      <tr class="total"><td>Total Acquisition Cost</td><td>${formatGBP(totalAcq)}</td></tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#888">SDLT calculated at additional-property surcharge rates. All other figures are estimates only and will be confirmed by your solicitor. SDLT may differ based on buyer circumstances.</p>

  <!-- Standard Conditions -->
  <div class="conditions">
    <h3>Standard Conditions of this Offer</h3>
    <ul>
      <li>This offer is subject to satisfactory survey and structural inspection.</li>
      <li>This offer is subject to clear title and confirmation of tenure by solicitors.</li>
      <li>This offer is not subject to mortgage approval (cash / bridging purchase).</li>
      <li>This offer remains open for acceptance for <strong>7 days</strong> from the date above.</li>
      <li>This offer is conditional upon the property being available with vacant possession at completion.</li>
      <li>Both parties will instruct solicitors within 5 working days of acceptance.</li>
      <li>This offer is not legally binding until exchange of contracts in accordance with English law.</li>
    </ul>
  </div>

  <!-- Closing -->
  <p>
    We are committed to making this transaction as smooth and stress-free as possible for you.
    We work with experienced solicitors who are familiar with quick-turnaround transactions,
    and we are happy to recommend one if required.
  </p>

  <p>
    Please do not hesitate to contact us should you have any questions or wish to discuss the terms
    of this offer. We look forward to hearing from you.
  </p>

  <!-- Signature -->
  <div class="signature-block">
    <p>Yours sincerely,</p>
    <div class="sig-line"></div>
    <p class="sig-meta">
      Authorised Signatory<br>
      ${companyName}<br>
      ${today}
    </p>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${companyName}${companyReg ? ` · ${companyReg}` : ""}${companyAddr ? ` · ${companyAddr.split("\n")[0]}` : ""}
    <br>This document is a formal offer letter and does not constitute a legally binding contract.
    A binding agreement is only created upon exchange of signed contracts by both parties' solicitors.
  </div>

  <!-- Print button -->
  <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

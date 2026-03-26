"use client"

const css = `
  .fb-kit *, .fb-kit *::before, .fb-kit *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .fb-kit {
    --blue: #1a56db;
    --blue-dark: #1e40af;
    --blue-light: #dbeafe;
    --gold: #d97706;
    --gold-light: #fef3c7;
    --red: #dc2626;
    --green: #16a34a;
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-400: #9ca3af;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-900: #111827;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: var(--gray-900);
  }

  .fb-kit .page { max-width: 1200px; margin: 0 auto; padding: 32px 24px 80px; }
  .fb-kit h1.page-title { font-size: 28px; font-weight: 800; color: var(--gray-900); margin-bottom: 4px; }
  .fb-kit h1.page-title span { color: var(--blue); }
  .fb-kit .page-subtitle { color: var(--gray-600); font-size: 15px; margin-bottom: 40px; }
  .fb-kit .section { margin-bottom: 56px; }
  .fb-kit .section-label { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--blue); background: var(--blue-light); display: inline-block; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; }
  .fb-kit .section-title { font-size: 22px; font-weight: 800; color: var(--gray-900); margin-bottom: 4px; }
  .fb-kit .section-desc { font-size: 14px; color: var(--gray-600); margin-bottom: 24px; line-height: 1.6; }

  .fb-kit .ad-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  @media (max-width: 700px) { .fb-kit .ad-grid { grid-template-columns: 1fr; } }
  .fb-kit .ad-card { border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.12); background: white; }
  .fb-kit .ad-card .ad-label { background: var(--gray-700); color: white; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 6px 14px; display: flex; align-items: center; gap: 6px; }
  .fb-kit .ad-label .badge { background: var(--gold); color: white; border-radius: 4px; padding: 1px 6px; font-size: 10px; }

  .fb-kit .poster-1 { background: linear-gradient(135deg, #1e3a8a 0%, #1a56db 50%, #0ea5e9 100%); padding: 32px 28px; color: white; min-height: 380px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
  .fb-kit .poster-1::before { content: ''; position: absolute; top: -60px; right: -60px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,.08); }
  .fb-kit .poster-1::after { content: ''; position: absolute; bottom: -40px; left: -40px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,.06); }
  .fb-kit .poster-1 .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; background: rgba(255,255,255,.2); display: inline-block; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
  .fb-kit .poster-1 h2 { font-size: 32px; font-weight: 900; line-height: 1.15; margin-bottom: 12px; }
  .fb-kit .poster-1 h2 em { color: #fbbf24; font-style: normal; }
  .fb-kit .poster-1 p { font-size: 14px; opacity: .88; line-height: 1.6; margin-bottom: 20px; max-width: 280px; }
  .fb-kit .poster-1 .bullets { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  .fb-kit .poster-1 .bullet { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .fb-kit .poster-1 .bullet::before { content: '✓'; background: #16a34a; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  .fb-kit .poster-1 .cta { background: #fbbf24; color: #1e3a8a; font-weight: 800; font-size: 15px; padding: 12px 24px; border-radius: 10px; display: inline-block; text-decoration: none; text-align: center; }
  .fb-kit .poster-1 .footer-note { font-size: 11px; opacity: .7; margin-top: 10px; }

  .fb-kit .poster-2 { background: white; padding: 0; min-height: 380px; display: flex; flex-direction: column; }
  .fb-kit .poster-2 .top-band { background: #1e3a8a; padding: 20px 24px; }
  .fb-kit .poster-2 .top-band h2 { color: white; font-size: 22px; font-weight: 900; line-height: 1.2; margin-bottom: 4px; }
  .fb-kit .poster-2 .top-band p { color: rgba(255,255,255,.8); font-size: 13px; }
  .fb-kit .poster-2 .body { padding: 20px 24px; flex: 1; }
  .fb-kit .poster-2 .stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .fb-kit .poster-2 .stat { text-align: center; background: var(--blue-light); border-radius: 10px; padding: 12px 8px; }
  .fb-kit .poster-2 .stat .num { font-size: 24px; font-weight: 900; color: var(--blue-dark); }
  .fb-kit .poster-2 .stat .lbl { font-size: 10px; font-weight: 600; color: var(--gray-600); text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
  .fb-kit .poster-2 .quote { background: var(--gray-50); border-left: 3px solid var(--blue); border-radius: 0 8px 8px 0; padding: 12px 14px; margin-bottom: 16px; }
  .fb-kit .poster-2 .quote p { font-size: 13px; color: var(--gray-700); line-height: 1.5; font-style: italic; }
  .fb-kit .poster-2 .quote span { font-size: 11px; color: var(--gray-400); font-style: normal; font-weight: 600; margin-top: 4px; display: block; }
  .fb-kit .poster-2 .cta-band { background: #fbbf24; padding: 14px 24px; }
  .fb-kit .poster-2 .cta-band p { font-size: 15px; font-weight: 800; color: #1e3a8a; text-align: center; }
  .fb-kit .poster-2 .cta-band span { font-size: 12px; font-weight: 500; display: block; color: #92400e; }

  .fb-kit .form-preview { background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,.08); overflow: hidden; max-width: 520px; }
  .fb-kit .form-header { background: linear-gradient(135deg, #1e3a8a, #1a56db); padding: 24px; color: white; }
  .fb-kit .form-header h3 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
  .fb-kit .form-header p { font-size: 13px; opacity: .85; }
  .fb-kit .form-body { padding: 24px; }
  .fb-kit .form-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--blue); margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid var(--blue-light); }
  .fb-kit .form-group { margin-bottom: 14px; }
  .fb-kit .form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--gray-700); margin-bottom: 4px; }
  .fb-kit .form-group label .req { color: var(--red); margin-left: 2px; }
  .fb-kit .form-group label .note { color: var(--gray-400); font-weight: 400; margin-left: 4px; }
  .fb-kit .form-group .field { background: var(--gray-100); border: 1.5px solid var(--gray-200); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--gray-400); width: 100%; }
  .fb-kit .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fb-kit .field-map { font-size: 10px; color: var(--blue); font-weight: 600; margin-top: 3px; }
  .fb-kit .form-cta { background: #1a56db; color: white; font-weight: 800; font-size: 15px; border-radius: 10px; padding: 14px; text-align: center; margin-top: 20px; }
  .fb-kit .privacy-note { font-size: 11px; color: var(--gray-400); text-align: center; margin-top: 8px; line-height: 1.5; }

  .fb-kit .steps { display: flex; flex-direction: column; gap: 20px; }
  .fb-kit .step { background: white; border-radius: 14px; padding: 24px; box-shadow: 0 1px 8px rgba(0,0,0,.06); display: flex; gap: 20px; align-items: flex-start; }
  .fb-kit .step-num { background: var(--blue); color: white; font-size: 18px; font-weight: 900; border-radius: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .fb-kit .step-content { flex: 1; }
  .fb-kit .step-content h4 { font-size: 16px; font-weight: 800; color: var(--gray-900); margin-bottom: 6px; }
  .fb-kit .step-content p { font-size: 13px; color: var(--gray-600); line-height: 1.65; margin-bottom: 10px; }
  .fb-kit .step-tips { display: flex; flex-direction: column; gap: 6px; }
  .fb-kit .step-tip { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--gray-700); }
  .fb-kit .step-tip code { background: var(--gray-100); border: 1px solid var(--gray-200); border-radius: 4px; padding: 1px 6px; font-size: 12px; color: var(--blue-dark); font-family: monospace; }
  .fb-kit .callout { border-radius: 12px; padding: 16px 20px; margin-top: 10px; font-size: 13px; line-height: 1.6; }
  .fb-kit .callout.blue { background: var(--blue-light); border-left: 4px solid var(--blue); color: var(--blue-dark); }
  .fb-kit .callout.gold { background: var(--gold-light); border-left: 4px solid var(--gold); color: #92400e; }
  .fb-kit .callout.green { background: #dcfce7; border-left: 4px solid var(--green); color: #166534; }

  .fb-kit .target-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 600px) { .fb-kit .target-grid { grid-template-columns: 1fr; } }
  .fb-kit .target-card { background: white; border-radius: 12px; padding: 18px; box-shadow: 0 1px 6px rgba(0,0,0,.06); }
  .fb-kit .target-card h5 { font-size: 13px; font-weight: 700; color: var(--gray-900); margin-bottom: 8px; }
  .fb-kit .target-card ul { list-style: none; }
  .fb-kit .target-card ul li { font-size: 12px; color: var(--gray-600); padding: 3px 0; border-bottom: 1px solid var(--gray-100); display: flex; align-items: center; gap: 6px; }
  .fb-kit .target-card ul li:last-child { border-bottom: none; }
  .fb-kit .target-card ul li::before { content: '▸'; color: var(--blue); font-size: 10px; }

  .fb-kit .budget-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .fb-kit .budget-table th { background: #1e3a8a; color: white; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .fb-kit .budget-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--gray-100); color: var(--gray-700); }
  .fb-kit .budget-table tr:last-child td { border-bottom: none; font-weight: 700; color: var(--gray-900); background: var(--gray-50); }
  .fb-kit .budget-table .green { color: var(--green); font-weight: 700; }

  .fb-kit .webhook-box { background: #1e293b; border-radius: 14px; padding: 24px; color: #e2e8f0; }
  .fb-kit .webhook-box h4 { font-size: 15px; font-weight: 700; color: white; margin-bottom: 8px; }
  .fb-kit .webhook-box p { font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.6; }
  .fb-kit .webhook-box pre { background: #0f172a; border-radius: 8px; padding: 16px; font-size: 12px; color: #7dd3fc; overflow-x: auto; line-height: 1.7; }
  .fb-kit .webhook-box .field-list { display: flex; flex-direction: column; gap: 6px; }
  .fb-kit .webhook-box .field-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .fb-kit .webhook-box .field-row .fb { color: #fbbf24; font-family: monospace; min-width: 160px; }
  .fb-kit .webhook-box .field-row .arrow { color: #4b5563; }
  .fb-kit .webhook-box .field-row .db { color: #86efac; font-family: monospace; }

  .fb-kit .ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 600px) { .fb-kit .ab-grid { grid-template-columns: 1fr; } }
  .fb-kit .ab-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 6px rgba(0,0,0,.06); }
  .fb-kit .ab-card .ab-label { font-size: 12px; font-weight: 800; border-radius: 6px; padding: 3px 10px; display: inline-block; margin-bottom: 10px; }
  .fb-kit .ab-label.a { background: var(--blue-light); color: var(--blue-dark); }
  .fb-kit .ab-label.b { background: var(--gold-light); color: #92400e; }
  .fb-kit .ab-card h5 { font-size: 14px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px; }
  .fb-kit .ab-card p { font-size: 13px; color: var(--gray-600); line-height: 1.6; }
  .fb-kit .ab-card ul { list-style: none; margin-top: 8px; }
  .fb-kit .ab-card ul li { font-size: 12px; color: var(--gray-600); padding: 3px 0; display: flex; gap: 6px; }
  .fb-kit .ab-card ul li::before { content: '•'; color: var(--blue); }

  .fb-kit .divider { border: none; border-top: 2px solid var(--gray-200); margin: 40px 0; }
  .fb-kit .toc { background: white; border-radius: 14px; padding: 20px 24px; margin-bottom: 40px; box-shadow: 0 1px 6px rgba(0,0,0,.06); }
  .fb-kit .toc h3 { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--gray-900); }
  .fb-kit .toc ol { padding-left: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .fb-kit .toc ol li { font-size: 13px; color: var(--blue); padding: 3px 0; }
  .fb-kit .toc ol li a { color: var(--blue); text-decoration: none; }
  .fb-kit .toc ol li a:hover { text-decoration: underline; }

  .fb-kit .test-phase { background: white; border-radius: 14px; padding: 24px; box-shadow: 0 1px 8px rgba(0,0,0,.06); margin-bottom: 16px; border-left: 4px solid var(--blue); }
  .fb-kit .test-phase.free { border-left-color: var(--green); }
  .fb-kit .test-phase.warn { border-left-color: var(--gold); }
  .fb-kit .test-phase h4 { font-size: 15px; font-weight: 800; color: var(--gray-900); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .fb-kit .test-phase .badge-free { background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .08em; }
  .fb-kit .test-phase p { font-size: 13px; color: var(--gray-600); line-height: 1.65; margin-bottom: 12px; }
  .fb-kit .test-phase ol, .fb-kit .test-phase ul { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
  .fb-kit .test-phase ol li, .fb-kit .test-phase ul li { font-size: 13px; color: var(--gray-700); line-height: 1.6; }
  .fb-kit .test-phase .cmd { background: #1e293b; color: #7dd3fc; font-family: monospace; font-size: 12px; padding: 10px 14px; border-radius: 8px; margin: 8px 0; display: block; overflow-x: auto; }
  .fb-kit .test-phase .inline-code { background: var(--gray-100); border: 1px solid var(--gray-200); border-radius: 4px; padding: 1px 6px; font-size: 12px; color: var(--blue-dark); font-family: monospace; }
  .fb-kit .checklist { display: flex; flex-direction: column; gap: 8px; }
  .fb-kit .checklist-item { display: flex; align-items: flex-start; gap: 10px; background: white; border-radius: 10px; padding: 12px 16px; box-shadow: 0 1px 4px rgba(0,0,0,.05); font-size: 13px; color: var(--gray-700); line-height: 1.5; }
  .fb-kit .checklist-item .ci-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .fb-kit .checklist-item strong { color: var(--gray-900); }
`

const html = `
<div class="page">
  <h1 class="page-title">Facebook BMV Campaign <span>Ad Kit</span></h1>
  <p class="page-subtitle">Professional marketing materials + step-by-step setup guide for finding motivated sellers</p>

  <div class="toc">
    <h3>📋 What's in this guide</h3>
    <ol>
      <li><a href="#posters">Ad Creative Designs (2 variants)</a></li>
      <li><a href="#lead-form">Lead Form Questions</a></li>
      <li><a href="#webhook">Webhook Integration</a></li>
      <li><a href="#free-test">🆓 Free End-to-End Testing (No Spend)</a></li>
      <li><a href="#campaign-setup">Step-by-Step Campaign Setup</a></li>
      <li><a href="#targeting">Audience Targeting</a></li>
      <li><a href="#budget">Budget &amp; Bidding</a></li>
      <li><a href="#copy">Ad Copy Variants</a></li>
      <li><a href="#ab">A/B Testing Strategy</a></li>
      <li><a href="#kpis">KPIs &amp; Optimisation</a></li>
    </ol>
  </div>

  <!-- Section 1: Ad Posters -->
  <div class="section" id="posters">
    <div class="section-label">Section 1</div>
    <h2 class="section-title">Ad Creative Designs</h2>
    <p class="section-desc">Two proven poster variants targeting different seller motivations. Use both in the same campaign for A/B testing. Recommended size: <strong>1080×1080px</strong> (square) or <strong>1080×1920px</strong> (Stories).</p>
    <div class="ad-grid">
      <div class="ad-card">
        <div class="ad-label">Variant A — Urgency &amp; Speed <span class="badge">Primary</span></div>
        <div class="poster-1">
          <div>
            <div class="eyebrow">🏠 Sell Your Property Fast</div>
            <h2>Need to Sell<br/><em>Quickly &amp; Hassle-Free?</em></h2>
            <p>We buy properties in any condition across Wales &amp; the South West — no estate agent fees, no delays.</p>
            <div class="bullets">
              <div class="bullet">Cash offer within 24 hours</div>
              <div class="bullet">Completion in as little as 7 days</div>
              <div class="bullet">Any condition — we handle everything</div>
              <div class="bullet">No fees, no chains, no stress</div>
            </div>
          </div>
          <div>
            <div class="cta">👉 Get Your Free Cash Offer</div>
            <p class="footer-note">🔒 Your details are safe — no obligation, no hard sell</p>
          </div>
        </div>
      </div>
      <div class="ad-card">
        <div class="ad-label">Variant B — Trust &amp; Social Proof</div>
        <div class="poster-2">
          <div class="top-band">
            <h2>Trusted Property Buyers<br/>in Your Area</h2>
            <p>Join homeowners who've sold fast — stress-free</p>
          </div>
          <div class="body">
            <div class="stat-row">
              <div class="stat"><div class="num">48h</div><div class="lbl">Avg. Offer</div></div>
              <div class="stat"><div class="num">£0</div><div class="lbl">Agent Fees</div></div>
              <div class="stat"><div class="num">7–28</div><div class="lbl">Days to Complete</div></div>
            </div>
            <div class="quote">
              <p>"They made us a fair cash offer within a day. Sold in 2 weeks — couldn't believe how easy it was."</p>
              <span>— Sarah M., Cardiff</span>
            </div>
            <p style="font-size:13px;color:#374151;line-height:1.6;">Facing repossession, divorce, probate, or just ready to move on? We can help — no pressure, no fees.</p>
          </div>
          <div class="cta-band">
            <p>Get a Free Cash Offer Today<br/><span>Takes less than 2 minutes</span></p>
          </div>
        </div>
      </div>
    </div>
    <div class="callout gold" style="margin-top:20px;">
      💡 <strong>Design Tips:</strong> Use a real photo of a UK terraced or semi-detached house (not stock imagery) as the background in Canva or Adobe Express. Add your company logo top-left. Use brand blue <code>#1e3a8a</code> as your primary colour. A real local photo increases CTR by up to 40%.
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 2: Lead Form -->
  <div class="section" id="lead-form">
    <div class="section-label">Section 2</div>
    <h2 class="section-title">Facebook Lead Ad Form</h2>
    <p class="section-desc">Designed to capture all fields your app needs to auto-create a VendorLead and trigger the AI qualification conversation. Keep it under 8 questions — every extra field drops completion rate by ~10%.</p>
    <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;">
      <div class="form-preview" style="flex:1;min-width:300px;">
        <div class="form-header">
          <h3>🏠 Get Your Free Cash Offer</h3>
          <p>Fill in your details below — we'll be in touch within 24 hours</p>
        </div>
        <div class="form-body">
          <div class="form-section-title">About You</div>
          <div class="form-row">
            <div class="form-group">
              <label>Full Name <span class="req">*</span></label>
              <div class="field">e.g. John Smith</div>
              <div class="field-map">→ vendorName</div>
            </div>
            <div class="form-group">
              <label>Phone Number <span class="req">*</span></label>
              <div class="field">e.g. 07700 000000</div>
              <div class="field-map">→ vendorPhone</div>
            </div>
          </div>
          <div class="form-group">
            <label>Email Address <span class="note">(optional)</span></label>
            <div class="field">e.g. john@email.com</div>
            <div class="field-map">→ vendorEmail</div>
          </div>
          <div class="form-section-title" style="margin-top:16px;">About the Property</div>
          <div class="form-group">
            <label>Property Address <span class="req">*</span></label>
            <div class="field">Full address including street</div>
            <div class="field-map">→ propertyAddress</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Postcode <span class="req">*</span></label>
              <div class="field">e.g. CF10 1AB</div>
              <div class="field-map">→ propertyPostcode</div>
            </div>
            <div class="form-group">
              <label>Asking Price <span class="req">*</span></label>
              <div class="field">e.g. £185,000</div>
              <div class="field-map">→ askingPrice</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Property Type</label>
              <div class="field">Terraced / Semi / Flat…</div>
              <div class="field-map">→ propertyType</div>
            </div>
            <div class="form-group">
              <label>Bedrooms</label>
              <div class="field">e.g. 3</div>
              <div class="field-map">→ bedrooms</div>
            </div>
          </div>
          <div class="form-section-title" style="margin-top:16px;">Your Situation</div>
          <div class="form-group">
            <label>Why are you selling?</label>
            <div class="field">Relocation / Financial / Divorce…</div>
            <div class="field-map">→ selling_reason → reasonForSelling</div>
          </div>
          <div class="form-group">
            <label>How quickly do you need to sell?</label>
            <div class="field">ASAP / 1–3 months / Flexible…</div>
            <div class="field-map">→ urgency → urgencyLevel</div>
          </div>
          <div class="form-cta">Submit &amp; Get My Free Offer →</div>
          <p class="privacy-note">🔒 Your data is safe. We won't share it with third parties.<br/>By submitting you agree to be contacted regarding your property.</p>
        </div>
      </div>
      <div style="flex:1;min-width:280px;display:flex;flex-direction:column;gap:14px;">
        <div class="callout blue">
          <strong>Pre-filled by Facebook:</strong> Name, phone, and email are automatically pre-filled from the user's Facebook profile — increasing form completions by up to 60%.
        </div>
        <div class="callout green">
          <strong>App auto-processes on submit:</strong>
          <ul style="margin-top:8px;list-style:none;display:flex;flex-direction:column;gap:4px;">
            <li>✅ Creates VendorLead record</li>
            <li>✅ Fetches PropertyData market value</li>
            <li>✅ Calculates BMV% automatically</li>
            <li>✅ Triggers AI SMS conversation</li>
            <li>✅ Enters NEW_LEAD pipeline stage</li>
          </ul>
        </div>
        <div class="callout gold">
          <strong>Hidden campaign field:</strong> Add a hidden <code>campaign_id</code> field mapped to your Facebook Campaign ID — the app stores this in <code>campaignId</code> so you can track which campaigns generate the best leads.
        </div>
        <div style="background:white;border-radius:12px;padding:18px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">🎯 Selling Reason Options</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:#374151;">
            <div>📦 <strong>Relocation</strong> — job move, emigrating</div>
            <div>💰 <strong>Financial difficulty</strong> — debt, repossession risk</div>
            <div>💔 <strong>Divorce / separation</strong></div>
            <div>⚰️ <strong>Probate / inheritance</strong></div>
            <div>📉 <strong>Downsizing</strong> — retiring, empty nesters</div>
            <div>❓ <strong>Other</strong></div>
          </div>
        </div>
        <div style="background:white;border-radius:12px;padding:18px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">⏱ Urgency Options</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:#374151;">
            <div>🔴 <strong>ASAP</strong> → <code>urgent</code></div>
            <div>🟠 <strong>Within 1 month</strong> → <code>quick</code></div>
            <div>🟡 <strong>1–3 months</strong> → <code>moderate</code></div>
            <div>🟢 <strong>3+ months / Flexible</strong> → <code>flexible</code></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 3: Webhook -->
  <div class="section" id="webhook">
    <div class="section-label">Section 3</div>
    <h2 class="section-title">Webhook Integration</h2>
    <p class="section-desc">Your app already has a Facebook webhook endpoint. Connect it to Meta's Lead Ads system so every form submission flows directly into your pipeline — no manual data entry.</p>
    <div class="webhook-box">
      <h4>🔗 Your Webhook Endpoint</h4>
      <p>Already built in your app. Register it in Meta Business Manager under Lead Access → Webhooks:</p>
      <pre>POST  https://your-domain.com/api/facebook-leads/webhook
GET   https://your-domain.com/api/facebook-leads/webhook  ← verification</pre>
      <h4 style="margin-top:20px;margin-bottom:8px;">📋 Facebook Form Field → Database Mapping</h4>
      <div class="field-list">
        <div class="field-row"><span class="fb">full_name</span><span class="arrow">→</span><span class="db">vendorName</span></div>
        <div class="field-row"><span class="fb">phone_number</span><span class="arrow">→</span><span class="db">vendorPhone</span></div>
        <div class="field-row"><span class="fb">email</span><span class="arrow">→</span><span class="db">vendorEmail</span></div>
        <div class="field-row"><span class="fb">property_address</span><span class="arrow">→</span><span class="db">propertyAddress</span></div>
        <div class="field-row"><span class="fb">property_postcode</span><span class="arrow">→</span><span class="db">propertyPostcode</span></div>
        <div class="field-row"><span class="fb">asking_price</span><span class="arrow">→</span><span class="db">askingPrice</span></div>
        <div class="field-row"><span class="fb">property_type</span><span class="arrow">→</span><span class="db">propertyType</span></div>
        <div class="field-row"><span class="fb">bedrooms</span><span class="arrow">→</span><span class="db">bedrooms</span></div>
        <div class="field-row"><span class="fb">selling_reason</span><span class="arrow">→</span><span class="db">reasonForSelling</span></div>
        <div class="field-row"><span class="fb">urgency</span><span class="arrow">→</span><span class="db">urgencyLevel</span></div>
        <div class="field-row"><span class="fb">campaign_id (hidden)</span><span class="arrow">→</span><span class="db">campaignId</span></div>
        <div class="field-row"><span class="fb">leadgen_id (auto)</span><span class="arrow">→</span><span class="db">facebookLeadId</span></div>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 4: Free Testing -->
  <div class="section" id="free-test">
    <div class="section-label">Section 4 — Do This First</div>
    <h2 class="section-title">Free End-to-End Testing</h2>
    <p class="section-desc">Complete this entire section <strong>before creating your ad campaign</strong> and before spending any money. You can test the full pipeline — Facebook form → webhook → app → AI SMS — completely free using Meta's own testing tools and a free ngrok tunnel.</p>

    <div class="callout green" style="margin-bottom:24px;">
      ✅ <strong>Goal:</strong> By the end of this section you should see a real test lead appear in your Vendor Leads pipeline, with BMV calculated, AI SMS triggered — all without spending a single penny on ads.
    </div>

    <div class="test-phase free">
      <h4>Step 1 — Expose Your Local App with ngrok <span class="badge-free">Free</span></h4>
      <p>Facebook's webhook verification requires a public HTTPS URL. Use ngrok to create a secure tunnel to your local dev server — completely free, no credit card needed.</p>
      <ol>
        <li><strong>Install ngrok:</strong> Download from <code class="inline-code">ngrok.com/download</code> or run <code class="inline-code">choco install ngrok</code> on Windows</li>
        <li><strong>Sign up for a free ngrok account</strong> at ngrok.com — gives you a stable subdomain</li>
        <li><strong>Authenticate:</strong> Run the auth command shown in your ngrok dashboard</li>
        <li><strong>Start your Next.js app</strong> as normal: <span class="cmd">npm run dev</span></li>
        <li><strong>In a second terminal, start ngrok:</strong><span class="cmd">ngrok http 3000</span></li>
        <li>Copy the <strong>Forwarding URL</strong> shown — it looks like <code class="inline-code">https://abc123.ngrok-free.app</code></li>
      </ol>
      <div class="callout blue" style="margin-top:12px;">
        💡 Your webhook URL will be: <code class="inline-code">https://abc123.ngrok-free.app/api/facebook-leads/webhook</code> — use this in the next steps. The URL changes each time you restart ngrok unless you use a paid static domain (£6/mo).
      </div>
    </div>

    <div class="test-phase free">
      <h4>Step 2 — Create a Meta Developer App <span class="badge-free">Free</span></h4>
      <p>You need a Meta Developer App to access the Lead Ads Testing Tool and register your webhook. This is separate from your ad account and costs nothing.</p>
      <ol>
        <li>Go to <code class="inline-code">developers.facebook.com</code> → <strong>My Apps → Create App</strong></li>
        <li>Choose <strong>"Business"</strong> as app type → enter a name like "Deal Sourcing Test"</li>
        <li>On the App Dashboard, find <strong>"Lead Ads Retrieval"</strong> → click <strong>Set Up</strong></li>
        <li>Go to <strong>Settings → Basic</strong> → copy your <strong>App ID</strong> and <strong>App Secret</strong> — you'll need these for webhook verification</li>
        <li>Add these to your <code class="inline-code">.env.local</code>:<span class="cmd">FACEBOOK_APP_ID=your_app_id&#10;FACEBOOK_APP_SECRET=your_app_secret&#10;FACEBOOK_VERIFY_TOKEN=any_random_string_you_choose</span></li>
      </ol>
    </div>

    <div class="test-phase free">
      <h4>Step 3 — Register and Verify Your Webhook <span class="badge-free">Free</span></h4>
      <p>Tell Meta where to send lead data when someone submits the form.</p>
      <ol>
        <li>In your Meta Developer App → left menu → <strong>Webhooks</strong></li>
        <li>Click <strong>Subscribe to this object</strong> → choose <strong>"Page"</strong></li>
        <li>Enter your ngrok URL: <code class="inline-code">https://abc123.ngrok-free.app/api/facebook-leads/webhook</code></li>
        <li>Enter your <strong>Verify Token</strong> — the same value you set in <code class="inline-code">FACEBOOK_VERIFY_TOKEN</code></li>
        <li>Click <strong>Verify and Save</strong> — Meta will send a GET request to your webhook; your app should respond with the challenge</li>
        <li>Once verified, tick the <strong>"leadgen"</strong> subscription checkbox and save</li>
      </ol>
      <div class="callout gold" style="margin-top:12px;">
        ⚠️ If verification fails: check ngrok is running, your Next.js dev server is running on port 3000, and your <code class="inline-code">FACEBOOK_VERIFY_TOKEN</code> matches exactly what you entered.
      </div>
    </div>

    <div class="test-phase free">
      <h4>Step 4 — Build Your Lead Form (Draft, Not Published) <span class="badge-free">Free</span></h4>
      <p>Create the Instant Form inside your Facebook Page — you don't need to attach it to a paid ad to test it. Forms can be tested for free using the testing tool.</p>
      <ol>
        <li>Go to your <strong>Facebook Business Page → Publishing Tools → Instant Forms</strong> (or via Meta Business Suite → All Tools → Instant Forms)</li>
        <li>Click <strong>Create</strong> → <strong>New Form</strong></li>
        <li>Add all fields from Section 2 of this guide — use the exact question keys listed (e.g. <code class="inline-code">property_address</code>, <code class="inline-code">asking_price</code>)</li>
        <li>Add a hidden field: key = <code class="inline-code">campaign_id</code>, value = <code class="inline-code">test_campaign_001</code></li>
        <li>Save as <strong>Draft</strong> — you do NOT need to publish it or attach it to an ad to test</li>
        <li>Copy the <strong>Form ID</strong> from the form list — you need this for the testing tool</li>
      </ol>
    </div>

    <div class="test-phase free">
      <h4>Step 5 — Send a Free Test Lead <span class="badge-free">Free — £0</span></h4>
      <p>Meta's Lead Ads Testing Tool lets you submit a real test lead to your form and have it delivered to your webhook — exactly as if a real person filled it in. No ad spend, no credit card, nothing charged.</p>
      <ol>
        <li>Go to: <code class="inline-code">developers.facebook.com/tools/lead-ads-testing</code></li>
        <li>Select your <strong>Facebook Page</strong> and your <strong>Lead Form</strong> from the dropdowns</li>
        <li>Click <strong>"Create lead"</strong> — Meta fires a real webhook event to your registered URL</li>
        <li>Watch your <strong>ngrok terminal</strong> — you should see an incoming POST request within seconds</li>
        <li>Open your <strong>Vendor Leads</strong> pipeline in the app — a new lead should appear in the <strong>New Lead</strong> stage</li>
      </ol>
      <div class="callout green" style="margin-top:12px;">
        🎉 If the lead appears in your pipeline — <strong>your entire integration is working</strong>. You can now go live with confidence.
      </div>
      <div class="callout gold" style="margin-top:10px;">
        💡 <strong>Re-test tip:</strong> You can only submit one test lead per form per Facebook account using the tool. To test again, delete the previous test lead from your app or use a different Facebook test account.
      </div>
    </div>

    <div class="test-phase free">
      <h4>Step 6 — Verify the Full Pipeline <span class="badge-free">Free</span></h4>
      <p>Before going live, check each part of the system responded correctly to the test lead.</p>
      <div class="checklist" style="margin-top:4px;">
        <div class="checklist-item"><span class="ci-icon">📋</span><span><strong>Lead created:</strong> Check Vendor Leads page — new entry with name "Test User" (or whatever the test tool generated)</span></div>
        <div class="checklist-item"><span class="ci-icon">🏠</span><span><strong>Property data fetched:</strong> If a real postcode was used, check the BMV% and market value fields are populated</span></div>
        <div class="checklist-item"><span class="ci-icon">📊</span><span><strong>Pipeline stage:</strong> Lead should be in <strong>New Lead</strong> stage automatically</span></div>
        <div class="checklist-item"><span class="ci-icon">💬</span><span><strong>AI SMS triggered:</strong> If Twilio is connected, check a qualification message was sent to the test phone number</span></div>
        <div class="checklist-item"><span class="ci-icon">🔔</span><span><strong>Sourcing alert fired:</strong> If you have a sourcing alert configured, check it triggered</span></div>
        <div class="checklist-item"><span class="ci-icon">🏷️</span><span><strong>Campaign field stored:</strong> Open the lead detail — <code class="inline-code">campaign_id</code> should show <code class="inline-code">test_campaign_001</code></span></div>
      </div>
    </div>

    <div class="test-phase warn">
      <h4>Step 7 — Test with Postman (Optional — No Facebook Account Needed)</h4>
      <p>You can also test your webhook directly using Postman or curl — useful for testing the exact payload format before involving Facebook at all.</p>
      <p>Send a POST to your local webhook URL with a test payload:</p>
      <span class="cmd">curl -X POST http://localhost:3000/api/facebook-leads/webhook \\&#10;  -H "Content-Type: application/json" \\&#10;  -d '{&#10;    "object": "page",&#10;    "entry": [{&#10;      "changes": [{&#10;        "field": "leadgen",&#10;        "value": {&#10;          "leadgen_id": "test_001",&#10;          "page_id": "your_page_id",&#10;          "form_id": "your_form_id",&#10;          "field_data": [&#10;            { "name": "full_name",        "values": ["John Test"] },&#10;            { "name": "phone_number",     "values": ["07700 000000"] },&#10;            { "name": "property_address", "values": ["123 Test Street, Cardiff"] },&#10;            { "name": "property_postcode","values": ["CF10 1AB"] },&#10;            { "name": "asking_price",     "values": ["185000"] },&#10;            { "name": "selling_reason",   "values": ["financial"] },&#10;            { "name": "urgency",          "values": ["urgent"] }&#10;          ]&#10;        }&#10;      }]&#10;    }]&#10;  }'</span>
      <div class="callout blue" style="margin-top:8px;">This approach lets you test edge cases — missing fields, unusual values, malformed postcodes — without creating Facebook forms or spending anything.</div>
    </div>

    <div class="callout green">
      ✅ <strong>Test checklist complete?</strong> Once Steps 1–6 all pass, delete your test lead from the pipeline and proceed to Section 5 to set up your real paid campaign. You'll know every piece works before a single pound is spent.
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 5: Campaign Setup -->
  <div class="section" id="campaign-setup">
    <div class="section-label">Section 5</div>
    <h2 class="section-title">Step-by-Step Campaign Setup</h2>
    <p class="section-desc">Follow these steps exactly in Meta Business Manager to launch your first lead generation campaign.</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>Set Up Meta Business Manager</h4>
          <p>Go to <strong>business.facebook.com</strong> and complete business verification. Required before running Lead Ads.</p>
          <div class="step-tips">
            <div class="step-tip"><span>✅</span> Create a Business Manager account (if you haven't)</div>
            <div class="step-tip"><span>✅</span> Connect your Facebook Business Page</div>
            <div class="step-tip"><span>✅</span> Set up a payment method (credit card or direct debit)</div>
            <div class="step-tip"><span>✅</span> Verify your business identity (required for property/financial ads)</div>
            <div class="step-tip"><span>⚠️</span> <strong>Property ads may require Special Ad Category "Housing"</strong> — limits some targeting but is legally required</div>
          </div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>Build the Instant Lead Form</h4>
          <p>In Ads Manager → Instant Forms. This is the form that syncs with your webhook.</p>
          <div class="step-tips">
            <div class="step-tip"><span>1.</span> <strong>Form Type:</strong> Choose <strong>"Higher Intent"</strong> — adds review screen, filters accidental submissions</div>
            <div class="step-tip"><span>2.</span> <strong>Questions:</strong> Add each field from Section 2 — use "Short Answer" for address/name, "Multiple Choice" for selling reason and urgency</div>
            <div class="step-tip"><span>3.</span> <strong>Pre-fill:</strong> Enable pre-fill for Full Name, Phone, Email from Facebook profile</div>
            <div class="step-tip"><span>4.</span> <strong>Privacy Policy:</strong> Required by Meta — link to your website's privacy page</div>
            <div class="step-tip"><span>5.</span> <strong>Thank You screen:</strong> "We'll be in touch within 24 hours with your cash offer"</div>
          </div>
          <div class="callout blue" style="margin-top:12px;">
            💡 <strong>Field Names Matter:</strong> The "Question Key" (internal name) must exactly match what your webhook expects: <code>property_address</code>, <code>property_postcode</code>, <code>asking_price</code>, <code>selling_reason</code>, <code>urgency</code>. These are case-sensitive.
          </div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>Connect the Webhook</h4>
          <p>Link your app's endpoint so every lead flows automatically into your pipeline.</p>
          <div class="step-tips">
            <div class="step-tip"><span>Option A</span> <strong>Direct Webhook (Recommended):</strong> Meta for Developers → Your App → Lead Access → Webhooks → Subscribe to <code>leadgen</code> events</div>
            <div class="step-tip"><span>Option B</span> <strong>Zapier / Make.com:</strong> Facebook Lead Ads trigger → HTTP POST to <code>/api/facebook-leads/webhook</code>. ~£20/mo, zero-code setup</div>
            <div class="step-tip"><span>Option C</span> <strong>Meta CRM Integration:</strong> Lead Ad form settings → CRM Integration → "Other CRM" → paste webhook URL</div>
          </div>
          <div class="callout green" style="margin-top:12px;">
            🔑 Your webhook handles the <strong>GET verification challenge</strong> automatically. Make sure your app is live on HTTPS before registering.
          </div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>Create the Ad Campaign</h4>
          <p>In Ads Manager, create a new campaign with the <strong>Lead generation</strong> objective.</p>
          <div class="step-tips">
            <div class="step-tip"><span>1.</span> <strong>Campaign:</strong> Objective = Leads | Budget = Campaign Budget Optimisation (CBO) | Special Ad Category = Housing</div>
            <div class="step-tip"><span>2.</span> <strong>Ad Set:</strong> Lead method = Instant Forms | Set targeting (see Section 5) | Placements = Automatic</div>
            <div class="step-tip"><span>3.</span> <strong>Ad:</strong> Upload your poster images | Write headline (see Section 7) | Select Instant Form</div>
            <div class="step-tip"><span>4.</span> <strong>CTA Button:</strong> Use "Get Quote" — avoid "Sign Up" (signals too much commitment)</div>
          </div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">5</div>
        <div class="step-content">
          <h4>Test Before Going Live</h4>
          <p>Always test the full flow. Use the Meta Lead Ads Testing Tool (search in Meta for Developers).</p>
          <div class="step-tips">
            <div class="step-tip"><span>🔧</span> Submit a test lead via the Lead Ads Testing Tool — no budget spent</div>
            <div class="step-tip"><span>✅</span> Verify VendorLead appears in your pipeline within 30 seconds</div>
            <div class="step-tip"><span>✅</span> Confirm the AI SMS conversation is triggered</div>
            <div class="step-tip"><span>✅</span> Check BMV calculation ran if asking price was provided</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 6: Targeting -->
  <div class="section" id="targeting">
    <div class="section-label">Section 6</div>
    <h2 class="section-title">Audience Targeting</h2>
    <p class="section-desc">Target motivated sellers — not buyers. Focus on homeowners in financial stress, life transitions, or those needing a fast sale.</p>
    <div class="target-grid">
      <div class="target-card"><h5>📍 Location</h5><ul><li>Target your sourcing area (Wales, South West)</li><li>Set radius: 20–40 miles from key city centres</li><li>Cardiff, Swansea, Newport, Bristol</li><li>Exclude very rural areas if not buying there</li></ul></div>
      <div class="target-card"><h5>👤 Demographics</h5><ul><li>Age: 35–65 (peak homeownership + life events)</li><li>Homeowners only (FB "Homeowner" filter)</li><li>All genders</li><li>Income: all (financial stress crosses all incomes)</li></ul></div>
      <div class="target-card"><h5>🎯 Interest Targeting</h5><ul><li>"Property" / "Real estate" interest</li><li>"Debt consolidation" / "Mortgage"</li><li>"Retirement planning"</li><li>"Moving home" life event</li><li>Competitors: Rightmove, Zoopla, Purple Bricks</li></ul></div>
      <div class="target-card"><h5>🔄 Custom Audiences (Advanced)</h5><ul><li>Website visitors (via Pixel) — retarget non-converters</li><li>Video viewers — 50%+ watch time</li><li>Lookalike Audience from existing vendor leads (1–2%)</li><li>Customer list upload (past sellers / contacts)</li></ul></div>
      <div class="target-card"><h5>🚫 Exclusions</h5><ul><li>Exclude "Real estate agent" job titles</li><li>Exclude people who already submitted a lead</li><li>Exclude "Property investor" interests</li></ul></div>
      <div class="target-card"><h5>⚠️ Special Ad Category Note</h5><ul><li>Housing ads restrict age/gender targeting</li><li>Cannot exclude by postcode under SAC rules</li><li>Interest targeting still works</li><li>Lookalike audiences still available</li></ul></div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 7: Budget -->
  <div class="section" id="budget">
    <div class="section-label">Section 7</div>
    <h2 class="section-title">Budget &amp; Bidding Strategy</h2>
    <p class="section-desc">UK property Lead Ads typically cost £8–£25 per lead. Your BMV strategy needs ~1 deal per 50–100 leads.</p>
    <table class="budget-table">
      <thead><tr><th>Phase</th><th>Daily Budget</th><th>Duration</th><th>Expected Leads</th><th>Cost Per Lead</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td><strong>Phase 1: Testing</strong><br/><span style="font-size:11px;color:#6b7280">Learning phase — don't judge yet</span></td><td>£15–20/day</td><td>2 weeks</td><td>~20–30 leads</td><td>£10–25</td><td>~£210–280</td></tr>
        <tr><td><strong>Phase 2: Optimise</strong><br/><span style="font-size:11px;color:#6b7280">Pause worst ads, scale best</span></td><td>£30–50/day</td><td>1 month</td><td>~60–100 leads</td><td>£8–18</td><td>~£900–1,500</td></tr>
        <tr><td><strong>Phase 3: Scale</strong><br/><span style="font-size:11px;color:#6b7280">Proven creative, proven audience</span></td><td>£75–150/day</td><td>Ongoing</td><td>3–7 leads/day</td><td>£8–15</td><td>£2,250+/mo</td></tr>
        <tr><td><strong>1 Deal closed at 15% BMV</strong></td><td colspan="3">—</td><td class="green">Typical profit: £25,000–£50,000+</td><td class="green">ROI: 10–30×</td></tr>
      </tbody>
    </table>
    <div class="callout gold" style="margin-top:16px;">💡 <strong>Bidding:</strong> Start with <strong>Lowest Cost</strong>. Once you have 50+ leads, switch to <strong>Cost Per Result Goal</strong> targeting £12–15 per lead. Never use manual bid caps in the learning phase.</div>
  </div>

  <hr class="divider" />

  <!-- Section 8: Copy -->
  <div class="section" id="copy">
    <div class="section-label">Section 8</div>
    <h2 class="section-title">Ad Copy Variants</h2>
    <p class="section-desc">The best-performing copy for motivated sellers focuses on <strong>speed, certainty, and no fees</strong> — not the price.</p>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
        <div style="font-size:11px;font-weight:700;color:#1a56db;margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em;">Copy A — Pain Point</div>
        <div style="font-size:13px;color:#111827;line-height:1.7;border-left:3px solid #1a56db;padding-left:14px;">
          <strong>Headline:</strong> "Need to Sell Your Home Fast? We Buy Any Property in Wales"<br/>
          <strong>Primary Text:</strong> Struggling with mortgage repayments? Going through a divorce? Inherited a property? We offer a fast, fair cash purchase — no estate agents, no fees, no delays. Get a no-obligation offer within 24 hours.<br/>
          <strong>CTA:</strong> Get Free Quote
        </div>
      </div>
      <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
        <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em;">Copy B — Specific Scenario</div>
        <div style="font-size:13px;color:#111827;line-height:1.7;border-left:3px solid #d97706;padding-left:14px;">
          <strong>Headline:</strong> "Relocating and Need a Quick Sale? Skip the Estate Agent Hassle"<br/>
          <strong>Primary Text:</strong> We've helped 50+ homeowners sell quickly across South Wales. Cash offer in 24h, completion in 7–28 days. Any condition — probate, tenanted, or problem properties welcome. 100% confidential.<br/>
          <strong>CTA:</strong> Get Your Offer
        </div>
      </div>
      <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em;">Copy C — Social Proof</div>
        <div style="font-size:13px;color:#111827;line-height:1.7;border-left:3px solid #16a34a;padding-left:14px;">
          <strong>Headline:</strong> "⭐⭐⭐⭐⭐ 'Sold in 12 Days — Couldn't Believe How Easy It Was'"<br/>
          <strong>Primary Text:</strong> "We contacted [Company] on a Monday and had a cash offer by Wednesday. Completed in under 2 weeks. No fees, no stress." — Mark T., Swansea. Own a property in Wales and want a fast, hassle-free sale? Fill out the form below.<br/>
          <strong>CTA:</strong> Learn More
        </div>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 9: A/B Testing -->
  <div class="section" id="ab">
    <div class="section-label">Section 9</div>
    <h2 class="section-title">A/B Testing Strategy</h2>
    <p class="section-desc">Never change two things at once. Test one variable per experiment. Run for at least 7 days and 50+ impressions per variant before judging.</p>
    <div class="ab-grid">
      <div class="ab-card"><div class="ab-label a">Test 1 — Creative</div><h5>Image vs. Video</h5><p>A 15–30 second video consistently outperforms static images by 20–40% for lead ads.</p><ul><li>A: Static poster (Variant A or B above)</li><li>B: 30-sec "How it works" Canva video</li><li>B: Real testimonial from past seller</li></ul></div>
      <div class="ab-card"><div class="ab-label b">Test 2 — Headline</div><h5>Speed vs. Price vs. No-Fee</h5><p>Test which motivator resonates most with your local audience.</p><ul><li>A: "Sell in 7 Days — Cash Offer Today"</li><li>B: "We Beat Any Estate Agent Price"</li><li>C: "No Fees. No Chain. No Stress."</li></ul></div>
      <div class="ab-card"><div class="ab-label a">Test 3 — Audience</div><h5>Interest vs. Lookalike</h5><p>Once you have 50+ leads, upload as Custom Audience and create a 1% Lookalike — often 30% cheaper CPL.</p><ul><li>A: Interest-based (homeowner + life events)</li><li>B: 1% Lookalike from existing leads</li></ul></div>
      <div class="ab-card"><div class="ab-label b">Test 4 — Form Length</div><h5>Short vs. Full Form</h5><p>More fields = better quality but lower volume. Test which generates more convertible leads.</p><ul><li>A: Full 10-field form</li><li>B: Short form — name, phone, postcode only</li><li>Measure: cost per qualified lead</li></ul></div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section 10: KPIs -->
  <div class="section" id="kpis">
    <div class="section-label">Section 10</div>
    <h2 class="section-title">KPIs &amp; Optimisation Checklist</h2>
    <p class="section-desc">Review weekly. Kill underperformers at 7 days, scale winners at 14 days.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
        <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">📊 Key Metrics to Track</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#374151;">
          <div style="display:flex;justify-content:space-between;"><span>CPL (Cost Per Lead)</span><span style="color:#1a56db;font-weight:700;">Target: £8–15</span></div>
          <div style="display:flex;justify-content:space-between;"><span>CTR (Click-Through Rate)</span><span style="color:#1a56db;font-weight:700;">Target: 1.5%+</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Form Completion Rate</span><span style="color:#1a56db;font-weight:700;">Target: 40%+</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Lead-to-Conversation Rate</span><span style="color:#1a56db;font-weight:700;">Target: 30%+</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Conversation-to-Deal Rate</span><span style="color:#1a56db;font-weight:700;">Target: 5–10%</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Ad Frequency</span><span style="color:#d97706;font-weight:700;">Pause if &gt; 3.0</span></div>
        </div>
      </div>
      <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.06);">
        <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">✅ Weekly Optimisation Checklist</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#374151;">
          <div>☐ Check CPL — pause any ad set over £25 CPL</div>
          <div>☐ Check frequency — pause if &gt; 3.0 (ad fatigue)</div>
          <div>☐ Review lead quality in your app pipeline</div>
          <div>☐ Check AI SMS response rate</div>
          <div>☐ Refresh creative every 2–3 weeks</div>
          <div>☐ Scale budget 20% on winning ad sets</div>
        </div>
      </div>
      <div class="callout green" style="grid-column:span 2;">
        🔁 <strong>Retargeting Loop:</strong> Once your pixel has 500+ events, create a retargeting campaign targeting people who visited your website in the last 30 days but didn't submit. These leads are 3–5× cheaper and much higher intent than cold traffic.
      </div>
    </div>
  </div>
</div>
`

export default function FacebookCampaignContent() {
  return (
    <div className="fb-kit min-h-screen bg-gray-100">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

# Property Deal Sourcing SaaS - Complete Project Brief

## Executive Summary

**Product Name:** DealStack (or your preferred name)

**Business Model:** B2B SaaS platform that sources, analyzes, and packages property investment deals, then sells them to investors for £3,000-£5,000 per deal.

**Target Users:** 
- **Internal Team (2-5 people):** Deal sourcers, analysts, admins
- **External Customers:** Property investors seeking ready-made deals

**Core Value Proposition:** "We find the deals, you make the money" - Investors get fully-analyzed, mortgage-ready property deals without spending time searching.

---

## Business Model Explained

### How It Works:

**Step 1: Deal Sourcing**
- System automatically sources properties from PropertyData API
- Filters for criteria: BMV 15%+, Yield 8%+, specific areas
- Internal team reviews flagged opportunities

**Step 2: Deal Analysis**
- Deep dive on promising properties
- Calculate all metrics (BMV%, yield, ROCE, etc.)
- Verify market value with comparables
- Assess refurbishment needs
- Check mortgage-ability

**Step 3: Deal Packaging**
- Create professional investor pack (PDF)
- Include: Photos, floorplan, area analysis, financial projections
- Full breakdown: Purchase costs, rental analysis, ROI projections
- Exit strategy recommendations
- Risk assessment

**Step 4: Deal Marketing**
- List deal in investor portal
- Email to matched investors (based on criteria)
- Track views, interest, questions

**Step 5: Deal Sale**
- Investor purchases deal for £3,000-£5,000
- Payment via Stripe
- Full pack delivered immediately
- Deal marked as sold
- Follow-up support

**Step 6: Post-Sale**
- Track if investor proceeded with purchase
- Collect testimonials
- Manage ongoing relationship

---

## User Types & Permissions

### 1. Admin (Full Access)
**Can:**
- Manage all deals (create, edit, delete)
- Manage all investors
- View all analytics
- Configure system settings
- Manage team members
- Set pricing

**Dashboard Shows:**
- Total deals sourced
- Deals sold this month
- Revenue (£)
- Active investors
- Pipeline status
- Team performance

---

### 2. Deal Sourcer (Internal Team)
**Can:**
- Create new deals
- Edit assigned deals
- Upload photos/documents
- Generate investor packs
- Mark deals as ready for sale
- View deal pipeline

**Cannot:**
- Delete deals
- Change pricing
- Manage investors directly
- Access financial analytics

**Dashboard Shows:**
- My assigned deals
- Deals pending review
- Deals sold (my sourced)
- Personal stats

---

### 3. Investor (External Customer)
**Can:**
- Browse available deals
- Filter by criteria (location, price, yield)
- View deal summaries (limited info)
- Purchase deals
- Access purchased deals (full packs)
- Save favorites
- Set search alerts

**Cannot:**
- See unpublished deals
- Access system internals
- See other investors

**Dashboard Shows:**
- Available deals (matching criteria)
- My purchased deals
- Saved deals
- My investment criteria
- Alerts

---

## Core Features Breakdown

### Module 1: Deal Sourcing Engine

**Automated Sourcing:**
```
- PropertyData API integration
- Scheduled searches (daily 8am)
- Configurable search criteria:
  - Postcodes: SA11, SA12, CF24, etc.
  - Min BMV: 15%
  - Min Yield: 8%
  - Property types: terraced, semi, detached
  - Max price: configurable
  
- Auto-scoring system (0-100)
- Flag high-potential deals (score 70+)
- De-duplicate properties
```

**Manual Deal Entry:**
```
- Form for team to add deals found elsewhere
- Fields: address, asking price, bedrooms, type, agent details
- Upload photos directly
- Set status: New, Under Review, Packaged, Listed, Sold
```

**Deal Enrichment:**
```
- Auto-fetch property details (PropertyData)
- Calculate all metrics automatically
- Find comparable sales
- Generate valuation report
- Check EPC rating
- Area statistics
```

---

### Module 2: Deal Analysis & Packaging

**Analysis Tools:**
```
- BMV Calculator
- Rental Yield Calculator
- BRRRR Scenario Modeler
- ROI/ROCE Projections (1, 3, 5 years)
- Mortgage Affordability Check
- Refurb Cost Estimator
- Running Costs Calculator
```

**Investor Pack Generator:**
```
Generates professional PDF with:

Page 1: Executive Summary
- Property photo
- Address, price, bedrooms
- Key metrics (BMV%, Yield, ROCE)
- Investment summary
- Deal score

Page 2: Financial Analysis
- Purchase costs breakdown
- Rental analysis (gross & net yield)
- BRRRR strategy numbers
- 5-year projection
- Exit strategies

Page 3: Property Details
- Full description
- Photos (6-8 high quality)
- Floorplan (if available)
- EPC rating
- Local amenities map

Page 4: Area Analysis
- Recent sales data
- Rental demand stats
- Capital growth trends (5 years)
- Demographics
- Local developments

Page 5: Investment Strategy
- Recommended approach (BRRRR, Buy & Hold, etc.)
- Timeline
- Risk assessment
- Why this is a good deal

Page 6: Next Steps
- How to proceed
- Recommended solicitors/brokers
- Viewing arrangements
- Due diligence checklist
```

**Template System:**
```
- Multiple pack templates (Basic, Standard, Premium)
- Customizable branding
- Variable pricing based on template
- Auto-populate from deal data
```

---

### Module 3: Investor Management (CRM)

**Investor Profiles:**
```
Fields:
- Name, email, phone
- Investment criteria:
  - Preferred areas
  - Budget range
  - Strategy (BRRRR, BTL, Flip)
  - Min yield requirement
  - Min BMV requirement
- Investment experience (beginner/intermediate/advanced)
- Financing status (cash buyer/needs mortgage)
- Number of deals purchased
- Total spent (£)
- Last activity date
```

**Investor Matching:**
```
- Auto-match deals to investors based on criteria
- Send email alerts: "New deal matching your criteria"
- Track open rates, clicks
- A/B test subject lines
```

**Communication Log:**
```
- Track all interactions
- Email history
- Phone call notes
- Deal questions/answers
- Follow-up reminders
```

**Investor Portal:**
```
Investor-facing dashboard showing:
- Available deals (matched to their criteria)
- Recently added deals
- Purchased deals (with full packs)
- Saved/favorited deals
- Investment criteria settings
- Account/billing
```

---

### Module 4: Deal Pipeline & Workflow

**Deal Statuses:**
```
1. New → Just sourced, needs review
2. Under Review → Team analyzing
3. In Progress → Creating pack
4. Ready → Pack complete, not yet listed
5. Listed → Live for investors to purchase
6. Reserved → Investor expressed interest, pending payment
7. Sold → Payment received
8. Archived → Deal no longer available/investor didn't proceed
```

**Kanban Board:**
```
Visual pipeline with drag-drop:
[New] → [Review] → [In Progress] → [Ready] → [Listed] → [Sold]

Each card shows:
- Property photo
- Address
- Deal score
- Assigned to
- Days in status
```

**Workflow Automation:**
```
- Auto-move to "Ready" when pack generated
- Auto-email investors when status = Listed
- Auto-archive if unsold after 30 days
- Reminder if deal stuck in status >7 days
- Notify team when deal reserved
```

**Task Management:**
```
For each deal:
- Checklist items (e.g., "Get photos", "Call agent", "Generate pack")
- Assign team members
- Due dates
- Comments/notes
```

---

### Module 5: Deal Marketplace (Investor-Facing)

**Deal Listing Page:**
```
Grid/list view showing:
- Property photo
- Address (partial for non-purchased: "SA11 area")
- Price: £70,000
- Bedrooms: 3
- Deal score: 82/100
- BMV: 22%
- Yield: 11.1%
- Pack price: £3,500
- "View Details" button
```

**Filters:**
```
- Location (dropdown of available postcodes/regions)
- Price range (slider)
- Min BMV %
- Min Yield %
- Property type
- Deal score (70-100)
- Sort by: Score, Yield, BMV, Price, Date added
```

**Deal Detail Page (Preview - Before Purchase):**
```
Shows limited info:
- Main photo
- Partial address (area only)
- Key metrics
- Investment summary
- Why this is a good deal (bullet points)
- Price to purchase pack
- "Buy This Deal - £3,500" button
- Sample pages from investor pack
```

**Deal Detail Page (Full - After Purchase):**
```
Shows everything:
- Full address
- All photos
- Complete financial analysis
- Download PDF pack button
- Contact details for agent
- Recommended next steps
```

---

### Module 6: Payment & Monetization

**Pricing Tiers:**
```
- Basic Deal: £2,500 (properties under £100k, basic pack)
- Standard Deal: £3,500 (most deals, full pack)
- Premium Deal: £5,000 (high-value, exceptional metrics, premium pack)

Pricing rules auto-apply based on:
- Deal score (70-80 = Basic, 80-90 = Standard, 90+ = Premium)
- Property value
- Complexity
```

**Payment Processing:**
```
- Stripe integration
- One-time payments
- Instant access upon payment
- Auto-generate invoice
- Email receipt
- VAT handling (UK)
```

**Revenue Tracking:**
```
Admin dashboard shows:
- Total revenue (all time)
- Revenue this month
- Revenue by deal tier
- Revenue by team member
- Average deal price
- Conversion rate (views → purchases)
```

---

### Module 7: Document & Media Management

**Photo Upload:**
```
- Drag & drop interface
- Auto-resize/optimize
- Set cover photo
- Caption each photo
- Organize in gallery
- Max 15 photos per deal
```

**Document Storage:**
```
Store for each deal:
- Energy Performance Certificate (EPC)
- Floorplan
- Land Registry title
- Survey (if available)
- Comparable sales report
- Custom notes/documents
```

**Pack Generation:**
```
- Generate PDF from template + data
- Store generated pack
- Version control (if deal updated, regenerate)
- Download link
- Preview in browser
```

---

### Module 8: Analytics & Reporting

**Admin Analytics:**
```
KPIs:
- Deals sourced (this month)
- Deals sold (this month)
- Conversion rate (listed → sold)
- Average days to sell
- Revenue (total, monthly)
- Active investors
- New investors (this month)

Charts:
- Revenue over time (line)
- Deals by status (pie)
- Deals by region (bar)
- Top performing team members
```

**Deal Performance:**
```
For each deal:
- Views count
- Time on market
- Investor inquiries
- Conversion time (listed → sold)
```

**Investor Analytics:**
```
- Most active investors
- Average purchase frequency
- Investor retention rate
- Deals purchased by investor type
```

---

## Technical Architecture

### Tech Stack (AWS-Hosted, Scalable)

**Frontend:**
```
- Framework: Next.js 14 (React 18)
- UI Library: shadcn/ui + Tailwind CSS
- State Management: React Context + SWR for data fetching
- Forms: React Hook Form + Zod validation
- PDF Generation: react-pdf or jsPDF
- Charts: Recharts
- Authentication: NextAuth.js
```

**Backend:**
```
- API: Next.js API Routes (initially) → Migrate to separate FastAPI if needed
- Language: TypeScript (frontend) + Python (analysis scripts)
- ORM: Prisma (for PostgreSQL)
```

**Database:**
```
- Primary: PostgreSQL (AWS RDS)
- Cache: Redis (AWS ElastiCache) - for API rate limiting, sessions
- File Storage: AWS S3 (photos, PDFs, documents)
```

**Infrastructure (AWS):**
```
- Hosting: AWS Amplify or Vercel (Next.js hosting)
- Database: AWS RDS (PostgreSQL, db.t3.micro for start)
- Storage: AWS S3 (media files, generated PDFs)
- CDN: CloudFront (for S3 assets)
- Email: AWS SES (transactional emails)
- Authentication: AWS Cognito or NextAuth with database
- Monitoring: AWS CloudWatch
- Backups: RDS automated backups
```

**Cost Estimate (2-5 users + ~50 investors):**
```
- AWS RDS (db.t3.micro): $15/month
- AWS S3: $5/month
- AWS SES: $1/month (1000 emails)
- Vercel Pro: $20/month
- Total: ~$45-60/month
```

**Scaling Plan:**
```
Current (2-5 users):
- Single RDS instance (t3.micro)
- Vercel deployment (serverless)

Future (100+ users, 500+ investors):
- RDS upgrade (t3.small or medium)
- Add Redis cache
- Separate FastAPI backend for heavy processing
- CDN for static assets
- Load balancer if needed
```

---

### Database Schema

**Users Table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role ENUM('admin', 'sourcer', 'investor') NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

**Investors Table (extends users):**
```sql
CREATE TABLE investors (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  
  -- Investment Criteria
  preferred_areas TEXT[], -- ['SA11', 'SA12', 'CF24']
  min_budget INTEGER,
  max_budget INTEGER,
  min_yield DECIMAL(5,2),
  min_bmv DECIMAL(5,2),
  strategy TEXT[], -- ['BRRRR', 'BTL', 'Flip']
  
  -- Profile
  experience_level VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
  financing_status VARCHAR(20), -- 'cash', 'mortgage', 'both'
  
  -- Stats
  deals_purchased INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  
  -- Communication
  email_alerts BOOLEAN DEFAULT true,
  sms_alerts BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Deals Table:**
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property Details
  address VARCHAR(255) NOT NULL,
  postcode VARCHAR(10),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  property_type VARCHAR(50), -- 'terraced', 'semi', 'detached', 'flat'
  bedrooms INTEGER,
  bathrooms INTEGER,
  square_feet INTEGER,
  
  -- Pricing
  asking_price DECIMAL(10,2) NOT NULL,
  market_value DECIMAL(10,2),
  estimated_refurb_cost DECIMAL(10,2),
  after_refurb_value DECIMAL(10,2),
  
  -- Metrics
  bmv_percentage DECIMAL(5,2),
  gross_yield DECIMAL(5,2),
  net_yield DECIMAL(5,2),
  roi DECIMAL(5,2),
  roce DECIMAL(5,2),
  deal_score INTEGER, -- 0-100
  
  -- Deal Info
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'review', 'in_progress', 'ready', 'listed', 'reserved', 'sold', 'archived'
  pack_tier VARCHAR(20), -- 'basic', 'standard', 'premium'
  pack_price DECIMAL(10,2), -- £2500, £3500, £5000
  
  -- Source
  data_source VARCHAR(50), -- 'propertydata', 'manual', 'rightmove'
  external_id VARCHAR(100),
  agent_name VARCHAR(255),
  agent_phone VARCHAR(20),
  listing_url TEXT,
  
  -- Team
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  
  -- Sale Details
  sold_to UUID REFERENCES investors(id),
  sold_at TIMESTAMP,
  sold_price DECIMAL(10,2),
  
  -- Tracking
  views_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  listed_at TIMESTAMP,
  archived_at TIMESTAMP
);
```

**Deal_Photos Table:**
```sql
CREATE TABLE deal_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  s3_key VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  caption TEXT,
  is_cover BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

**Deal_Documents Table:**
```sql
CREATE TABLE deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  document_type VARCHAR(50), -- 'epc', 'floorplan', 'title', 'survey', 'pack'
  s3_key VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  filename VARCHAR(255),
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

**Comparables Table:**
```sql
CREATE TABLE comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  address VARCHAR(255),
  postcode VARCHAR(10),
  sale_price DECIMAL(10,2),
  sale_date DATE,
  bedrooms INTEGER,
  property_type VARCHAR(50),
  distance_km DECIMAL(5,2),
  source VARCHAR(50), -- 'propertydata', 'land_registry'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purchases Table:**
```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  investor_id UUID REFERENCES investors(id),
  
  -- Payment
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  payment_status VARCHAR(20), -- 'pending', 'completed', 'refunded'
  
  -- Access
  pack_downloaded BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  first_download_at TIMESTAMP,
  
  -- Follow-up
  investor_proceeded BOOLEAN, -- Did they buy the property?
  feedback_rating INTEGER, -- 1-5 stars
  feedback_comment TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Favorites Table:**
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id),
  deal_id UUID REFERENCES deals(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(investor_id, deal_id)
);
```

**Deal_Views Table (Analytics):**
```sql
CREATE TABLE deal_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  investor_id UUID REFERENCES investors(id),
  viewed_at TIMESTAMP DEFAULT NOW()
);
```

**Communications Table:**
```sql
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id),
  deal_id UUID REFERENCES deals(id),
  
  type VARCHAR(20), -- 'email', 'sms', 'call', 'note'
  subject VARCHAR(255),
  message TEXT,
  
  -- Email specific
  email_sent BOOLEAN DEFAULT false,
  email_opened BOOLEAN DEFAULT false,
  email_clicked BOOLEAN DEFAULT false,
  
  sent_by UUID REFERENCES users(id),
  sent_at TIMESTAMP DEFAULT NOW()
);
```

**Alerts Table:**
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id),
  
  name VARCHAR(255), -- "High yield SA11 deals"
  criteria JSONB, -- Store filter criteria
  
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### API Structure

**Authentication:**
```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

**Deals (Internal Team):**
```
GET    /api/deals                    # List all deals (with filters)
GET    /api/deals/:id                # Get single deal
POST   /api/deals                    # Create new deal
PUT    /api/deals/:id                # Update deal
DELETE /api/deals/:id                # Delete deal
POST   /api/deals/:id/photos         # Upload photo
POST   /api/deals/:id/documents      # Upload document
POST   /api/deals/:id/generate-pack  # Generate investor pack
PUT    /api/deals/:id/status         # Update status
GET    /api/deals/:id/analytics      # View analytics
```

**Deals (Investor-Facing):**
```
GET  /api/marketplace/deals          # List available deals (filtered by investor criteria)
GET  /api/marketplace/deals/:id      # Preview deal (limited info)
POST /api/marketplace/deals/:id/favorite  # Add to favorites
GET  /api/marketplace/favorites      # Get saved deals
```

**Investors:**
```
GET    /api/investors                # List all investors (admin/sourcer)
GET    /api/investors/:id            # Get investor profile
PUT    /api/investors/:id            # Update investor profile
PUT    /api/investors/:id/criteria   # Update investment criteria
GET    /api/investors/:id/purchases  # Get purchase history
POST   /api/investors/:id/contact    # Log communication
```

**Purchases:**
```
POST /api/purchases/checkout         # Create Stripe checkout session
POST /api/purchases/webhook          # Stripe webhook handler
GET  /api/purchases/:id              # Get purchase details
GET  /api/purchases/:id/download     # Download pack (post-purchase)
```

**Analytics:**
```
GET /api/analytics/dashboard         # Admin dashboard stats
GET /api/analytics/revenue           # Revenue over time
GET /api/analytics/deals             # Deal performance metrics
GET /api/analytics/investors         # Investor analytics
```

**Search:**
```
GET /api/search/deals?q=...          # Full-text search
GET /api/search/postcodes            # List all available postcodes
```

---

### Security & Multi-Tenancy

**Authentication:**
```
- JWT tokens (NextAuth.js)
- Refresh token rotation
- Session timeout: 7 days
- Password requirements: min 8 chars, 1 uppercase, 1 number
- 2FA optional (for admins)
```

**Authorization:**
```
Middleware checks:
- Admin: Full access
- Sourcer: Own deals + team deals
- Investor: Only purchased deals + listed deals

Row-level security:
- Investors only see own data
- Team members see team data
- Admins see everything
```

**Data Privacy:**
```
- Before purchase: Partial address only ("SA11 area")
- After purchase: Full address revealed
- Email/phone encrypted at rest
- GDPR compliance: Right to delete, data export
```

**API Rate Limiting:**
```
- Investors: 100 requests/minute
- Team: 500 requests/minute
- Admin: 1000 requests/minute
- PropertyData API: Cache aggressively to avoid limits
```

---

## Development Phases

### Phase 1: MVP (Weeks 1-4)
**Goal:** Internal tool for team to manage deals

**Features:**
- ✅ User authentication (admin, sourcer roles only)
- ✅ Deal CRUD (create, read, update, delete)
- ✅ Photo upload (S3)
- ✅ Basic deal scoring
- ✅ Deal pipeline (Kanban board)
- ✅ PropertyData integration (auto-sourcing)
- ✅ Simple deal list/grid view

**Tech:**
- Next.js + PostgreSQL + S3
- Deploy to Vercel

---

### Phase 2: Deal Packaging (Weeks 5-6)
**Goal:** Generate professional investor packs

**Features:**
- ✅ Investor pack template (PDF)
- ✅ Auto-populate pack from deal data
- ✅ Pack preview
- ✅ Pack download
- ✅ Version control (regenerate if deal updated)

**Tech:**
- PDF generation library
- S3 storage for packs

---

### Phase 3: Investor Portal (Weeks 7-10)
**Goal:** External investors can browse & purchase deals

**Features:**
- ✅ Investor signup/login
- ✅ Deal marketplace (public listing)
- ✅ Deal preview (limited info)
- ✅ Favorites
- ✅ Investment criteria settings
- ✅ Stripe integration (checkout)
- ✅ Purchase history
- ✅ Deal access control (only show purchased deals)

**Tech:**
- Stripe payment integration
- Email notifications (SES)

---

### Phase 4: CRM & Automation (Weeks 11-12)
**Goal:** Investor relationship management

**Features:**
- ✅ Investor matching (auto-notify on criteria match)
- ✅ Email alerts ("New deal for you!")
- ✅ Communication log
- ✅ Task management
- ✅ Deal analytics (views, conversion)
- ✅ Revenue dashboard

**Tech:**
- Email templates
- Cron jobs (Next.js API routes + Vercel cron or AWS EventBridge)

---

### Phase 5: Advanced Features (Weeks 13-16)
**Goal:** Scale & optimize

**Features:**
- ✅ Multi-tier pricing (Basic/Standard/Premium packs)
- ✅ Advanced search & filters
- ✅ Deal recommendations (ML-based)
- ✅ Investor testimonials
- ✅ API for third-party integrations
- ✅ Mobile-responsive optimization
- ✅ Performance optimization (caching, CDN)

---

## Key User Journeys

### Journey 1: Team Member Adds Deal
```
1. Login as Sourcer
2. Click "Add Deal"
3. Enter address: "23 High Street, Neath SA11"
4. System auto-fetches:
   - Property details (bedrooms, type)
   - Market value estimate
   - Comparable sales
5. Upload 8 photos
6. Upload floorplan
7. Review auto-calculated metrics:
   - BMV: 22%
   - Yield: 11.1%
   - Deal Score: 82/100
8. Click "Generate Pack"
9. Preview PDF
10. Adjust if needed
11. Set price: £3,500 (auto-suggested based on score)
12. Click "Publish to Marketplace"
13. Deal now visible to investors
14. Email sent to matched investors
```

---

### Journey 2: Investor Buys Deal
```
1. Investor receives email: "New deal matching your criteria!"
2. Clicks link → Deal preview page
3. Sees:
   - Photo
   - "SA11 area" (not full address yet)
   - BMV: 22%, Yield: 11.1%, Score: 82
   - Investment summary
4. Clicks "Buy This Deal - £3,500"
5. Stripe checkout page
6. Enters payment details
7. Payment processed
8. Redirected to "Thank you" page
9. Email sent with:
   - Download link to full pack
   - Full address revealed
   - Agent contact details
10. Investor downloads PDF
11. Reviews full pack
12. Contacts agent to arrange viewing
```

---

### Journey 3: Admin Reviews Performance
```
1. Login as Admin
2. Dashboard shows:
   - Revenue this month: £24,500 (7 deals sold)
   - Deals in pipeline: 15
   - Active investors: 42
   - Conversion rate: 28%
3. Click "Deal Analytics"
4. See top-performing deals:
   - SA11 terraced: Sold in 2 days, 15 views
   - CF24 semi: Sold in 5 days, 32 views
5. Click "Revenue Report"
6. Chart showing £80k revenue last 3 months
7. Breakdown:
   - Basic deals: £15k (6 deals)
   - Standard deals: £45k (13 deals)
   - Premium deals: £20k (4 deals)
8. Export CSV for accounting
```

---

## Design Guidelines

**Brand Tone:**
- Professional but approachable
- Data-driven and trustworthy
- "We do the hard work, you make the profit"

**UI/UX Principles:**
- Clean, modern interface (inspired by Notion, Linear)
- Fast loading (optimize everything)
- Mobile-responsive (investors browse on phone)
- Accessible (WCAG AA)

**Color Scheme (Suggested):**
```
Primary: #5865F2 (trust, professionalism)
Success: #57F287 (deals, positive metrics)
Warning: #FEE75C (under review, pending)
Danger: #ED4245 (archived, issues)
Neutral: #2B2D31 (dark mode friendly)
```

**Typography:**
```
Headings: Inter (clean, modern)
Body: Inter
Monospace: JetBrains Mono (for numbers, metrics)
```

---

## Success Metrics (KPIs)

**Business Metrics:**
- Deals sourced per month: Target 20+
- Deals sold per month: Target 10+
- Conversion rate (listed → sold): Target 30%+
- Average days to sell: Target <14 days
- Revenue per month: Target £30,000+

**Product Metrics:**
- User satisfaction (investor feedback): Target 4.5+/5
- Pack quality rating: Target 4.5+/5
- Investor retention (repeat purchases): Target 40%+
- System uptime: Target 99.9%

---

## Future Enhancements (Post-Launch)

**Phase 6: Advanced Features**
- AI-powered deal scoring (ML model)
- Automated property viewings (book via platform)
- Solicitor/broker marketplace integration
- Deal funding (connect investors to lenders)
- Portfolio tracking (track investor's purchased deals performance)
- Mobile app (React Native)

**Phase 7: Scale**
- White-label platform (license to other sourcers)
- API access for institutional buyers
- International expansion (Spain, Portugal)
- Deal auctions (investors bid on deals)

---

## Technical Considerations

**Performance:**
- All pages load in <2 seconds
- Images lazy-loaded
- PDF generation async (job queue)
- Database queries optimized (indexes on commonly filtered fields)

**SEO:**
- Server-side rendering (Next.js)
- Dynamic meta tags per deal
- Sitemap generation
- Schema.org structured data

**Monitoring:**
- Error tracking: Sentry
- Analytics: Mixpanel or PostHog
- Uptime monitoring: UptimeRobot
- Database monitoring: AWS RDS Performance Insights

**Backups:**
- Database: Daily automated backups (RDS)
- S3: Versioning enabled
- Code: Git (GitHub)

---

## Deployment Checklist

**Pre-Launch:**
- [ ] All critical features tested
- [ ] Security audit completed
- [ ] Terms & Conditions written
- [ ] Privacy Policy compliant (GDPR)
- [ ] Stripe account verified
- [ ] AWS account secured (MFA, IAM policies)
- [ ] Domain purchased & configured
- [ ] SSL certificate active
- [ ] Email sending verified (SES)
- [ ] Error monitoring active (Sentry)
- [ ] Database backed up

**Go-Live:**
- [ ] Deploy to production
- [ ] Smoke test all features
- [ ] Invite first beta investors
- [ ] Monitor for 48 hours

**Post-Launch:**
- [ ] Gather feedback
- [ ] Fix critical bugs
- [ ] Iterate on pack templates
- [ ] Optimize conversion funnel

---

This is the complete specification for building a scalable, AWS-hosted Property Deal Sourcing SaaS platform for 2-5 team members to find, package, and sell property deals to investors.

**Next Steps:**
1. Set up Next.js project
2. Configure AWS (RDS, S3, SES)
3. Build authentication
4. Start with Phase 1 MVP features
```

---

## 🎯 **How to Use This Prompt in Cursor:**

### **Step 1: Save the File**
Create `PROJECT_BRIEF.md` in your project root with the content above

### **Step 2: Initial Setup Prompt**

Open Cursor Chat (`Cmd+L`) and say:
```
Read PROJECT_BRIEF.md completely.

I want to build this Property Deal Sourcing SaaS. Let's start by:

1. Setting up the Next.js project structure
2. Configuring the database schema (Prisma)
3. Setting up AWS S3 integration
4. Creating the authentication system

Please create the initial project structure and all necessary config files.
```

### **Step 3: Feature Development Prompts**

For each feature:
```
Based on PROJECT_BRIEF.md Module 1 (Deal Sourcing Engine), 
create the deal sourcing functionality with:
- API route for PropertyData integration
- Automated daily sourcing cron job
- Deal scoring algorithm
- Database storage

Show me the complete code for all files needed.
```

---

## 💡 **Additional Tips for Cursor:**

**1. Reference the brief often:**
```
"Using the database schema in PROJECT_BRIEF.md, create the Prisma schema file"
```

**2. Ask for specific implementations:**
```
"Create the investor pack PDF generator based on the template design in PROJECT_BRIEF.md, Page 2: Financial Analysis"
```

**3. Request architecture decisions:**
```
"Should we use Next.js API routes or separate FastAPI backend for this? Consider the scalability requirements in PROJECT_BRIEF.md"

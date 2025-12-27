# DealStack - Technical Overview

**For Developers and Technical Collaborators**

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Tech Stack](#tech-stack)
3. [Code Organization](#code-organization)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Development Workflow](#development-workflow)
7. [Authentication & Authorization](#authentication--authorization)
8. [External Integrations](#external-integrations)
9. [Performance Considerations](#performance-considerations)
10. [Security Measures](#security-measures)
11. [Testing Strategy](#testing-strategy)
12. [Deployment](#deployment)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  Next.js 14 App Router │ React Server Components │ Tailwind     │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ├─── API Routes (Next.js)
                    │
┌───────────────────▼─────────────────────────────────────────────┐
│                      Application Layer                           │
│  Business Logic │ Validation │ Data Transformation              │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ├─── Prisma ORM
                    │
┌───────────────────▼─────────────────────────────────────────────┐
│                       Data Layer                                 │
│  PostgreSQL │ S3 (Images) │ External APIs                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client-Side                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Dashboard   │  │   Deals      │  │   Vendors    │         │
│  │   Components  │  │   Pipeline   │  │   Pipeline   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                   ┌────────▼────────┐                           │
│                   │   API Client    │                           │
│                   │  (fetch calls)  │                           │
│                   └────────┬────────┘                           │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             │ HTTP/JSON
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                      Server-Side                               │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │             API Route Handlers                          │ │
│  │                                                         │ │
│  │  /api/deals/*        /api/vendors/*                   │ │
│  │  /api/investors/*    /api/vendor-pipeline/*           │ │
│  │  /api/comparables/*  /api/analytics/*                 │ │
│  └────────┬────────────────────────────────────────────────┘ │
│           │                                                   │
│  ┌────────▼────────────────────────────────────────────────┐ │
│  │          Business Logic Layer                          │ │
│  │                                                        │ │
│  │  lib/calculations/     - BMV, yields, ROI             │ │
│  │  lib/format.ts         - Formatting utilities          │ │
│  │  lib/ai/               - AI conversation logic         │ │
│  │  lib/investor-pack-*   - PDF generation               │ │
│  └────────┬───────────────────────────────────────────────┘ │
│           │                                                   │
│  ┌────────▼────────────────────────────────────────────────┐ │
│  │              Prisma ORM                                │ │
│  │  - Type-safe database queries                          │ │
│  │  - Schema validation                                   │ │
│  │  - Migrations                                          │ │
│  └────────┬───────────────────────────────────────────────┘ │
│           │                                                   │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────┐
│                     External Services                          │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │    AWS S3    │  │   Twilio     │       │
│  │   Database   │  │  (Photos)    │  │   (SMS)      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Anthropic   │  │ PropertyData │  │   Facebook   │       │
│  │   Claude     │  │     API      │  │   Lead Ads   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

**Next.js 14.2.35 (App Router)**
- **Why chosen:**
  - React Server Components for better performance
  - Built-in API routes eliminate need for separate backend
  - File-based routing simplifies navigation
  - Excellent TypeScript support
  - Industry standard for React applications

**React 18**
- **Why chosen:**
  - Component-based architecture for reusability
  - Hooks for state management
  - Massive ecosystem of libraries
  - Virtual DOM for efficient updates

**TypeScript 5.5.4**
- **Why chosen:**
  - Type safety catches errors at compile time
  - Better IDE autocomplete and refactoring
  - Self-documenting code
  - Easier to maintain large codebases

**Tailwind CSS 3.4**
- **Why chosen:**
  - Utility-first approach speeds up development
  - Consistent design system
  - Small bundle size (unused styles removed)
  - No context switching between files

**shadcn/ui Components**
- **Why chosen:**
  - High-quality, accessible components
  - Customizable (not a black box)
  - Built on Radix UI primitives
  - Beautiful default styling

### Backend

**Next.js API Routes**
- **Why chosen:**
  - Serverless functions (scales automatically)
  - Same codebase as frontend
  - Edge runtime support
  - Built-in request/response handling

**Prisma ORM 5.15**
- **Why chosen:**
  - Type-safe database access
  - Automatic TypeScript type generation
  - Schema migrations made easy
  - Great developer experience
  - Works perfectly with PostgreSQL

**PostgreSQL 16**
- **Why chosen:**
  - Robust relational database
  - ACID compliance for data integrity
  - JSON support for flexible schemas
  - Excellent performance for complex queries
  - Open source and widely supported

### Authentication

**NextAuth.js v4**
- **Why chosen:**
  - Built for Next.js
  - Supports multiple auth strategies
  - Session management included
  - Secure by default
  - Easy to customize

### AI & External Services

**Anthropic Claude API (Sonnet 4.5)**
- **Use case:** SMS conversation agent
- **Why chosen:** Best-in-class language understanding, reliable function calling

**Twilio SMS API**
- **Use case:** Send/receive SMS messages
- **Why chosen:** Industry standard, reliable delivery, UK number support

**PropertyData UK API**
- **Use case:** Property valuations and comparables
- **Why chosen:** Most comprehensive UK property data, 30+ years of sales history

**AWS S3**
- **Use case:** Property photo storage
- **Why chosen:** Scalable, reliable, cost-effective object storage

**Facebook Graph API**
- **Use case:** Lead ads webhook
- **Why chosen:** Direct integration with Facebook advertising platform

---

## Code Organization

```
deal-sourcing-saas/
├── app/                          # Next.js 14 App Router
│   ├── api/                      # API route handlers
│   │   ├── analytics/            # Analytics endpoints
│   │   ├── auth/                 # Authentication
│   │   ├── comparables/          # Property comparables
│   │   ├── deals/                # Deal CRUD operations
│   │   ├── investors/            # Investor management
│   │   ├── propertydata/         # External API proxy
│   │   ├── vendor-leads/         # Vendor lead operations
│   │   ├── vendor-pipeline/      # Pipeline management
│   │   └── vendors/              # Legacy vendor system
│   ├── dashboard/                # Protected dashboard pages
│   │   ├── analytics/            # Analytics views
│   │   ├── deals/                # Deal management UI
│   │   ├── investors/            # Investor management UI
│   │   ├── settings/             # Settings pages
│   │   └── vendors/              # Vendor pipeline UI
│   ├── admin/                    # Admin-only pages
│   ├── login/                    # Public auth pages
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (redirects)
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui base components
│   ├── dashboard/                # Dashboard widgets
│   ├── deals/                    # Deal-related components
│   ├── investors/                # Investor components
│   ├── vendors/                  # Vendor pipeline components
│   ├── comparables/              # Comparables display
│   └── settings/                 # Settings components
│
├── lib/                          # Business logic & utilities
│   ├── calculations/             # Deal metrics calculations
│   │   ├── deal-metrics.ts       # BMV, yields, ROI
│   │   └── rental-yield.ts       # Rental calculations
│   ├── ai/                       # AI-related code
│   │   └── vendor-sms-agent.ts   # Claude conversation logic
│   ├── format.ts                 # Formatting utilities
│   ├── auth.ts                   # NextAuth configuration
│   ├── db.ts                     # Prisma client singleton
│   ├── s3.ts                     # AWS S3 utilities
│   ├── twilio.ts                 # Twilio SMS client
│   ├── propertydata.ts           # PropertyData API client
│   └── investor-pack-generator.ts # PDF generation
│
├── prisma/                       # Database
│   ├── schema.prisma             # Database schema (40 models)
│   ├── migrations/               # Migration history
│   └── seed.ts                   # Database seeding
│
├── public/                       # Static assets
│   └── images/                   # Public images
│
├── scripts/                      # Utility scripts
│   └── seed-default-template.ts  # Template seeding
│
├── types/                        # TypeScript type definitions
│   └── next-auth.d.ts            # NextAuth type extensions
│
├── .env                          # Environment variables
├── .env.example                  # Example env vars
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies

```

### Key Directories Explained

**`/app/api/*`** - Next.js API routes (serverless functions)
- Each folder represents a resource (deals, investors, vendors)
- `route.ts` files define HTTP handlers (GET, POST, PATCH, DELETE)
- Organized by resource and nested by ID for RESTful structure

**`/components/*`** - React components
- `ui/` contains base shadcn components (Button, Dialog, Card, etc.)
- Other folders group components by feature area
- Components are client-side by default (use `"use client"` directive)

**`/lib/*`** - Shared business logic
- `calculations/` contains pure functions for deal metrics
- `ai/` contains AI conversation logic
- Root files are utilities used across the app

**`/prisma/*`** - Database management
- `schema.prisma` is the single source of truth for data models
- Migrations are auto-generated and versioned
- Seed scripts populate initial data

---

## Database Schema

### Core Models (40 total)

**Users & Authentication**
- `User` - User accounts (admin, sourcer, viewer)
- `Account` - OAuth accounts (NextAuth)
- `Session` - User sessions (NextAuth)
- `VerificationToken` - Email verification

**Deals**
- `Deal` - Property deals (core entity)
- `DealPhoto` - Property photos (S3 references)
- `DealDocument` - Legal documents
- `DealNote` - Internal notes
- `DealActivity` - Activity log

**Vendors (New Pipeline)**
- `VendorLead` - AI-powered vendor pipeline
- `SMSMessage` - SMS conversation history
- `PipelineEvent` - Stage transitions
- `OfferRetry` - Retry attempts

**Vendors (Legacy)**
- `Vendor` - Old vendor system
- `VendorAIConversation` - Legacy conversations
- `VendorOffer` - Legacy offers

**Comparables**
- `ComparableProperty` - Market comparables
- `ComparablesSnapshot` - Historical comparables
- `ComparablesConfig` - Search parameters

**Investors**
- `Investor` - Investor profiles
- `InvestorCriteria` - Investment preferences
- `InvestorActivity` - Activity tracking
- `Reservation` - Deal reservations
- `ProofOfFunds` - POF documents

**Investor Packs**
- `InvestorPack` - Generated PDF packs
- `InvestorPackTemplate` - Pack templates
- `InvestorPackDelivery` - Email delivery tracking
- `InvestorPackView` - View analytics

**Analytics**
- `PipelineMetric` - Pipeline performance
- `PropertyDataUsage` - API usage tracking
- `FacebookLeadEvent` - Lead capture events

**Company**
- `CompanyProfile` - Company branding settings

**Communications**
- `Communication` - Multi-channel messages

### Key Relationships

```
User ──< Deal (one-to-many: user creates deals)
Deal ──< DealPhoto (one-to-many: deal has photos)
Deal ──< Reservation (one-to-many: deal has reservations)
Deal ─── VendorLead (one-to-one: deal links to vendor)
Deal ──< ComparableProperty (one-to-many: deal has comparables)

VendorLead ──< SMSMessage (one-to-many: lead has messages)
VendorLead ──< PipelineEvent (one-to-many: lead has events)
VendorLead ──< ComparableProperty (one-to-many: lead has comparables)

Investor ──< Reservation (one-to-many: investor makes reservations)
Investor ──< InvestorCriteria (one-to-many: investor has criteria)
Investor ──< InvestorPackDelivery (one-to-many: investor receives packs)

Deal ──< InvestorPack (one-to-many: deal has packs)
InvestorPack ──< InvestorPackDelivery (one-to-many: pack sent to investors)
InvestorPack ── InvestorPackTemplate (many-to-one: pack uses template)
```

### Indexes & Performance

Key indexes for query performance:
```prisma
@@index([userId, createdAt])          // User's recent deals
@@index([status, createdAt])          // Pipeline filtering
@@index([vendorPhone])                // Phone lookup
@@index([pipelineStage, updatedAt])   // Stage queries
@@index([investorId, createdAt])      // Investor history
```

---

## API Design

### RESTful Conventions

**Resource Naming**
- Plural nouns: `/api/deals`, `/api/investors`, `/api/vendors`
- Nested resources: `/api/deals/[id]/photos`
- Actions as verbs: `/api/deals/[id]/status`, `/api/vendor-pipeline/leads/[id]/send-message`

**HTTP Methods**
- `GET` - Retrieve resource(s)
- `POST` - Create new resource
- `PATCH` - Update existing resource
- `DELETE` - Remove resource

**Response Format**
```typescript
// Success (200/201)
{
  deal: { /* resource */ },
  metadata?: { /* optional meta */ }
}

// Error (400/401/403/404/500)
{
  error: "Human-readable error message",
  code?: "ERROR_CODE",
  details?: { /* additional context */ }
}
```

### Authentication Pattern

All protected routes check session:
```typescript
const session = await getServerSession(authOptions)
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### Authorization Pattern

Role-based access control:
```typescript
if (session.user.role !== "admin" && session.user.role !== "sourcer") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### Example API Route Structure

```typescript
// app/api/deals/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 2. Fetch data
    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: { photos: true, vendor: true }
    })

    // 3. Not found check
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 })

    // 4. Authorization check (own deals or admin)
    if (deal.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 5. Return data
    return NextResponse.json({ deal })
  } catch (error) {
    console.error("Error fetching deal:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

---

## Development Workflow

### Local Setup

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd deal-sourcing-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Setup database**
   ```bash
   # Start PostgreSQL (or use cloud instance)
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Run development server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

### Database Migrations

**Create migration**
```bash
# Edit prisma/schema.prisma
npx prisma migrate dev --name descriptive_name
```

**Apply migrations**
```bash
npx prisma migrate deploy  # Production
```

**Reset database** (dev only)
```bash
npx prisma migrate reset
```

**Generate Prisma client**
```bash
npx prisma generate
```

### Code Quality

**TypeScript check**
```bash
npx tsc --noEmit
```

**Linting**
```bash
npm run lint
```

**Formatting**
```bash
npm run format  # (if configured)
```

### Git Workflow

1. Create feature branch: `git checkout -b feature/description`
2. Make changes and commit: `git commit -m "feat: description"`
3. Push: `git push origin feature/description`
4. Create Pull Request
5. Code review
6. Merge to main

### Commit Convention

Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Build/tooling

---

## Authentication & Authorization

### NextAuth Configuration

Located in `lib/auth.ts`:

```typescript
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      // Email/password authentication
    })
  ],
  callbacks: {
    session: async ({ session, user }) => {
      // Add user role to session
      session.user.role = user.role
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
}
```

### Roles

- **admin** - Full access to everything
- **sourcer** - Can manage deals, vendors, investors
- **viewer** - Read-only access

### Session Access

**Server-side (API routes)**
```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const session = await getServerSession(authOptions)
```

**Client-side (components)**
```typescript
import { useSession } from "next-auth/react"

const { data: session, status } = useSession()
```

### Protected Pages

Middleware in `middleware.ts` protects `/dashboard/*` routes:
```typescript
export { default } from "next-auth/middleware"
export const config = { matcher: ["/dashboard/:path*"] }
```

---

## External Integrations

### 1. Anthropic Claude API

**Purpose:** AI-powered SMS conversations with vendors

**Implementation:** `lib/ai/vendor-sms-agent.ts`

**API Call Pattern:**
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1000,
  messages: conversationHistory,
  system: systemPrompt,
  tools: [extractPropertyDetailsTool]
})
```

**Function Calling:** Extracts structured data from conversations
- Property address
- Asking price
- Property type
- Motivation score
- Timeline

### 2. Twilio SMS

**Purpose:** Send/receive SMS messages

**Implementation:** `lib/twilio.ts`

**Webhook:** `/api/vendor-pipeline/webhook/sms`

**Send SMS:**
```typescript
await twilioClient.messages.create({
  body: messageText,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: vendorPhone
})
```

**Receive SMS:** Twilio POSTs to webhook when message received

### 3. PropertyData UK API

**Purpose:** Property valuations and market comparables

**Implementation:** `lib/propertydata.ts`

**Endpoints used:**
- `/property` - Property details
- `/sales` - Comparable sales
- `/rental` - Rental estimates

**Usage tracking:** Stored in `PropertyDataUsage` model

### 4. AWS S3

**Purpose:** Property photo storage

**Implementation:** `lib/s3.ts`

**Upload flow:**
1. Frontend requests presigned URL
2. Backend generates URL: `await s3Client.send(new PutObjectCommand(...))`
3. Frontend uploads directly to S3
4. Backend saves metadata to database

### 5. Facebook Lead Ads

**Purpose:** Capture property seller leads

**Webhook:** `/api/facebook-leads/webhook`

**Flow:**
1. User fills lead form on Facebook
2. Facebook POSTs to webhook
3. System creates `VendorLead` record
4. AI starts SMS conversation

---

## Performance Considerations

### Database Query Optimization

**Use `select` to limit fields:**
```typescript
const deals = await prisma.deal.findMany({
  select: {
    id: true,
    address: true,
    askingPrice: true
    // Don't load all fields
  }
})
```

**Use `include` for relations:**
```typescript
const deal = await prisma.deal.findUnique({
  where: { id },
  include: {
    photos: true,
    vendor: { select: { name: true, phone: true } }
  }
})
```

**Pagination:**
```typescript
const deals = await prisma.deal.findMany({
  take: 20,
  skip: page * 20,
  orderBy: { createdAt: 'desc' }
})
```

### API Response Caching

For expensive calculations:
```typescript
// Cache in memory for 5 minutes
const stats = await cache.get('pipeline-stats') ||
  await calculateStats().then(s => cache.set('pipeline-stats', s, 300))
```

### Image Optimization

Next.js `<Image>` component:
```typescript
<Image
  src={photo.url}
  alt="Property"
  width={800}
  height={600}
  loading="lazy"
  placeholder="blur"
/>
```

### Bundle Size

- Tree shaking eliminates unused code
- Dynamic imports for heavy components:
  ```typescript
  const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false })
  ```

---

## Security Measures

### Environment Variables

**Never commit:**
- API keys
- Database credentials
- Secret keys

**Use `.env` for local development**
**Use platform environment variables for production**

### SQL Injection Protection

Prisma parameterizes all queries automatically:
```typescript
// Safe - Prisma handles escaping
await prisma.deal.findMany({
  where: { address: userInput }
})
```

### XSS Protection

React escapes all values by default:
```typescript
// Safe - React escapes HTML
<div>{userInput}</div>
```

**Danger:** Only use `dangerouslySetInnerHTML` with sanitized HTML

### CSRF Protection

NextAuth includes CSRF tokens automatically.

### Rate Limiting

API routes should implement rate limiting:
```typescript
// Example: 100 requests per 15 minutes
const rateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
```

### Authentication

- Passwords hashed with bcrypt
- Sessions stored server-side
- HttpOnly cookies prevent XSS theft
- Secure flag in production

### Authorization

Always check:
1. User is authenticated
2. User has permission for resource
3. User owns resource (or is admin)

### Input Validation

Validate all user input:
```typescript
const schema = z.object({
  address: z.string().min(5).max(200),
  askingPrice: z.number().positive()
})

const validated = schema.parse(body)  // Throws if invalid
```

---

## Testing Strategy

### Manual Testing Checklist

**After code changes:**
- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Test in browser on localhost
- [ ] Check browser console for errors
- [ ] Test on mobile viewport

**Before deployment:**
- [ ] Run production build: `npm run build`
- [ ] Test key user flows
- [ ] Check database migrations apply
- [ ] Verify environment variables are set

### Future: Automated Testing

**Unit tests** (functions in `lib/`)
- Pure calculation functions
- Formatting utilities
- Business logic

**Integration tests** (API routes)
- CRUD operations
- Authentication flows
- External API interactions

**E2E tests** (full user flows)
- Login and navigation
- Create deal
- Generate investor pack
- Vendor pipeline flow

---

## Deployment

### Build Process

```bash
# Install dependencies
npm ci

# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Build Next.js app
npm run build

# Start production server
npm start
```

### Environment Variables (Production)

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random secret for session encryption
- `NEXTAUTH_URL` - Production URL
- `ANTHROPIC_API_KEY` - Claude API key
- `TWILIO_ACCOUNT_SID` - Twilio account ID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio SMS number
- `PROPERTYDATA_API_KEY` - PropertyData UK key
- `AWS_ACCESS_KEY_ID` - S3 access key
- `AWS_SECRET_ACCESS_KEY` - S3 secret
- `AWS_REGION` - S3 region
- `AWS_BUCKET_NAME` - S3 bucket

**Optional:**
- `FACEBOOK_APP_SECRET` - For lead ads webhook verification

### Recommended Hosting

**Vercel** (easiest)
- Native Next.js support
- Automatic deployments from Git
- Serverless functions included
- Edge network CDN

**AWS** (most control)
- EC2 for server
- RDS for PostgreSQL
- S3 for static assets
- CloudFront for CDN

**Railway** (good middle ground)
- Easy deployment
- Integrated PostgreSQL
- Affordable pricing

### Monitoring

**Application logs:**
- Check console errors in browser
- Check server logs in hosting platform

**Database:**
- Monitor query performance
- Check connection pool usage
- Set up slow query alerts

**External APIs:**
- Monitor rate limits
- Track error rates
- Set up downtime alerts

---

## Key Development Principles

1. **Type Safety First** - Use TypeScript strictly, no `any` unless necessary
2. **Server Components by Default** - Use client components only when needed
3. **Database as Source of Truth** - Prisma schema defines data structure
4. **RESTful APIs** - Follow REST conventions for consistency
5. **Error Handling** - Always handle errors gracefully with user-friendly messages
6. **Security by Default** - Check auth on every protected endpoint
7. **Performance Matters** - Optimize queries, use pagination, lazy load images
8. **Code Reusability** - Extract shared logic to `lib/`, shared UI to `components/ui/`
9. **Documentation** - Comment complex logic, write clear commit messages
10. **Incremental Improvement** - Make small, focused changes with clear purpose

---

## Common Development Tasks

### Add a New Feature

1. **Design database schema** (if needed)
   - Edit `prisma/schema.prisma`
   - Run `npx prisma migrate dev`

2. **Create API endpoint**
   - Add route in `app/api/[resource]/route.ts`
   - Implement handlers (GET, POST, etc.)
   - Add auth checks

3. **Build UI components**
   - Create components in `components/[feature]/`
   - Use existing UI components from `components/ui/`

4. **Add page/route**
   - Create page in `app/dashboard/[feature]/page.tsx`
   - Connect to API endpoints

5. **Test thoroughly**
   - Manual testing in browser
   - Check TypeScript compilation
   - Verify database updates

### Fix a Bug

1. **Reproduce the issue** - Understand what's happening
2. **Locate the code** - Use TypeScript errors, console logs, or grep
3. **Fix the root cause** - Not just the symptom
4. **Test the fix** - Ensure it works and doesn't break other things
5. **Consider edge cases** - What if input is null? Empty? Invalid?

### Optimize Performance

1. **Identify bottleneck** - Use browser DevTools, check slow API responses
2. **Profile database queries** - Check Prisma query logs
3. **Optimize query** - Add indexes, reduce fields, use pagination
4. **Cache results** - For expensive calculations
5. **Measure improvement** - Verify performance improved

---

## Further Reading

- **Next.js Documentation:** https://nextjs.org/docs
- **Prisma Documentation:** https://www.prisma.io/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs
- **React Documentation:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com/docs

---

*For non-technical overview, see SYSTEM_OVERVIEW.md*
*For vendor pipeline details, see VENDOR_PIPELINE_GUIDE.md*

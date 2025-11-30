# DealStack - Property Deal Sourcing SaaS

A B2B SaaS platform for sourcing, analyzing, and selling property investment deals to investors.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js with JWT
- **Storage:** AWS S3
- **Payments:** Stripe (Phase 3)

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher (20.9.0+ recommended for Next.js 16)
- PostgreSQL database
- AWS account (for S3)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Then edit `.env` and fill in all required values:
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - AWS credentials (for S3)
   - Other service keys as needed

3. **Set up the database:**
   ```bash
   # Generate Prisma Client
   npm run db:generate

   # Push schema to database (or create migration)
   npm run db:push
   
   # Or create a migration
   npm run db:migrate
   ```

4. **Create initial admin user:**
   
   You'll need to create an admin user manually. You can do this by:
   - Using Prisma Studio: `npm run db:studio`
   - Creating a seed script (recommended)
   - Using a database client

   Example SQL (you'll need to hash the password with bcrypt):
   ```sql
   INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
   VALUES ('admin@example.com', '$2a$10$...hashedpassword...', 'admin', 'Admin', 'User', true);
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages (protected)
│   ├── login/             # Login page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   └── dashboard/         # Dashboard-specific components
├── lib/                   # Utility functions
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   ├── s3.ts              # AWS S3 utilities
│   └── utils.ts           # General utilities
├── prisma/                # Database schema
│   └── schema.prisma      # Prisma schema
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

## Development Phases

### Phase 1: MVP (Current)
- ✅ User authentication (admin, sourcer roles)
- ✅ Database schema
- ✅ Admin dashboard layout
- ✅ AWS S3 integration setup
- ⏳ Deal CRUD operations
- ⏳ Photo upload
- ⏳ Deal pipeline (Kanban board)

### Phase 2: Deal Packaging
- Investor pack generation (PDF)
- Template system

### Phase 3: Investor Portal
- Investor signup/login
- Deal marketplace
- Stripe payments

### Phase 4: CRM & Automation
- Investor matching
- Email alerts
- Analytics dashboard

## Environment Variables

See `env.example` for all required environment variables.

## License

Private - All rights reserved


# DealStack

A property deal sourcing platform I built to find, analyse and package UK buy-to-let deals for investors. It pulls listings from the main property portals, scores each deal, and uses Claude to do the research a sourcer would normally do by hand.

I built it as a side project alongside my day job as a Principal SRE, partly to run my own property business and partly to get hands-on with LLM tooling in a real application.

## What it does

- **Finds deals.** Scheduled scrapers pull listings from Rightmove, Zoopla, OnTheMarket and PrimeLocation, and match them against sourcing alerts by area and strategy.
- **Scores them.** Each deal is enriched with PropertyData, Land Registry price paid data and rental estimates, then scored on BMV, yield and cash flow. It handles stamp duty (SDLT) and picks up Welsh properties automatically, since the tax and tenancy rules are different there.
- **Uses AI for the research.** Claude reviews listing photos and floorplans, checks street view and flood risk, summarises the area and property history, and drafts a due diligence report.
- **Works the vendor side.** A vendor pipeline tracks motivated sellers, with an AI negotiation coach and an offer engine that builds a negotiation ladder. An AI SMS agent (Twilio) handles first contact with vendors.
- **Sells to investors.** It generates investor packs and pitches, tracks investor interest and reservations, and keeps solicitors and contacts in one place.

## How the AI is wired in

- A small provider layer (`lib/vendor-pipeline/ai-provider.ts`) lets each feature run on Anthropic Claude or OpenAI, and tracks token usage and rate limits so a busy day doesn't hit the API limits.
- Vision models handle the photo, floorplan and street view checks.
- The agent roles (SMS agent, deal validator, offer engine, pipeline orchestrator) are written up in [`docs/agents`](docs/agents).

## Stack

| Area | Tools |
|---|---|
| App | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Data | PostgreSQL, Prisma ORM |
| AI | Anthropic Claude API, OpenAI API |
| Integrations | PropertyData API, HM Land Registry, Twilio, AWS S3 and SES, Facebook Lead Ads |
| Auth | NextAuth.js (JWT) |
| Hosting | Self-hosted Linux server behind Cloudflare Tunnel, run with pm2 |
| CI/CD | GitHub Actions on a self-hosted runner |

## Deployment

Pushes to `main` deploy through a GitHub Actions workflow on a self-hosted runner. The workflow installs dependencies, applies Prisma migrations, builds the app and does a zero-downtime reload with pm2. Production deploys wait for a manual approval in the GitHub `production` environment, and there is a separate manual path for urgent fixes. The server is not exposed to the internet directly; traffic comes in through a Cloudflare Tunnel.

## Running it locally

You'll need Node.js 20+, a PostgreSQL database and API keys for the services you want to use.

```bash
npm install
cp env.example .env      # then fill in the values
npm run db:migrate
npm run seed:admin
npm run dev
```

The app runs on http://localhost:3000. More detail is in [SETUP.md](SETUP.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Status

This is a working personal project, not a commercial product. It's under active development, and the scrapers in particular need updating whenever the portals change their pages.

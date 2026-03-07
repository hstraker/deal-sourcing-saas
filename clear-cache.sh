#!/bin/bash
# Clear Next.js cache and restart dev server

echo "Starting Cloudflare Tunnel"
cloudflared tunnel run deals-app &
sleep 3

echo "Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next/cache

echo "Clearing - Scraper cards"
npx tsx scripts/run-scraper.ts --reset-db

echo "Starting application"
npm run dev


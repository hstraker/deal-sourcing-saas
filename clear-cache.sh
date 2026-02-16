#!/bin/bash
# Clear Next.js cache and restart dev server

echo "Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next/cache

echo "Clearing - Scraper cards"
npx tsx scripts/run-scraper.ts --reset-db

echo "Starting application"
npm run dev


#!/bin/bash
# Clear Next.js cache and restart dev server

echo "Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next/cache

echo "Cache cleared! Now restart your dev server with:"
echo "Start application"
npm run dev


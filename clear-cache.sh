#!/bin/bash
# Clear Next.js cache and restart dev server

echo "Clearing Next.js cache..."
rm -rf .next

echo "Cache cleared! Now restart your dev server with:"
sleep 1
echo "Start application"
npm run dev


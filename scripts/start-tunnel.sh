#!/bin/bash
# Start Cloudflare Tunnel for mobile testing
# Make sure your Next.js dev server is running first!

echo "🚀 Starting Cloudflare Tunnel..."
echo ""
echo "⚠️  Make sure your Next.js dev server is running on localhost:3000"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed!"
    echo ""
    echo "Install it with:"
    echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb"
    echo "  sudo dpkg -i cloudflared.deb"
    echo ""
    exit 1
fi

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Warning: Could not connect to localhost:3000"
    echo "   Make sure your dev server is running with: npm run dev"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Starting tunnel to http://localhost:3000"
echo ""

# Start the tunnel
cloudflared tunnel --url http://localhost:3000


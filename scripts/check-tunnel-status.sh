#!/bin/bash
# Check Cloudflare Tunnel status and configuration

echo "🔍 Checking Cloudflare Tunnel Status..."
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed"
    echo "   Install it with: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb && sudo dpkg -i cloudflared.deb"
    exit 1
fi

echo "✅ cloudflared is installed"
echo ""

# Check if tunnel exists
echo "📋 Listing tunnels:"
cloudflared tunnel list
echo ""

# Check if tunnel is running
if pgrep -f "cloudflared tunnel run" > /dev/null; then
    echo "✅ Tunnel process is running"
else
    echo "⚠️  Tunnel process is NOT running"
    echo "   Start it with: npm run tunnel:dev"
fi
echo ""

# Check config file
CONFIG_FILE="$HOME/.cloudflared/config.yml"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Config file exists: $CONFIG_FILE"
    echo ""
    echo "Current configuration:"
    cat "$CONFIG_FILE"
    echo ""
else
    echo "⚠️  Config file not found: $CONFIG_FILE"
    echo "   Create it with: ./scripts/create-tunnel-config.sh"
fi
echo ""

# Check credentials
if ls ~/.cloudflared/*.json 1> /dev/null 2>&1; then
    echo "✅ Credentials file found"
    ls -la ~/.cloudflared/*.json
elif [ -f ~/.cloudflared/cert.pem ]; then
    echo "✅ Certificate file found"
    ls -la ~/.cloudflared/cert.pem
else
    echo "⚠️  No credentials file found"
    echo "   Run: cloudflared tunnel login"
fi
echo ""

# Check DNS
echo "🌐 Checking DNS resolution:"
echo "   invest.thefatoffice.co.uk should resolve to a Cloudflare IP"
nslookup invest.thefatoffice.co.uk 2>/dev/null || echo "   (nslookup not available, trying dig...)"
dig +short invest.thefatoffice.co.uk 2>/dev/null || echo "   (dig not available)"
echo ""

# Check if Next.js is running
if pgrep -f "next dev" > /dev/null || pgrep -f "node.*next" > /dev/null; then
    echo "✅ Next.js dev server appears to be running"
else
    echo "⚠️  Next.js dev server does not appear to be running"
    echo "   Start it with: npm run dev"
fi
echo ""

echo "📝 Quick fixes:"
echo "1. If tunnel is not running: npm run tunnel:dev"
echo "2. If Next.js is not running: npm run dev"
echo "3. If DNS is not resolving, wait a few minutes or check Cloudflare dashboard"
echo "4. Try accessing: https://invest.thefatoffice.co.uk"


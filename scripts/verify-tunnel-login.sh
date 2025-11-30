#!/bin/bash
# Verify Cloudflare Tunnel login status

echo "🔍 Checking Cloudflare Tunnel login status..."
echo ""

# Check if .cloudflared directory exists
if [ ! -d "$HOME/.cloudflared" ]; then
    echo "❌ ~/.cloudflared directory doesn't exist"
    echo ""
    echo "You need to run: cloudflared tunnel login"
    exit 1
fi

# Check for certificate files
CERT_FILES=$(ls -1 ~/.cloudflared/*.json 2>/dev/null | wc -l)

if [ "$CERT_FILES" -eq 0 ]; then
    echo "❌ No certificate files found in ~/.cloudflared/"
    echo ""
    echo "The login process didn't complete successfully."
    echo ""
    echo "To fix this:"
    echo "1. Run: cloudflared tunnel login"
    echo "2. Complete email verification if prompted"
    echo "3. Select domain: thefatoffice.co.uk"
    echo "4. Click 'Authorize' in browser"
    echo "5. Wait for 'Success' message"
    echo ""
    exit 1
else
    echo "✅ Found $CERT_FILES certificate file(s):"
    ls -1 ~/.cloudflared/*.json
    echo ""
    echo "✅ Login appears to be successful!"
    echo ""
    echo "You can now:"
    echo "1. Create tunnel: cloudflared tunnel create dealstack-dev"
    echo "2. Create DNS: cloudflared tunnel route dns dealstack-dev invest.thefatoffice.co.uk"
    echo ""
fi


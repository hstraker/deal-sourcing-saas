#!/bin/bash
# Test Cloudflare Tunnel connection from different perspectives

echo "🧪 Testing Cloudflare Tunnel Connection..."
echo ""

# Test 1: Local connection
echo "1️⃣ Testing local connection to Next.js server:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|307"; then
    echo "   ✅ Next.js server is responding locally"
else
    echo "   ❌ Next.js server is NOT responding locally"
    echo "   Make sure: npm run dev"
fi
echo ""

# Test 2: Tunnel connection
echo "2️⃣ Testing tunnel connection:"
TUNNEL_URL="https://invest.thefatoffice.co.uk"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL" 2>&1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "   ✅ Tunnel is accessible: HTTP $HTTP_CODE"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ Cannot connect to tunnel (connection refused or DNS issue)"
    echo "   This might be a DNS propagation issue"
else
    echo "   ⚠️  Tunnel returned HTTP $HTTP_CODE"
    echo "   Response:"
    curl -s -I "$TUNNEL_URL" | head -5
fi
echo ""

# Test 3: Check DNS
echo "3️⃣ Checking DNS resolution:"
if command -v host &> /dev/null; then
    DNS_RESULT=$(host invest.thefatoffice.co.uk 2>&1)
    echo "$DNS_RESULT"
    if echo "$DNS_RESULT" | grep -q "cfargotunnel.com"; then
        echo "   ✅ DNS is pointing to Cloudflare Tunnel"
    else
        echo "   ⚠️  DNS might not be configured correctly"
    fi
elif command -v nslookup &> /dev/null; then
    nslookup invest.thefatoffice.co.uk
else
    echo "   (DNS tools not available)"
fi
echo ""

# Test 4: Check Cloudflare tunnel info
echo "4️⃣ Checking tunnel connection status:"
cloudflared tunnel info dealstack-dev 2>&1 | head -20
echo ""

# Test 5: Check for Cloudflare Access rules
echo "5️⃣ Note: Check Cloudflare Dashboard for:"
echo "   - Zero Trust → Networks → Tunnels → dealstack-dev"
echo "   - DNS → Records → invest.thefatoffice.co.uk (should be Proxied)"
echo "   - Any Access policies that might block connections"
echo ""

echo "📱 Mobile-specific troubleshooting:"
echo "   - Try using mobile data instead of WiFi (or vice versa)"
echo "   - Some mobile carriers block certain connections"
echo "   - Clear browser cache on mobile"
echo "   - Try a different browser on mobile"
echo "   - Check if mobile network has any firewall/proxy settings"


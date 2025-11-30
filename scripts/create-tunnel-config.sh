#!/bin/bash
# Create tunnel configuration file after tunnel is created
# This script should be run AFTER: cloudflared tunnel create dealstack-dev

echo "🔧 Creating Cloudflare Tunnel configuration..."
echo ""

# Check if tunnel exists
if ! cloudflared tunnel list | grep -q "dealstack-dev"; then
    echo "❌ Tunnel 'dealstack-dev' not found!"
    echo ""
    echo "Please create it first with:"
    echo "  cloudflared tunnel create dealstack-dev"
    echo ""
    exit 1
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep dealstack-dev | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Could not find tunnel ID for dealstack-dev"
    echo ""
    echo "Please run: cloudflared tunnel list"
    exit 1
fi

echo "✅ Found tunnel ID: $TUNNEL_ID"
echo ""

# Check for credentials file
CRED_FILE="/root/.cloudflared/${TUNNEL_ID}.json"
CERT_FILE="/root/.cloudflared/cert.pem"

if [ -f "$CRED_FILE" ]; then
    CRED_PATH="$CRED_FILE"
    echo "✅ Found credentials file: $CRED_FILE"
elif [ -f "$CERT_FILE" ]; then
    CRED_PATH="$CERT_FILE"
    echo "✅ Found certificate file: $CERT_FILE"
    echo "   (Using cert.pem - this is fine)"
else
    echo "⚠️  Warning: Could not find credentials file"
    echo "   Expected: $CRED_FILE or $CERT_FILE"
    echo ""
    echo "The tunnel may still work, but let's proceed..."
    CRED_PATH="/root/.cloudflared/${TUNNEL_ID}.json"
fi

echo ""

# Create config directory
mkdir -p ~/.cloudflared

# Create config file
CONFIG_FILE="$HOME/.cloudflared/config.yml"
cat > "$CONFIG_FILE" << EOF
tunnel: dealstack-dev
credentials-file: $CRED_PATH

ingress:
  # Development server
  - hostname: invest.thefatoffice.co.uk
    service: http://localhost:3000
  
  # Catch-all rule (must be last)
  - service: http_status:404
EOF

echo "✅ Configuration file created at: $CONFIG_FILE"
echo ""
echo "Configuration:"
cat "$CONFIG_FILE"
echo ""
echo "Next steps:"
echo "1. Make sure your Next.js dev server is running: npm run dev"
echo "2. Start the tunnel: npm run tunnel:dev"
echo "3. Access your app at: https://invest.thefatoffice.co.uk"
echo ""


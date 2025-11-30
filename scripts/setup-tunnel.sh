#!/bin/bash
# Setup script for Cloudflare Tunnel with custom domain
# This will guide you through setting up a named tunnel

echo "🔧 Cloudflare Tunnel Setup for thefatoffice.co.uk"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed!"
    echo ""
    echo "Installing cloudflared..."
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
    echo ""
fi

echo "✅ cloudflared is installed"
echo ""

# Step 1: Login
echo "Step 1: Login to Cloudflare"
echo "This will open your browser to authorize the tunnel."
echo ""
echo "⚠️  Note: Cloudflare may ask you to verify your email."
echo "   If prompted, check your email and click the verification link,"
echo "   then return to complete the authorization."
echo ""
read -p "Press Enter to continue..."
cloudflared tunnel login

echo ""
echo "✅ Login complete!"
echo ""

# Step 2: Create tunnel
echo "Step 2: Creating named tunnel 'dealstack-dev'..."
cloudflared tunnel create dealstack-dev

echo ""
echo "✅ Tunnel created!"
echo ""

# Step 3: Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep dealstack-dev | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"
echo ""

# Step 4: Get username
USERNAME=$(whoami)
echo "Your username: $USERNAME"
echo ""

# Step 5: Create config
echo "Step 3: Creating tunnel configuration..."
mkdir -p ~/.cloudflared

CONFIG_FILE="$HOME/.cloudflared/config.yml"
cat > "$CONFIG_FILE" << EOF
tunnel: dealstack-dev
credentials-file: /home/$USERNAME/.cloudflared/$TUNNEL_ID.json

ingress:
  # Development server
  - hostname: invest.thefatoffice.co.uk
    service: http://localhost:3000
  
  # Catch-all rule (must be last)
  - service: http_status:404
EOF

echo "✅ Config file created at: $CONFIG_FILE"
echo ""

# Step 6: Create DNS record
echo "Step 4: Creating DNS record..."
echo "This will create a CNAME record: invest.thefatoffice.co.uk"
echo ""
read -p "Press Enter to create DNS record..."
cloudflared tunnel route dns dealstack-dev invest.thefatoffice.co.uk

echo ""
echo "✅ DNS record created!"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your Next.js dev server is running: npm run dev"
echo "2. Start the tunnel: npm run tunnel:dev"
echo "3. Access your app at: https://invest.thefatoffice.co.uk"
echo ""
echo "The tunnel will stay active as long as the command is running."
echo ""


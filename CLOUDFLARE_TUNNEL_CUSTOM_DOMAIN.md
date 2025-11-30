# Cloudflare Tunnel with Custom Domain Setup

This guide will help you set up Cloudflare Tunnel with your custom domain `thefatoffice.co.uk` for a persistent, professional URL.

**Your tunnel URL will be:** `https://invest.thefatoffice.co.uk`

## Prerequisites

- ✅ Cloudflare account
- ✅ Domain `thefatoffice.co.uk` added to Cloudflare
- ✅ Domain DNS managed by Cloudflare

## Email Verification

When you run `cloudflared tunnel login`, Cloudflare may ask you to verify your email. This is **normal and required** for security:
1. Check your email inbox for a verification email from Cloudflare
2. Click the verification link
3. Return to the browser and complete the authorization
4. The tunnel login will complete successfully

## Setup Steps

### 1. Install cloudflared (if not already installed)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 2. Login to Cloudflare

```bash
cloudflared tunnel login
```

This will:
1. Open your browser
2. Ask you to verify your email (if not already verified)
3. Ask you to select the domain `thefatoffice.co.uk`
4. Authorize the tunnel (this creates the certificate file)

**Important:** 
- Make sure to select `thefatoffice.co.uk` when prompted!
- Complete the email verification if asked
- Wait for the "Success" message in the browser
- The command should complete and show "You have successfully logged in"

**Verify login was successful:**
```bash
ls -la ~/.cloudflared/*.json
```

You should see a file like `TUNNEL_ID.json` - this is your certificate file. If you don't see it, the login didn't complete successfully.

### 3. Create a Named Tunnel

```bash
cloudflared tunnel create dealstack-dev
```

This creates a tunnel named `dealstack-dev`. You'll see output with a Tunnel ID (UUID).

### 4. Create Tunnel Configuration

Create the config directory:
```bash
mkdir -p ~/.cloudflared
```

Create/edit the config file `~/.cloudflared/config.yml`:

```yaml
tunnel: dealstack-dev
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  # Your development server
  - hostname: invest.thefatoffice.co.uk
    service: http://localhost:3000
  
  # Catch-all rule (must be last)
  - service: http_status:404
```

**Important:** Replace `TUNNEL_ID` with the actual tunnel ID from step 3. After creating the tunnel, you'll see the tunnel ID in the output, and a file will be created at `/root/.cloudflared/TUNNEL_ID.json`.

**Note:** If you see `cert.pem` instead of a `.json` file, that's fine - cloudflared will use it automatically. The config file format above is for the newer `.json` format.

### 5. Create DNS Record in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain `thefatoffice.co.uk`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type:** `CNAME`
   - **Name:** `invest` (this creates `invest.thefatoffice.co.uk`)
   - **Target:** `TUNNEL_ID.cfargotunnel.com` (replace TUNNEL_ID with your actual tunnel ID)
   - **Proxy status:** Proxied (orange cloud) ✅
   - **TTL:** Auto
6. Click **Save**

**Alternative:** You can also create the DNS record via command line (recommended):
```bash
cloudflared tunnel route dns dealstack-dev invest.thefatoffice.co.uk
```

This automatically creates the DNS record for you!

This automatically creates the DNS record for you!

### 6. Update Next.js Configuration (Important!)

The Next.js config has been updated to allow your custom domain. If you see cross-origin warnings, make sure `next.config.js` includes:

```javascript
allowedDevOrigins: [
  'https://invest.thefatoffice.co.uk',
],
```

This is already configured in the project! ✅

**Optional:** If you want NextAuth to work properly with the custom domain, you can update your `.env` file:
```bash
NEXTAUTH_URL="https://invest.thefatoffice.co.uk"
```

However, NextAuth should work fine with the default `localhost:3000` setting even when accessed via the tunnel.

### 7. Run the Tunnel

```bash
cloudflared tunnel run dealstack-dev
```

Or use the npm script:
```bash
npm run tunnel:dev
```

The tunnel will start and connect. You should see:
```
+--------------------------------------------------------------------------------------------+
|  Your tunnel is running! Visit it at:                                                    |
|  https://invest.thefatoffice.co.uk                                                       |
+--------------------------------------------------------------------------------------------+
```

### 8. Access from Mobile

Once the tunnel is running:
1. Make sure your Next.js dev server is running: `npm run dev`
2. Open `https://invest.thefatoffice.co.uk` on your mobile device
3. Test your application!

## Quick Reference Commands

**List all tunnels:**
```bash
cloudflared tunnel list
```

**View tunnel details:**
```bash
cloudflared tunnel info dealstack-dev
```

**Delete tunnel (if needed):**
```bash
cloudflared tunnel delete dealstack-dev
```

**Run tunnel:**
```bash
cloudflared tunnel run dealstack-dev
```

## Adding to package.json

I'll add a script to make it easier to run your named tunnel.

## Troubleshooting

### DNS not resolving
- Wait a few minutes for DNS propagation (usually instant with Cloudflare)
- Check Cloudflare dashboard → DNS → Records to verify the CNAME exists
- Make sure the tunnel is running

### Tunnel won't connect
- Verify the config file path and tunnel name are correct
- Check that credentials file exists: `ls ~/.cloudflared/*.json`
- Make sure your dev server is running on `localhost:3000`

### 404 errors
- Make sure your Next.js dev server is running
- Check the service URL in config.yml is correct: `http://localhost:3000`
- Verify the tunnel is actually running (check the terminal output)

### Works at home but not on mobile/other networks
This is a common issue. Try these steps:

1. **Check if tunnel is still running:**
   ```bash
   ./scripts/check-tunnel-status.sh
   ```
   Or manually:
   ```bash
   pgrep -f "cloudflared tunnel run"
   ```
   If not running, restart it: `npm run tunnel:dev`

2. **Verify DNS is resolving correctly:**
   - On your mobile, try accessing the URL directly
   - Check Cloudflare dashboard → DNS → Records
   - Make sure the CNAME record exists and is "Proxied" (orange cloud)

3. **Check tunnel logs:**
   - Look at the terminal where the tunnel is running
   - Check for any error messages
   - The tunnel should show "Connection established"

4. **Restart the tunnel:**
   ```bash
   # Stop the tunnel (Ctrl+C)
   # Then restart:
   npm run tunnel:dev
   ```

5. **Check Cloudflare dashboard:**
   - Go to Zero Trust → Networks → Tunnels
   - Verify your tunnel shows as "Active" or "Healthy"
   - Check for any warnings or errors

6. **Network-specific issues:**
   - Some mobile networks or public WiFi may block certain connections
   - Try using mobile data instead of WiFi (or vice versa)
   - Some networks block Cloudflare Tunnel connections

7. **Verify the tunnel is accessible:**
   ```bash
   # From your home network, test:
   curl -I https://invest.thefatoffice.co.uk
   ```
   Should return HTTP 200 or 307 (redirect)

### Can't login / No certificate file
- Make sure you complete the entire login process:
  1. Run `cloudflared tunnel login`
  2. Verify your email if prompted
  3. Select your domain `thefatoffice.co.uk`
  4. Click "Authorize" in the browser
  5. Wait for "Success" message
  6. The terminal should show "You have successfully logged in"
- Check if certificate file exists: `ls -la ~/.cloudflared/*.json`
- If no certificate file, try: `cloudflared tunnel login --overwrite-dns`
- Make sure you're logged into Cloudflare in your browser before running the command

## Security Notes

⚠️ **Important:**
- This exposes your local dev server to the internet
- Your Next.js authentication still applies (good!)
- Only use for development/testing
- Consider adding IP restrictions in Cloudflare if needed
- The tunnel uses HTTPS automatically (secure)

## Multiple Subdomains

You can add more subdomains for different services:

```yaml
ingress:
  - hostname: invest.thefatoffice.co.uk
    service: http://localhost:3000
  - hostname: api-dev.thefatoffice.co.uk
    service: http://localhost:3001
  - service: http_status:404
```

Then create DNS records for each subdomain pointing to your tunnel.

## Running as a Service (Optional)

To run the tunnel automatically in the background, you can set it up as a systemd service. Let me know if you want instructions for this!


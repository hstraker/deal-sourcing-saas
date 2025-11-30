# Cloudflare Tunnel Setup for Mobile Testing

This guide will help you set up Cloudflare Tunnel to access your local development server from your mobile device.

## What is Cloudflare Tunnel?

Cloudflare Tunnel (cloudflared) creates a secure connection between your local server and Cloudflare's network, giving you a public URL that tunnels to your localhost. It's **free** and perfect for testing on mobile devices.

## Prerequisites

- A Cloudflare account (free tier works)
- Your Next.js dev server running on `localhost:3000`

**💡 Have a custom domain?** If you have a Cloudflare-managed domain (like `thefatoffice.co.uk`), see `CLOUDFLARE_TUNNEL_CUSTOM_DOMAIN.md` for setup with a persistent, professional URL!

## Setup Steps

### 1. Install cloudflared

**On WSL Ubuntu:**
```bash
# Download and install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

**Or using snap:**
```bash
sudo snap install cloudflared
```

**Verify installation:**
```bash
cloudflared --version
```

### 2. Login to Cloudflare

```bash
cloudflared tunnel login
```

This will:
1. Open your browser
2. Ask you to select a domain (if you have one) or use Cloudflare's free tunnel service
3. Authorize the tunnel

**Note:** If you don't have a domain, you can use Cloudflare's free tunnel service which gives you a random URL like `https://random-words-1234.trycloudflare.com`

### 3. Quick Start (Temporary Tunnel - Easiest)

For quick testing, you can use a temporary tunnel that gives you a random URL:

```bash
# In a new terminal (keep your npm run dev running in another terminal)
cloudflared tunnel --url http://localhost:3000
```

This will output something like:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://random-words-1234.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

**Use this URL on your mobile device!** The tunnel will stay active as long as the command is running.

### 4. Named Tunnel (Persistent - Recommended)

For a more permanent solution with a consistent URL:

#### Create a named tunnel:
```bash
cloudflared tunnel create dealstack-dev
```

This creates a tunnel named `dealstack-dev`.

#### Create a config file:
```bash
mkdir -p ~/.cloudflared
```

Create `~/.cloudflared/config.yml`:
```yaml
tunnel: dealstack-dev
credentials-file: /home/YOUR_USERNAME/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: dealstack-dev.YOUR_DOMAIN.com  # If you have a domain
    service: http://localhost:3000
  - service: http_status:404  # Catch-all rule
```

**Note:** Replace `YOUR_USERNAME` and `YOUR_DOMAIN.com` with your actual values.

#### Run the tunnel:
```bash
cloudflared tunnel run dealstack-dev
```

### 5. Add npm Script (Optional)

I'll add a script to your `package.json` to make it easier to start the tunnel.

## Security Notes

⚠️ **Important Security Considerations:**

1. **Development Only:** Only use this for development/testing. Don't expose production servers.
2. **Authentication:** Your Next.js app has authentication, which is good. Make sure you're logged in before accessing sensitive data.
3. **HTTPS:** Cloudflare Tunnel automatically provides HTTPS, which is secure.
4. **Temporary URLs:** The quick tunnel URLs are temporary and change each time. Named tunnels can have persistent URLs if you have a domain.

## Troubleshooting

### Tunnel won't connect
- Make sure your Next.js dev server is running on `localhost:3000`
- Check that port 3000 isn't blocked by firewall
- Try restarting the tunnel

### Can't access from mobile
- Make sure you're using the HTTPS URL (not HTTP)
- Check that your mobile device has internet connection
- Try the URL in a browser first to verify it works

### Connection drops
- Keep the `cloudflared` command running
- If using a named tunnel, make sure the config file is correct
- Check Cloudflare dashboard for tunnel status

## Quick Reference

**Start temporary tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

**Start named tunnel:**
```bash
cloudflared tunnel run dealstack-dev
```

**List tunnels:**
```bash
cloudflared tunnel list
```

**Delete tunnel:**
```bash
cloudflared tunnel delete dealstack-dev
```

## Next Steps

Once the tunnel is running:
1. Copy the URL provided by cloudflared
2. Open it on your mobile device
3. Test your application's mobile responsiveness
4. The tunnel will stay active as long as the command is running

---

**Pro Tip:** You can run the tunnel in a separate terminal window or as a background process so it doesn't block your terminal.


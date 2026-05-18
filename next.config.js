/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    // Keep SWC but try to handle edge cases better
    removeConsole: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Puppeteer must not be bundled by webpack — it needs to resolve its
    // bundled Chrome binary at runtime from node_modules.
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-core', 'twilio', '@anthropic-ai/sdk', 'openai'],
    // Proper per-icon tree-shaking for lucide-react.
    // Without this, Next.js barrel-optimises the whole icon set and renames
    // exports to _barrel_optimize_names_… which breaks module-level JSX
    // (e.g. FLAG_ICON / FLOOD_ZONE_CONFIG constant objects in panel files).
    optimizePackageImports: ['lucide-react'],
  },
  // Allow Cloudflare Tunnel domain for development
  // This allows cross-origin requests to /_next/* resources from the tunnel domain
  allowedDevOrigins: [
    'app.habbits.co.uk',
  ],
}

module.exports = nextConfig


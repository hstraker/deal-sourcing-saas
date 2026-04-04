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
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-core', 'twilio'],
  },
  // Allow Cloudflare Tunnel domain for development
  // This allows cross-origin requests to /_next/* resources from the tunnel domain
  allowedDevOrigins: [
    'app.habbits.co.uk',
  ],
}

module.exports = nextConfig


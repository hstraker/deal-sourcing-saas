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
    instrumentationHook: true,
    // Puppeteer must not be bundled by webpack — it needs to resolve its
    // bundled Chrome binary at runtime from node_modules.
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-core'],
  },
  // Allow Cloudflare Tunnel domain for development
  // This allows cross-origin requests to /_next/* resources from the tunnel domain
  allowedDevOrigins: [
    'https://invest.thefatoffice.co.uk',
  ],
}

module.exports = nextConfig


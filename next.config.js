/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  },
  // Allow Cloudflare Tunnel domain for development
  // This allows cross-origin requests to /_next/* resources from the tunnel domain
  allowedDevOrigins: [
    'https://invest.thefatoffice.co.uk',
  ],
}

module.exports = nextConfig


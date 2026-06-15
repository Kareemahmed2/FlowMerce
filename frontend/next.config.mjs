/** @type {import('next').NextConfig} */
const nextConfig = {
  // DOC-2: enables the .next/standalone output needed by the Docker runner stage.
  output: 'standalone',

  images: {
    // DOC-7: allow images served from localhost (dev) and the backend upload path.
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/api/v1/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '**.flowmerce.io',
      },
    ],
  },
}

export default nextConfig

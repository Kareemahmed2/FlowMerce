/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output is only needed for Docker production builds — Turbopack
  // dev mode errors on it, so we skip it outside of a real build.
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),

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

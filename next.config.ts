import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
  devIndicators: {
    appIsrStatus: false,
  },
}

export default nextConfig

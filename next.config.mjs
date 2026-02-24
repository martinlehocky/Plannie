import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['next-intl']
  },
  async redirects() {
    return [
      {
        source: '/:path((?!en|de|api|_next|_vercel|.*\\..*).*)',
        destination: '/en/:path*',
        permanent: true,
      },
    ]
  },
}

export default withNextIntl(nextConfig)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@genver/sdk'],
};

module.exports = nextConfig;

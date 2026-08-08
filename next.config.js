/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname)
    };
    return config;
  },
  // Some dependencies ship ESM-only builds that can cause runtime import errors
  // on serverless platforms. Transpile them so the server/runtime can import
  // them safely (fixes errors like "Named export 'createContext' not found").
  transpilePackages: [
    'swr'
  ],
};

module.exports = nextConfig;

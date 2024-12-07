/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

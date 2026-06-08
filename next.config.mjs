/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // TODO: turn this off after the legacy screens listed in README are typed.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

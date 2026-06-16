/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev artifacts separate from production builds. Sharing `.next`
  // invalidates the dev Server Action manifest whenever `npm run build` runs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Type errors now fail the build (tsc --noEmit is clean). Keep it this way
    // so regressions are caught before deploy.
    ignoreBuildErrors: false,
  },
  // The app used to live under /v2; it is now the system at root. Keep old
  // /v2/* bookmarks and shared links working instead of 404-ing.
  async redirects() {
    return [
      { source: "/v2", destination: "/", permanent: true },
      { source: "/v2/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

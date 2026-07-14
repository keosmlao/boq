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
  experimental: {
    serverActions: {
      // Photos reach the survey / project / work-order actions as raw camera
      // files in a FormData. A phone shot is 2-5MB, well over the 1MB default,
      // so the request was rejected before the action body ever ran and the
      // save surfaced as a generic "ບັນທຶກບໍ່ສຳເລັດ".
      bodySizeLimit: "10mb",
    },
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

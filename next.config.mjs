/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM + uses Node built-ins; keep it external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Hide the floating dev badge — it sits bottom-left, over the sidebar account card.
  devIndicators: false,
};

export default nextConfig;

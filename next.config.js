/** @type {import('next').NextConfig} */
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

function getDistDir() {
  // Optional override (e.g., to keep build artifacts outside OneDrive):
  // set NEXT_DIST_DIR=.next
  // or point it to a project-local junction/symlink.
  if (process.env.NEXT_DIST_DIR) return process.env.NEXT_DIST_DIR;

  // Default to a project-local folder so TypeScript module resolution
  // works for generated Next types (distDir outside the project breaks this).
  return '.next';
}

// Enable dynamic server functions & API routes (no static export)
const nextConfig = withNextIntl({
  distDir: getDistDir(),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'www.pexels.com' },
    ]
  },
  poweredByHeader: false,
});

module.exports = nextConfig;

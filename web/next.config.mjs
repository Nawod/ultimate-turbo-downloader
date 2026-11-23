/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig = {
  // a self-contained server bundle for the Docker image (yt-dlp needs a real server, not serverless)
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // video thumbnails come from many CDNs; shown with a plain <img>, so no remote patterns needed
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

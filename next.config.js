const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force cache bust on env var changes
  generateBuildId: async () => `build-${Date.now()}`,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.amazonaws.com",
        pathname: "/upload-file-droplinked/**",
      },
    ],
  },
  webpack(config) {
    config.module.rules.push({
      test: /[\\/]@burnt-labs[\\/]abstraxion-core[\\/]dist[\\/]index\.m?js$/,
      use: [{ loader: path.resolve(__dirname, "abstraxion-patch-loader.js") }],
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
}

module.exports = nextConfig;

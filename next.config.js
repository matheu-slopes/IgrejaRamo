/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: "NetworkOnly",
      options: {
        cacheName: "ramo-supabase-network",
      },
    },
    {
      urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
      options: {
        cacheName: "ramo-api-network",
      },
    },
    {
      urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "ramo-next-static",
        expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "ramo-images",
        expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = withPWA(nextConfig);

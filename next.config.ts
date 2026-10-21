import type { NextConfig } from "next";

// Uploaded images are served from the object storage bucket's public URL.
const storageUrl = process.env.S3_PUBLIC_BASE_URL ? new URL(process.env.S3_PUBLIC_BASE_URL) : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: storageUrl
      ? [
          {
            protocol: storageUrl.protocol.replace(":", "") as "http" | "https",
            hostname: storageUrl.hostname,
            pathname: `${storageUrl.pathname.replace(/\/$/, "")}/**`,
          },
        ]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

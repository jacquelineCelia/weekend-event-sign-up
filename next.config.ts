import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The staff Attendees tab moved from /staff/people to /staff/participants (2026-11-10); old bookmarks still work.
  async redirects() {
    return [
      { source: "/staff/people", destination: "/staff/participants", permanent: false },
      { source: "/staff/people/csv", destination: "/staff/participants/csv", permanent: false },
    ];
  },
};

export default nextConfig;

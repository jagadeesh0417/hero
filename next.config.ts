import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [
      // Enforce www as the canonical hostname.
      // Razorpay validates the page origin against the approved website —
      // if the customer visits sumantravels.online (no www) the Razorpay
      // checkout sees a different origin and throws "Business - Website mismatch".
      {
        source: "/:path*",
        has: [{ type: "host", value: "sumantravels.online" }],
        destination: "https://www.sumantravels.online/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.7:3000",
    "192.168.1.7",
    "localhost:3000",
    "127.0.0.1:3000"
  ],
  images: {
    // Popsy illustrations are SVG line art, served through next/image with
    // `unoptimized` (nothing for the optimizer to do). Listed here so the host
    // is documented in one place if we ever switch them to raster assets.
    remotePatterns: [new URL("https://illustrations.popsy.co/**")],
  },
};

export default nextConfig;

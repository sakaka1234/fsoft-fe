import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Popsy illustrations are SVG line art, served through next/image with
    // `unoptimized` (nothing for the optimizer to do). Listed here so the host
    // is documented in one place if we ever switch them to raster assets.
    remotePatterns: [new URL("https://illustrations.popsy.co/**")],
  },
};

export default nextConfig;

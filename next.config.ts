import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emit .next/standalone: a self-contained server plus only the traced
   * node_modules files, so the runtime image never installs dependencies.
   * The Dockerfile depends on this; removing it breaks the image, not the
   * local build. `public` and `.next/static` are not copied into standalone
   * automatically, which is why the Dockerfile copies them itself.
   */
  // output: "standalone",

  /**
   * Origins allowed to reach the dev server's internal endpoints. The port the
   * app listens on lives in package.json (`next dev -p 4000`); this list only
   * matters for reaching that server from somewhere other than the host it was
   * started on, such as a phone on the LAN.
   *
   * Both ports are listed so switching back to 3000 needs no config change.
   */
  allowedDevOrigins: [
    "localhost:4000",
    "127.0.0.1:4000",
    "192.168.1.7:4000",
    "192.168.1.7",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.1.7:3000",
  ],
  /*
   * No `images.remotePatterns` on purpose. Every illustration now lives in
   * public/illustrations/ and is referenced by an absolute path, so nothing
   * next/image loads comes from another origin. The previous entry existed
   * for illustrations.popsy.co, whose CDN zone was suspended and took every
   * illustration on the landing and auth pages down with it. Adding a remote
   * host back means accepting that failure mode again.
   */
};

export default nextConfig;

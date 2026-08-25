import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output is OPT IN, and only the Dockerfile opts in.
   *
   * Setting it unconditionally broke deploys on Vercel:
   *
   *   Error: ENOENT: no such file or directory, open
   *   '/vercel/path0/.next/next-server.js.nft.json'
   *
   * The mechanism: `output: "standalone"` makes Next run copyTracedFiles()
   * (node_modules/next/dist/build/utils.js:1106), which READS that trace file.
   * The file is written only by collectBuildTraces(), and both of its call
   * sites in build/index.js are gated on the bundler not being Turbopack. On
   * Vercel the writer did not run and the reader still did, so the build died.
   * The same build succeeds locally, which is why this was worth pinning to a
   * flag rather than to a guess about which platform behaves how.
   *
   * Vercel does not need this setting: it produces its own deployment output.
   * Only a self-hosted container does, so the Docker builder stage sets
   * BUILD_STANDALONE=1 and nothing else does. Keeping the default equal to
   * stock Next means the everyday `pnpm build` and CI take the well trodden
   * path.
   *
   * `public` and `.next/static` are not copied into standalone automatically,
   * which is why the Dockerfile copies them itself.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,

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

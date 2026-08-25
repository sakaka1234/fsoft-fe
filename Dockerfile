# syntax=docker/dockerfile:1.7

# Production image for the Next.js frontend.
#
# Four stages so that a source-only change reuses the cached dependency
# install: base (toolchain) -> deps (node_modules) -> builder (next build)
# -> runner (the only stage that ships).
#
# Build:
#   docker build \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-backend/fsoft \
#     --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
#     -t fsoft-fe .
# Run:
#   docker run --rm -p 4000:4000 fsoft-fe

ARG NODE_VERSION=22.14.0

# ---------------------------------------------------------------------------
# base: Node plus pnpm. pnpm's version is not pinned here on purpose. Corepack
# reads the "packageManager" field in package.json, so the container always
# matches the repo and the two cannot drift apart.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base

# Next's SWC binary is glibc-linked and needs this shim on musl/Alpine.
RUN apk add --no-cache libc6-compat

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Corepack otherwise stops and waits for a yes/no answer, which hangs a build
# that has no TTY attached.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

WORKDIR /app

# ---------------------------------------------------------------------------
# deps: node_modules only. Copying just the manifests means this layer is
# rebuilt when a dependency changes, not when a component does.
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile fails rather than quietly resolving a different tree than
# the one committed. The cache mount keeps pnpm's content-addressed store
# across builds; it lives outside the layer, so it adds nothing to the image.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder: next build.
#
# NEXT_PUBLIC_* variables are substituted into the client bundle during the
# build, not read at container start. They therefore have to arrive as build
# args, and the resulting image is tied to the backend it was built against.
# Pointing at a different backend means rebuilding, not restarting.
# ---------------------------------------------------------------------------
FROM base AS builder

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NODE_ENV=production

# Turns on `output: "standalone"` in next.config.ts, which is off by default.
# It is a flag rather than a constant because setting it unconditionally broke
# Vercel deploys with an ENOENT on .next/next-server.js.nft.json; the reasoning
# is written out in next.config.ts. This image is the only thing that wants it.
ENV BUILD_STANDALONE=1

# Fail loudly at build time. Without this the build succeeds and every API
# call in the running container resolves against the container's own origin,
# which looks like a backend outage rather than a missing argument.
RUN if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then \
      echo "" >&2; \
      echo "ERROR: --build-arg NEXT_PUBLIC_API_BASE_URL is required." >&2; \
      echo "It is baked into the browser bundle and cannot be set at runtime." >&2; \
      echo "" >&2; \
      exit 1; \
    fi; \
    if [ -z "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]; then \
      echo "WARNING: NEXT_PUBLIC_GOOGLE_CLIENT_ID is empty." >&2; \
      echo "The app will build and run, but Google sign-in will not work." >&2; \
    fi

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ---------------------------------------------------------------------------
# runner: the shipped image. Plain Node, no pnpm and no source tree.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Port and host are read by the standalone server.js at startup, so both can
# be overridden with `docker run -e PORT=...` without a rebuild. 0.0.0.0 is
# required: bound to localhost the server is unreachable from outside the
# container even with -p.
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Run as a normal user. node:alpine ships a `node` user at uid 1000, so 1001
# is free.
RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# `output: "standalone"` writes a server plus only the node_modules files that
# tracing proved are reachable. It deliberately leaves out public/ and
# .next/static, expecting a CDN to serve them; there is no CDN here, so they
# are copied in and server.js picks them up.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 4000

# Node 22 has fetch built in, so this needs no curl or wget in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

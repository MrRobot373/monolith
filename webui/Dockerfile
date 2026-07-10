# syntax=docker/dockerfile:1
# Build OpenWork's FULL web UI (apps/app, MIT) from source and serve it as a
# static SPA — replaces the minimal built-in "Toy UI".
#
# Build context = MONOLITH repo root (so it can COPY openwork/).

# ---- Stage 1: compile the React/Vite app --------------------------------------
FROM node:22-bookworm AS build
RUN corepack enable \
 && curl -fsSL https://bun.sh/install | bash \
 && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
WORKDIR /src
COPY openwork/ ./
# Install only the app + its workspace deps (@openwork/types, @openwork/ui — both
# export TS source, so no separate build of those is needed).
RUN pnpm install --frozen-lockfile --filter "@openwork/app..."

# Server wiring baked into the bundle (the app seeds these into localStorage).
ARG VITE_OPENWORK_URL
ARG VITE_OPENWORK_TOKEN
ARG VITE_OPENWORK_HOST_TOKEN
ARG VITE_OPENWORK_PORT
ENV VITE_OPENWORK_URL=$VITE_OPENWORK_URL \
    VITE_OPENWORK_TOKEN=$VITE_OPENWORK_TOKEN \
    VITE_OPENWORK_HOST_TOKEN=$VITE_OPENWORK_HOST_TOKEN \
    VITE_OPENWORK_PORT=$VITE_OPENWORK_PORT

# Branding: set the product name in the browser tab title.
ARG MONOLITH_PRODUCT_NAME=MONOLITH
RUN sed -i "s|<title>[^<]*</title>|<title>${MONOLITH_PRODUCT_NAME}</title>|g" \
      apps/app/index.html apps/app/overlay.html 2>/dev/null || true

RUN pnpm --filter "@openwork/app" build

# ---- Stage 2: serve the static build ------------------------------------------
FROM caddy:2-alpine
COPY webui/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/apps/app/dist /srv

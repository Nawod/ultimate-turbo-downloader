# Ultimate Turbo Downloader — website. Needs a real server (not serverless): it runs yt-dlp + ffmpeg.
# Build:  docker build -t utd-web --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com .
# Run:    docker run -p 3060:3060 -e TOKEN_SECRET=$(openssl rand -hex 32) utd-web

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3060
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
# yt-dlp (with its YouTube JS-challenge solver) and ffmpeg
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages "yt-dlp[default,curl-cffi]" \
 && apt-get purge -y python3-pip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3060 HOSTNAME=0.0.0.0 MAX_JOBS=4
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN useradd --create-home --uid 10001 app && chown -R app /app
USER app
EXPOSE 3060
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3060/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM node:24-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium tzdata \
 && rm -rf /var/lib/apt/lists/*
ARG COMMIT_SHA COMMIT_TIME
ENV COMMIT_SHA=$COMMIT_SHA COMMIT_TIME=$COMMIT_TIME
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    TZ=Europe/Berlin \
    NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src src
COPY public public
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["npm", "start"]

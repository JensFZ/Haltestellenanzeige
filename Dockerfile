FROM node:25-slim
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
CMD ["npm", "start"]

FROM mcr.microsoft.com/playwright:v1.48.2-jammy
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Chromium inside a container needs these flags (no user namespaces / small /dev/shm)
RUN sed -i "s/chromium.launch()/chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })/" app/api/browse/route.ts

RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["npm", "start"]

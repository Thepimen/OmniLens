# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Final stage
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js

# Ensure local directories for file uploads and frame extractions exist
RUN mkdir -p /uploads/frames

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "server.js"]

# Stage 1: Build Server and Client
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm run install:all

# Copy source code
COPY . .

# Build server and client
RUN npm run build --prefix server
RUN npm run build --prefix client

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3383

# Copy package manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install perl for exiftool-vendored support
RUN apk add --no-cache perl

# Install production dependencies for server
RUN npm install --only=production --prefix server

# Copy compiled build output
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Expose web application port
EXPOSE 3383

# Start production server
CMD ["node", "server/dist/index.js"]

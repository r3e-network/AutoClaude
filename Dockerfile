# Multi-stage build for AutoClaude VS Code Extension
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY terminal/package*.json ./terminal/

# Install dependencies
RUN npm ci --only=production
RUN cd terminal && npm ci --only=production

# Copy source code
COPY . .

# Build the extension
RUN npm run compile:production

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache python3 git

# Create non-root user
RUN addgroup -g 1001 -S autoclaude && \
    adduser -u 1001 -S autoclaude -G autoclaude

# Set working directory
WORKDIR /app

# Copy built files from builder stage
COPY --from=builder --chown=autoclaude:autoclaude /app/out ./out
COPY --from=builder --chown=autoclaude:autoclaude /app/package*.json ./
COPY --from=builder --chown=autoclaude:autoclaude /app/node_modules ./node_modules
COPY --from=builder --chown=autoclaude:autoclaude /app/terminal ./terminal

# Copy necessary files
COPY --chown=autoclaude:autoclaude LICENSE ./
COPY --chown=autoclaude:autoclaude README.md ./
COPY --chown=autoclaude:autoclaude .vscodeignore ./

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R autoclaude:autoclaude /app/logs /app/data

# Switch to non-root user
USER autoclaude

# Set environment variables
ENV NODE_ENV=production
ENV LOG_FILE_PATH=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Volume for persistent data
VOLUME ["/app/logs", "/app/data"]

# Note: VS Code extensions run within VS Code, so there's no single entry point
# This container is primarily for packaging and distribution
CMD ["node", "-e", "console.log('AutoClaude container ready. Install in VS Code to use.')"]
# ==============================================================================
# Stage 1: Base Image - Common Layer
# ==============================================================================
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# ==============================================================================
# Stage 2: Dependencies - Install Production Dependencies
# ==============================================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies only
# - Use clean install for reproducible builds
# - Ignore optional dependencies to reduce image size
# - Skip audit to speed up build (run separately in CI)
RUN npm ci --only=production --ignore-scripts --omit=dev && \
    npm cache clean --force

# ==============================================================================
# Stage 3: Build - Install All Dependencies (if build step needed)
# ==============================================================================
FROM base AS build

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build/test)
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source code
COPY . .

# Run tests in build stage (fail fast if tests fail)
# Note: Requires test database connection or mocked services
# Uncomment when you have test environment configured
# RUN npm test

# Validate code syntax
RUN npm run check

# ==============================================================================
# Stage 4: Production - Final Optimized Image
# ==============================================================================
FROM base AS production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Set security headers and limits
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodejs:nodejs . .

# Remove development files to reduce image size
RUN rm -rf \
    tests \
    .git \
    .github \
    .kiro \
    .env.example \
    *.md \
    nodemon.json \
    .gitignore \
    .dockerignore \
    jest.config.js

# Create necessary directories with proper permissions
RUN mkdir -p logs && \
    chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check - adjust path based on your health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly (PID 1 problem)
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/main.js"]

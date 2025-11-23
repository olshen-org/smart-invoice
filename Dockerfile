# Multi-stage build for optimal image size

# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY package.json package-lock.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Build the final image
FROM node:20-slim

WORKDIR /app

# Copy server package files
COPY server/package.json server/package-lock.json ./

# Install production dependencies only
RUN npm ci --production

# Copy server code
COPY server/ .

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Environment variable for port
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "index.js"]



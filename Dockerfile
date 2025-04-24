# Build stage
FROM node:20-slim as builder

# Set working directory
WORKDIR /app

# Copy package files for both client and server
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies for both client and server
RUN npm install --legacy-peer-deps
RUN cd server && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the React application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --production --legacy-peer-deps
RUN cd server && npm install --production --legacy-peer-deps

# Copy built files and server code
COPY --from=builder /app/dist ./dist
COPY server ./server

# Create uploads directory
RUN mkdir -p server/uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/index.js"]

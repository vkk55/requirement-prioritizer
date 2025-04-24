# Use Node.js LTS version
FROM node:20-slim as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the React application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY server ./server

# Install production dependencies only
RUN npm install --production

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/index.js"]

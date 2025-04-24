# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install --legacy-peer-deps
RUN cd server && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the React application
RUN npm run build

# Create uploads directory
RUN mkdir -p server/uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/index.js"]

# Use official Node.js 22 Alpine image
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy all project files
COPY . .

# Expose application port
EXPOSE 8080

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health',(res)=>{if(res.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"

# Environment
ENV NODE_ENV=production

# Start application
CMD ["node", "server.js"]
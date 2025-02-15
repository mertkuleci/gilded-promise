# Use the official Playwright image with Ubuntu Focal (includes all browser dependencies)
FROM mcr.microsoft.com/playwright:focal

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock to leverage caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port (make sure your app listens on process.env.PORT || 3001)
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]

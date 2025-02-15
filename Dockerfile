# Use the official Playwright image with Ubuntu Focal (includes all browser dependencies)
FROM mcr.microsoft.com/playwright:focal

# Set the working directory
WORKDIR /app

# Copy package.json (remove yarn.lock if not present)
COPY package.json ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port (make sure your app listens on process.env.PORT || 3001)
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]

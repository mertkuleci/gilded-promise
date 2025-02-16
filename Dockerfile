# Use the official Playwright image with Ubuntu Focal
FROM mcr.microsoft.com/playwright:focal

# Set working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies using npm (this will run postinstall to download Playwright browsers)
RUN npm install

# Copy the rest of the code
COPY . .

# Expose port 3001
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]

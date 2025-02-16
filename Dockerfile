# Use the official Playwright image with Ubuntu Focal
FROM mcr.microsoft.com/playwright:focal

# Set the working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies using npm (runs postinstall to download browsers)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port (ensure server.js listens on process.env.PORT || 3001)
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]

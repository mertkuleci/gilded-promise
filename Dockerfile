# Use the official Playwright image with Ubuntu Focal (includes necessary browser dependencies)
FROM mcr.microsoft.com/playwright:focal

# Set the working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies using npm (this runs the postinstall script to download Playwright browsers)
RUN npm install

# Copy the rest of the code
COPY . .

# Expose port 3001 (or the port your server uses)
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]

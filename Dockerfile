# Use the official Playwright image with Ubuntu Focal
FROM mcr.microsoft.com/playwright:focal

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]

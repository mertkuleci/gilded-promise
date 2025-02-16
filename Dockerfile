# Dockerfile for building and running our Node/Express app
FROM mcr.microsoft.com/playwright:focal

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]

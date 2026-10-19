FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p public/uploads && chown -R node:node /app

EXPOSE 3000

CMD ["node", "server.js"]

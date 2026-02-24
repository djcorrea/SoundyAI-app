FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/uploads

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
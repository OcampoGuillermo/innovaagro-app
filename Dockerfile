FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    UPLOADS_DIR=/app/uploads

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY shared ./shared
COPY public ./public

RUN mkdir -p /app/data /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
VOLUME ["/app/data", "/app/uploads"]

CMD ["node", "server/index.js"]

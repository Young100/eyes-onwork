# Étape 1 : Build du bundle frontend Vite
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Étape 2 : Conteneur d'exécution pour Google Cloud Run
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
# tsx est présent dans dependencies et sera conservé
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/emailService.ts ./
COPY --from=builder /app/firebase-applet-config.json ./
COPY --from=builder /app/src ./src

EXPOSE 8080

CMD ["npm", "start"]

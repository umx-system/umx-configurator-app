FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm exec -- prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/app/data/app.sqlite
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/prisma ./prisma
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
# Mount /app/data as a persistent volume when using the default SQLite store.
CMD ["npm", "run", "docker-start"]

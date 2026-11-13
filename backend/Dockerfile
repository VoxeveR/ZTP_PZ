FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8000
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]

FROM runtime AS test
COPY --chown=node:node test ./test
CMD ["node", "--test", "test/lifecycle.e2e.test.mjs", "test/products.e2e.test.mjs", "test/product-history.e2e.test.mjs", "test/notifications.e2e.test.mjs"]

FROM runtime AS production

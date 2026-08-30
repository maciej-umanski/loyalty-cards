# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run icons
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.mjs .
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.mjs"]

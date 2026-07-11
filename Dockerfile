# Build stage: compile the React frontend
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: Express serves the API + built static files
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8080
USER node
CMD ["node", "server/index.js"]

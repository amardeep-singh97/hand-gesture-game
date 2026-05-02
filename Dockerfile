# Stage 1: Build
FROM node:25-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/client/package*.json ./packages/client/
COPY packages/server/package*.json ./packages/server/
COPY packages/common/package*.json ./packages/common/

# Install all dependencies
RUN npm install

COPY . .

# Build the frontend and the backend (tsup will handle common automatically)
RUN npm run build -w client
RUN npm run build -w server

# Stage 2: Production
FROM node:25-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy root configs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/server/package*.json ./packages/server/

# Copy the completely flat dist folder created by tsup
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Install production dependencies
RUN npm install --omit=dev

EXPOSE 3001

# The file is exactly where you expect it to be!
CMD ["node", "packages/server/dist/index.js"]
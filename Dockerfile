# Stage 1: Build the React frontend
FROM node:26-bookworm-slim AS frontend-build
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@latest
WORKDIR /app
COPY package.json ./
RUN npm install
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm run build

# Stage 2: Build the Node/Express backend
FROM node:26-bookworm-slim AS backend-build
RUN npm install -g npm@latest
WORKDIR /app
COPY package.json ./
RUN npm install
COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist ./public

# Stage 3: Final image
FROM node:26-bookworm-slim
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends gosu supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/src ./src
COPY --from=backend-build /app/public ./public

COPY entrypoint.sh /entrypoint.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN useradd -m -u 10001 golf \
    && mkdir -p /app/data \
    && chown -R golf:golf /app \
    && chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]

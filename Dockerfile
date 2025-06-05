FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    gcc \
    musl-dev \
    pkgconfig \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev
RUN mkdir -p models
COPY package*.json ./
ENV PYTHON=/usr/bin/python3
RUN npm install
COPY health_model.json ./models/
COPY . .
RUN npm run build
RUN npm prune --production
RUN npm install -g serve
COPY start.sh ./
RUN chmod +x start.sh
EXPOSE 7860
LABEL maintainer="EdgarJR"
LABEL description="AI-powered Health Metrics Analysis Tool"
LABEL version="1.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7860/ || exit 1
CMD ["./start.sh"]
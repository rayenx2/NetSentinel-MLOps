# ── Stage 0: Build React frontend ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build
# Output: /home/rayen/portfolio/mlops-ml/network-security-mlops/static via outDir: ../static
# But since WORKDIR is /frontend, outDir ../static = /static

FROM python:3.10-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# --- Builder stage ---
FROM base AS builder

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install -r requirements.txt

# --- Runtime stage ---
FROM base AS runtime

COPY --from=builder /install /usr/local

# Create non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Copy source code
COPY --chown=appuser:appgroup . .
COPY --from=frontend-builder /static ./static

# Create writable dirs (including prediction_output/logs for prediction_logger)
RUN mkdir -p /app/prediction_output/logs /app/final_model /app/logs /app/static && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["python3", "app.py"]

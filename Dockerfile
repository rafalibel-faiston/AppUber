# ---------- Stage 1: build do frontend (PWA) ----------
FROM node:22-slim AS frontend
WORKDIR /front
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend + assets buildados ----------
FROM python:3.11-slim AS backend
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# O build do Vite vai servir estatico via FastAPI em backend/static
COPY --from=frontend /front/dist ./static

EXPOSE 8000
# Railway injeta a porta em $PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

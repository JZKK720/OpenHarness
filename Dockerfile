# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────
# Stage 1: build frontend assets (React/Ink TUI)
# ─────────────────────────────────────────────
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend/terminal
COPY frontend/terminal/package.json frontend/terminal/package-lock.json* ./
# Install all deps (including devDependencies) so typescript is available for type-check
RUN npm ci

COPY frontend/terminal/ ./
# Type-check only (build artefacts not needed; TUI runs from src at runtime)
RUN ./node_modules/.bin/tsc --noEmit

# ─────────────────────────────────────────────
# Stage 2: Python environment (uv-managed)
# ─────────────────────────────────────────────
FROM python:3.11-slim AS python-base

# uv is the recommended installer for this project
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# System deps: git (for tools/bridge), curl (web-fetch passthrough)
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        bash \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────
# Stage 3: install Python deps only (layer-cacheable)
# ─────────────────────────────────────────────
FROM python-base AS deps

WORKDIR /app

COPY pyproject.toml README.md ./
# hatchling force-includes frontend/terminal assets when building the wheel
COPY frontend/terminal/package.json frontend/terminal/tsconfig.json ./frontend/terminal/
COPY frontend/terminal/src/ ./frontend/terminal/src/
# Sync runtime deps (no dev extras)
RUN uv sync --no-dev

# ─────────────────────────────────────────────
# Stage 4: final runtime image
# ─────────────────────────────────────────────
FROM python-base AS runtime

WORKDIR /app

# Copy virtual-env from deps stage
COPY --from=deps /app/.venv /app/.venv

# Copy source and frontend
COPY src/ ./src/
COPY --from=frontend-builder /app/frontend/terminal /app/frontend/terminal
COPY pyproject.toml README.md LICENSE ./

# Activate the uv venv so `oh` is on PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src:$PYTHONPATH" \
    # Disable bytecode to keep the image lean
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ─────────────────────────────────────────────
# Runtime data directory (override with -v)
# ─────────────────────────────────────────────
# ~/.openharness/ is resolved to /root/.openharness/ in the container.
# Mount a volume here to persist sessions, memory, and settings across runs.
VOLUME ["/root/.openharness"]

# ─────────────────────────────────────────────
# HTTP shim (optional – for inter-container use)
# ─────────────────────────────────────────────
# The built-in TUI uses JSON-line stdio, not HTTP.
# The included http_shim.py wraps `oh -p` behind a minimal FastAPI endpoint
# so other containers can send POST /query and receive stream-json or json output.
# It is ONLY started when OH_HTTP_MODE=1 is set.
#
# Default: headless CLI mode (oh -p "<prompt>")
# ─────────────────────────────────────────────

COPY docker/http_shim.py ./docker/http_shim.py

# Port exposed only when OH_HTTP_MODE=1
EXPOSE 8581

COPY docker/entrypoint.sh /entrypoint.sh
# Strip Windows CRLF line endings that git on Windows may introduce
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# Default: drop into REPL (can be overridden with -p "..." or --output-format)
CMD []

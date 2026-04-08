"""
docker/http_shim.py — Thin FastAPI wrapper around `oh -p`.

Exposes a single endpoint so other containers can drive OpenHarness
over HTTP instead of spawning it as a subprocess.

Start: OH_HTTP_MODE=1 (handled by entrypoint.sh)
Port:  8000  (set OH_SHIM_PORT to override)

API:
  POST /query
    Body (JSON): { "prompt": "...", "output_format": "json"|"stream-json" }
    Response:
      output_format=json         → 200 application/json  { "output": "..." }
      output_format=stream-json  → 200 text/event-stream (SSE, one JSON per line)

  GET  /health  → 200 { "status": "ok" }

Security notes:
  - Bind to 0.0.0.0 only inside trusted Docker networks.
  - Set OH_ALLOWED_HOSTS to a comma-separated list of allowed Origin headers
    when exposing beyond a private bridge network (default: *).
  - ANTHROPIC_API_KEY must be set in the container environment.

Port: 8581 (override with OH_SHIM_PORT)
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import sys
from asyncio.subprocess import PIPE, create_subprocess_exec
from http import HTTPStatus
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="OpenHarness HTTP Shim", version="0.1.0")

_allowed_origins = [o.strip() for o in os.environ.get("OH_ALLOWED_HOSTS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

OH_BIN = "oh"  # on PATH via /app/.venv/bin
_MAX_PROMPT_LEN = int(os.environ.get("OH_MAX_PROMPT_LEN", "8192"))


class QueryRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=_MAX_PROMPT_LEN)
    output_format: str = Field(default="json", pattern="^(json|stream-json)$")
    permission_mode: str = Field(default="full_auto", pattern="^(default|plan|full_auto)$")


async def _stream_oh(prompt: str, output_format: str, permission_mode: str) -> AsyncIterator[bytes]:
    """Yield raw bytes from `oh -p` stdout line by line."""
    cmd = [
        OH_BIN,
        "-p", prompt,
        "--output-format", output_format,
        "--permission-mode", permission_mode,
    ]
    proc = await create_subprocess_exec(*cmd, stdout=PIPE, stderr=PIPE)
    assert proc.stdout is not None
    try:
        async for line in proc.stdout:
            yield line
    finally:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        await proc.wait()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/query")
async def query(req: QueryRequest) -> Response:
    if req.output_format == "stream-json":
        return StreamingResponse(
            _stream_oh(req.prompt, req.output_format, req.permission_mode),
            media_type="text/event-stream",
        )

    # Collect full JSON output
    chunks: list[bytes] = []
    async for chunk in _stream_oh(req.prompt, req.output_format, req.permission_mode):
        chunks.append(chunk)
    raw = b"".join(chunks).decode("utf-8", errors="replace").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"output": raw}
    return Response(
        content=json.dumps(parsed),
        media_type="application/json",
        status_code=HTTPStatus.OK,
    )


if __name__ == "__main__":
    import uvicorn  # type: ignore[import]

    port = int(os.environ.get("OH_SHIM_PORT", "8581"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")

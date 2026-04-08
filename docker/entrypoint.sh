#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# OpenHarness container entrypoint
#
# Modes (controlled by environment variables):
#
#   OH_HTTP_MODE=1          Start the HTTP shim (port 8000) for inter-container use.
#                           Other containers POST to /query and receive JSON/stream responses.
#
#   OH_PROMPT=<text>        Run one headless prompt and exit (stream-json output).
#                           Honoured even when OH_HTTP_MODE is not set.
#
#   (default)               Pass all CMD arguments through to `oh` (interactive REPL,
#                           headless -p, or any other oh flag).
# ─────────────────────────────────────────────

if [[ "${OH_HTTP_MODE:-0}" == "1" ]]; then
    echo "Starting OpenHarness HTTP shim on :8000 …"
    exec uv run python /app/docker/http_shim.py
elif [[ -n "${OH_PROMPT:-}" ]]; then
    exec oh -p "${OH_PROMPT}" --output-format "${OH_OUTPUT_FORMAT:-stream-json}"
else
    exec oh "$@"
fi

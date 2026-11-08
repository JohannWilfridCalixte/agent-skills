#!/bin/sh
if ! command -v bun >/dev/null 2>&1; then
  echo "agentic hook skipped: bun not installed" >&2
  exit 0
fi
exec bun "$(dirname "$0")/agentic.ts" hook "$@"

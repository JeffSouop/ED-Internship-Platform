#!/bin/sh
set -e
cd /app/dist/server

/app/node_modules/.bin/wrangler dev index.js \
  --local \
  --ip 127.0.0.1 \
  --port 8787 \
  --show-interactive-dev-session=false \
  --log-level warn &
WRANGLER_PID=$!

cleanup() {
  kill "$WRANGLER_PID" 2>/dev/null || true
}
trap cleanup TERM INT

i=0
while ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:8787/"; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "wrangler n'a pas répondu sur 8787 à temps"
    exit 1
  fi
  if ! kill -0 "$WRANGLER_PID" 2>/dev/null; then
    echo "wrangler s'est arrêté"
    exit 1
  fi
  sleep 1
done

exec nginx -g "daemon off;"

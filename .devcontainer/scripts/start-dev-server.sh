#!/usr/bin/env bash
set -euo pipefail

PORT_FILE="/tmp/sveltekit-dev.port"

# If we already started a server and it's still listening, don't start another.
# This handles postAttachCommand running after postStartCommand.
if [[ -f "$PORT_FILE" ]]; then
  saved_port=$(cat "$PORT_FILE")
  if (echo > /dev/tcp/127.0.0.1/"$saved_port") 2>/dev/null; then
    echo "Dev server already running on port $saved_port"
    exit 0
  fi
fi

# Find a free port using /dev/tcp (no dependency on lsof)
APP_PORT=""
for port in $(seq 5173 5190); do
  if ! (echo > /dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
    APP_PORT="$port"
    break
  fi
done

if [[ -z "$APP_PORT" ]]; then
  echo "No open port found in range 5173-5190."
  exit 1
fi

echo "$APP_PORT" > "$PORT_FILE"
echo "Starting SvelteKit dev server on port $APP_PORT"

setsid bash -lc "npm run dev -- --host 0.0.0.0 --port $APP_PORT" >/tmp/sveltekit-dev.log 2>&1 </dev/null &

echo "Waiting for SvelteKit dev server to be ready on port $APP_PORT..."
for i in $(seq 1 60); do
  if (echo > /dev/tcp/127.0.0.1/"$APP_PORT") 2>/dev/null; then
    echo "SvelteKit dev server is ready on port $APP_PORT"
    echo "Log file: /tmp/sveltekit-dev.log"
    exit 0
  fi
  sleep 1
done

echo "Warning: timed out waiting for dev server on port $APP_PORT"
echo "Log file: /tmp/sveltekit-dev.log"

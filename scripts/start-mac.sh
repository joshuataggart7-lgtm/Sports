#!/usr/bin/env bash
# One command to run Room OS on a Mac: installs what is missing, builds the app, starts the agent.
#   ./scripts/start-mac.sh            live sports (ESPN), MLB + college football + NFL
#   ./scripts/start-mac.sh demo       simulated game instead of live data
#   ./scripts/start-mac.sh reseed     forget saved devices/displays and start from the built-in room again
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then echo "Install Homebrew first: https://brew.sh"; exit 1; fi
  brew install node
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "adb (for the XGIMI projectors and Fire Stick) is not installed; installing with Homebrew..."
  command -v brew >/dev/null 2>&1 && brew install --quiet android-platform-tools || echo "skipped adb install"
fi
if ! command -v kasa >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/kasa" ]; then
  echo "python-kasa (for TP-Link Kasa/Tapo plugs) is not installed; installing with pipx..."
  command -v brew >/dev/null 2>&1 && { brew install --quiet pipx && pipx install python-kasa; } || echo "skipped python-kasa install"
fi
if [ "${1:-}" = "reseed" ]; then rm -f packages/agent/data/room.json; echo "Room data reset to the built-in seed."; shift || true; fi
[ -d node_modules ] || npm install
# Rebuild the screen pages whenever the code has changed since the last build.
STAMP=packages/web/dist/.built-from
HEAD=$(git rev-parse HEAD 2>/dev/null || echo unknown)
if [ ! -f packages/web/dist/index.html ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$HEAD" ]; then
  npm run build -w @room/web && echo "$HEAD" > "$STAMP"
fi
# A previous run that did not exit cleanly keeps the port; free it so this start always wins.
PORT="${PORT:-8790}"
if command -v lsof >/dev/null 2>&1; then
  OLD=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$OLD" ]; then echo "Stopping the previous Room OS on port $PORT..."; kill $OLD 2>/dev/null || true; sleep 1; kill -9 $OLD 2>/dev/null || true; fi
fi
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname)
echo
echo "Room OS will be at:  http://$IP:8790   (open this on the iPad, then Share -> Add to Home Screen)"
echo "Displays:            http://$IP:8790/display/<pairing code>   codes are on the Displays page"
echo "Projector ribbon:    http://$IP:8790/display/projector?mode=ticker"
echo
if [ "${1:-}" = "demo" ]; then PROVIDER=simulated exec npm run agent; fi
PROVIDER=espn LEAGUES="${LEAGUES:-mlb,ncaaf,nfl}" exec npm run agent

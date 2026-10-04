#!/usr/bin/env bash
# One command to run Room OS on a Mac: installs what is missing, builds the app, starts the agent.
#   ./scripts/start-mac.sh            live sports (ESPN), MLB + college football + NFL
#   ./scripts/start-mac.sh demo       simulated game instead of live data
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
[ -d node_modules ] || npm install
[ -f packages/web/dist/index.html ] || npm run build -w @room/web
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname)
echo
echo "Room OS will be at:  http://$IP:8790   (open this on the iPad, then Share -> Add to Home Screen)"
echo "Displays:            http://$IP:8790/display/<pairing code>   codes are on the Displays page"
echo "Projector ribbon:    http://$IP:8790/display/projector?mode=ticker"
echo
if [ "${1:-}" = "demo" ]; then PROVIDER=simulated exec npm run agent; fi
PROVIDER=espn LEAGUES="${LEAGUES:-mlb,ncaaf,nfl}" exec npm run agent

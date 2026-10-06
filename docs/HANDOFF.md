# Room OS handoff: modes work

Written 2026-10-06 for whoever picks up the mode improvements (Concert, Talk Show, Movie, Gaming, Chill).
The sports side is live in the room and should be left as is.

## Where the code is

- Mac in the room: `/Users/joshuataggart/room-os` (clone of github.com/joshuataggart7-lgtm/Sports).
- Branch: `claude/connected-room-alternative-mey6nd`. Everything is committed and pushed; the tree is clean.
- Monorepo, npm workspaces: `packages/core` (types), `packages/engine` (events from the feed),
  `packages/sports` (ESPN + simulated provider), `packages/agent` (the room server, Node + tsx),
  `packages/web` (Vite + React + Tailwind PWA, served by the agent from `packages/web/dist`).

## How to run

```
cd ~/room-os && git pull && ./scripts/start-mac.sh
```

The script installs node/adb/python-kasa if missing, kills any old agent, rebuilds the web app when
HEAD changed, resets adb, and runs the agent on port 8790 with `PROVIDER=espn`. App: http://192.168.1.22:8790
(iPad). Display pages: `/display/<pairingCode>` (codes on the Displays page) and
`/display/projector?mode=ticker`. Guest page: `/guest`.

Dev without the room: `PORT=8799 PROVIDER=simulated npx tsx src/main.ts` inside `packages/agent`.
Checks: `npm run typecheck`, `npm test -w @room/agent -w @room/engine`, `npm run build -w @room/web`.

State lives in `packages/agent/data/room.json` (devices with real IPs, scenes, automations, experience
settings). Delete it to reseed; `./scripts/start-mac.sh reseed` does that. The seed is
`packages/agent/src/seed.ts` plus `packages/agent/src/experiences.ts`. On start, `Agent.migrate`
(`packages/agent/src/agent.ts`) merges new seed scenes/automations/devices into an existing room.json by id,
replaces a stored scene or automation when the seed's `version` is higher, and retires seed devices
listed in `RETIRED_DEVICE_IDS` if they are still on the mock driver. Bump `version` on a seed scene to
push a change to the room without a reseed.

## Modes and mode switching

- Mode list and labels: `packages/core/src/modes.ts` (`ROOM_MODES`, `MODE_LABELS`, `Scene` type).
- A mode is a scene with `mode: "<MODE>"`. Room-setup scenes: `packages/agent/src/seed.ts` (`scenes` array:
  SPORTS, GAME_DAY, MOVIE, MULTIVIEW, WORK, PARTY, AMBIENT, ALL_OFF) and `packages/agent/src/experiences.ts`
  `modeScenes()` (GAMING, CHILL, TALK_SHOW, MUSIC_VIDEO "Concert").
- Switching: `POST /api/mode { mode }` (`packages/agent/src/api.ts`) → `Orchestrator.setMode`
  (`packages/agent/src/orchestrator.ts`) → `runScene`. A scene with `suppressSportsAutomations: true`
  cancels celebrations mid-flight and blocks sports automations while the mode is on.
- After any non-fx scene the agent pushes each display's page to its device over ADB
  (`Agent.openDisplayPages`, debounced 15 s per display).
- Scene actions: device commands targeted at `{device}`, `{group}`, `{deviceType}`, `{displayRole}`;
  display overlays; `{preset}` (display role presets); `{roleAssignment}` (set a display's role and
  roleOptions). Templates like `{{team.primary}}` render from `packages/agent/src/template.ts`.
- Effect scenes (`fx: true`) pass through the Experience gate (`packages/agent/src/experience.ts`,
  settings type in `packages/core/src/experience.ts`): master, six categories with dials, intensity modes,
  importance scaling, limits (fog/horn caps and cooldowns, tactile ceiling, quiet hours). Mode scenes bypass
  the gate on purpose (Game Day's receiver volume is a setting, not an effect).
- UI: Room page mode tiles `packages/web/src/pages/RoomControl.tsx` (`MODES` array with hints); Live page
  Experience panel and Simulator `packages/web/src/components/Effects.tsx` (mode-specific button rows for
  `button.group` "talk" and "concert"); Guest page `packages/web/src/pages/Guest.tsx`.
- Display roles: `packages/core/src/displays.ts` (`DISPLAY_ROLES`), rendering in
  `packages/web/src/display/DisplayPage.tsx` and `roles.tsx`. AMBIENT with `roleOptions.theme === "concert"`
  renders `ConcertAmbient` (warm beams, no team art).

## Room hardware as configured (room.json on the Mac)

| Device id | What | Driver | Address |
|---|---|---|---|
| tv_sony | Sony KD-70X690E | mock (no network control on this model; HDMI by hand) | |
| tv_left | TCL 43S431 Roku, vertical | roku | 192.168.1.27 |
| stick_left | Fire Stick 4K Plus on the TCL | androidtv (ADB) | 192.168.1.21 |
| tv_right | Insignia Fire TV, vertical, built-in Fire OS | androidtv | 192.168.1.26 |
| projector_ribbon | XGIMI MoGo 2 Plus + Fire Stick, ribbon on the pull-down screen | androidtv | 192.168.1.20 |
| avr | Onkyo TX-NR6100 | onkyo | 192.168.1.10 (Apple TV = STRM BOX "11") |
| lamps | ceiling fan, three WiZ candle bulbs | wiz | hosts .31 .29 .33 |
| lamp_left / lamp_right | corner torchieres, WiZ A19 | wiz | .32 / .30 |
| wiz_sony_bias | Strip 1 behind the Sony | wiz | 192.168.1.36 |
| wiz_tower_left | Strip 2 behind the TCL | wiz | 192.168.1.37 |
| wiz_tower_right | Strip 3 behind the Insignia | wiz | 192.168.1.35 |
| wiz_console / wiz_stadium_upper | Strips 4, 5 | wiz | not installed yet (mock) |
| fx_fog | Gemmy 400 W fog, power only, Tapo TP15 via Apple Home | shortcuts ("Fog Machine On"/"Off") | |
| fx_speaker | Mac audio out | localaudio | |
| fx_horn, fx_goal_light, fx_shaker, fx_kinta, lyra | not yet owned or arriving | mock | |

Displays: disp_sony (MAIN_GAME), disp_left (PLAYER_STATS, rotation 270), disp_right (LEAGUE_SCORES,
rotation 270), disp_projector (PROJECTED_TICKER; bands at x 160, y 30/250, h 190, width 1600).

## What works (sports)

Game Day, Multiview and Sports modes; pages pushed to all three screens; Onkyo input/volume; Roku and
Fire OS power/input; WiZ bulbs and the three strips; fog plug power through Apple Home. Event pipeline from
ESPN with broadcast delay and overturn handling; derived context (importance, pressure, win-probability
swing, clutch, rivalry, drive summary); play fingerprints (pick six, fourth-down stop, missed FG, blocked
kick); multi-game arbiter; touchdown shockwave across the strips with TOUCH/DOWN on the side screens and
drive afterglow on the ribbon; pressure scenes on 3rd/4th down; Experience panel, Simulator with per-command
timing, SHOW ME ROOM OS demo (`POST /api/demo`); Quiet mode and quiet hours; limits with cooldowns.
Verified in the room on 2026-10-05/06: all of the above except props (horn, beacon, Shelly not arrived).

## What is unfinished (modes)

- MUSIC_VIDEO (Concert): rest scene exists (warm amber base, towers breathing, halo wash, screens on the
  concert ambient theme), buttons DROP and ENCORE. Open issue, see below: the strips did not visibly change
  when Concert was selected in the room; not yet diagnosed. No audio analysis: the spec's bass/beat/energy
  reactivity, style presets (country_concert etc.) and Now Playing screens need an audio capture path on
  the Mac (BlackHole or similar loopback) and a tactile output; none of that exists.
- TALK_SHOW: rest scene and buttons (STUDIO LIGHTS, BIG LAUGH, APPLAUSE, CHAOS) exist. No speech/laughter
  detection.
- MOVIE: theater rest look v2 exists. Movie tactile patterns and the "DIY D-BOX" behavior wait on the
  shakers; the tactile driver (`type: "tactile"` commands) is mock only.
- GAMING, CHILL, PARTY, AMBIENT: basic rest scenes only.
- DMX (`type: "fixture"` commands, group `dmx`, device fx_kinta): mock only; Art-Net driver not written.
- Scene editor UI: Automations page is toggle-only; scenes are edited as JSON in room.json or via
  `POST /api/displays/:id/role`, `PUT /api/devices/:id`, `PUT /api/experience`.

## Known issues

1. Concert lights: user reports no change to the strips on entering Concert; screens now switch to the
   concert ambient. Next step was to read `GET /api/metrics?limit=40` right after tapping Concert to see
   whether the WiZ commands went out and with what result. Possible causes to check: WiZ `effect: "breathe"`
   with `durationMs: 0` ends immediately (by design) but should still leave the first color; `set_color` on
   the wiz driver sends `setPilot {state, r, g, b}`.
2. Insignia Fire TV drops off Wi-Fi when it sleeps; ADB then says "device offline" or "No route to host".
   Fix on the TV: screensaver Never and sleep longest; otherwise power-cycle. `start-mac.sh` resets adb.
3. Tapo TP15 plugs use TP-Link's TPAP encryption, unsupported by python-kasa (open PR upstream). Workaround
   in place: pair via Matter to Apple Home, drive with macOS Shortcuts (`drivers/shortcuts.ts`). Each plug
   needs two Shortcuts on the Mac, "<Name> On" and "<Name> Off".
4. Gemmy fog machine has no wired-remote jack; the plan is a Shelly 1 Mini Gen3 soldered across the
   wireless fob's button. Until then fx_fog is power only and is not in the `fog` group.
5. Sony has no IP control; stays mock. Apple TV device is a placeholder.
6. The MoGo ribbon is placed by hand; `ticker.ruler: true` draws calibration lines.
7. Display pages bypass the service worker (`vite.config.ts` navigateFallbackDenylist) so TVs always load
   the newest build; the iPad app still uses the SW.
8. Strips 4 and 5 are not installed; their devices are mock until a host is set.

## Arriving / to buy

12 V 10 A supply + wire (horn), rotating beacon, Shelly 1 Mini Gen3, two Dayton BST-1 + DTA-120 stereo amp
+ USB audio adapter + stereo RCA mixer + speaker wire, later Mini Kinta + Art-Net node. See docs/BUY_LIST.md.

## Docs

docs/EXPERIENCE.md (the effects layer, context, limits, modes), docs/BUY_LIST.md, docs/renders/wall8-strips.png
(strip placement), README.md.

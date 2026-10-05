# Room OS

> One button turns the entire room into the perfect environment for whatever I am about to do.

A personal sports and media room platform: live sports data feeds an event engine, the event
engine drives a room orchestrator, and the orchestrator runs displays, a projected scoreboard
ribbon, a motorized screen, a projector, an AV receiver and lights through abstract device drivers.
Everything that is not real hardware is labeled **SIMULATED** in the UI, so the architecture can be
proven before anything is wired up.

```
SPORTS DATA  →  EVENT ENGINE  →  ROOM ORCHESTRATOR  →  DEVICES / DISPLAYS / LIGHTS / AUDIO
 (providers)     (dedup, reversal,   (modes, scenes,        (drivers: mock SIMULATED,
                  broadcast delay)    automations, logs)      Home Assistant UNVERIFIED)
```

## Run it (MVP 1, simulated)

```bash
npm install
npm run build -w @room/web      # builds the PWA into packages/web/dist
npm run agent                   # Room Agent on http://localhost:8790 (serves the built app)
```

Open <http://localhost:8790> on a phone, iPad or desktop. Press **START GAME DAY**. Then:

- **Live**: big score, broadcast sync with **SYNC TO TV**, manual TOUCHDOWN / FIELD GOAL / DEFENSE / CELEBRATION / RESET buttons, simulation controls (feed touchdown, overturn).
- **Room**: SPORTS · MOVIE · MULTIVIEW · WORK · PARTY · AMBIENT · ALL OFF, plus per-device toggles.
- **Displays**: drag roles onto screens, pairing codes, presets, projected-ribbon viewport settings.
- **Automate**: the WHEN / WAIT / DO / RESTORE automations and their run log.
- **Timeline**: every mode change, event, device command and automation, with reasons.

Put a browser on each TV and open `/display/<pairing code>` (codes are on the Displays page).
Put the projector on `/display/projector?mode=ticker`: the whole image is black except the ribbon.

For development with hot reload: `npm run agent` in one terminal and `npm run web` in another
(Vite on <http://localhost:5173> proxies `/api` and `/ws` to the agent).

Environment for the agent: `PROVIDER=simulated|espn`, `HA_URL` + `HA_TOKEN` (Home Assistant),
`ROOM_PIN` (household PIN), `PORT`, `SIM_TICK_MS`.

## What is real and what is not

| Piece | Status |
|---|---|
| Simulated sports provider (football, basketball; drives, clock, red zone, overturns) | SIMULATED |
| ESPN public scoreboard provider (reads only, no play-by-play) | CONNECTED, unofficial endpoint |
| Mock device driver (TVs, projector, screen, receiver, lights) | SIMULATED |
| Home Assistant driver (`HA_URL`, `HA_TOKEN`) | UNVERIFIED, reports CONNECTED only after a successful ping |
| Browser displays and the projected ribbon | real web pages, run on any screen |
| Supabase auth / Postgres / realtime | schema in `supabase/migrations`, not wired; agent uses a local JSON store and an optional PIN |
| Netlify functions | not started |

See [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) for the requirement-by-requirement view.

## Packages

| Package | Layer | What it holds |
|---|---|---|
| `packages/core` | shared types | devices and commands, display roles, sports model, `SportsProvider`, events, automations, modes, protocol |
| `packages/sports` | sports data | `SimulatedProvider`, `EspnProvider` |
| `packages/engine` | event processing | `EventEngine` (derive, dedup, reversal, cooldowns), `DelayScheduler` (broadcast delay, SYNC TO TV), `rankGames` |
| `packages/agent` | local room agent + orchestration | device and display managers, orchestrator (modes, scenes, automations, restore), game watcher, HTTP + WebSocket API, JSON store, seed room |
| `packages/web` | UI | React 19 + Vite + Tailwind 4 PWA: app screens, display roles, projected ticker |
| `supabase/` | database | Postgres schema for the cloud store |
| `packages/lanes` | earlier work | the Lanes ambient LED ticker; kept intact, see its README |

## Principles this codebase enforces

1. Devices are abstract: `RoomDevice` + `DeviceDriver`; nothing in the orchestrator knows a brand.
2. Sports data is abstract: `SportsProvider`; the engine only sees `Game` and `Play`.
3. Displays are role-based: the room assigns `DisplayRole`s; a screen is never hard-coded.
4. Cloud and local are separated by `RoomStore` (what) and drivers (how); the orchestrator talks only to those.
5. Every provider event is scheduled behind `broadcast_delay_ms`; SYNC TO TV measures it from a real play.
6. Events have deterministic ids; a score decrease reverses prior events and withdraws queued reactions.
7. A manual device change holds automations off that device for ten minutes; manual buttons always work.
8. Movie Mode suppresses sports automations and cancels any mid-flight.
9. Every automated action is in the timeline with its origin.
10. The simulated provider needs no network; modes, lights, manual buttons and displays work offline.

## Tests and checks

```bash
npm test          # engine, sports, agent, lanes
npm run typecheck
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshots.mjs out/   # every screen, from a running agent
```

## Roadmap (from the brief)

- **MVP 2**: Home Assistant verified on hardware; projector, screen, receiver, lights, real TVs.
- **MVP 3**: licensed sports API with live subscriptions, delay calibration from known plays.
- **MVP 4**: automation step editor, room map from a photo, smart multiview promotion, kids mode, fantasy content, notifications.

## Experience layer

Touchdowns, takeaways, halftime and the win are coordinated room moments: screens, lights, DMX
beams, couch shaker, sound and props on one timeline, gated by a master switch, per-category
dials and an intensity mode (Normal, Big Game, Insane, Quiet). Eleven manual buttons and a
Simulator with per-command timing live on the Live page. See [docs/EXPERIENCE.md](docs/EXPERIENCE.md).

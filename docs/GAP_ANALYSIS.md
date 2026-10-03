# Gap analysis: Room OS brief vs. the codebase

Status labels used throughout the codebase and this document:

- **CONNECTED**: talks to a real external system and was confirmed working from this repository.
- **SIMULATED**: a deliberate mock that implements the real interface so the architecture can be proven without hardware or paid feeds.
- **UNVERIFIED**: real integration code exists but has not been confirmed against hardware or a live account.
- **NOT STARTED**: nothing in the repo yet.

## What existed before this brief

The repo held one package, **Lanes** (now `packages/lanes`): a Node/TypeScript ambient LED ticker with a
rules engine, an attention budget, pluggable sources (ESPN scoreboard, weather, crypto, calendar,
countdowns, webhooks) and a pixel renderer shared by a browser display and a Raspberry Pi LED bridge.
It is kept intact, tests and all. Parts of it map directly onto the brief:

| Lanes piece | Brief concept | Reused how |
|---|---|---|
| `sources/sports.ts` (ESPN public scoreboard, **CONNECTED**) | `SportsProvider` | Normalized into the `EspnProvider` adapter in `packages/sports` |
| `core/engine.ts` rules + cooldowns | Event engine, automations | Ideas carried over; the new engine adds dedup, reversal and broadcast delay |
| Attention budget / quiet hours | Movie Mode suppression, "manual overrides automation" | Generalized into orchestrator suppression rules |
| Pixel renderer + LED bridge | Future LED matrix upgrade path for the ribbon | Left as is; the projected ribbon is an HTML display role, the LED path remains available |
| Webhook source | Manual event buttons, external triggers | Equivalent `/api/events/manual` endpoint on the Room Agent |

What Lanes does not have, and the brief needs: a device abstraction, room modes and scenes, role-based
displays with pairing, a layout editor, a broadcast-delay scheduler, event deduplication and reversal,
a choreographed automation runner, a React PWA, and a database schema.

## Requirement by requirement

| Area | Brief | Before | After this pass | Label |
|---|---|---|---|---|
| Architecture | Sports data → event engine → room orchestrator → devices | Flat single package | `packages/core`, `sports`, `engine`, `agent`, `web`; cloud/local split expressed as `RoomStore` + `Orchestrator` boundaries | — |
| Frontend stack | React, TS, Vite, Tailwind, PWA | Vanilla HTML admin page | `packages/web`: React 19, Vite, Tailwind 4, PWA manifest + service worker, responsive for phone/tablet/desktop/kiosk | — |
| Backend | Supabase auth/Postgres/realtime, Netlify functions | None | Postgres schema in `supabase/migrations`; `RoomStore` interface with a local JSON implementation; realtime over the agent's WebSocket. Supabase client and Netlify deploy are **NOT STARTED** (needs a project and keys) | NOT STARTED (cloud) |
| Local room layer | Home Assistant or Node Room Agent | Lanes server | `packages/agent`: Node Room Agent with device registry, drivers, orchestrator, display manager, timeline | SIMULATED devices |
| Device abstraction | `RoomDevice` with capabilities, state, `execute(command)` | None | `packages/core/devices.ts`; `MockDriver` (SIMULATED) and `HomeAssistantDriver` (UNVERIFIED, activates only with `HA_URL`/`HA_TOKEN` and reports CONNECTED only after a successful ping) | SIMULATED / UNVERIFIED |
| Display system | Browser displays with pairing codes and roles | Single LED display | `/display/:id` pairing with 4-letter code, role assignment, 13 roles, presets | — |
| Layout editor | Drag roles onto displays, save presets | None | Displays page with drag-and-drop role chips onto a room grid, preset save/apply | — |
| Projected ribbon | Narrow ticker on black canvas with viewport, team colors, possession, clock, down/distance, red-zone, score flash | LED pixel ticker | `PROJECTED_TICKER` role: configurable x/y/width/height, font size, scrolling/static, league selection, true-black surround | — |
| Sports provider | `SportsProvider` interface, mocked first | ESPN only, hard-wired | `SimulatedProvider` (SIMULATED football with drives, clock, possession, red zone, reversals) and `EspnProvider` (CONNECTED read-only public endpoint; play-by-play and standings not implemented) | SIMULATED / CONNECTED |
| Broadcast delay | `broadcast_delay_ms`, SYNC TO TV, profiles by source | None | `DelayScheduler`: every event is released at `ts + delay`; SYNC TO TV computes the delay from the last released event; profiles per source/app/device | — |
| Event engine | Typed events, dedup, reversal, corrected scores, cooldowns | Score diff only | `EventEngine` derives GAME_START/END, PERIOD, SCORE_CHANGE, TOUCHDOWN, FIELD_GOAL, EXTRA_POINT, SAFETY, LEAD_CHANGE, RED_ZONE, TURNOVER, BIG_PLAY, OVERTIME, WIN/LOSS; deterministic ids for dedup; score decreases produce SCORE_CORRECTION and cancel queued celebrations; per-type cooldowns | — |
| Automation builder | WHEN / IF / DO / WAIT / THEN / RESTORE, Shortcuts-like | YAML rules | Step model in `core/automation.ts`, runner in the agent with choreography delays and RESTORE; web UI lists and toggles automations and shows runs. Visual step editor is **MVP 4** | — |
| Manual events | TOUCHDOWN / FIELD GOAL / DEFENSE / CELEBRATION / RESET always available | Webhook | Buttons on the Live Game screen, routed through the same engine with `source: manual` | — |
| Room modes | Sports, Movie, Multiview, Work, Game Day, Party, All Off | None | Scenes with ordered, delayed actions; Movie Mode sets suppression; All Off sequences shutdown | SIMULATED devices |
| Home screen | Tonight's game, START GAME DAY, room status | None | Implemented | — |
| Live game screen | Big score, clock, possession, sync, manual buttons, display assignments | None | Implemented | — |
| Room control | Six large mode buttons | None | Implemented | — |
| Room map | Photo/plan with device positions | None | Layout editor uses a schematic grid; photo-based map is **MVP 4** | NOT STARTED |
| Follow the action / smart multiview | Promote interesting secondary games | None | Interest scoring function in `engine` (`rankGames`) and a suggestion on the Live screen; never replaces the primary automatically | partial |
| Room timeline | Log every automated action | Fired log | Timeline persisted and shown in the app | — |
| Team profiles | Colors, celebration pattern, audio, theme | None | `teams` table and profile objects on simulated teams; editing UI is later | partial |
| Guest / Kids mode | Four-button interfaces | None | `/guest` (WATCH / MOVIE / MUSIC / OFF) and `/kids` (MOVIE / MUSIC / DANCE / OFF) | — |
| Morning dashboard | Clock, weather, calendar, status when idle | Lanes has these sources | `ROOM_STATUS` role shows clock and status; weather/calendar can be fed from Lanes sources later | partial |
| Event choreography | Staggered device actions | None | Scene and automation actions carry `delayMs`; default touchdown automation uses 0 / 200 / 500 / 800 / 5000 ms | — |
| Fail-safe local control | Modes and manual buttons work offline | Yes for Lanes | Agent runs everything locally; the simulated provider needs no network; ESPN failures are logged, not fatal | — |
| Design language | Apple TV + ESPN + control room | Admin page | Charcoal palette, large score typography, restrained motion, Tailwind tokens in `web/src/index.css` | — |
| Hardware: projector, screen, receiver, lights, TVs | MVP 2 | None | SIMULATED devices with the right capabilities so scenes are complete. Network drivers written for PJLink projectors, Sony Bravia TVs and WLED strips, plus Home Assistant; each device is probed individually and shows CONNECTED only when it answers. Settings has a device editor to assign drivers and hosts. See `docs/ROOM_PLAN.md` | SIMULATED / UNVERIFIED |
| Real sports API, live subscriptions | MVP 3 | ESPN reads | Provider interface ready; `subscribeToGame` is polling-based for both providers | partial |
| Fantasy, bracket, social roles | MVP 4 | None | Roles exist with placeholder renderers labeled as such | NOT STARTED (content) |

## Order of implementation in this pass

1. Monorepo with Lanes preserved.
2. `core` domain model and protocol.
3. `sports` providers (simulated, ESPN).
4. `engine` (events, dedup, reversal, delay scheduler, game ranking) with tests.
5. `agent` (devices, orchestrator, modes, automations, displays, timeline, API, WebSocket).
6. `web` (PWA, all screens, display roles, ticker, layout editor).
7. Postgres schema for Supabase.
8. End-to-end verification with the simulated game, screenshots.

## Verified in this pass

- 14 unit and integration tests pass across engine, sports, agent and lanes (`npm test`).
- Typecheck passes for every package; the PWA builds.
- Smoke test against the running agent: GAME_DAY sequences screen, TVs, projector (ribbon input), receiver and team-colored lights; a simulated touchdown is held for the 24 s profile; SYNC TO TV recalibrates to the measured delay; an overturned play withdraws the queued celebration; MOVIE mode suppresses a manual touchdown.
- Screenshots of every screen (desktop, phone, TV display roles, projected ribbon during a touchdown) captured with Playwright: `scripts/screenshots.mjs`.

## Known gaps after this pass

- No Supabase project, so auth is a local household PIN on the agent (labeled LOCAL in the UI). The store interface and SQL schema are ready for the Supabase adapter.
- No Netlify functions; the "cloud brain" and the local agent run in one process. The orchestrator takes decisions through the `RoomStore` and device drivers only, so the split is a deployment step, not a rewrite.
- No hardware integration is confirmed. Home Assistant driver code exists but is UNVERIFIED.
- Automation step editor, room map from a photo, fantasy content and notifications are not built.
- PJLink, Bravia and WLED drivers are written from their public protocol docs and have not been run against hardware.

# The Experience layer

Room OS turns a sports event, a button, or a mode change into a coordinated physical moment:
screens, lights, DMX beams, a couch shaker, sound, props. This document is the map of that layer.

```
Game / button / mode
   → Event Router          packages/agent/src/orchestrator.ts  (handleEvent: type, team, cooldown, mode)
   → Automation            room.json automations               (wait for the TV → run a scene → restore)
   → Scene (timeline)      room.json scenes, seeded from packages/agent/src/experiences.ts
   → Experience gate       packages/agent/src/experience.ts    (master, categories, intensity mode)
   → DeviceManager         packages/agent/src/devices.ts       (capability check, manual hold, timing)
   → Driver                packages/agent/src/drivers/*        (Govee, WLED, Kasa, Shelly, Onkyo, DMX, tactile…)
```

Scenes never name hardware. They target groups (`accent`, `tv_bias`, `tactile`, `dmx`, `horn`,
`fog`) and use template values (`{{team.primary}}`, `{{team.audio}}`), so one TOUCHDOWN runs for
Ole Miss, the Saints, or any team, on whatever is plugged in. A device that is offline fails its
own command; the rest of the scene continues. Every device in a step fires concurrently.

## Settings (Live page → Experience)

| Control | Effect |
|---|---|
| Effects master | Off: no effect of any category fires. Modes, screens and stats still work. |
| Intensity mode | NORMAL, BIG GAME (lights 115%, tactile 120%, audio 110%), INSANE (130/135/120%), QUIET (lights 80%, tactile 30%, audio 35%, props off). |
| Category dials | Lighting, DMX, Tactile, Audio FX, Display FX, Props. Each has on/off and 0–100. |

What scales: brightness, audio volume, tactile intensity, fixture intensity. Colors and durations
do not. Room-setup scenes (Game Day, Movie, Chill…) bypass the gate: the receiver volume in Game
Day is a setting, not an effect.

API: `GET /api/experience`, `PUT /api/experience { master?, mode?, categories?: { tactile: { intensity: 50 } } }`.

## Scenes

Effect scenes have `fx: true`. Buttons on the Live page are scenes with a `button` field;
sports moments have `forEvents`. All are plain JSON in `packages/agent/data/room.json` after
first run, and `experiences.ts` is only the seed. Scenes and automations added to the seed are
merged into an existing room file on start (by id); a seed automation with a higher `version`
replaces the stored copy but keeps its enabled flag.

Buttons: CELEBRATE, BOOM, STADIUM, LIGHT SHOW, CROWD ROAR, HORN, COUCH HIT, BEAM BURST, TEAM COLORS, BLACKOUT, RESET ROOM.

Moments: GAME_START, KICKOFF, BIG_PLAY, FIRST_DOWN (off by default), THIRD_DOWN, FOURTH_DOWN, RED_ZONE,
TOUCHDOWN, FIELD_GOAL, TURNOVER, SACK, INTERCEPTION, OPPONENT_SCORE, HALFTIME, GAME_WIN, GAME_LOSS,
OVERTIME, TWO_MINUTE, COMMERCIAL_BREAK, RETURN_TO_GAME. Modes: GAMING and CHILL join the existing set.

The engine now emits THIRD_DOWN / FOURTH_DOWN (new down for the team with the ball), SACK,
HALFTIME and TWO_MINUTE from the feed. Big physical effects are reserved for scores, takeaways
and the win; downs are a bias-light pulse and a low heartbeat on the couch.

## Commands added

```ts
{ type: "tactile", pattern: "impact" | "doubleImpact" | "heartbeat" | "rumble" | "engine" | "crowdPulse" | "explosion" | "kickoff" | "victoryPulse" | "stop", intensity?: 0..100, durationMs? }
{ type: "fixture", op: "beam_burst" | "set_color" | "set_brightness" | "motor_speed" | "strobe" | "blackout", color?, intensity?, speed?, durationMs? }
```

Devices `fx_shaker` (type tactile) and `fx_kinta` (type dmx_fixture, profile `mini_kinta_ils`) are
seeded as SIMULATED. The tactile and DMX drivers are the next milestones; the scenes, the gate and
the UI already speak to them, so plugging the hardware in is a driver, not a redesign.

## Simulator and timing

Live page → Simulator fires the real pipeline (event → automation → scene → devices) with or
without a game: Touchdown, Turnover, Big Play, Opponent Score, Halftime, Win, plus every moment
scene directly. "Debug" shows each command with its offset from the scene start, the driver's
time to acknowledge, and why a command was dropped ("tactile off", "effects off", "manual hold").
`GET /api/metrics` returns the same, with per-driver average and p95. Kasa plugs answer in about
half a second (python-kasa process spawn), Govee and WLED in tens of milliseconds, mock in 40–120.

Room page → each effect device has a Test button (`POST /api/devices/:id/test`).

## Team profiles

`room.teams` holds per-team overrides: name, colors, and audio clips by moment (`score`,
`bigPlay`, `win`). Templates: `{{team.audio}}`, `{{team.bigPlayAudio}}`, `{{team.winAudio}}`.
Clips live in `packages/agent/sounds/`; `no_celebration.mp3` is the Saints clip once you drop it in
(placeholders fall back to `celebration`).

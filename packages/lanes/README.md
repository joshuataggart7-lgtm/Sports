# Lanes

An ambient event ticker for everything that matters to you. Not just sports.

Lanes turns any screen, or a real LED matrix, into a calm strip of live information that
only gets loud when something happens. A goal, rain starting, a price moving, the bus
being five minutes out, someone at the door. You describe what you care about in plain
English; Lanes writes the rule, watches the sources, and decides when to interrupt you.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▌NYY 1 HOU 4 Top 7  •  DAL @ PHI 7:20 PM  •  BTC 84,523 ↓0.3%  •  ETH │  ← lane "top"
├──────────────────────────────────────────────────────────────────────┤
│   ◷ Fri 7:21 PM   ☼ Houston 80°F Partly cloudy   ⚑ Launch in 59d 14h │  ← lane "bottom"
└──────────────────────────────────────────────────────────────────────┘
      ...and when the Astros score, the whole thing becomes orange confetti for 7 seconds.
```

## Why this exists

Connected Room sells a very good LED ticker for sports fans: two scrolling banners,
animations when your team scores, lights that flash in team colors. It is $499 of
hardware, and it only speaks sports.

Lanes keeps the parts that make that product fun and generalizes the rest:

| | Connected Room Scroll | Lanes |
|---|---|---|
| What it shows | Scores, player images | Anything with a feed: scores, weather, markets, calendar, countdowns, your house, your server, a webhook from anywhere |
| How it reacts | Pre-built sports animations | Moments: five animation kinds any rule can trigger with any text and color |
| How you configure it | Their app | One YAML file, or a sentence typed into the admin page ("when BTC moves 3%, pulse green") |
| What it runs on | Their panel | Any browser (a TV, a tablet on the fridge, an old phone), plus HUB75 LED panels on a Raspberry Pi through the frame stream |
| How it stays calm | It doesn't; every goal is a goal | An attention budget: moments cost points, you set an hourly budget and quiet hours, and anything that doesn't make the cut becomes a quiet lane item instead |
| Cost | $499 + optional subscription | Free, local, no account |

The core idea is that a ticker is really a tiny attention manager. Everything in Lanes is
built on three nouns that any source can speak:

- **Event**: something happened (`sports/score`, `weather/rain_start`, `webhook/doorbell`).
- **Card**: the state of something right now (the score, today's temperature, the next meeting).
- **Rule**: when an event matches, push a lane item, fire a moment, or call a webhook.

Because sports, weather, markets and your doorbell all produce the same shape of event,
one rules engine, one animation system and one attention budget cover all of them.

## Run it

```bash
npm install
npm run demo        # synthetic game that scores every 25s, plus live weather/markets
# or
npm start           # live data from lanes.yaml
```

Open <http://localhost:8787> for the display and <http://localhost:8787/admin> to watch
events, test moments, and write rules. Click the display to go full screen.

Everything is configured in [`lanes.yaml`](lanes.yaml). The shipped file is a complete
example: a 256×64 virtual matrix, two lanes, seven sources, eleven rules.

### Sources

| Source | Needs | Cards | Events |
|---|---|---|---|
| `sports` | nothing (ESPN public scoreboard) | live, upcoming and final scores for the leagues/teams you follow | `game_start`, `score` (with the scoring team), `period`, `game_end` |
| `weather` | nothing (Open-Meteo) | temperature and conditions, high/low | `rain_start`, `storm_start`, `snow_start`, `clearing`, `weather_change` |
| `markets` | nothing (CoinGecko) | crypto prices with 24h change | `price_move` when a coin moves N% |
| `calendar` | an ICS URL or file | the next few events | `event_soon`, `event_start` |
| `countdown` | a date | "Launch in 12d 4h" | `milestone` (1 week, 1 day, 1 hour, 10 min, 1 min), `zero` |
| `clock` | nothing | day and time | |
| `host` | nothing | CPU, memory, uptime of the machine | `cpu_high` |
| `webhook` | nothing | optional card per call | anything you POST |

Supported leagues: NFL, NCAAF, MLB, NBA, WNBA, NCAAB, NHL, MLS, Premier League,
La Liga, Bundesliga, Serie A, Champions League. The first poll only sets a baseline,
so restarting never replays old goals.

### Rules

```yaml
- id: astros-score
  when: { source: sports, kind: score, tags: HOU }
  then:
    moment: { kind: confetti, title: "{{team}} SCORE!", subtitle: "{{summary}}",
              color: "{{teamColor}}", duration: 7000, priority: 80 }
  cooldown: 15000
  stop: true

- id: btc-move
  when: { source: markets, kind: price_move, symbol: BTC, pct: { gte: 3 } }
  then:
    moment: { kind: pulse, title: "BTC {{direction}} {{pct}}%", color: "#5ee37a", priority: 55 }
    lane:   { id: top, text: "BTC moved {{pct}}%", ttl: 600000 }

- id: lights-on-score
  when: { source: sports, kind: score, tags: HOU }
  then:
    webhook:
      url: http://homeassistant.local:8123/api/webhook/lanes-score
      body: { color: "{{teamColor}}" }
```

`when` matches on `source`, `kind`, `key`, `title`, `text`, `tags` and any field in the
event's `data`. A plain value means equals (or "has" for tags); objects take
`gt gte lt lte ne in has regex`. `{{templates}}` read any event field.

Moment kinds: `flash` (urgent), `confetti` (celebrate), `pulse` (attention), `rain`
(weather), `wipe` (announcement). Priority 0–100 decides who wins when two moments
collide and whether a moment survives the attention budget.

### Writing rules in plain English

Set `ANTHROPIC_API_KEY` (or run `ant auth login`) and the admin page gains a box where
you can type:

> When the Cowboys score flash blue with the new score, and when the game ends show the final.

Lanes asks Claude for a rule with a strict output schema, so what comes back is always
a valid rule you can read, edit and save. Refusal fallbacks are enabled so a declined
request is retried on a fallback model inside the same call. Without credentials the
JSON editor still works.

### Attention budget

```yaml
attention:
  budgetPerHour: 20      # moments cost points (default priority / 20)
  alwaysPriority: 85     # at or above this, ignore the budget and quiet hours
  quietHours: { start: "23:00", end: "07:00" }
```

Over budget, or during quiet hours, a moment below `alwaysPriority` is demoted to a
lane item with a bell icon instead of taking over the screen. The admin page shows
points spent this hour. A doorbell at priority 90 still gets through at 2am; a crypto
wobble at 55 does not.

### Push anything in

```bash
curl -X POST localhost:8787/api/events -H 'content-type: application/json' -d '{
  "kind": "package", "title": "Package delivered", "importance": 0.6,
  "card": { "text": "Package at the door", "color": "#5ee37a", "icon": "check", "ttl": 600000 }
}'
```

Home Assistant, IFTTT, a cron job, a kid's scoreboard app and a shell script all use
this one endpoint. Add `?as=sports` to impersonate a source while testing rules.

### Real LED panels

The server streams raw RGB frames on `ws://host:8787/frames`. [`bridge/led_matrix.py`](bridge/led_matrix.py)
feeds them to HUB75 panels on a Raspberry Pi with
[rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix):

```bash
sudo python3 bridge/led_matrix.py --server ws://lanes.local:8787 --rows 32 --cols 64 --chain 4 --parallel 2
python3 bridge/led_matrix.py --preview   # no hardware, just counts frames
```

Set `matrix.width` and `height` in `lanes.yaml` to your panel's native size. The same
renderer draws the browser and the panel, so what you see on the admin page is what
the hardware shows. The bridge has not been run on real panels from this repository;
the protocol is one JSON header then `w*h*3` bytes per frame.

## How it is built

```
src/
  core/      types, config loader, rules matcher, Engine (state, moments, attention ledger)
  sources/   one file per source; each emits events and sets cards through SourceContext
  render/    5x7 bitmap font + pixel renderer, shared by browser and hardware
  client/    browser display (bundled to public/display.js at startup)
  ai/        plain-English rule composer (Anthropic SDK, structured output)
  server.ts  HTTP + WebSocket: /ws for displays, /frames for hardware, /api/* for the admin page
public/      index.html (display), admin.html
bridge/      Raspberry Pi LED matrix bridge
test/        node:test unit tests for rules, engine, renderer, ICS parser
```

Adding a source is one file that implements `Source`:

```ts
export const bus: Source = {
  id: "bus",
  start(ctx, opts) {
    setInterval(async () => {
      const eta = await fetchEta(opts.stop);
      ctx.setCards([{ key: "next", source: "bus", text: `Bus in ${eta} min`, icon: "bus" }]);
      if (eta <= 5) ctx.emit({ kind: "bus_soon", key: "next", title: `Bus in ${eta} min`, importance: 0.7, tags: ["bus"], data: { eta } });
    }, 30_000);
  },
};
```

Register it in `src/sources/index.ts` and it immediately works with lanes, rules, moments,
the budget and the composer.

```bash
npm test            # unit tests
npm run typecheck
npm run font:preview /tmp/preview   # renders the font sheet and every moment kind to PNG
```

## Roadmap

- Team logos and player images on score moments (ESPN exposes logo URLs; the renderer needs a small PNG decoder).
- More sources: transit (GTFS-realtime), GitHub and CI status, Spotify now playing, stocks via a keyed API, Home Assistant entity states.
- Shareable lane packs: export a lane plus its rules as one JSON file.
- ESP32 firmware that speaks the same frame stream for small 64×32 desk displays.
- Audio: text to speech or a sound on moments, routed to Sonos or a speaker.

MIT.

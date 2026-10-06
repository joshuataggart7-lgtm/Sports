# Buy list, by phase

Prices checked October 2026 at Amazon, Walmart and the makers' own stores. Everything here is
optional; the game, the two side TVs, the ribbon and the celebrations run on what you already own.
Buy in the order below. Each phase works on its own and nothing in a later phase is needed for an
earlier one to work.

## Phase 0: tonight (nothing to buy)

Mac, Apple TV, Sony, two Roku TVs, two XGIMIs, Onkyo, old computer, Fire Stick (if it turns up),
iPads. See `TOMORROW.md` for the steps.

## Phase 1: this week, about $70 to $140

| Item | Where | ~Price | Why |
|---|---|---|---|
| Fire TV Stick 4K **Plus**, two of them (not the 4K Select, not the HD) | Lowe's, Walmart or Amazon ($50 list, $38 on sale) | $76–100 | One behind each Roku TV. The 4K has 2 GB of RAM and keeps the animated takeovers smooth; the HD model (1 GB) works but can stutter. Two identical sticks means one setup, and the old computer goes back to being a spare. Power each from its wall adapter, not the TV's USB port, so the stick stays alive when the TV sleeps. The 4K Plus runs Fire OS (Android), which is what Room OS drives over ADB. The newer 4K Select and HD sticks run Amazon's Vega OS, which has no ADB, so Room OS could not open the page on them |
| **TP-Link Kasa EP10 smart plug, 4-pack** (or Tapo P100/P105 4-pack) | Walmart, Lowe's, Amazon | $25–30 for four | The cheap route: one keeps the fog machine warm during Game Day, one pulses the goal light, two spares for lamps. Local control over Wi-Fi through python-kasa; newer plugs want your TP-Link account email + password typed into the device row once. The app does the off itself, so use these where a stuck-on is harmless |
| Shelly Plus Plug US (optional upgrade) | shelly.com ($23) or Walmart | $23–29 each | Has its own auto-off timer inside the plug. Only worth it if you want hardware-level safety on something that heats |
| HDMI cables, 6 ft, pack of 3 | Amazon or Walmart | $10–15 | Fire Stick extender, old computer to TV, spare |
| Powered USB speaker for the Mac (or any Bluetooth speaker you own) | Walmart | $0–30 | The horn and fanfare come from the Mac, layered over the broadcast on the Onkyo |

## Phase 2: the celebration kit, about $150 to $230

| Item | Where | ~Price | Why |
|---|---|---|---|
| Chauvet DJ Hurricane 700 fog machine | Walmart ($49–54) or Guitar Center ($50) | $49–54 | Comes with a wired momentary remote and a pint of fluid. 450 W heater, 3 to 4 minutes to warm up |
| Shelly Plus 1 relay | shelly.com or Amazon | $20–25 | Wired across the remote's button so Room OS can "press" it for 1.5 s. Built-in off timer |
| Goal light (Fan Fever red strobe, or any 120 V red rotating beacon) | Amazon | $40–85 | Plugged into a Shelly Plug and pulsed for 8 seconds. The Fan Fever has its own horn; a plain red beacon ($25–40) plus the Mac horn is cheaper |
| Fog fluid, 1 gallon | Walmart | $15–20 | The included pint lasts about one season of 1.5 s bursts |

Smoke alarm note: a photoelectric alarm in the same room will trip on fog. Test one burst with the
door open before game day. If the alarm is in the room, skip fog and keep the goal light and horn.

## Phase 2b: the immersion kit (couch shaker and DMX beams), about $300

The Experience layer already has scenes, a Simulator and intensity modes for these; each one
is a driver away once the box arrives. Prices are typical Amazon / Parts Express / Guitar Center.

| Item | ~Price | Notes |
|---|---|---|
| Dayton Audio BST-1 bass shaker (50 W, 4 Ω), **two** | $55 each | One under each loveseat seat, bolted to the wooden frame, never to upholstery panels. Two seats let effects travel left to right |
| Dayton DTA-120 two-channel amp (60 W per channel into 4 Ω) | $60 | One shaker per channel. A mono amp would lose left/right |
| USB stereo audio adapter for the Mac | $10 | Room OS's own left/right tactile output, separate from the Mac's sound effects |
| Passive 2-into-1 RCA mixer, stereo | $12 | Onkyo sub pre-out (movies, games) and the Mac tactile output both feed the amp |
| 3.5 mm to RCA cable, 10 ft | $8 | USB adapter into the mixer |
| 16 gauge speaker wire, 50 ft | $12 | Both seats back to the amp with slack |
| Chauvet DJ Mini Kinta ILS | $110–120 | RGBW moving beams, standard DMX. The seeded `fx_kinta` fixture profile targets it |
| Art-Net / sACN to DMX node | $45–70 | Pure UDP on your Wi-Fi, no drivers on the Mac. Not ENTTEC Open DMX USB: that one has no hardware timing and needs a flaky FTDI driver on macOS |
| 3-pin DMX cable, 10 ft | $12 | Node to the Kinta |

## Phase 3: lights, about $50 to $180

Two routes. Both flash on cue; the app drives either one directly on your Wi-Fi.

| Route | Where | ~Price | Notes |
|---|---|---|---|
| **Govee Wi-Fi strip, model H619A (16.4 ft) or H61A0/H61A1/H6159/H6163/H6172/H6176** | Lowe's (gift cards), Walmart, Amazon | $20–35 each | Turn on "LAN Control" in the Govee Home app (device → gear → LAN Control). The app then talks to it over UDP with no cloud. Model number is on the box; the ones listed are on Govee's LAN list |
| WLED kit (controller + WS2812B strip + supply) | Walmart or athom.tech | $55–85 each | Open firmware, built-in effects, the hobbyist standard. Buy this if the Govee model on the shelf is not on the LAN list |


| Item | Where | ~Price | Why |
|---|---|---|---|
| WLED LED kit (Athom ESP32-C3 controller + 5 m WS2812B + power supply) | athom.tech ($60 on sale, $85 list) | $60–85 | Bias light behind the Sony. Pre-flashed with WLED; Room OS drives it directly over the network |
| Second WLED kit | same | $60–85 | Accent strip along the top of the TV wall. Team colors on Game Day, warm white in Movie and Work |
| Any WS2812B strip + Gledopto or Athom WLED controller from Amazon | Amazon | $35–50 per set | Cheaper route if you do not mind matching the parts yourself; look for "pre-flashed WLED" in the listing |

## Phase 4: the room, about $40 to $80 (no wall mounts)

The Sony stays on its console, the two 43s sit on side tables, both ribbons are projected. Nothing goes on the wall.

| Item | Where | ~Price | Why |
|---|---|---|---|
| Second side table, about 28" tall, 24–36" wide | Lowe's, Walmart, or any thrift store | $30–60 | Matches the nightstand you have; one 43" TV on each |
| HDMI cables, 6 ft, 3-pack | Lowe's or Walmart | $10–15 | Fire Stick extenders, Apple TV to the Onkyo |
| Tripod-thread shelf or bracket for the MoGo on the opposite wall | Amazon | $15 | Only if there is no shelf at the right height |

### Phase 4 (later): the mounted version, about $130 to $260

| Item | Where | ~Price | Why |
|---|---|---|---|
| Fixed TV mount for the 70" Sony (rated 100+ lb, VESA 400x300) | Amazon or Walmart | $40–90 | The long wall |
| Two fixed mounts for the 43" Roku TVs | Amazon or Walmart | $20–30 each | Either side of the Sony, horizontal |
| Projector ceiling mount for the Horizon Pro | Amazon | $30–60 | Check the existing wall arm's rating first; the Horizon Pro is about 6.4 lb |
| Tripod-thread wall bracket for the MoGo 2 Plus | Amazon | $15 | The MoGo has a 1/4" mount |
| In-wall HDMI, 25–35 ft, plus a 4K active HDMI, 25–35 ft | Amazon | $55–80 | Mac to the ribbon projector; receiver to the Horizon Pro |
| HDMI 1x2 splitter, 4K HDCP 2.2 | Amazon | $20–30 | Only if the Onkyo has a single HDMI out |

## Phase 5: once you send me the screen housing label, $20 to $130

| Screen control | Buy | ~Price |
|---|---|---|
| RF remote | Bond Bridge | $97–129 |
| 12 V trigger jack | Shelly Plus 1 | $20–25 |
| IR remote only | Broadlink RM4 mini | $25 |
| Wall switch, no remote | Shelly Plus 2PM in the switch box | $30 |

## Not worth buying for this

- **AIPI Lite** ($22–27). It is a pocket chatbot: an ESP32 with a mic, speaker and tiny screen
  that talks to ChatGPT over Wi-Fi. It cannot show a web page, drive a TV, or switch a relay.
  Someone has written custom ESPHome firmware for it, so with a weekend of flashing it could
  become a one-button "Game Day" remote, but a $20 Shelly button or the iPad on the wall already
  does that with zero work.
- **Raspberry Pi, or a Google TV box (onn, Chromecast).** Google TV has no browser built in, so it needs a sideloaded one before it can show a page. A Fire Stick ships with Silk, and Room OS already drives both over ADB. The old computer stays a spare.
- **Home Assistant box.** Every device here has a local protocol Room OS speaks directly.
- **A second Onkyo output or new speakers.** The surround set you have is complete.

## Running total

| Phase | Low | High |
|---|---|---|
| 1. This week | $70 | $140 |
| 2. Celebration kit | $150 | $230 |
| 2b. Immersion kit | $350 | $390 |
| 3. Lights | $120 | $180 |
| 4. Remount | $130 | $260 |
| 5. Screen control | $20 | $130 |
| **All phases** | **$490** | **$940** |

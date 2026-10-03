# Shopping list

What you already have covers the brain, the main picture, the sound and the projection. What is
missing is small: a way to put a web page on each extra screen, lights that can be told what color
to be, and the mounting hardware for the new wall. Prices are typical US retail in 2026; nothing
here is a specific brand requirement.

## Already have, and how it is used

| You have | Job in the system | Notes |
|---|---|---|
| Mac | Room Agent (the brain), and the projector's video source for the ribbon | Any Mac from the last 8 years. If it is a laptop, set it to stay awake with the lid closed (plugged in, Energy settings) or use a Mac mini |
| Apple TV | The game on the Sony: YouTube TV, ESPN, etc. | Room OS switches the TV and receiver to it; it does not need to run anything |
| Sony TV | Main game | Needs only its network IP-control setting turned on |
| Two spare TVs/monitors | Aux screens | Each needs a browser box (below) |
| 49" ultrawide | Desk dashboard | The Mac at the desk drives it directly |
| Onkyo receiver | Surround sound, source switching | Networked Onkyos speak eISCP; Room OS talks to it directly, no hub needed |
| XGIMI Horizon Pro | Movie projector (screen fully down) | 2200 ANSI lumens, 4K, Android TV. Controlled over ADB; Apple TV switches it on with HDMI-CEC |
| XGIMI MoGo 2 Plus | Dedicated ribbon projector | 1080p, Android TV, HDMI in. Shows only the ribbon, so it never needs an input switch |
| Sony KD-70X690E | Main game | Supports Bravia IP control with a pre-shared key |
| TCL 43S431 and Element Roku TV | Aux screens | Roku ECP network control, on by default. Each needs a Raspberry Pi for the browser |
| Motorized screen | Ribbon surface (partial drop) and movie screen | Its control type decides one small purchase below |
| Satellite speakers on wall brackets | Rear surrounds | Reuse as is |
| iPad / iPhones | Controllers | The app is a web app; nothing to install |

## Must buy (about $250 to $400)

| Item | Qty | ~Price | Why |
|---|---|---|---|
| Raspberry Pi 4 (2 GB) kit with case, power supply and micro-HDMI cable | 0 to 2 | $75 each | Only if you want scoreboard web pages on the Roku TVs. See "Do you need the Raspberry Pis?" below; the no-cost option is to use those TVs for a second live game instead |
| TV wall mount for the Sony | 1 | $40–90 | Fixed or tilting is fine; full-motion only if you want to angle it toward the desk |
| TV wall mounts for the aux TVs | 2 | $20–30 each | Fixed mounts; keep them horizontal |
| Projector ceiling/wall mount | 1 | $30–60 | The existing articulating arm on the entry wall may fit; check its weight rating against the projector |
| In-wall-rated HDMI cable, 25–35 ft | 1 | $25–35 | Mac at the desk to the MoGo 2 Plus (ribbon) on the closet wall. 1080p, so a plain certified cable is fine |
| HDMI 1×2 splitter (4K, HDCP 2.2) | 1 | $20–30 | Receiver HDMI out to both the Sony and the Horizon Pro, so Movie Mode needs no cable swap. Skip if the Onkyo has two HDMI outputs (Main + Sub) |
| HDMI cable, 25–35 ft, 4K rated (active) | 1 | $30–45 | Splitter to the Horizon Pro on the ceiling |
| WLED LED strip kit (controller + 5 m addressable strip, 12 V supply) | 2 | $35–50 each | One behind the Sony as bias light, one along the top of the TV wall as the accent strip. Pre-flashed WLED controllers from Athom or Gledopto plug straight in; Room OS drives them directly |
| HDMI cables, 6 ft | 3–4 | $8 each | Pi to each aux TV, Apple TV to receiver, receiver to Sony if you do not have them |

## Which device drives which screen, using what you own

You listed iPads, Apple TVs, Chromecasts, Fire Sticks and an old computer. That covers every
screen with nothing new to buy. No Raspberry Pi.

| Screen | Shows | Driven by | Why this one |
|---|---|---|---|
| Sony 70" | The game (video) | Apple TV via the Onkyo | The broadcast itself; Room OS switches the TV and receiver to it |
| Left Roku TV | Stats & Leaders board, or a second game | **Old computer** on HDMI 1, Chrome full screen on the display URL | A real computer is the most reliable kiosk there is; better than a Pi |
| Right Roku TV | League scores / second game | **Fire TV Stick** on HDMI 1, Silk browser full screen | Fire OS is Android; Room OS opens the page on it with the same ADB driver as the projectors |
| MoGo 2 Plus (ribbon) | The projected ribbon | **Mac** over HDMI from the desk, or the MoGo's own browser via ADB | The Mac is already running the agent |
| Desk ultrawide | Scoreboard / fantasy | The Mac, second window | Already there |
| iPad on the wall or console | The control app (Home, Live, Room) | Itself, as a home-screen web app | Your "one button" panel |
| Spare iPad | A small stats board on the console or a player card by the couch | Itself, Safari full screen | Any display role works on it; the room treats it as another screen |
| Chromecasts, spare Apple TVs | Second-game video on an aux TV later | Their own apps | Keep them for video, not web pages: Apple TV has no browser |

Fire Stick setup is three minutes: Settings → My Fire TV → Developer options → ADB debugging
On, note the IP under Settings → My Fire TV → About → Network, and turn off the screensaver
under Settings → Display & Sounds → Screensaver → Start time → Never. Room OS then opens the page
in Silk on Game Day and wakes the stick when the room wakes.

The old computer: install Chrome, set it to open the display URL at login in kiosk mode (one
command, in the setup guide), turn off sleep. Done.

## Do you need the Raspberry Pis? Not with the gear above

A Pi's only job here is to be a tiny computer that opens a web page full screen on a TV that has
no browser of its own. Roku TVs have no browser, which is the only reason they were on the list.
You have three ways around it, and the first costs nothing:

1. **Use the Roku TVs as second-game screens, not scoreboard screens.** Room OS can power them
   on and launch YouTube TV (or any Roku app) through Roku's network control. You pick the game
   with the Roku remote once; the TV stays on it. The scoreboard, league scores and fantasy pages
   then live on the ultrawide and the ribbon, which already have a computer behind them. On a
   real game day a second live broadcast is usually what you want on those screens anyway.
2. **Something you already own.** Any old laptop, Chromebook, or an old iPad with a Lightning or
   USB-C to HDMI adapter ($20 to $40) can sit behind a TV and show the page. Less tidy than a Pi
   but free.
3. **A Chromecast with Google TV or Google TV Streamer** ($40 to $100). It is Android TV, so the
   same driver that runs your XGIMI projectors can open the page in a sideloaded browser. Slightly
   less reliable than a Pi as a 24/7 kiosk; a Pi never shows a screensaver or an update prompt.

My suggestion: start with option 1, zero cost, and add Pis later only if you find yourself wanting
a stats screen on a wall TV. If you do buy Pis, I will give you a one-line setup script; there is
nothing to learn.

## Celebration effects: sounds, fog, goal light (about $0 to $200)

Yes, the touchdown choreography can fire real things. The automation already does: ribbon
takeover, bias lights flash, LED strip pulse, sound, goal light, fog, then everything restores.

| Effect | What to buy | ~Price | How it is wired |
|---|---|---|---|
| **Sound** (air horn, fight song, crowd) | Nothing to start: the Mac plays the clip through whatever its sound output is. For a louder, better-placed speaker: any USB or Bluetooth speaker by the TV, or an AirPlay speaker/HomePod mini the Mac targets | $0, or $30 to $100 | Clips go in `packages/agent/sounds/`. Placeholder horn and fanfare are included; add your own `touchdown.mp3`, `miss_celebration.mp3`. The receiver keeps playing the game; the celebration comes from its own speaker so it layers over the broadcast |
| **Goal light** (the hockey-style red strobe) | A goal light or a cheap red beacon light ($25 to $60) plus a Shelly Plus Plug US ($25) | $50 to $85 | The plug is pulsed for 8 seconds; the relay times itself off |
| **Fog** | A 400 to 700 W fog machine with a wired remote ($40 to $90) plus a Shelly Plus 1 relay ($20) wired across the remote's button contacts, plus a Shelly plug to keep the heater powered only during Game Day | $85 to $140 | Pulsed for 1.5 seconds on a touchdown. The relay has a built-in off timer so a dropped packet can never leave it running |

Honest notes on fog in a bedroom-sized room: a 1.5-second burst from a small machine is a fun
puff; anything longer fills the room in a minute. Fog sets off photoelectric smoke alarms, and the
machine needs 3 to 5 minutes to heat before it can fire (that is why it gets its own plug that
Game Day turns on). The Chauvet Hurricane 700 and similar have a wired remote with a simple
momentary button; a DMX model is overkill. If the alarm is in that room, the goal light and horn
give most of the effect with none of the risk.

## Buy once you send me the screen model (about $25 to $100)

| If the screen is controlled by… | Buy | ~Price |
|---|---|---|
| An RF remote (most common; no line of sight needed) | Bond Bridge | $99 |
| A 12 V trigger input (3.5 mm jack on the housing) | Shelly Plus 1 relay | $20 |
| An IR remote only | Broadlink RM4 mini | $25 |
| A wall switch with no remote | Shelly Plus 2PM wired into the switch box (electrician or confident DIY) | $30 |

Room OS can drive Bond and Shelly directly over the local network; the Broadlink route goes
through Home Assistant.

## Strongly recommended (about $60 to $120)

| Item | ~Price | Why |
|---|---|---|
| Flush-mount smart ceiling light to replace the fan (WiZ or Hue flush fixture) | $40–80 | The fan blades sit in the projector's throw path. A flat fixture clears the beam and gives the Work, Ambient and Movie modes a dimmable room light |
| 5-port gigabit switch + three Ethernet cables | $25 | Wired Pis and TV never drop the display. Optional if Wi-Fi is strong in that room |

## Later, not now

| Item | ~Price | When |
|---|---|---|
| Second Apple TV or Fire TV Stick for a second live game on an aux TV | $50–150 | When you want two broadcasts at once instead of a scoreboard on the second screen |
| Raspberry Pi 4 for Home Assistant OS | $80 | Only if you add devices Room OS cannot talk to directly (Hue hub, Govee, IR-only gear). HA can also run in Docker on the Mac for free |
| iPad wall mount | $25–40 | If the iPad lives in the room |
| Dedicated short-throw mini projector for the ribbon | $150–300 | Only if the main projector's black level on the screen strip bothers you. Try the real thing first |
| Licensed sports data subscription | from ~$100/mo | For play-by-play event detection beyond scores |

## What you do not need

- A Home Assistant box, for now. Sony (IP control), Onkyo (eISCP), Roku TVs (ECP), XGIMI projectors (ADB), WLED, Bond and Shelly all have local network protocols that Room OS speaks directly.
- A projector mount for the ribbon unit beyond a $15 tripod-thread wall bracket: the MoGo 2 Plus has a 1/4" tripod mount and weighs about 2.5 lb.
- An LED matrix or stretched bar display. The projector plus the dropped screen strip does the job; the LED path stays in the repo if you ever want it.
- Any cloud subscription. The simulated and ESPN providers are free; Supabase has a free tier if you want login.
- New speakers. The Onkyo plus what is on the walls is a full surround set.

## Total

Must buy plus the screen controller plus the ceiling light: roughly **$350 to $600**, with the
Raspberry Pis and the LED kits being the bulk of it.

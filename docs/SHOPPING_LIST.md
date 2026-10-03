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
| Two projectors | One for the ribbon and movies; the second is spare or a dedicated ribbon unit | Model numbers decide which does what |
| Motorized screen | Ribbon surface (partial drop) and movie screen | Its control type decides one small purchase below |
| Satellite speakers on wall brackets | Rear surrounds | Reuse as is |
| iPad / iPhones | Controllers | The app is a web app; nothing to install |

## Must buy (about $250 to $400)

| Item | Qty | ~Price | Why |
|---|---|---|---|
| Raspberry Pi 4 (2 GB) kit with case, power supply and micro-HDMI cable | 2 | $75 each | One per aux TV. Boots straight into a full-screen browser showing that screen's role. Most reliable kiosk option, and the agent can restart or re-point it. (A Fire TV Stick 4K at $50 with the Silk browser also works, but it cannot be controlled by the system and drifts out of full screen.) |
| TV wall mount for the Sony | 1 | $40–90 | Fixed or tilting is fine; full-motion only if you want to angle it toward the desk |
| TV wall mounts for the aux TVs | 2 | $20–30 each | Fixed mounts; keep them horizontal |
| Projector ceiling/wall mount | 1 | $30–60 | The existing articulating arm on the entry wall may fit; check its weight rating against the projector |
| In-wall-rated HDMI cable, 25–35 ft | 1 | $25–35 | Mac at the desk to the projector on the closet wall. Active or fiber HDMI if over 25 ft at 4K |
| WLED LED strip kit (controller + 5 m addressable strip, 12 V supply) | 2 | $35–50 each | One behind the Sony as bias light, one along the top of the TV wall as the accent strip. Pre-flashed WLED controllers from Athom or Gledopto plug straight in; Room OS drives them directly |
| HDMI cables, 6 ft | 3–4 | $8 each | Pi to each aux TV, Apple TV to receiver, receiver to Sony if you do not have them |

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

- A Home Assistant box, for now. Sony, Onkyo, PJLink projectors, WLED, Bond and Shelly all have local network protocols that Room OS speaks directly.
- An LED matrix or stretched bar display. The projector plus the dropped screen strip does the job; the LED path stays in the repo if you ever want it.
- Any cloud subscription. The simulated and ESPN providers are free; Supabase has a free tier if you want login.
- New speakers. The Onkyo plus what is on the walls is a full surround set.

## Total

Must buy plus the screen controller plus the ceiling light: roughly **$350 to $600**, with the
Raspberry Pis and the LED kits being the bulk of it.

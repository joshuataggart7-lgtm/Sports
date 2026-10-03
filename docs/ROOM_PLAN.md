# Room plan: making the physical room match the design

This is the working plan for turning the simulated room into the real one. It has three parts:
an inventory you fill in, the projected-ribbon geometry, and the bring-up order. Fill in the
inventory first; almost every later decision depends on it.

## 1. Inventory (fill this in)

Copy the model numbers off the back of each unit. "How it is controlled" is the key column: it
decides which driver the Room Agent uses.

| Device | Make / model | IP on the LAN | How it is controlled today | Driver we will use |
|---|---|---|---|---|
| Sony TV (main) | Bravia ______ (year) | | remote / HDMI-CEC / app | `bravia` (needs the TV's Pre-Shared Key under Settings → Network → Home network → IP control) |
| Left aux TV | | | | `bravia` if Sony, else Home Assistant integration or a smart plug + CEC |
| Right aux TV | | | | same |
| Desk ultrawide | | n/a | always on, input switch | `mock` for now; a browser on the desk PC opens `/display/<code>` |
| Ceiling projector | | | remote / RS-232 / LAN | `pjlink` if it has a LAN port (most Epson, Sony, BenQ, Optoma, NEC do) |
| Second projector (optional) | | | | later |
| Motorized screen | | | RF remote / 12 V trigger / IR | Home Assistant via Bond Bridge (RF), a Shelly relay (12 V trigger), or a Broadlink (IR) |
| AV receiver | Denon / Marantz / Yamaha / Onkyo ______ | | app / remote / HDMI | Home Assistant (all four brands have HA integrations) |
| TV bias lights | | | | `wled` if WLED, Home Assistant if Hue/LIFX/Govee |
| Room LED strip | | | | same |
| Lamps | | | | Home Assistant (Hue, smart plugs) |
| Streaming box on the Sony | Apple TV / Roku / Fire TV | | | Home Assistant for input and app launch |
| Streaming services used for games | YouTube TV / ESPN app / antenna / cable | | | one broadcast-delay profile each |
| Network | router model, Wi-Fi vs Ethernet per device | | | the agent and every display should be on Ethernet or 5 GHz |
| Room Agent host | Mac mini / NUC / Raspberry Pi 4+ | | | runs 24/7, Ethernet |
| Controllers | iPad (wall-mounted?), iPhones | | | the PWA, added to the home screen |

Also useful: a phone photo of the TV wall straight on, a photo of the ceiling where the projector
mounts, and the three measurements in section 2.

## 2. The projected ribbon

The ribbon is a narrow horizontal band of the projector's image above the TV array; the rest of
the image is black. Three measurements decide whether it works:

1. **Throw distance** (lens to wall), in inches.
2. **Projector throw ratio** (from the spec sheet, e.g. 1.32–2.15:1 for a zoom lens).
3. **Wall space above the TVs**: height from the top of the tallest TV to the ceiling, and the width of the TV array.

Image width = throw distance ÷ throw ratio. A 1.5:1 projector 15 ft (180 in) from the wall throws a
120 in wide image, 67.5 in tall at 16:9. If you only want a 10 in tall ribbon, that is 15% of the
image height, which is why the surround must be truly black.

Set these in the app (Displays → Projector → viewport): `canvasWidth` and `canvasHeight` are the
projector's native resolution (1920×1080 or 3840×2160); `x`, `y`, `width`, `height` are the ribbon's
place in that image. To get the ribbon exactly above the TVs: project a test image, measure where
the TV top edge lands in the image, and set `y` and `height` from that. The font size scales with
the viewport height; 64 px at 1080p reads from the couch at 15 ft.

Black levels, in order of cheapness:

- **Lens shift and zoom first.** Shift the image up so most of it lands on the ceiling or a dark
  valance; zoom in so the 16:9 frame is as small as the ribbon allows.
- **Dark surface.** Matte black or very dark paint above the TVs, or a black fabric valance the
  width of the array. A DLP projector's "black" on a dark wall is invisible at TV-viewing light levels.
- **Lens mask.** A matte black card or foam board in front of the lens with a slot cut for the
  ribbon. Crude, effective, reversible.
- **Mini projector.** A short-throw 1080p mini projector dedicated to the ribbon, mounted at the
  wall. The main projector stays free for movies. ~$150–300.
- **LED matrix or stretched bar display.** A 1920×360 or 1920×540 bar LCD (used in retail), or the
  Lanes LED matrix path already in this repo. The ribbon page renders fine on either.

If the main projector doubles as the movie projector, Movie Mode switches its input to the Apple
TV and the screen comes down over the TV; Sports Mode sends the screen up and switches the input
back to the ribbon source. Which device drives the ribbon source? Options: a second HDMI from the
Room Agent host, a Raspberry Pi running Chromium in kiosk mode on `/display/projector?mode=ticker`,
or a Chromecast with Google TV launching that URL. The Pi is the most reliable.

## 3. Bring-up order (MVP 2)

Each step is a day or an evening, and each one is independently useful. After each step the
device in question shows **CONNECTED** in Settings instead of SIMULATED.

1. **Agent host.** Install Node 20+, clone the repo, `npm install`, `npm run build -w @room/web`,
   `npm run agent`. Give the host a fixed IP. Add the app to an iPad's home screen.
2. **Displays.** Open `/display/<code>` on each TV (built-in browser, Apple TV via AirPlay to a
   Mac, a Chromecast, or a Pi). Pair them. Drag roles. This works with zero hardware control.
3. **Projector ribbon.** Pi or spare laptop on the projector's HDMI, kiosk browser on the ribbon
   URL. Measure, set the viewport, deal with black levels (section 2).
4. **Lights.** WLED strips point straight at the agent (`wled` driver, host IP). Hue, LIFX,
   Govee go through Home Assistant. Test with the manual TOUCHDOWN button.
5. **Home Assistant.** Install HA (Pi or the same host), add the receiver, screen, streaming
   box and any lights it owns. Create a long-lived token; start the agent with `HA_URL` and
   `HA_TOKEN`; set each device's driver to `homeassistant` with its `entityId`.
6. **Sony TV.** Enable IP control and a PSK; `bravia` driver with host + PSK. Map HDMI inputs.
7. **Projector.** Enable the network on the projector, `pjlink` driver with host (and password if
   set). Map inputs (`31` is usually HDMI 1).
8. **Receiver.** Through HA: power, source and volume. Map the inputs the scenes use
   (`appletv`, `game`, `tv_arc`, `music`).
9. **Screen.** Through HA (Bond, Shelly or Broadlink). Confirm `screen_up` / `screen_down`.
10. **Delay profiles.** Watch a game on each streaming source, tap SYNC TO TV on the first score,
    check the profile reads a sensible number (YouTube TV is usually 20–40 s; antenna 3–8 s).
11. **Game Day rehearsal.** Simulated provider, real hardware: START GAME DAY, feed touchdown,
    overturn, Movie Mode, ALL OFF. Watch the Timeline for anything that fired unexpectedly.

## 4. Sports data (MVP 3)

The ESPN scoreboard reader works for scores and basic situation data and costs nothing, but it is
unofficial and has no play-by-play. For reliable touchdown / turnover events with the plays that
caused them, a licensed feed is the long-term answer: SportsDataIO and Sportradar both offer NFL
and NCAA football with play-by-play. Pricing starts in the low hundreds per month for personal
plans; a key goes in the agent's environment and never in the app. The provider interface is
already there, so the swap is one file.

## 5. Decisions to make

- Does the main projector also do movies, or does the ribbon get its own mini projector?
- Which streaming source is the everyday one? That profile becomes the default.
- Is the iPad wall-mounted? If so Guest mode or Kids mode may be the right default page for it.
- Home Assistant on the agent host, or on its own Pi?

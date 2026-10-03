# Room plan: making the physical room match the design

This is the working plan for turning the simulated room into the real one. It has three parts:
an inventory you fill in, the projected-ribbon geometry, and the bring-up order. Fill in the
inventory first; almost every later decision depends on it.


## 0. The room as photographed, and the layout that makes the design work

From the photos: a rectangular bedroom with a window on one short wall (curtains, blinds, the
motorized screen housing mounted above the window), a double-door closet on the wall to the right
of the window, the entry door in the opposite short wall near the corner, a ceiling fan with a
light in the center of the room, and one long blank wall with an articulating wall mount and two
speaker brackets already in it. Wood floor, white walls, roughly 9 to 10 ft ceilings. Satellite
speakers are already on wall brackets high in two corners.

Plan view (not to scale):

```
                      WINDOW WALL (A): desk + ultrawide under the window
   ┌─────────────────────────────────────────────────────────────┐
   │  [desk · 49" ultrawide]                       (curtains)    │
   │                                                             │
 C │                        ● fan → replace with a flush light   │ L
 L │                                                             │ O
 O │                                                             │ N
 S │   [loveseat]                                                │ G
 E │   facing →                                        [aux TV]  │
 T │                                             [SONY 65"+]     │ W
   │                                                   [aux TV]  │ A
 W │                                   ribbon: screen drops 10"  │ L
 A │                                      ━━━━━━━━━━━━━━━━━━━━   │ L
 L │                                                             │
 L │  projector mounts high here, above the loveseat ▶           │ (D)
 (B)│                                                            │
   └──────────────────────────┬──────────────────────────────────┘
                      entry door (wall C, near the D corner)
```

Walls, named for the rest of this document:

- **A, window wall**: the desk and the 49-inch ultrawide go here. Daylight behind a monitor is fine; daylight behind a TV is not, which is why the TV leaves this wall.
- **B, closet wall**: the loveseat, centered, facing wall D. The closet doors still open; a loveseat is shallow enough. The projector mounts high on this wall or on the ceiling just in front of it, throwing across the room at wall D.
- **C, entry wall**: nothing load-bearing for the system. Leave it for the door swing, a floor lamp, and later the room map's "guest" view. The existing articulating mount on this wall can be reused for a surround speaker.
- **D, the long blank wall**: the sports wall. Sony in the center at seated eye height (center of screen about 42 in off the floor), the two aux TVs flanking it, the motorized screen re-mounted above the array.

### Aux TVs: horizontal

Mount them horizontal (landscape), not vertical. Every game feed, RedZone and the second-game
display are 16:9; a vertical TV would letterbox them to a third of the panel. The one role that
suits a vertical screen is stats or fantasy, and the ultrawide at the desk already covers that.
Keep the aux TVs the same height as the Sony's center line so the three read as one wall. If the
aux TVs are much smaller than the Sony, raise them slightly so their top edges align with the Sony's
top edge; the eye forgives mismatched bottoms more than mismatched tops.

### The screen as the ribbon surface (your idea, and it is the right one)

Mount the motorized screen on wall D so its housing sits just below the ceiling, with its bottom
edge, when fully retracted, right above the TV array. Two positions:

- **Sports and Game Day**: the screen drops about 10 to 14 inches. The projector paints the ribbon
  on that strip of white screen. Everything else in the projector's image is black and falls on
  the TVs and wall below, where it is invisible at normal TV brightness. A white screen strip gives
  the ribbon a brightness and crispness a painted wall never will.
- **Movie**: the screen drops fully in front of the TV array; the Sony and aux TVs are off behind
  it; the projector switches input to the Apple TV. This matches the brief exactly.

For the partial drop you need a screen controller with a **stop** command or a preset position.
Elite, Da-Lite, Draper and most RF-controlled screens have stop; Bond Bridge learns RF remotes and
exposes open/close/stop to Home Assistant. If yours is 12 V trigger only, a Shelly 2PM relay can
time a partial drop (measure once, then "down for 2.3 seconds"). We read the model number off the
housing end cap first.

### Two projectors, two jobs

You have an XGIMI Horizon Pro and an XGIMI MoGo 2 Plus. That settles the "does the main projector
also do movies" question: it does not have to.

- **Horizon Pro = movie projector.** 2200 ANSI lumens, 4K, throw ratio 1.2:1 with no optical
  zoom. It only ever shows the receiver's output (Apple TV), with the screen fully down.
- **MoGo 2 Plus = ribbon projector.** 1080p, about 400 ISO lumens, throw ratio about 1.2:1,
  Android TV. It only ever shows the ribbon (the Mac's HDMI, or its own browser). Permanently
  aimed at the dropped strip of screen. Because it never changes input, nothing can go wrong with
  it mid-game, and 400 lumens on a white screen strip in a TV-lit room is plenty.

Neither has lens shift, and digital keystone costs resolution, so mount each one square to the
wall at the height of the image it is making.

Throw math at 1.2:1 (image width = throw distance ÷ 1.2):

| Throw distance | Image width | Image height (16:9) |
|---|---|---|
| 8 ft | 80 in | 45 in |
| 10 ft | 100 in | 56 in |
| 12 ft | 120 in | 68 in |

So the Horizon Pro sits about 10 ft from the wall for a 100-inch-wide screen, which is close to the
room's center line and the fan. The MoGo sits as far back as the room allows (12 ft gives a 120-inch
ribbon), mounted high on the closet wall on a tripod-thread bracket, aimed level at the strip. The
ribbon strip is the top 10 to 14 inches of its image; the rest lands on the TVs below and stays
black.

### Projector placement and the ceiling fan

The fan sits in the center of the ceiling, directly in the throw path from wall B to wall D. A
projector mounted behind it will clip the blades. Options, best first:

1. Replace the fan with a flush-mount smart light. With the Horizon Pro needing to sit about 10 ft
   from the wall, it lands next to the fan, so this is close to mandatory. You want dimmable,
   color-capable room light for the modes anyway (a Hue or WiZ flush fixture).
2. Keep the fan, mount the projector on wall B just below the ceiling, use lens shift to push the
   image up, and aim the ribbon as high on wall D as the screen allows. The beam then passes above
   the blade sweep. Works only if the fan's blade tips are at least 8 in below the lens.
3. Short-throw projector on a shelf or mount at wall D, above the screen housing, throwing down
   onto the dropped strip. No fan interaction, but ultra-short-throw units at the top of a wall
   are awkward, and this leaves Movie Mode needing the second projector you mentioned.

Measure: floor to ceiling, wall B to the fan center, and the width of wall D. With those three
numbers and the projector's throw ratio, I will give you the exact mount point and the viewport
settings. The throw distance across this room (about 11 to 13 ft from the look of the photos)
suits a standard 1.3 to 1.6 throw ratio at a 100 to 110 inch image width, which is wider than the
three TVs together, so the ribbon can span the whole array.

### Speakers and the receiver

The two satellites on corner brackets become the rear surrounds. Front left and right go on
either side of the Sony, center under it on the console, and the subwoofer in the corner by the
desk. The receiver and the Apple TV live in the console under the Sony with the HDMI runs: Apple
TV → receiver → Sony (eARC back). The aux TVs each get a cheap HDMI source for their browser
display (a Raspberry Pi or a Chromecast with Google TV), and the ribbon gets the same from the
projector's HDMI.

### Lighting

- Bias light strip behind the Sony (WLED or Hue Play gradient).
- One LED strip along the top of wall D behind the screen housing, which doubles as the
  "stadium" accent in team colors.
- Flush ceiling light (replacing the fan) for the Work and Ambient modes.
- A lamp by the loveseat on a smart plug or smart bulb.

Four lights is enough for every mode in the brief; more becomes clutter.

### Order of operations for the move

1. Clear the room (done, per your note).
2. Decide fan vs. flush light; if replacing, do it first while the room is empty.
3. Mount the Sony on wall D at eye height, then the aux TVs, then the screen housing above.
4. Run power and HDMI to the three TV positions and to the projector position on wall B.
5. Mount the projector; project a test pattern; set lens shift and zoom; measure where the dropped
   screen strip lands in the image; enter the viewport numbers in the app.
6. Loveseat against wall B, desk under the window, lamp by the entry.
7. Then the hardware bring-up order in section 3.

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

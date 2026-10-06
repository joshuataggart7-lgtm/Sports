/**
 * The Experience scenes: every physical moment the room can perform, as timed, device-agnostic
 * actions. Scenes speak in groups ("accent", "tactile", "dmx", "horn") and template values
 * ("{{team.primary}}"), never in hardware, so the same TOUCHDOWN runs for Ole Miss, the Saints,
 * or a team added next year, and runs on whatever lights/shaker/fixture happen to be plugged in.
 * Every scene here is fx: true, so it passes through the Experience settings (master, categories,
 * intensity mode) at dispatch. Stored in room.json after first run; edit there or in the app.
 */
import type { Automation, RoomDevice, Scene, SceneAction, TeamExperience } from "@room/core";

type Target = SceneAction["action"] extends infer A ? A extends { target: infer T } ? T : never : never;
const g = (group: string): Target => ({ group });
const d = (device: string): Target => ({ device });
const all = { all: true } as const;
const at = (delayMs: number, action: SceneAction["action"], label?: string): SceneAction => ({ delayMs, action, ...(label ? { label } : {}) });
const cmd = (target: Target, command: Record<string, unknown>) => ({ target, command }) as SceneAction["action"];
const overlay = (target: { all: true } | { displayRole: string } | { display: string }, o: Record<string, unknown>) => ({ target, overlay: o }) as SceneAction["action"];

const TEAM = ["{{team.primary}}", "{{team.secondary}}"];

export function experienceDevices(ROOM: string, dev: (id: string, type: RoomDevice["type"], name: string, caps: RoomDevice["capabilities"], extra?: Partial<RoomDevice>) => RoomDevice): RoomDevice[] {
  return [
    // Couch shaker: a Dayton BST-1 on a small amp, fed by the Mac for FX mode. SIMULATED until the tactile driver lands.
    dev("fx_shaker", "tactile", "Couch Shaker (BST-1)", ["power", "tactile"], { driver: "tactile", driverConfig: { host: "", output: "", intendedDriver: "tactile" }, groups: ["fx", "tactile"], position: { x: 0.5, y: 0.78, w: 0.2, h: 0.05 } }),
    // Effect light on DMX. Profile named here; the DMX driver maps semantic ops to channels.
    dev("fx_kinta", "dmx_fixture", "Effect Light (Mini Kinta)", ["power", "color", "brightness", "dmx"], { driver: "dmx", driverConfig: { host: "", universe: 1, address: 1, profile: "mini_kinta_ils", intendedDriver: "dmx" }, groups: ["fx", "dmx"], position: { x: 0.5, y: 0.02, w: 0.05, h: 0.03 } }),
    // Govee Lyra floor lamp beside the main TV: on Govee's LAN list; part of the accent group so it chases with the strips.
    dev("lyra", "light", "Floor Lamp (Govee Lyra)", ["power", "brightness", "color", "effect"], { driver: "govee", driverConfig: { host: "", intendedDriver: "govee" }, groups: ["accent", "floor_lamp"], position: { x: 0.68, y: 0.5, w: 0.03, h: 0.12 } }),
    // Stadium horn on a smart plug: 12 V horn + adapter, two seconds on a score. Driver kasa (Kasa/Tapo)
    // or wiz (WiZ plug) depending on what the store had; set it in Settings with the plug's IP.
    dev("fx_horn", "smart_plug", "Stadium Horn (smart plug)", ["power", "momentary"], { driver: "wiz", driverConfig: { host: "", intendedDriver: "wiz" }, groups: ["fx", "horn"], position: { x: 0.92, y: 0.6, w: 0.04, h: 0.03 } }),
  ];
}

export function experienceScenes(ROOM: string): Scene[] {
  const fx = (id: string, name: string, actions: SceneAction[], extra: Partial<Scene> = {}): Scene => ({ id, roomId: ROOM, name, fx: true, actions, ...extra });
  return [
    // ------------------------------------------------------------ manual buttons
    fx("fx_celebrate", "Celebrate", [
      at(0, overlay(all, { kind: "celebration", text: "LET'S GO", subtext: "{{team.name}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "victoryPulse", intensity: 70, durationMs: 5000 })),
      at(100, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 6000 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 90, durationMs: 6000 })),
      at(300, cmd(d("fx_speaker"), { type: "play_audio", clip: "celebration", volume: 80 })),
      at(300, cmd(g("goal_light"), { type: "pulse", durationMs: 6000 })),
    ], { button: { label: "CELEBRATE", group: "celebrate" } }),
    fx("fx_boom", "Boom", [
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "explosion", intensity: 100, durationMs: 1200 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 700 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "strobe", intensity: 100, durationMs: 600 })),
      at(60, cmd(d("fx_speaker"), { type: "play_audio", clip: "boom", volume: 95 })),
    ], { button: { label: "BOOM", group: "celebrate" } }),
    fx("fx_stadium", "Stadium", [
      at(0, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 85 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "crowdPulse", intensity: 55, durationMs: 8000 })),
      at(200, cmd(g("accent"), { type: "effect", effect: "chase", colors: TEAM, durationMs: 8000 })),
      at(200, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 80, durationMs: 8000 })),
      at(300, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "{{team.name}}", subtext: "{{game.away}} {{game.awayScore}} · {{game.home}} {{game.homeScore}}", color: "{{team.primary}}", durationMs: 8000 })),
    ], { button: { label: "STADIUM", group: "celebrate" } }),
    fx("fx_light_show", "Light Show", [
      at(0, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff", "{{team.primary}}"], durationMs: 12000 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "motor_speed", speed: 80, intensity: 100, durationMs: 12000 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.primary}}", intensity: 100 })),
      at(6000, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.secondary}}", intensity: 100 })),
    ], { button: { label: "LIGHT SHOW", group: "celebrate" } }),
    fx("fx_crowd_roar", "Crowd Roar", [
      at(0, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 90 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "crowdPulse", intensity: 50, durationMs: 5000 })),
    ], { button: { label: "CROWD ROAR", group: "celebrate" } }),
    fx("fx_horn", "Horn", [
      at(0, cmd(d("fx_speaker"), { type: "play_audio", clip: "horn", volume: 95 })),
      at(0, cmd(g("horn"), { type: "pulse", durationMs: 2000 })),
    ], { button: { label: "HORN", group: "celebrate" } }),
    fx("fx_couch_hit", "Couch Hit", [
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 90, durationMs: 500 })),
    ], { button: { label: "COUCH HIT", group: "celebrate" } }),
    fx("fx_beam_burst", "Beam Burst", [
      at(0, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 100, durationMs: 3000 })),
    ], { button: { label: "BEAM BURST", group: "celebrate" } }),
    fx("fx_team_colors", "Team Colors", [
      at(0, cmd(g("tv_bias"), { type: "set_color", color: "{{team.primary}}", transitionMs: 800 })),
      at(0, cmd(g("room_leds"), { type: "set_color", color: "{{team.secondary}}", transitionMs: 800 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.primary}}", intensity: 70 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "off" })),
    ], { button: { label: "TEAM COLORS", group: "celebrate" } }),
    fx("fx_blackout", "Blackout", [
      at(0, overlay(all, { kind: "clear", durationMs: 0 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "blackout" })),
      at(0, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(100, cmd(g("accent"), { type: "power_off" })),
      at(100, cmd(g("ambient"), { type: "power_off" })),
    ], { button: { label: "BLACKOUT", group: "celebrate" } }),
    fx("fx_reset_room", "Reset Room", [
      at(0, overlay(all, { kind: "clear", durationMs: 0 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "blackout" })),
      at(0, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(200, cmd(g("accent"), { type: "power_on" })),
      at(300, cmd(g("tv_bias"), { type: "set_color", color: "{{team.primary}}", transitionMs: 1500 })),
      at(300, cmd(g("room_leds"), { type: "set_color", color: "{{team.secondary}}", transitionMs: 1500 })),
      at(300, cmd(g("accent"), { type: "set_brightness", brightness: 45 })),
      at(300, cmd(g("ambient"), { type: "set_brightness", brightness: 25 })),
    ], { button: { label: "RESET ROOM", group: "celebrate" } }),

    // ------------------------------------------------------------ talk show and concert buttons
    fx("fx_studio_lights", "Studio Lights", [
      at(0, cmd(g("tv_bias"), { type: "set_color", color: "#f4efe6", transitionMs: 1500 })),
      at(0, cmd(g("tv_bias"), { type: "set_brightness", brightness: 35 })),
      at(0, cmd(g("towers"), { type: "set_color", color: "#7c9cff", transitionMs: 1500 })),
      at(0, cmd(g("towers"), { type: "set_brightness", brightness: 15 })),
      at(0, cmd(g("lamps"), { type: "set_color", color: "#ffd9a0", transitionMs: 1500 })),
      at(0, cmd(g("lamps"), { type: "set_brightness", brightness: 40 })),
    ], { button: { label: "STUDIO LIGHTS", group: "talk" } }),
    fx("fx_big_laugh", "Big Laugh", [
      at(0, cmd(g("towers"), { type: "effect", effect: "pulse", colors: ["#ffd60a", "#ff7a00"], durationMs: 2500 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "crowdPulse", intensity: 30, durationMs: 2000 })),
      at(100, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 45 })),
    ], { button: { label: "BIG LAUGH", group: "talk" } }),
    fx("fx_applause", "Applause", [
      at(0, cmd(g("accent"), { type: "effect", effect: "breathe", colors: ["#ffffff", "#ffd9a0"], durationMs: 4000 })),
      at(0, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 55 })),
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "APPLAUSE", color: "#ffd60a", durationMs: 3000 })),
    ], { button: { label: "APPLAUSE", group: "talk" } }),
    fx("fx_chaos", "Chaos", [
      at(0, cmd(g("accent"), { type: "effect", effect: "chase", colors: ["#ff2d55", "#5856d6", "#34c759", "#ffd60a"], durationMs: 6000 })),
      at(0, cmd(g("room_leds"), { type: "effect", effect: "flash", colors: ["#ffffff", "#ff2d55"], durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "explosion", intensity: 70, durationMs: 1200 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "strobe", intensity: 80, durationMs: 3000 })),
      at(100, cmd(d("fx_speaker"), { type: "play_audio", clip: "boom", volume: 80 })),
      at(0, overlay(all, { kind: "celebration", text: "CHAOS", color: "#ff2d55", color2: "#5856d6", durationMs: 5000 })),
    ], { button: { label: "CHAOS", group: "talk" } }),
    fx("fx_drop", "Drop", [
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "explosion", intensity: 90, durationMs: 1200 })),
      at(0, cmd(g("tv_bias"), { type: "effect", effect: "flash", colors: ["#ffffff", "#ff9f43"], durationMs: 800 })),
      at(60, cmd(g("towers"), { type: "effect", effect: "chase", colors: ["#ff9f43", "#ffd9a0", "#ffffff"], durationMs: 6000 })),
      at(120, cmd(g("stadium_upper"), { type: "effect", effect: "pulse", colors: ["#ff9f43", "#000000"], durationMs: 6000 })),
      at(300, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "#ff9f43", intensity: 90, durationMs: 6000 })),
    ], { button: { label: "DROP", group: "concert" } }),
    fx("fx_encore", "Encore", [
      at(0, cmd(g("lamps"), { type: "effect", effect: "breathe", colors: ["#ffd9a0", "#ffffff"], durationMs: 12000 })),
      at(0, cmd(g("stadium_upper"), { type: "effect", effect: "breathe", colors: ["#ff9f43", "#ffffff"], durationMs: 12000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 35, durationMs: 12000 })),
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "ENCORE", color: "#ff9f43", durationMs: 8000 })),
    ], { button: { label: "ENCORE", group: "concert" } }),

    // ------------------------------------------------------------ sports moments
    fx("fx_game_start", "Game Start", [
      at(0, overlay(all, { kind: "banner", text: "GAME TIME", subtext: "{{game.away}} at {{game.home}}", color: "{{team.primary}}", durationMs: 6000 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "chase", colors: TEAM, durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "kickoff", intensity: 60, durationMs: 3000 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 70 })),
      at(200, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 80, durationMs: 6000 })),
    ], { forEvents: ["GAME_START"] }),
    fx("fx_kickoff", "Kickoff", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "KICKOFF", color: "{{team.primary}}", durationMs: 4000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "kickoff", intensity: 55, durationMs: 2500 })),
      at(0, cmd(g("tv_bias"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 1200 })),
    ], { forEvents: ["KICKOFF"] }),
    fx("fx_big_play", "Big Play", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "BIG PLAY", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 70, durationMs: 800 })),
      at(100, cmd(g("tv_bias"), { type: "effect", effect: "pulse", colors: TEAM, durationMs: 3000 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 70, durationMs: 2500 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "{{team.bigPlayAudio}}", volume: 65 })),
    ], { forEvents: ["BIG_PLAY"] }),
    fx("fx_first_down", "First Down", [
      at(0, cmd(g("tv_bias"), { type: "effect", effect: "flash", colors: ["{{team.primary}}"], durationMs: 700 })),
    ], { forEvents: ["FIRST_DOWN"] }),
    fx("fx_third_down", "Third Down", [
      at(0, cmd(g("tv_bias"), { type: "effect", effect: "pulse", colors: ["{{team.primary}}", "#000000"], durationMs: 4000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 30, durationMs: 4000 })),
    ], { forEvents: ["THIRD_DOWN"] }),
    fx("fx_fourth_down", "Fourth Down", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "4TH DOWN", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 5000 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "pulse", colors: ["{{team.primary}}", "#000000"], durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 45, durationMs: 6000 })),
    ], { forEvents: ["FOURTH_DOWN"] }),
    fx("fx_red_zone", "Red Zone", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "RED ZONE", subtext: "{{event.text}}", color: "#ff3b30", durationMs: 6000 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "breathe", colors: ["#ff3b30", "{{team.primary}}"], durationMs: 20000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 35, durationMs: 20000 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "#ff3b30", intensity: 40 })),
    ], { forEvents: ["RED_ZONE"] }),
    // The shockwave: one impact that travels outward from the TV (couch → TV backlight → lamps →
    // floor lamp → beams → props), then the three auxiliary screens form one composition
    // (TOUCH / team name / DOWN), then the drive summary explains what just happened.
    fx("fx_touchdown", "Touchdown", [
      at(0, overlay(all, { kind: "celebration", text: "TOUCHDOWN", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 8000 }), "Screens"),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 85, durationMs: 400 }), "Couch hit"),
      at(80, cmd(g("tv_bias"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Sony bias"),
      at(130, cmd(g("accent_left"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Left tower"),
      at(160, cmd(g("lamps"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Corner lamps"),
      at(190, cmd(g("accent_right"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Right tower"),
      at(220, cmd(g("room_leds_low"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Console underglow"),
      at(240, cmd(g("floor_lamp"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 })),
      at(260, cmd(g("stadium_upper"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "Upper halo"),
      at(300, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 90, durationMs: 8000 }), "Beams"),
      at(350, cmd(d("fx_speaker"), { type: "play_audio", clip: "touchdown", volume: 90 }), "Horn"),
      at(350, cmd(g("horn"), { type: "pulse", durationMs: 2000 })),
      at(350, cmd(g("goal_light"), { type: "pulse", durationMs: 8000 })),
      at(350, cmd(g("fog"), { type: "pulse", durationMs: 400 }), "Fog burst"),
      at(400, overlay({ display: "disp_left" }, { kind: "celebration", text: "TOUCH", color: "{{team.primary}}", color2: "{{team.secondary}}", durationMs: 7600 }), "Left screen"),
      at(400, overlay({ display: "disp_right" }, { kind: "celebration", text: "DOWN", color: "{{team.primary}}", color2: "{{team.secondary}}", durationMs: 7600 }), "Right screen"),
      at(450, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "{{team.name}}", subtext: "{{event.score}}", color: "{{team.primary}}", durationMs: 7500 }), "Ribbon fascia"),
      at(700, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 80, durationMs: 700 })),
      at(1000, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 7000 }), "Team chase across the wall"),
      at(1000, cmd(g("room_leds"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 7000 })),
      at(1000, cmd(g("lamps"), { type: "set_color", color: "{{team.primary}}", transitionMs: 500 })),
      at(1500, cmd(g("tactile"), { type: "tactile", pattern: "rumble", intensity: 55, durationMs: 3500 })),
      at(2600, cmd(d("fx_speaker"), { type: "play_audio", clip: "{{team.audio}}", volume: 85 }), "Fight song"),
      at(8200, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "{{drive.summary}}", subtext: "{{team.name}} · {{event.score}}", color: "{{team.primary}}", durationMs: 9000 }), "Drive afterglow"),
      at(8200, overlay({ display: "disp_left" }, { kind: "banner", text: "{{drive.summary}}", color: "{{team.primary}}", durationMs: 9000 })),
      at(8500, cmd(g("tv_bias"), { type: "set_color", color: "{{team.primary}}", transitionMs: 2500 }), "Back to Game Day rest"),
      at(8500, cmd(g("tv_bias"), { type: "set_brightness", brightness: 22 })),
      at(8500, cmd(g("towers"), { type: "set_color", color: "{{team.secondary}}", transitionMs: 2500 })),
      at(8500, cmd(g("towers"), { type: "set_brightness", brightness: 12 })),
      at(8500, cmd(g("room_leds_low"), { type: "set_color", color: "{{team.primary}}", transitionMs: 2500 })),
      at(8500, cmd(g("room_leds_low"), { type: "set_brightness", brightness: 9 })),
      at(8500, cmd(g("stadium_upper"), { type: "set_brightness", brightness: 5 })),
      at(8500, cmd(g("lamps"), { type: "set_brightness", brightness: 25 })),
      at(8500, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.primary}}", intensity: 40 })),
    ], { forEvents: ["TOUCHDOWN"], version: 3 }),
    // Pressure: before the play, the room tightens. Ribbon shows the down, light pulls in to one color, couch gets a heartbeat.
    fx("fx_pressure", "Pressure", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "{{down.text}}", subtext: "{{team.abbr}} · {{event.text}}", color: "{{team.primary}}", durationMs: 12000 })),
      at(0, cmd(g("ambient"), { type: "set_brightness", brightness: 10 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(100, cmd(g("accent"), { type: "set_color", color: "{{team.primary}}", transitionMs: 1500 })),
      at(100, cmd(g("accent"), { type: "set_brightness", brightness: 60 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 40, durationMs: 12000 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.primary}}", intensity: 25 })),
    ], { forEvents: ["PRESSURE"] }),
    // Fingerprints: sharper versions of takeaway / big play for moments the feed text makes unmistakable.
    fx("fx_pick_six", "Pick Six", [
      at(0, overlay(all, { kind: "celebration", text: "PICK SIX", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 9000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "explosion", intensity: 100, durationMs: 1200 })),
      at(80, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 1500 })),
      at(160, cmd(g("lamps"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 1500 })),
      at(300, cmd(g("dmx"), { type: "fixture", op: "strobe", color: "{{team.primary}}", intensity: 100, durationMs: 2000 })),
      at(350, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 95 })),
      at(350, cmd(g("horn"), { type: "pulse", durationMs: 3000 })),
      at(400, cmd(g("goal_light"), { type: "pulse", durationMs: 9000 })),
      at(800, cmd(g("fog"), { type: "pulse", durationMs: 2000 })),
      at(1600, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 7000 })),
      at(2000, cmd(g("tactile"), { type: "tactile", pattern: "victoryPulse", intensity: 80, durationMs: 6000 })),
      at(2800, cmd(d("fx_speaker"), { type: "play_audio", clip: "{{team.audio}}", volume: 90 })),
      at(9000, cmd(g("accent"), { type: "set_color", color: "{{team.primary}}", transitionMs: 2500 })),
    ], { forEvents: ["PICK_SIX"] }),
    fx("fx_fourth_down_stop", "Fourth-Down Stop", [
      at(0, overlay(all, { kind: "celebration", text: "STOPPED", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 90, durationMs: 500 })),
      at(80, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 2000 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 80 })),
      at(300, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 80, durationMs: 4000 })),
    ], { forEvents: ["FOURTH_DOWN_STOP"] }),
    fx("fx_missed_field_goal", "Missed Field Goal", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "NO GOOD", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 60, durationMs: 700 })),
      at(100, cmd(g("tv_bias"), { type: "effect", effect: "pulse", colors: TEAM, durationMs: 3000 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 65 })),
    ], { forEvents: ["MISSED_FIELD_GOAL"] }),
    fx("fx_blocked_kick", "Blocked Kick", [
      at(0, overlay(all, { kind: "celebration", text: "BLOCKED", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "explosion", intensity: 90, durationMs: 1000 })),
      at(80, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 2500 })),
      at(300, cmd(g("dmx"), { type: "fixture", op: "strobe", color: "{{team.primary}}", intensity: 90, durationMs: 1500 })),
      at(350, cmd(d("fx_speaker"), { type: "play_audio", clip: "boom", volume: 90 })),
      at(600, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 85 })),
    ], { forEvents: ["BLOCKED_KICK"] }),
    // A favorite scoring in a game that is not the primary one: screens only, never the horn.
    fx("fx_secondary_score", "Other Game Score", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "{{event.text}}", subtext: "{{game.away}} {{game.awayScore}} · {{game.home}} {{game.homeScore}}", color: "{{team.primary}}", durationMs: 7000 })),
      at(0, overlay({ display: "disp_right" }, { kind: "banner", text: "{{team.abbr}} SCORES", subtext: "{{event.score}}", color: "{{team.primary}}", durationMs: 7000 })),
      at(0, cmd(g("tv_bias"), { type: "effect", effect: "pulse", colors: TEAM, durationMs: 2500 })),
    ], { forEvents: ["SECONDARY_SCORE"] }),
    fx("fx_field_goal", "Field Goal", [
      at(0, overlay(all, { kind: "celebration", text: "FIELD GOAL", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 60, durationMs: 400 })),
      at(100, cmd(g("accent"), { type: "effect", effect: "pulse", colors: TEAM, durationMs: 4000 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 60, durationMs: 4000 })),
      at(300, cmd(d("fx_speaker"), { type: "play_audio", clip: "field_goal", volume: 75 })),
    ], { forEvents: ["FIELD_GOAL"] }),
    fx("fx_turnover", "Turnover", [
      at(0, overlay(all, { kind: "celebration", text: "TAKEAWAY", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 75, durationMs: 700 })),
      at(100, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 2500 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "strobe", color: "{{team.primary}}", intensity: 80, durationMs: 1500 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 75 })),
    ], { forEvents: ["TURNOVER"] }),
    fx("fx_sack", "Sack", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "SACK", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 4000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 80, durationMs: 400 })),
      at(0, cmd(d("fx_speaker"), { type: "play_audio", clip: "boom", volume: 70 })),
      at(100, cmd(g("tv_bias"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 1000 })),
    ], { forEvents: ["SACK"] }),
    fx("fx_interception", "Interception", [
      at(0, overlay(all, { kind: "celebration", text: "PICKED OFF", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 5000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 80, durationMs: 700 })),
      at(100, cmd(g("accent"), { type: "effect", effect: "chase", colors: TEAM, durationMs: 5000 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 85, durationMs: 5000 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 80 })),
    ], { forEvents: ["INTERCEPTION"] }),
    fx("fx_opponent_score", "Opponent Score", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "alert", text: "{{event.text}}", subtext: "{{event.score}}", color: "#6b7280", durationMs: 5000 })),
      at(0, cmd(g("accent"), { type: "set_color", color: "#1e3a8a", transitionMs: 1500 })),
      at(0, cmd(g("accent"), { type: "set_brightness", brightness: 15 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 35, durationMs: 600 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "blackout" })),
      at(6000, cmd(g("accent"), { type: "set_color", color: "{{team.primary}}", transitionMs: 3000 })),
      at(6000, cmd(g("accent"), { type: "set_brightness", brightness: 45 })),
    ], { forEvents: ["OPPONENT_SCORE"] }),
    fx("fx_halftime", "Halftime", [
      at(0, overlay(all, { kind: "banner", text: "HALFTIME", subtext: "{{game.away}} {{game.awayScore}} · {{game.home}} {{game.homeScore}}", color: "{{team.primary}}", durationMs: 8000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(0, cmd(g("ambient"), { type: "set_brightness", brightness: 60 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "breathe", colors: TEAM, durationMs: 0 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.secondary}}", intensity: 30 })),
    ], { forEvents: ["HALFTIME"] }),
    fx("fx_game_win", "Game Win", [
      at(0, overlay(all, { kind: "celebration", text: "{{team.abbr}} WINS", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 20000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "victoryPulse", intensity: 80, durationMs: 15000 })),
      at(100, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 20000 })),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 100, durationMs: 20000 })),
      at(300, cmd(d("fx_speaker"), { type: "play_audio", clip: "touchdown", volume: 90 })),
      at(300, cmd(g("horn"), { type: "pulse", durationMs: 3000 })),
      at(400, cmd(g("goal_light"), { type: "pulse", durationMs: 15000 })),
      at(800, cmd(g("fog"), { type: "pulse", durationMs: 2500 })),
      at(2800, cmd(d("fx_speaker"), { type: "play_audio", clip: "{{team.winAudio}}", volume: 90 })),
      at(20500, cmd(g("accent"), { type: "set_color", color: "{{team.primary}}", transitionMs: 3000 })),
    ], { forEvents: ["GAME_WIN"] }),
    fx("fx_game_loss", "Game Loss", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "FINAL", subtext: "{{event.text}}", color: "#9ca3af", durationMs: 10000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(0, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(100, cmd(g("accent"), { type: "set_color", color: "#1e3a8a", transitionMs: 4000 })),
      at(100, cmd(g("accent"), { type: "set_brightness", brightness: 20 })),
      at(100, cmd(g("dmx"), { type: "fixture", op: "blackout" })),
    ], { forEvents: ["GAME_LOSS"] }),
    fx("fx_overtime", "Overtime", [
      at(0, overlay(all, { kind: "banner", text: "OVERTIME", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 6000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 50, durationMs: 10000 })),
      at(0, cmd(g("accent"), { type: "effect", effect: "pulse", colors: ["{{team.primary}}", "#ffffff"], durationMs: 10000 })),
      at(0, cmd(g("dmx"), { type: "fixture", op: "strobe", color: "{{team.primary}}", intensity: 70, durationMs: 2000 })),
      at(200, cmd(d("fx_speaker"), { type: "play_audio", clip: "crowd_roar", volume: 80 })),
    ], { forEvents: ["OVERTIME"] }),
    fx("fx_two_minute", "Two-Minute Warning", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "TWO-MINUTE WARNING", subtext: "{{game.away}} {{game.awayScore}} · {{game.home}} {{game.homeScore}}", color: "{{team.primary}}", durationMs: 6000 })),
      at(0, cmd(g("ambient"), { type: "set_brightness", brightness: 10 })),
      at(0, cmd(g("accent"), { type: "set_brightness", brightness: 60 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "heartbeat", intensity: 25, durationMs: 15000 })),
    ], { forEvents: ["TWO_MINUTE"] }),
    fx("fx_commercial_break", "Commercial Break", [
      at(0, overlay({ displayRole: "PROJECTED_TICKER" }, { kind: "banner", text: "BREAK", subtext: "{{game.away}} {{game.awayScore}} · {{game.home}} {{game.homeScore}}", color: "#9ca3af", durationMs: 4000 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(0, cmd(g("ambient"), { type: "set_brightness", brightness: 50 })),
      at(0, cmd(g("accent"), { type: "set_brightness", brightness: 25 })),
    ], { forEvents: ["COMMERCIAL_BREAK"] }),
    fx("fx_return_to_game", "Return to Game", [
      at(0, cmd(g("ambient"), { type: "set_brightness", brightness: 25 })),
      at(0, cmd(g("accent"), { type: "set_brightness", brightness: 45 })),
      at(0, cmd(g("tv_bias"), { type: "set_color", color: "{{team.primary}}", transitionMs: 1500 })),
      at(0, cmd(g("room_leds"), { type: "set_color", color: "{{team.secondary}}", transitionMs: 1500 })),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "kickoff", intensity: 40, durationMs: 1500 })),
    ], { forEvents: ["RETURN_TO_GAME"] }),
  ];
}

/** Room-setup scenes for the added modes. Not fx: they set the room, they are not effects. */
export function modeScenes(ROOM: string): Scene[] {
  return [
    // Talk show / podcast: comfortable and still. Sports celebrations suppressed; buttons on the Live page for laughs.
    { id: "scene_talk_show", roomId: ROOM, name: "Talk Show", mode: "TALK_SHOW", suppressSportsAutomations: true, actions: [
      at(0, cmd(d("tv_sony"), { type: "power_on" })),
      at(300, cmd(d("tv_sony"), { type: "set_input", input: "appletv" })),
      at(0, cmd(d("avr"), { type: "power_on" })),
      at(500, cmd(d("avr"), { type: "set_input", input: "appletv" })),
      at(800, cmd(d("avr"), { type: "set_volume", volume: 32 })),
      at(600, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(700, cmd(g("tv_bias"), { type: "set_color", color: "#f4efe6", transitionMs: 2000 })),
      at(700, cmd(g("tv_bias"), { type: "set_brightness", brightness: 12 })),
      at(700, cmd(g("towers"), { type: "set_color", color: "#7c9cff", transitionMs: 2000 })),
      at(700, cmd(g("towers"), { type: "set_brightness", brightness: 8 })),
      at(700, cmd(g("room_leds_low"), { type: "set_color", color: "#ffb86b", transitionMs: 2000 })),
      at(700, cmd(g("room_leds_low"), { type: "set_brightness", brightness: 5 })),
      at(700, cmd(g("stadium_upper"), { type: "power_off" })),
      at(700, cmd(g("dmx"), { type: "fixture", op: "blackout" })),
      at(700, cmd(g("tactile"), { type: "tactile", pattern: "stop" })),
      at(700, cmd(g("ambient"), { type: "set_brightness", brightness: 30 })),
      at(1000, cmd(g("aux"), { type: "power_off" })),
      at(1000, cmd(d("projector_ribbon"), { type: "power_off" })),
    ] },
    // Concert / music video: warm venue look, team logic off, towers and halo carry the energy. Audio-reactive layer lands with the shakers.
    { id: "scene_concert", roomId: ROOM, name: "Concert", mode: "MUSIC_VIDEO", suppressSportsAutomations: true, actions: [
      at(0, cmd(d("tv_sony"), { type: "power_on" })),
      at(300, cmd(d("tv_sony"), { type: "set_input", input: "appletv" })),
      at(0, cmd(d("avr"), { type: "power_on" })),
      at(500, cmd(d("avr"), { type: "set_input", input: "appletv" })),
      at(800, cmd(d("avr"), { type: "set_volume", volume: 48 })),
      at(600, cmd(g("accent"), { type: "effect", effect: "off" })),
      at(700, cmd(g("tv_bias"), { type: "set_color", color: "#ffb86b", transitionMs: 2000 })),
      at(700, cmd(g("tv_bias"), { type: "set_brightness", brightness: 30 })),
      at(700, cmd(g("towers"), { type: "effect", effect: "breathe", colors: ["#ff9f43", "#ffd9a0"], durationMs: 0 })),
      at(700, cmd(g("towers"), { type: "set_brightness", brightness: 35 })),
      at(700, cmd(g("stadium_upper"), { type: "set_color", color: "#ff9f43", transitionMs: 2000 })),
      at(700, cmd(g("stadium_upper"), { type: "set_brightness", brightness: 40 })),
      at(700, cmd(g("room_leds_low"), { type: "set_color", color: "#ffb86b", transitionMs: 2000 })),
      at(700, cmd(g("room_leds_low"), { type: "set_brightness", brightness: 12 })),
      at(700, cmd(g("lamps"), { type: "set_color", color: "#ffd9a0", transitionMs: 2000 })),
      at(700, cmd(g("lamps"), { type: "set_brightness", brightness: 20 })),
      at(700, cmd(g("ambient"), { type: "set_brightness", brightness: 10 })),
      at(700, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "#ff9f43", intensity: 30 })),
      at(1000, cmd(g("aux"), { type: "power_off" })),
      at(1000, cmd(d("projector_ribbon"), { type: "power_off" })),
    ] },
    { id: "scene_gaming", roomId: ROOM, name: "Gaming", mode: "GAMING", actions: [
      at(0, cmd(d("tv_sony"), { type: "power_on" })),
      at(300, cmd(d("tv_sony"), { type: "set_input", input: "receiver" })),
      at(0, cmd(d("avr"), { type: "power_on" })),
      at(500, cmd(d("avr"), { type: "set_input", input: "game" })),
      at(800, cmd(d("avr"), { type: "set_volume", volume: 42 })),
      at(600, cmd(g("accent"), { type: "power_on" })),
      at(900, cmd(g("accent"), { type: "effect", effect: "breathe", colors: ["#7c3aed", "#06b6d4"], durationMs: 0 })),
      at(900, cmd(g("accent"), { type: "set_brightness", brightness: 35 })),
      at(900, cmd(g("ambient"), { type: "set_brightness", brightness: 12 })),
      at(1000, cmd(g("aux"), { type: "power_on" })),
      at(1500, cmd(g("aux"), { type: "set_input", input: "browser" })),
      at(1600, { preset: "preset_nfl" } as SceneAction["action"]),
    ] },
    { id: "scene_chill", roomId: ROOM, name: "Chill", mode: "CHILL", actions: [
      at(0, cmd(g("sports_wall"), { type: "power_off" })),
      at(0, cmd(d("avr"), { type: "power_on" })),
      at(400, cmd(d("avr"), { type: "set_input", input: "music" })),
      at(600, cmd(d("avr"), { type: "set_volume", volume: 28 })),
      at(200, cmd(g("ambient"), { type: "set_color", color: "#ffb86b", transitionMs: 3000 })),
      at(200, cmd(g("ambient"), { type: "set_brightness", brightness: 35 })),
      at(300, cmd(g("accent"), { type: "effect", effect: "breathe", colors: ["#ff9f43", "#c084fc"], durationMs: 0 })),
      at(300, cmd(g("accent"), { type: "set_brightness", brightness: 18 })),
      at(500, cmd(d("projector_ribbon"), { type: "power_on" })),
      at(1000, { roleAssignment: { displayId: "disp_projector", role: "AMBIENT" } } as SceneAction["action"]),
    ] },
  ];
}

/**
 * Event wiring for moments the original automations do not cover. Each one waits for the
 * broadcast delay and runs the matching scene; the scene carries the choreography.
 */
export function experienceAutomations(ROOM: string): Automation[] {
  const wire = (id: string, name: string, sceneId: string, eventTypes: Automation["trigger"]["eventTypes"], extra: Partial<Automation> & { teams?: string[]; condition?: Parameters<typeof cond>[0] } = {}): Automation => {
    const { teams, condition, ...rest } = extra;
    const steps: Automation["steps"] = [{ kind: "wait", ms: "broadcast_delay", label: "Wait for the TV" }];
    steps.push(condition ? { kind: "if", condition, then: [{ kind: "scene", sceneId }] } : { kind: "scene", sceneId });
    return { id, roomId: ROOM, name, enabled: true, trigger: { eventTypes, teams, watchedGamesOnly: true, manual: true }, steps, ...rest };
  };
  const cond = (c: Automation["steps"][number] extends { kind: "if"; condition: infer C } ? C : never) => c;
  return [
    wire("auto_fx_game_start", "Game start", "fx_game_start", ["GAME_START"], { cooldownMs: 60_000 }),
    wire("auto_fx_kickoff", "Kickoff", "fx_kickoff", ["KICKOFF"], { cooldownMs: 30_000 }),
    wire("auto_fx_big_play", "Big play", "fx_big_play", ["BIG_PLAY"], { teams: ["@favorites"], cooldownMs: 20_000 }),
    // Pressure: a high-leverage down (red zone, clutch) gets the tightening scene; an ordinary one gets the subtle pulse.
    { id: "auto_fx_third_down", version: 2, roomId: ROOM, name: "Third down", enabled: true, cooldownMs: 15_000, trigger: { eventTypes: ["THIRD_DOWN"], teams: ["@favorites"], watchedGamesOnly: true, manual: true },
      steps: [{ kind: "wait", ms: "broadcast_delay" }, { kind: "if", condition: { minPressure: 0.6 }, then: [{ kind: "scene", sceneId: "fx_pressure" }], else: [{ kind: "scene", sceneId: "fx_third_down" }] }] },
    { id: "auto_fx_fourth_down", version: 2, roomId: ROOM, name: "Fourth down", enabled: true, cooldownMs: 15_000, trigger: { eventTypes: ["FOURTH_DOWN"], teams: ["@favorites"], watchedGamesOnly: true, manual: true },
      steps: [{ kind: "wait", ms: "broadcast_delay" }, { kind: "if", condition: { minPressure: 0.6 }, then: [{ kind: "scene", sceneId: "fx_pressure" }], else: [{ kind: "scene", sceneId: "fx_fourth_down" }] }] },
    wire("auto_fx_pick_six", "Pick six", "fx_pick_six", ["PICK_SIX"], { teams: ["@favorites"], cooldownMs: 20_000 }),
    wire("auto_fx_fourth_down_stop", "Fourth-down stop", "fx_fourth_down_stop", ["FOURTH_DOWN_STOP"], { teams: ["@favorites"], cooldownMs: 20_000 }),
    wire("auto_fx_missed_fg", "Opponent misses a field goal", "fx_missed_field_goal", ["MISSED_FIELD_GOAL"], { teams: ["@opponents"], cooldownMs: 20_000 }),
    wire("auto_fx_blocked_kick", "Blocked kick", "fx_blocked_kick", ["BLOCKED_KICK"], { teams: ["@favorites"], cooldownMs: 20_000 }),
    // Multi-game arbiter: a favorite scoring in a secondary watched game gets the screens, not the room.
    { id: "auto_fx_secondary_score", roomId: ROOM, name: "Other game: favorite scores", enabled: true, cooldownMs: 8_000, trigger: { eventTypes: ["TOUCHDOWN", "FIELD_GOAL", "HOME_RUN", "WIN", "LEAD_CHANGE"], teams: ["@favorites"], watchedGamesOnly: true, manual: false, games: "secondary" },
      steps: [{ kind: "wait", ms: "broadcast_delay" }, { kind: "scene", sceneId: "fx_secondary_score" }] },
    wire("auto_fx_sack", "Sack", "fx_sack", ["SACK"], { teams: ["@favorites"], cooldownMs: 15_000 }),
    wire("auto_fx_halftime", "Halftime", "fx_halftime", ["HALFTIME"], { cooldownMs: 120_000 }),
    wire("auto_fx_overtime", "Overtime", "fx_overtime", ["OVERTIME"], { cooldownMs: 60_000 }),
    wire("auto_fx_two_minute", "Two-minute warning", "fx_two_minute", ["TWO_MINUTE"], { cooldownMs: 60_000 }),
    wire("auto_fx_commercial", "Commercial break", "fx_commercial_break", ["COMMERCIAL_BREAK"], { cooldownMs: 30_000 }),
    wire("auto_fx_return", "Back to the game", "fx_return_to_game", ["RETURN_TO_GAME"], { cooldownMs: 30_000 }),
    wire("auto_fx_first_down", "First down blink", "fx_first_down", ["FIRST_DOWN"], { teams: ["@favorites"], cooldownMs: 8_000, enabled: false }),
  ];
}

/** Rival abbreviations per favorite: a game against one of these runs hotter. */
export const DEFAULT_RIVALS = ["LSU", "MSST", "ALA", "ATL", "TB", "LAD"];

export const DEFAULT_TEAMS: TeamExperience[] = [
  { abbr: "MISS", name: "Ole Miss", audio: { score: "miss_celebration", bigPlay: "big_play", win: "miss_celebration" } },
  { abbr: "NO", name: "Saints", audio: { score: "no_celebration", bigPlay: "big_play", win: "no_celebration" } },
  { abbr: "SD", name: "Padres", audio: { score: "sd_celebration", bigPlay: "big_play", win: "sd_celebration" } },
];

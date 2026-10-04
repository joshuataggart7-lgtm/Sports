/**
 * The default room from the brief: one Sony TV, two auxiliary TVs, a desk ultrawide,
 * a ceiling projector with a motorized screen, an AV receiver, bias lights and room LEDs.
 * Every device here is SIMULATED until a real driver claims it.
 */
import { DEFAULT_TICKER, pairingCode, type Automation, type BroadcastDelayProfile, type DisplayDevice, type DisplayPreset, type Room, type RoomDevice, type Scene } from "@room/core";
import type { RoomData } from "./store";

const ROOM = "room_main";

function dev(id: string, type: RoomDevice["type"], name: string, caps: RoomDevice["capabilities"], extra: Partial<RoomDevice> = {}): RoomDevice {
  return { id, roomId: ROOM, type, name, capabilities: caps, driver: "mock", status: "SIMULATED", state: { power: "off", updatedAt: Date.now() }, ...extra };
}

export function seedRoom(): RoomData {
  // Josh's room, from the labels: Sony KD-70X690E (Bravia IP control), TCL 43S431 and an
  // Element Roku TV (Roku ECP), XGIMI Horizon Pro (movies) and XGIMI MoGo 2 Plus (ribbon),
  // both Android TV over ADB, an Onkyo receiver (eISCP). Hosts are filled in from Settings.
  const devices: RoomDevice[] = [
    dev("tv_sony", "television", "Sony 70\" (KD-70X690E)", ["power", "input", "volume"], { driver: "bravia", driverConfig: { host: "", psk: "" }, inputs: { appletv: "1", receiver: "1", browser: "3" }, groups: ["sports_wall"], position: { x: 0.5, y: 0.22, w: 0.3, h: 0.17 } }),
    dev("tv_left", "television", "Left TV (TCL 43S431 Roku)", ["power", "input", "volume"], { driver: "roku", driverConfig: { host: "" }, inputs: { browser: "tvinput.hdmi1", cable: "tvinput.hdmi2", antenna: "tvinput.dtv" }, groups: ["sports_wall", "aux"], position: { x: 0.17, y: 0.25, w: 0.2, h: 0.12 } }),
    dev("tv_right", "television", "Right TV (Element Roku)", ["power", "input", "volume"], { driver: "roku", driverConfig: { host: "" }, inputs: { browser: "tvinput.hdmi1", cable: "tvinput.hdmi2", antenna: "tvinput.dtv" }, groups: ["sports_wall", "aux"], position: { x: 0.83, y: 0.25, w: 0.2, h: 0.12 } }),
    dev("desk_ultrawide", "monitor", "Desk Ultrawide 49\"", ["power", "input", "url"], { groups: ["desk"], position: { x: 0.22, y: 0.85, w: 0.3, h: 0.08 } }),
    dev("projector_ribbon", "projector", "Ribbon Projector (XGIMI MoGo 2 Plus)", ["power", "input", "url"], { driver: "androidtv", driverConfig: { host: "" }, inputs: { ribbon: "hdmi1" }, position: { x: 0.5, y: 0.58, w: 0.06, h: 0.04 } }),
    dev("projector", "projector", "Movie Projector (XGIMI Horizon Pro)", ["power", "input", "url"], { driver: "androidtv", driverConfig: { host: "" }, inputs: { appletv: "hdmi1", receiver: "hdmi1", ribbon: "hdmi2" }, position: { x: 0.5, y: 0.5, w: 0.08, h: 0.05 } }),
    dev("screen", "projector_screen", "Motorized Screen", ["screen_position"], { position: { x: 0.5, y: 0.12, w: 0.5, h: 0.03 } }),
    dev("avr", "av_receiver", "Onkyo Receiver", ["power", "input", "volume", "audio_playback"], { driver: "onkyo", driverConfig: { host: "" }, inputs: { appletv: "10", game: "02", tv_arc: "12", music: "2B" }, position: { x: 0.5, y: 0.42, w: 0.16, h: 0.05 } }),
    dev("bias_lights", "light", "TV Bias Lights (WLED)", ["power", "brightness", "color", "effect"], { driver: "wled", driverConfig: { host: "" }, groups: ["tv_bias", "accent"], position: { x: 0.5, y: 0.3, w: 0.32, h: 0.02 } }),
    dev("room_leds", "light", "Wall LED Strip (WLED)", ["power", "brightness", "color", "effect"], { driver: "wled", driverConfig: { host: "" }, groups: ["room_leds", "accent"], position: { x: 0.5, y: 0.05, w: 0.9, h: 0.02 } }),
    dev("lamps", "light", "Ceiling Light", ["power", "brightness", "color"], { groups: ["ambient"], position: { x: 0.5, y: 0.7, w: 0.05, h: 0.05 } }),
    dev("desk_lamp", "light", "Desk Lamp", ["power", "brightness"], { groups: ["desk"], position: { x: 0.1, y: 0.8, w: 0.04, h: 0.04 } }),
    dev("appletv", "computer", "Apple TV", ["power"], { position: { x: 0.42, y: 0.42, w: 0.05, h: 0.03 } }),
    // Celebration effects. The speaker is the Mac's own audio output (free). The fog machine
    // and goal light are optional: a Shelly relay fires them for a moment, and the relay times
    // itself off so nothing can be left running.
    dev("fx_speaker", "speaker", "Celebration Speaker (Mac audio)", ["power", "audio_playback"], { driver: "localaudio", driverConfig: { volume: 80, host: "local" }, groups: ["fx"], position: { x: 0.3, y: 0.42, w: 0.04, h: 0.03 } }),
    dev("fx_fog", "smart_plug", "Fog Machine Trigger (Shelly)", ["power", "momentary"], { driver: "shelly", driverConfig: { host: "" }, groups: ["fx", "fog"], position: { x: 0.9, y: 0.35, w: 0.04, h: 0.03 } }),
    dev("fx_goal_light", "smart_plug", "Goal Light (Shelly plug)", ["power", "momentary"], { driver: "shelly", driverConfig: { host: "" }, groups: ["fx", "goal_light"], position: { x: 0.1, y: 0.35, w: 0.04, h: 0.03 } }),
  ];
  // Devices without a host yet run on the mock driver so every scene still completes; the
  // real driver takes over the moment a host is entered in Settings.
  for (const d of devices) if (d.driver !== "mock" && d.driver !== "localaudio" && !d.driverConfig?.host) { d.driverConfig = { ...d.driverConfig, intendedDriver: d.driver }; d.driver = "mock"; }

  const displays: DisplayDevice[] = [
    { id: "disp_sony", roomId: ROOM, name: "Sony TV", deviceId: "tv_sony", role: "MAIN_GAME", pairingCode: pairingCode(), paired: false, position: { x: 34, y: 22, w: 32, h: 20 }, kind: "tv" },
    { id: "disp_left", roomId: ROOM, name: "Left TV", deviceId: "tv_left", role: "PLAYER_STATS", pairingCode: pairingCode(), paired: false, position: { x: 8, y: 24, w: 22, h: 13 }, kind: "tv" },
    { id: "disp_right", roomId: ROOM, name: "Right TV", deviceId: "tv_right", role: "LEAGUE_SCORES", pairingCode: pairingCode(), paired: false, position: { x: 70, y: 24, w: 22, h: 13 }, kind: "tv" },
    { id: "disp_desk", roomId: ROOM, name: "Desk Ultrawide", deviceId: "desk_ultrawide", role: "ROOM_STATUS", pairingCode: pairingCode(), paired: false, position: { x: 4, y: 72, w: 26, h: 9 }, kind: "ultrawide" },
    { id: "disp_projector", roomId: ROOM, name: "Projector", deviceId: "projector_ribbon", role: "PROJECTED_TICKER", roleOptions: { ticker: { ...DEFAULT_TICKER } }, pairingCode: pairingCode(), paired: false, position: { x: 8, y: 8, w: 84, h: 7 }, kind: "projector" },
  ];

  const presets: DisplayPreset[] = [
    { id: "preset_cfb", roomId: ROOM, name: "Game Day", assignments: [{ displayId: "disp_sony", role: "MAIN_GAME" }, { displayId: "disp_left", role: "PLAYER_STATS" }, { displayId: "disp_right", role: "LEAGUE_SCORES" }, { displayId: "disp_desk", role: "SCOREBOARD" }, { displayId: "disp_projector", role: "PROJECTED_TICKER" }] },
    { id: "preset_nfl", roomId: ROOM, name: "Multiview Sunday", assignments: [{ displayId: "disp_sony", role: "MAIN_GAME" }, { displayId: "disp_left", role: "SECOND_GAME" }, { displayId: "disp_right", role: "PLAYER_STATS" }, { displayId: "disp_desk", role: "LEAGUE_SCORES" }, { displayId: "disp_projector", role: "PROJECTED_TICKER" }] },
    { id: "preset_movie", roomId: ROOM, name: "Movie Night", assignments: [{ displayId: "disp_sony", role: "OFF" }, { displayId: "disp_left", role: "OFF" }, { displayId: "disp_right", role: "OFF" }, { displayId: "disp_desk", role: "OFF" }, { displayId: "disp_projector", role: "MOVIE_INFO" }] },
    { id: "preset_fantasy", roomId: ROOM, name: "Fantasy Command Center", assignments: [{ displayId: "disp_sony", role: "MAIN_GAME" }, { displayId: "disp_left", role: "FANTASY" }, { displayId: "disp_right", role: "PLAYER_STATS" }, { displayId: "disp_desk", role: "FANTASY" }, { displayId: "disp_projector", role: "PROJECTED_TICKER" }] },
    { id: "preset_work", roomId: ROOM, name: "Work", assignments: [{ displayId: "disp_sony", role: "OFF" }, { displayId: "disp_left", role: "OFF" }, { displayId: "disp_right", role: "SCOREBOARD" }, { displayId: "disp_desk", role: "OFF" }, { displayId: "disp_projector", role: "OFF" }] },
  ];

  const g = (group: string) => ({ group });
  const d = (device: string) => ({ device });
  const scenes: Scene[] = [
    { id: "scene_sports", roomId: ROOM, name: "Sports", mode: "SPORTS", actions: [
      { delayMs: 0, label: "Screen up", action: { target: d("screen"), command: { type: "screen_up" } } },
      { delayMs: 0, action: { target: d("tv_sony"), command: { type: "power_on" } } },
      { delayMs: 300, action: { target: d("tv_sony"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 400, action: { target: g("aux"), command: { type: "power_on" } } },
      { delayMs: 900, action: { target: g("aux"), command: { type: "set_input", input: "browser" } } },
      { delayMs: 1000, label: "Ribbon projector on, movie projector off", action: { target: d("projector_ribbon"), command: { type: "power_on" } } },
      { delayMs: 1500, action: { target: d("projector_ribbon"), command: { type: "set_input", input: "ribbon" } } },
      { delayMs: 1000, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 500, action: { target: d("avr"), command: { type: "power_on" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_volume", volume: 38 } } },
      { delayMs: 1200, action: { target: g("accent"), command: { type: "power_on" } } },
      { delayMs: 1300, action: { target: g("accent"), command: { type: "set_brightness", brightness: 45 } } },
      { delayMs: 1300, action: { target: g("ambient"), command: { type: "set_brightness", brightness: 30 } } },
      { delayMs: 1600, action: { preset: "preset_cfb" } },
    ] },
    { id: "scene_game_day", roomId: ROOM, name: "Game Day", mode: "GAME_DAY", actions: [
      { delayMs: 0, action: { target: d("screen"), command: { type: "screen_up" } } },
      { delayMs: 0, action: { target: d("tv_sony"), command: { type: "power_on" } } },
      { delayMs: 300, action: { target: d("tv_sony"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 400, action: { target: g("aux"), command: { type: "power_on" } } },
      { delayMs: 900, action: { target: g("aux"), command: { type: "set_input", input: "browser" } } },
      { delayMs: 1000, action: { target: d("projector_ribbon"), command: { type: "power_on" } } },
      { delayMs: 1500, action: { target: d("projector_ribbon"), command: { type: "set_input", input: "ribbon" } } },
      { delayMs: 1000, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 500, action: { target: d("avr"), command: { type: "power_on" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_volume", volume: 40 } } },
      { delayMs: 1200, label: "Team palette", action: { target: g("accent"), command: { type: "power_on" } } },
      { delayMs: 1300, action: { target: d("bias_lights"), command: { type: "set_color", color: "{{team.primary}}", transitionMs: 1500 } } },
      { delayMs: 1300, action: { target: d("room_leds"), command: { type: "set_color", color: "{{team.secondary}}", transitionMs: 1500 } } },
      { delayMs: 1300, action: { target: g("ambient"), command: { type: "set_brightness", brightness: 25 } } },
      { delayMs: 1600, action: { preset: "preset_cfb" } },
      { delayMs: 2000, action: { target: { all: true }, overlay: { kind: "banner", text: "GAME DAY", subtext: "{{game.away}} at {{game.home}}", color: "{{team.primary}}", durationMs: 4000 } } },
    ] },
    { id: "scene_movie", roomId: ROOM, name: "Movie", mode: "MOVIE", suppressSportsAutomations: true, actions: [
      { delayMs: 0, label: "Dim first, then move the screen", action: { target: g("ambient"), command: { type: "set_brightness", brightness: 10 } } },
      { delayMs: 0, action: { target: g("accent"), command: { type: "set_brightness", brightness: 5 } } },
      { delayMs: 200, action: { target: d("screen"), command: { type: "screen_down" } } },
      { delayMs: 300, action: { target: g("aux"), command: { type: "power_off" } } },
      { delayMs: 300, action: { target: d("tv_sony"), command: { type: "power_off" } } },
      { delayMs: 300, action: { target: d("projector_ribbon"), command: { type: "power_off" } } },
      { delayMs: 500, label: "Movie projector warms up while the screen drops", action: { target: d("projector"), command: { type: "power_on" } } },
      { delayMs: 1000, action: { target: d("projector"), command: { type: "set_input", input: "receiver" } } },
      { delayMs: 500, action: { target: d("avr"), command: { type: "power_on" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 800, action: { target: d("avr"), command: { type: "set_volume", volume: 45 } } },
      { delayMs: 1200, action: { preset: "preset_movie" } },
      { delayMs: 8000, label: "Theater scene", action: { target: g("ambient"), command: { type: "set_brightness", brightness: 0 } } },
    ] },
    { id: "scene_multiview", roomId: ROOM, name: "Multiview", mode: "MULTIVIEW", actions: [
      { delayMs: 0, action: { target: d("screen"), command: { type: "screen_up" } } },
      { delayMs: 0, action: { target: g("sports_wall"), command: { type: "power_on" } } },
      { delayMs: 500, action: { target: g("aux"), command: { type: "set_input", input: "browser" } } },
      { delayMs: 500, action: { target: d("tv_sony"), command: { type: "set_input", input: "appletv" } } },
      { delayMs: 800, action: { target: d("projector_ribbon"), command: { type: "power_on" } } },
      { delayMs: 1300, action: { target: d("projector_ribbon"), command: { type: "set_input", input: "ribbon" } } },
      { delayMs: 800, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 600, action: { target: d("avr"), command: { type: "power_on" } } },
      { delayMs: 1200, action: { target: g("accent"), command: { type: "set_brightness", brightness: 40 } } },
      { delayMs: 1500, action: { preset: "preset_nfl" } },
    ] },
    { id: "scene_work", roomId: ROOM, name: "Work", mode: "WORK", actions: [
      { delayMs: 0, action: { target: g("sports_wall"), command: { type: "power_off" } } },
      { delayMs: 0, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 0, action: { target: d("projector_ribbon"), command: { type: "power_off" } } },
      { delayMs: 0, action: { target: d("avr"), command: { type: "power_off" } } },
      { delayMs: 200, action: { target: d("desk_ultrawide"), command: { type: "power_on" } } },
      { delayMs: 200, action: { target: g("desk"), command: { type: "power_on" } } },
      { delayMs: 300, action: { target: g("ambient"), command: { type: "set_color", color: "#f4efe6", transitionMs: 2000 } } },
      { delayMs: 300, action: { target: g("ambient"), command: { type: "set_brightness", brightness: 70 } } },
      { delayMs: 300, action: { target: g("accent"), command: { type: "power_off" } } },
      { delayMs: 500, action: { preset: "preset_work" } },
      { delayMs: 600, label: "Score widget on the right TV only", action: { target: d("tv_right"), command: { type: "power_on" } } },
    ] },
    { id: "scene_party", roomId: ROOM, name: "Party", mode: "PARTY", actions: [
      { delayMs: 0, action: { target: d("avr"), command: { type: "power_on" } } },
      { delayMs: 300, action: { target: d("avr"), command: { type: "set_input", input: "music" } } },
      { delayMs: 300, action: { target: d("avr"), command: { type: "set_volume", volume: 50 } } },
      { delayMs: 0, action: { target: g("accent"), command: { type: "power_on" } } },
      { delayMs: 400, action: { target: g("accent"), command: { type: "effect", effect: "breathe", colors: ["#ff2d55", "#5856d6", "#34c759"], durationMs: 0 } } },
      { delayMs: 400, action: { target: g("ambient"), command: { type: "set_brightness", brightness: 20 } } },
      { delayMs: 600, action: { target: g("sports_wall"), command: { type: "power_on" } } },
      { delayMs: 1000, action: { preset: "preset_nfl" } },
      { delayMs: 1200, action: { target: d("desk_ultrawide"), command: { type: "power_off" } } },
    ] },
    { id: "scene_ambient", roomId: ROOM, name: "Ambient", mode: "AMBIENT", actions: [
      { delayMs: 0, action: { target: g("sports_wall"), command: { type: "power_off" } } },
      { delayMs: 0, action: { target: d("avr"), command: { type: "power_off" } } },
      { delayMs: 200, action: { target: d("projector_ribbon"), command: { type: "power_on" } } },
      { delayMs: 700, action: { target: d("projector_ribbon"), command: { type: "set_input", input: "ribbon" } } },
      { delayMs: 200, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 300, action: { target: g("ambient"), command: { type: "set_brightness", brightness: 35 } } },
      { delayMs: 300, action: { target: g("accent"), command: { type: "set_brightness", brightness: 15 } } },
      { delayMs: 800, action: { roleAssignment: { displayId: "disp_projector", role: "AMBIENT" } } },
    ] },
    { id: "scene_all_off", roomId: ROOM, name: "All Off", mode: "ALL_OFF", actions: [
      { delayMs: 0, label: "Sources first, then displays, then the screen, then lights", action: { target: d("avr"), command: { type: "set_volume", volume: 0 } } },
      { delayMs: 300, action: { target: d("avr"), command: { type: "power_off" } } },
      { delayMs: 500, action: { target: g("sports_wall"), command: { type: "power_off" } } },
      { delayMs: 500, action: { target: d("desk_ultrawide"), command: { type: "power_off" } } },
      { delayMs: 800, action: { target: d("projector"), command: { type: "power_off" } } },
      { delayMs: 800, action: { target: d("projector_ribbon"), command: { type: "power_off" } } },
      { delayMs: 3000, label: "Projectors cool before the screen moves", action: { target: d("screen"), command: { type: "screen_up" } } },
      { delayMs: 1200, action: { target: g("accent"), command: { type: "power_off" } } },
      { delayMs: 1500, action: { target: g("ambient"), command: { type: "power_off" } } },
      { delayMs: 1500, action: { target: g("desk"), command: { type: "power_off" } } },
    ] },
  ];

  const automations: Automation[] = [
    { id: "auto_touchdown", roomId: ROOM, name: "Touchdown celebration", enabled: true, cooldownMs: 15_000,
      trigger: { eventTypes: ["TOUCHDOWN"], teams: ["MISS"], watchedGamesOnly: true, manual: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay", label: "Wait for the TV to catch up" },
        { kind: "do", label: "Choreographed celebration", actions: [
          { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "celebration", text: "TOUCHDOWN {{team.abbr}}", subtext: "{{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 8000 }, delayMs: 0 },
          { target: { group: "tv_bias" }, command: { type: "effect", effect: "flash", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 3000 }, delayMs: 200 },
          { target: { group: "room_leds" }, command: { type: "effect", effect: "pulse", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 5000 }, delayMs: 500 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "touchdown", volume: 85 }, delayMs: 300 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "{{team.audio}}", volume: 80 }, delayMs: 2600 },
          { target: { group: "goal_light" }, command: { type: "pulse", durationMs: 8000 }, delayMs: 400 },
          { target: { group: "fog" }, command: { type: "pulse", durationMs: 1500 }, delayMs: 800 },
          { target: { all: true }, overlay: { kind: "celebration", text: "TOUCHDOWN", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 6000 }, delayMs: 150 },
        ] },
        { kind: "wait", ms: 8000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_field_goal", roomId: ROOM, name: "Field goal", enabled: true, cooldownMs: 10_000,
      trigger: { eventTypes: ["FIELD_GOAL"], teams: ["MISS"], watchedGamesOnly: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "do", actions: [
          { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "banner", text: "FIELD GOAL {{team.abbr}}", subtext: "{{event.score}}", color: "{{team.primary}}", durationMs: 5000 } },
          { target: { all: true }, overlay: { kind: "banner", text: "FIELD GOAL", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", logoUrl: "{{team.logo}}", durationMs: 5000 }, delayMs: 150 },
          { target: { group: "tv_bias" }, command: { type: "effect", effect: "pulse", colors: ["{{team.primary}}"], durationMs: 2500 }, delayMs: 200 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "field_goal", volume: 75 }, delayMs: 300 },
        ] },
        { kind: "wait", ms: 4000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_opponent_score", roomId: ROOM, name: "Opponent scores", enabled: true, cooldownMs: 10_000,
      trigger: { eventTypes: ["TOUCHDOWN", "FIELD_GOAL"], teams: ["LSU", "ALA", "UGA"], watchedGamesOnly: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "do", actions: [{ target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "banner", text: "{{event.text}}", color: "#8a93a6", durationMs: 4000 } }] },
      ] },
    { id: "auto_red_zone", roomId: ROOM, name: "Red zone alert", enabled: true, cooldownMs: 30_000,
      trigger: { eventTypes: ["RED_ZONE"], watchedGamesOnly: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "do", actions: [
          { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "alert", text: "RED ZONE", subtext: "{{team.abbr}} {{event.yard}}", color: "#ff3b30", durationMs: 4000 } },
          { target: { group: "tv_bias" }, command: { type: "effect", effect: "breathe", colors: ["#ff3b30"], durationMs: 6000 }, delayMs: 100 },
        ] },
        { kind: "wait", ms: 6000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_turnover", roomId: ROOM, name: "Defense takes it away", enabled: true, cooldownMs: 15_000,
      trigger: { eventTypes: ["TURNOVER", "DEFENSE"], teams: ["MISS"], watchedGamesOnly: true, manual: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "do", actions: [
          { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "banner", text: "TAKEAWAY", subtext: "{{event.text}}", color: "{{team.secondary}}", durationMs: 5000 } },
          { target: { all: true }, overlay: { kind: "alert", text: "TAKEAWAY", subtext: "{{event.text}}", color: "{{team.primary}}", durationMs: 5000 }, delayMs: 150 },
          { target: { group: "room_leds" }, command: { type: "effect", effect: "chase", colors: ["{{team.secondary}}", "{{team.primary}}"], durationMs: 4000 }, delayMs: 300 },
        ] },
        { kind: "wait", ms: 5000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_padres_run", roomId: ROOM, name: "Padres score", enabled: true, cooldownMs: 8_000,
      trigger: { eventTypes: ["SCORE_CHANGE"], teams: ["SD"], watchedGamesOnly: true, manual: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "if", condition: { minPoints: 2 }, then: [
          { kind: "do", label: "Big inning", actions: [
            { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "celebration", text: "PADRES SCORE {{event.points}}", subtext: "{{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 7000 } },
            { target: { all: true }, overlay: { kind: "celebration", text: "{{event.points}} RUNS SCORE", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 6000 }, delayMs: 150 },
            { target: { group: "accent" }, command: { type: "effect", effect: "flash", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 4000 }, delayMs: 200 },
            { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "celebration", volume: 80 }, delayMs: 300 },
            { target: { group: "goal_light" }, command: { type: "pulse", durationMs: 6000 }, delayMs: 400 },
          ] },
        ], else: [
          { kind: "do", actions: [
            { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "banner", text: "PADRES SCORE", subtext: "{{event.score}}", color: "{{team.primary}}", durationMs: 5000 } },
            { target: { all: true }, overlay: { kind: "banner", text: "RUN SCORES", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", logoUrl: "{{team.logo}}", durationMs: 5000 }, delayMs: 150 },
            { target: { group: "tv_bias" }, command: { type: "effect", effect: "pulse", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 3000 }, delayMs: 200 },
            { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "field_goal", volume: 70 }, delayMs: 300 },
          ] },
        ] },
        { kind: "wait", ms: 5000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_home_run", roomId: ROOM, name: "Home run", enabled: true, cooldownMs: 8_000,
      trigger: { eventTypes: ["HOME_RUN"], teams: ["SD"], watchedGamesOnly: true, manual: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "do", label: "Home run choreography", actions: [
          { target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "celebration", text: "HOME RUN {{team.abbr}}", subtext: "{{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 8000 }, delayMs: 0 },
          { target: { all: true }, overlay: { kind: "celebration", text: "HOME RUN", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 6000 }, delayMs: 150 },
          { target: { group: "tv_bias" }, command: { type: "effect", effect: "flash", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 3000 }, delayMs: 200 },
          { target: { group: "room_leds" }, command: { type: "effect", effect: "chase", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 6000 }, delayMs: 500 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "touchdown", volume: 85 }, delayMs: 300 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "{{team.audio}}", volume: 80 }, delayMs: 2600 },
          { target: { group: "goal_light" }, command: { type: "pulse", durationMs: 8000 }, delayMs: 400 },
          { target: { group: "fog" }, command: { type: "pulse", durationMs: 1500 }, delayMs: 800 },
        ] },
        { kind: "wait", ms: 8000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_final", roomId: ROOM, name: "Final score", enabled: true,
      trigger: { eventTypes: ["GAME_END", "WIN", "LOSS"], watchedGamesOnly: true },
      steps: [
        { kind: "wait", ms: "broadcast_delay" },
        { kind: "if", condition: { team: ["MISS", "SD", "NO"] }, then: [
          { kind: "do", actions: [
            { target: { all: true }, overlay: { kind: "celebration", text: "{{team.abbr}} WINS", subtext: "{{event.text}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 12000 } },
            { target: { group: "accent" }, command: { type: "effect", effect: "chase", colors: ["{{team.primary}}", "{{team.secondary}}", "#ffffff"], durationMs: 12000 }, delayMs: 300 },
            { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "{{team.audio}}", volume: 85 }, delayMs: 300 },
          ] },
          { kind: "wait", ms: 12000 },
          { kind: "restore", what: "lights" },
        ], else: [
          { kind: "do", actions: [{ target: { displayRole: "PROJECTED_TICKER" }, overlay: { kind: "banner", text: "FINAL", subtext: "{{event.text}}", color: "#ffffff", durationMs: 8000 } }] },
        ] },
      ] },
    { id: "auto_celebration", roomId: ROOM, name: "Manual celebration", enabled: true,
      trigger: { eventTypes: ["CELEBRATION"], watchedGamesOnly: false, manual: true },
      steps: [
        { kind: "do", actions: [
          { target: { all: true }, overlay: { kind: "celebration", text: "LET'S GO", color: "{{team.primary}}", durationMs: 6000 } },
          { target: { group: "accent" }, command: { type: "effect", effect: "flash", colors: ["{{team.primary}}", "{{team.secondary}}"], durationMs: 4000 }, delayMs: 200 },
          { target: { device: "fx_speaker" }, command: { type: "play_audio", clip: "celebration", volume: 80 }, delayMs: 300 },
          { target: { group: "goal_light" }, command: { type: "pulse", durationMs: 6000 }, delayMs: 300 },
        ] },
        { kind: "wait", ms: 6000 },
        { kind: "restore", what: "lights" },
      ] },
    { id: "auto_reset", roomId: ROOM, name: "Manual reset", enabled: true,
      trigger: { eventTypes: ["RESET"], watchedGamesOnly: false, manual: true },
      steps: [
        { kind: "do", actions: [{ target: { all: true }, overlay: { kind: "clear" } }, { target: { group: "accent" }, command: { type: "effect", effect: "off" } }] },
        { kind: "restore", what: "all" },
      ] },
  ];

  const delayProfiles: BroadcastDelayProfile[] = [
    { id: "delay_yttv_appletv", roomId: ROOM, name: "YouTube TV on Apple TV", source: "YouTube TV", app: "YouTube TV", deviceId: "appletv", delayMs: 24_000 },
    { id: "delay_ota", roomId: ROOM, name: "OTA antenna", source: "Antenna", delayMs: 5_000 },
    { id: "delay_espn_app", roomId: ROOM, name: "ESPN app", source: "ESPN", app: "ESPN", deviceId: "appletv", delayMs: 31_000 },
  ];

  const room: Room = { id: ROOM, name: "Game Room", timezone: "America/Chicago", mode: null, watchedGameIds: [], favoriteTeams: ["MISS", "SD", "NO"], activeDelayProfileId: "delay_yttv_appletv" };

  return { room, devices, displays, presets, scenes, automations, delayProfiles, timeline: [], runs: [] };
}

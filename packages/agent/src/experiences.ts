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
    fx("fx_touchdown", "Touchdown", [
      at(0, overlay(all, { kind: "celebration", text: "TOUCHDOWN", subtext: "{{team.name}}  ·  {{event.score}}", color: "{{team.primary}}", color2: "{{team.secondary}}", logoUrl: "{{team.logo}}", durationMs: 8000 }), "Screens"),
      at(0, cmd(g("accent"), { type: "effect", effect: "flash", colors: ["#ffffff", "{{team.primary}}"], durationMs: 900 }), "White flash"),
      at(0, cmd(g("tactile"), { type: "tactile", pattern: "impact", intensity: 85, durationMs: 400 }), "Couch hit"),
      at(150, cmd(g("dmx"), { type: "fixture", op: "beam_burst", color: "{{team.primary}}", intensity: 90, durationMs: 8000 }), "Beams"),
      at(350, cmd(d("fx_speaker"), { type: "play_audio", clip: "touchdown", volume: 90 }), "Horn"),
      at(350, cmd(g("horn"), { type: "pulse", durationMs: 2000 })),
      at(400, cmd(g("goal_light"), { type: "pulse", durationMs: 8000 })),
      at(700, cmd(g("tactile"), { type: "tactile", pattern: "doubleImpact", intensity: 80, durationMs: 700 })),
      at(800, cmd(g("fog"), { type: "pulse", durationMs: 1500 })),
      at(1000, cmd(g("accent"), { type: "effect", effect: "chase", colors: [...TEAM, "#ffffff"], durationMs: 7000 }), "Team chase"),
      at(1500, cmd(g("tactile"), { type: "tactile", pattern: "rumble", intensity: 55, durationMs: 3500 })),
      at(2600, cmd(d("fx_speaker"), { type: "play_audio", clip: "{{team.audio}}", volume: 85 }), "Fight song"),
      at(8500, cmd(g("accent"), { type: "set_color", color: "{{team.primary}}", transitionMs: 2500 }), "Back to game mode"),
      at(8500, cmd(g("dmx"), { type: "fixture", op: "set_color", color: "{{team.primary}}", intensity: 40 })),
    ], { forEvents: ["TOUCHDOWN"] }),
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

/** Room-setup scenes for the two modes the brief adds. Not fx: they set the room, they are not effects. */
export function modeScenes(ROOM: string): Scene[] {
  return [
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
    wire("auto_fx_third_down", "Third down pulse", "fx_third_down", ["THIRD_DOWN"], { teams: ["@favorites"], cooldownMs: 15_000 }),
    wire("auto_fx_fourth_down", "Fourth down", "fx_fourth_down", ["FOURTH_DOWN"], { teams: ["@favorites"], cooldownMs: 15_000 }),
    wire("auto_fx_sack", "Sack", "fx_sack", ["SACK"], { teams: ["@favorites"], cooldownMs: 15_000 }),
    wire("auto_fx_halftime", "Halftime", "fx_halftime", ["HALFTIME"], { cooldownMs: 120_000 }),
    wire("auto_fx_overtime", "Overtime", "fx_overtime", ["OVERTIME"], { cooldownMs: 60_000 }),
    wire("auto_fx_two_minute", "Two-minute warning", "fx_two_minute", ["TWO_MINUTE"], { cooldownMs: 60_000 }),
    wire("auto_fx_commercial", "Commercial break", "fx_commercial_break", ["COMMERCIAL_BREAK"], { cooldownMs: 30_000 }),
    wire("auto_fx_return", "Back to the game", "fx_return_to_game", ["RETURN_TO_GAME"], { cooldownMs: 30_000 }),
    wire("auto_fx_first_down", "First down blink", "fx_first_down", ["FIRST_DOWN"], { teams: ["@favorites"], cooldownMs: 8_000, enabled: false }),
  ];
}

export const DEFAULT_TEAMS: TeamExperience[] = [
  { abbr: "MISS", name: "Ole Miss", audio: { score: "miss_celebration", bigPlay: "big_play", win: "miss_celebration" } },
  { abbr: "NO", name: "Saints", audio: { score: "no_celebration", bigPlay: "big_play", win: "no_celebration" } },
  { abbr: "SD", name: "Padres", audio: { score: "sd_celebration", bigPlay: "big_play", win: "sd_celebration" } },
];

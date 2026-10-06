import { test } from "node:test";
import assert from "node:assert/strict";
import { Agent } from "../src/agent";
import { MockDriver } from "../src/drivers/mock";
import { seedRoom } from "../src/seed";
import type { RoomStore, RoomData } from "../src/store";
import { SimulatedProvider } from "@room/sports";

const GAME = "sim:ncaaf:LSU@MISS";
class MemStore implements RoomStore { kind = "LOCAL_JSON" as const; async load() { return seedRoom(); } async save(_d: RoomData) {} }

async function boot() {
  const provider = new SimulatedProvider({ seed: 11, overturnRate: 0 });
  const data = seedRoom();
  // The seed carries the real room's addresses; tests run every device on the mock driver.
  for (const d of data.devices) if (d.driver !== "localaudio") d.driver = "mock";
  const agent = new Agent(data, provider, new MemStore(), "NONE");
  agent.devices.register(new MockDriver());
  await agent.devices.connectAll();
  await agent.watcher.refreshGames();
  agent.watcher.setWatched([GAME]);
  return { agent, provider, data };
}

test("Game Day mode runs the scene: screen up, TV on, projector on ribbon, lights in team colors", async () => {
  const { agent } = await boot();
  await agent.orchestrator.setMode("GAME_DAY");
  const d = (id: string) => agent.devices.get(id)!.state;
  assert.equal(agent.room.mode, "GAME_DAY");
  assert.equal(d("screen").screenPosition, "up");
  assert.equal(d("tv_sony").power, "on");
  assert.equal(d("projector_ribbon").power, "on");
  assert.equal(d("projector_ribbon").input, "ribbon");
  assert.equal(d("projector").power, "off", "movie projector stays off in Game Day");
  assert.equal(d("wiz_sony_bias").color, "#CE1126", "Ole Miss red on the bias lights");
  assert.equal(agent.displays.get("disp_projector")!.role, "PROJECTED_TICKER");
});

test("Movie mode drops the screen, turns the sports wall off and suppresses celebrations", async () => {
  const { agent } = await boot();
  await agent.orchestrator.setMode("MOVIE");
  assert.equal(agent.devices.get("screen")!.state.screenPosition, "down");
  assert.equal(agent.devices.get("tv_sony")!.state.power, "off");
  agent.watcher.manual("TOUCHDOWN", "home");
  await new Promise((r) => setTimeout(r, 50));
  const run = agent.data.runs.find((r) => r.automationName === "Touchdown celebration");
  assert.equal(run?.status, "suppressed");
  assert.match(run?.reason ?? "", /MOVIE/);
});

test("manual touchdown runs the choreographed celebration and restores the lights", async () => {
  const { agent, data } = await boot();
  const auto = data.automations.find((a) => a.id === "auto_touchdown")!;
  auto.steps = auto.steps.map((s) => (s.kind === "wait" && s.ms !== "broadcast_delay" ? { ...s, ms: 50 } : s));
  // The choreography lives in the Touchdown scene; compress its 8.5 s timeline for the test.
  const scene = data.scenes.find((x) => x.id === "fx_touchdown")!;
  scene.actions = scene.actions.map((a) => ({ ...a, delayMs: Math.round(a.delayMs / 20) }));
  await agent.orchestrator.setMode("SPORTS");
  await agent.devices.execute("wiz_sony_bias", { type: "set_color", color: "#123456" }, "scene");
  agent.watcher.manual("TOUCHDOWN", "home");
  await new Promise((r) => setTimeout(r, 4000)); // the choreography staggers sound and effects over ~3 s
  const run = data.runs.find((r) => r.automationName === "Touchdown celebration")!;
  assert.equal(run.status, "done");
  assert.equal(agent.devices.get("wiz_sony_bias")!.state.color, "#123456", "restored after the celebration");
  assert.ok(data.timeline.some((t) => t.text.includes("Sony bias (WiZ): flash")));
});

test("a manual device change holds off automations on that device", async () => {
  const { agent } = await boot();
  await agent.devices.execute("wiz_stadium_upper", { type: "set_color", color: "#ffffff" }, "manual");
  const r = await agent.devices.execute("wiz_stadium_upper", { type: "set_color", color: "#000000" }, "automation");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "manual hold");
  assert.equal(agent.devices.get("wiz_stadium_upper")!.state.color, "#ffffff");
});

test("provider events wait for the broadcast delay and SYNC re-times them", async () => {
  const { agent, provider } = await boot();
  agent.room.activeDelayProfileId = "delay_yttv_appletv";
  provider.forcePlay(GAME, "field_goal", "home");
  await new Promise((r) => setTimeout(r, 20));
  const pending = agent.watcher.scheduler.pendingEvents();
  assert.ok(pending.some((e) => e.type === "FIELD_GOAL"));
  assert.ok((pending[0].releaseAt ?? 0) - pending[0].ts >= 24_000);
  const r = agent.sync();
  assert.ok(r.delayMs < 2000, "synced right after the play means a tiny delay");
  agent.watcher.scheduler.pump();
  assert.equal(agent.watcher.scheduler.pendingEvents().length, 0);
});

test("an overturned touchdown withdraws the queued celebration", async () => {
  const { agent, provider } = await boot();
  provider.forcePlay(GAME, "touchdown", "home");
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(agent.watcher.scheduler.pendingEvents().some((e) => e.type === "TOUCHDOWN"));
  provider.forceOverturn(GAME);
  await new Promise((r) => setTimeout(r, 20));
  const pending = agent.watcher.scheduler.pendingEvents();
  assert.ok(!pending.some((e) => e.type === "TOUCHDOWN"));
  assert.ok(agent.watcher.recentEvents.some((e) => e.type === "TOUCHDOWN" && e.state === "reversed"));
});

/**
 * Room Agent entry point. Runs locally in the room: it owns devices, displays, modes and
 * automations, and keeps working when the internet or the sports feed does not.
 *
 *   PROVIDER=simulated|espn   sports data (default simulated)
 *   HA_URL + HA_TOKEN         enable the Home Assistant driver (UNVERIFIED until it pings)
 *   ROOM_PIN                  optional household PIN for the app (LOCAL auth)
 *   PORT                      default 8790
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EspnProvider, SimulatedProvider } from "@room/sports";
import { Agent } from "./agent";
import { createApi } from "./api";
import { HomeAssistantDriver } from "./drivers/homeassistant";
import { MockDriver } from "./drivers/mock";
import { PjLinkDriver } from "./drivers/pjlink";
import { BraviaDriver } from "./drivers/bravia";
import { WledDriver } from "./drivers/wled";
import { OnkyoDriver } from "./drivers/onkyo";
import { RokuDriver } from "./drivers/roku";
import { AndroidTvDriver } from "./drivers/androidtv";
import { ShellyDriver } from "./drivers/shelly";
import { LocalAudioDriver } from "./drivers/localaudio";
import { seedRoom } from "./seed";
import { JsonFileStore } from "./store";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const port = Number(process.env.PORT ?? 8790);
const providerId = process.env.PROVIDER ?? "simulated";
const pin = process.env.ROOM_PIN || undefined;

const provider = providerId === "espn" ? new EspnProvider({ leagues: (process.env.LEAGUES ?? "nfl,ncaaf").split(",") }) : new SimulatedProvider({ tickMs: Number(process.env.SIM_TICK_MS ?? 4000) });
const store = new JsonFileStore(path.join(root, "data", "room.json"), seedRoom);
const data = await store.load();
const agent = new Agent(data, provider, store, pin ? "LOCAL_PIN" : "NONE");

agent.devices.register(new MockDriver());
// Network drivers for common room hardware. UNVERIFIED until a device answers; each device
// gets its own status from a probe, so one offline strip does not hide a working projector.
agent.devices.register(new PjLinkDriver());
agent.devices.register(new BraviaDriver());
agent.devices.register(new WledDriver());
agent.devices.register(new OnkyoDriver());
agent.devices.register(new RokuDriver());
agent.devices.register(new AndroidTvDriver());
agent.devices.register(new ShellyDriver());
agent.devices.register(new LocalAudioDriver());
if (process.env.HA_URL && process.env.HA_TOKEN) {
  agent.devices.register(new HomeAssistantDriver(process.env.HA_URL, process.env.HA_TOKEN));
} else if (data.devices.some((d) => d.driver === "homeassistant")) {
  console.warn("[agent] devices use the homeassistant driver but HA_URL/HA_TOKEN are not set; they will show OFFLINE");
}

await agent.start();
const server = createApi(agent, { staticDir: path.resolve(root, "..", "web", "dist"), pin });
server.listen(port, () => {
  console.log(`[agent] http://localhost:${port}  (api: /api/*, realtime: /ws)${pin ? "  PIN enabled" : ""}`);
});

const shutdown = () => { store.flush(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

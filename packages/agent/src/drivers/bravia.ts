/**
 * Sony Bravia TV driver (UNVERIFIED). Uses the TV's REST API ("IP control") that newer
 * Bravia sets expose once you set a Pre-Shared Key in Settings → Network → Home network
 * → IP control. Device driverConfig: { host: "192.168.1.40", psk: "0000" }
 * Inputs map logical names to HDMI ports: { appletv: "1", cable: "2", browser: "3" }.
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class BraviaDriver implements DeviceDriver {
  id = "bravia";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const r = await this.call(device, "system", "getPowerStatus", [], "1.0"); return r && "result" in r ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const r = (await this.call(device, "system", "getPowerStatus", [], "1.0")) as { result?: Array<{ status: string }> };
    return { power: r.result?.[0]?.status === "active" ? "on" : "off" };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": await this.call(device, "system", "setPowerStatus", [{ status: true }], "1.0"); return { power: "on" };
      case "power_off": await this.call(device, "system", "setPowerStatus", [{ status: false }], "1.0"); return { power: "off" };
      case "set_input": { const port = device.inputs?.[command.input] ?? command.input; await this.call(device, "avContent", "setPlayContent", [{ uri: `extInput:hdmi?port=${port}` }], "1.0"); return { input: command.input, power: "on" }; }
      case "set_volume": await this.call(device, "audio", "setAudioVolume", [{ target: "speaker", volume: String(command.volume) }], "1.0"); return { volume: command.volume };
      case "open_url": await this.call(device, "appControl", "setActiveApp", [{ uri: "com.sony.dtv.com.android.chrome", data: command.url }], "1.0"); return { url: command.url };
      default: throw new Error(`Bravia cannot ${command.type}`);
    }
  }

  private async call(device: RoomDevice, service: string, method: string, params: unknown[], version: string): Promise<Record<string, unknown>> {
    const host = String(device.driverConfig?.host ?? "");
    if (!host) throw new Error(`${device.name} has no host`);
    const res = await fetch(`http://${host}/sony/${service}`, { method: "POST", headers: { "content-type": "application/json", "x-auth-psk": String(device.driverConfig?.psk ?? "") }, body: JSON.stringify({ method, params, id: 1, version }), signal: AbortSignal.timeout(4000) });
    const j = (await res.json()) as Record<string, unknown>;
    if (j.error) throw new Error(`Bravia ${method}: ${JSON.stringify(j.error)}`);
    return j;
  }
}

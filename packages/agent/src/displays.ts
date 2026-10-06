import { EventEmitter } from "node:events";
import { pairingCode, uid, type DisplayDevice, type DisplayOverlay, type DisplayPreset, type DisplayRole, type TimelineEntry } from "@room/core";

export class DisplayManager extends EventEmitter {
  constructor(public displays: DisplayDevice[], public presets: DisplayPreset[], private log: (e: Omit<TimelineEntry, "id" | "roomId" | "ts">) => void) { super(); }

  get(id: string): DisplayDevice | undefined { return this.displays.find((d) => d.id === id); }
  byRole(role: DisplayRole): DisplayDevice[] { return this.displays.filter((d) => d.role === role); }

  pair(code: string): DisplayDevice | undefined {
    const d = this.displays.find((x) => x.pairingCode.toUpperCase() === code.toUpperCase());
    if (!d) return undefined;
    d.paired = true; d.lastSeenAt = Date.now();
    this.log({ kind: "display", text: `${d.name} paired`, detail: { displayId: d.id } });
    this.emit("change", d);
    return d;
  }

  seen(id: string): void { const d = this.get(id); if (d) { d.lastSeenAt = Date.now(); if (!d.paired) { d.paired = true; this.emit("change", d); } } }

  setRole(id: string, role: DisplayRole, roleOptions?: Record<string, unknown>, origin = "user"): DisplayDevice | undefined {
    const d = this.get(id);
    if (!d) return undefined;
    d.role = role;
    if (roleOptions) d.roleOptions = { ...(d.roleOptions ?? {}), ...roleOptions };
    this.log({ kind: "display", text: `${d.name} → ${role}${origin !== "user" ? ` (${origin})` : ""}`, detail: { displayId: id, role } });
    this.emit("change", d);
    return d;
  }

  update(id: string, patch: Partial<Pick<DisplayDevice, "name" | "position" | "kind" | "roleOptions" | "rotation" | "safeArea">>): DisplayDevice | undefined {
    const d = this.get(id);
    if (!d) return undefined;
    Object.assign(d, patch);
    this.emit("change", d);
    return d;
  }

  add(name: string, kind: DisplayDevice["kind"], roomId: string): DisplayDevice {
    const d: DisplayDevice = { id: uid("disp"), roomId, name, role: "SCOREBOARD", pairingCode: pairingCode(), paired: false, position: { x: 40, y: 50, w: 20, h: 12 }, kind };
    this.displays.push(d);
    this.log({ kind: "display", text: `Added display ${name} (code ${d.pairingCode})` });
    this.emit("change", d);
    return d;
  }

  remove(id: string): boolean {
    const i = this.displays.findIndex((d) => d.id === id);
    if (i < 0) return false;
    this.displays.splice(i, 1);
    this.emit("change");
    return true;
  }

  applyPreset(presetId: string, origin = "user"): DisplayPreset | undefined {
    const p = this.presets.find((x) => x.id === presetId);
    if (!p) return undefined;
    for (const a of p.assignments) { const d = this.get(a.displayId); if (d) { d.role = a.role; if (a.roleOptions) d.roleOptions = { ...(d.roleOptions ?? {}), ...a.roleOptions }; } }
    this.log({ kind: "display", text: `Preset "${p.name}" applied${origin !== "user" ? ` (${origin})` : ""}`, detail: { presetId } });
    this.emit("change");
    return p;
  }

  savePreset(name: string, roomId: string, id?: string): DisplayPreset {
    const assignments = this.displays.map((d) => ({ displayId: d.id, role: d.role, roleOptions: d.role === "SECOND_GAME" || d.role === "CUSTOM" ? d.roleOptions : undefined }));
    const existing = id ? this.presets.find((p) => p.id === id) : undefined;
    if (existing) { existing.name = name; existing.assignments = assignments; this.emit("change"); return existing; }
    const p: DisplayPreset = { id: uid("preset"), roomId, name, assignments };
    this.presets.push(p);
    this.log({ kind: "display", text: `Preset "${name}" saved` });
    this.emit("change");
    return p;
  }

  deletePreset(id: string): boolean {
    const i = this.presets.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.presets.splice(i, 1);
    this.emit("change");
    return true;
  }

  overlay(target: { displayRole: DisplayRole } | { display: string } | { all: true }, overlay: Omit<DisplayOverlay, "until"> & { durationMs?: number }): void {
    const ids = "all" in target ? "all" : "display" in target ? [target.display] : this.byRole(target.displayRole).map((d) => d.id);
    const payload: DisplayOverlay = { kind: overlay.kind, text: overlay.text, subtext: overlay.subtext, color: overlay.color, color2: overlay.color2, logoUrl: overlay.logoUrl || undefined, until: Date.now() + (overlay.durationMs ?? 5000) };
    this.emit("overlay", ids, payload);
  }
}

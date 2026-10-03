import type { IntegrationStatus } from "./status";
import type { RoomMode } from "./modes";

export interface BroadcastDelayProfile {
  id: string;
  roomId: string;
  name: string;          // "YouTube TV on Apple TV"
  source?: string;       // streaming service
  app?: string;
  deviceId?: string;
  delayMs: number;
  /** Last time SYNC TO TV updated it. */
  calibratedAt?: number;
  samples?: number[];
}

export interface Room {
  id: string;
  name: string;
  timezone?: string;
  mode: RoomMode | null;
  /** Game ids currently watched; the first is primary. */
  watchedGameIds: string[];
  favoriteTeams: string[];   // abbreviations
  activeDelayProfileId?: string;
  /** Manual override: automations are paused until this time. */
  automationsPausedUntil?: number;
  /** Guest/kids simplifications. */
  guestMode?: boolean;
}

export interface TimelineEntry {
  id: string;
  roomId: string;
  ts: number;
  kind: "mode" | "event" | "automation" | "device" | "display" | "sync" | "system" | "manual";
  text: string;
  detail?: Record<string, unknown>;
}

export interface AgentStatus {
  online: boolean;
  version: string;
  startedAt: number;
  provider: { id: string; status: IntegrationStatus };
  drivers: Record<string, IntegrationStatus>;
  auth: "LOCAL_PIN" | "SUPABASE" | "NONE";
}

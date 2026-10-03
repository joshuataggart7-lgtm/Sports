export function pin(): string | null { try { return localStorage.getItem("room.pin"); } catch { return null; } }
export function setPin(v: string | null): void { try { v ? localStorage.setItem("room.pin", v) : localStorage.removeItem("room.pin"); } catch { /* ignore */ } }

export async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const p = pin();
  if (p) headers["x-room-pin"] = p;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error || res.statusText);
  return j as T;
}

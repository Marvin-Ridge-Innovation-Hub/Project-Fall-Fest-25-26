import type { ScoreEntry } from "@/lib/scoreManager";
import { loadLocalScores, saveLocalScores } from "@/lib/scoreManager";

/**
 * Google Sheets integration via a deployed Google Apps Script Web App.
 *
 * This runs in the browser (static export / file://). Therefore:
 * - Any credentials in env are NOT secret. Prefer deploying the Apps Script as "Anyone" access,
 *   or enforce access inside Apps Script by checking an optional shared token.
 *
 * Env vars (baked at build time for static export):
 * - NEXT_PUBLIC_GAS_LEADERBOARD_URL: required, Apps Script Web App URL
 * - NEXT_PUBLIC_GAS_AUTH_TOKEN: optional shared token checked by your Apps Script
 */

const ENV_URL = process.env.NEXT_PUBLIC_GAS_LEADERBOARD_URL;
const ENV_TOKEN = process.env.NEXT_PUBLIC_GAS_AUTH_TOKEN;

type RemoteEntry = ScoreEntry & { name?: string; id?: string; updatedAt?: string };

type GasResponse =
  | { ok: true; entries: RemoteEntry[] }
  | { ok: false; error: string; code?: string };

type GasAction = "list" | "upsertMany";

const LAST_SYNC_KEY = "flappybird_lastSyncAt";
const PENDING_KEY = "flappybird_pendingScores";

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function entryKey(e: any): string {
  const id = typeof e?.id === "string" ? e.id : "";
  if (id) return id;
  const name = typeof e?.name === "string" ? normalizeName(e.name) : "";
  return name ? `name:${name}` : `unknown:${String(e?.createdAt ?? "")}`;
}

function toIso(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function pickBest(a: RemoteEntry, b: RemoteEntry): RemoteEntry {
  const scoreA = a.score ?? 0;
  const scoreB = b.score ?? 0;
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;

  const ua = toIso((a as any).updatedAt) ?? toIso((a as any).createdAt) ?? "";
  const ub = toIso((b as any).updatedAt) ?? toIso((b as any).createdAt) ?? "";
  if (ua !== ub) return ua > ub ? a : b;

  // Stable fallback
  return a;
}

export function mergeByKey(local: RemoteEntry[], remote: RemoteEntry[]): RemoteEntry[] {
  const map = new Map<string, RemoteEntry>();

  for (const e of remote) {
    map.set(entryKey(e), e);
  }

  for (const e of local) {
    const k = entryKey(e);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, e);
      continue;
    }

    const best = pickBest(existing, e);

    // Preserve earliest createdAt if possible.
    const createdA = toIso((existing as any).createdAt);
    const createdB = toIso((e as any).createdAt);
    const earliest = createdA && createdB ? (createdA < createdB ? createdA : createdB) : createdA ?? createdB;

    map.set(k, {
      ...best,
      id: (best as any).id ?? (existing as any).id ?? (e as any).id,
      name: (best as any).name ?? (existing as any).name ?? (e as any).name,
      createdAt: earliest ?? (best as any).createdAt,
    });
  }

  return Array.from(map.values());
}

function loadPendingScores(): RemoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PENDING_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as RemoteEntry[]) : [];
  } catch {
    return [];
  }
}

function savePendingScores(entries: RemoteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
  } catch {}
}

export function enqueuePendingScore(entry: RemoteEntry): void {
  if (typeof window === "undefined") return;
  const pending = loadPendingScores();
  const k = entryKey(entry);
  const idx = pending.findIndex((e) => entryKey(e) === k);
  if (idx >= 0) {
    // Keep the best version of the pending entry.
    pending[idx] = pickBest(pending[idx], entry);
  } else {
    pending.push(entry);
  }
  savePendingScores(pending);
}

function clearPendingScores(sentKeys: string[]): void {
  if (typeof window === "undefined") return;
  const pending = loadPendingScores();
  if (pending.length === 0) return;
  const sent = new Set(sentKeys);
  const remaining = pending.filter((e) => !sent.has(entryKey(e)));
  savePendingScores(remaining);
}

async function gasRequest(action: GasAction, payload: Record<string, unknown>, signal?: AbortSignal): Promise<GasResponse> {
  if (!ENV_URL) {
    return { ok: false, error: "Missing NEXT_PUBLIC_GAS_LEADERBOARD_URL" };
  }

  // IMPORTANT: this app is often run via file:// on Chromebooks.
  // file:// pages have Origin "null", and a JSON POST would trigger a CORS preflight that Apps Script
  // doesn't satisfy. Use GET query params to avoid preflight.
  const params = new URLSearchParams();
  params.set("action", action);
  if (ENV_TOKEN) params.set("token", ENV_TOKEN);
  if (Object.keys(payload).length > 0) {
    // Payload is JSON encoded into a single query param.
    // Keep payload small (leaderboard sizes are typically small).
    params.set("payload", JSON.stringify(payload));
  }

  const url = `${ENV_URL}${ENV_URL.includes("?") ? "&" : "?"}${params.toString()}`;

  try {
    const res = await fetch(url, { method: "GET", signal });

    // Apps Script often returns 200 with an error payload, but handle non-2xx too.
    const text = await res.text();
    // Common Apps Script mis-deploy symptom: HTML error page with "Script function not found: doPost"
    if (text.includes("Script function not found: doPost")) {
      return {
        ok: false,
        error:
          "Apps Script deployment missing doPost(e). This client uses doGet(e) with query params; ensure your Web App code defines doGet/doPost and redeploy the Web App.",
        code: "MISSING_HANDLER",
      };
    }
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    if (json && json.ok === true && Array.isArray(json.entries)) {
      return { ok: true, entries: json.entries as RemoteEntry[] };
    }

    if (json && json.ok === false && typeof json.error === "string") {
      return json as GasResponse;
    }

    return { ok: false, error: "Unexpected Apps Script response" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error", code: err?.name };
  }
}

function isOfflineLikely(): boolean {
  // navigator.onLine is best-effort and can be undefined in some environments.
  if (typeof navigator === "undefined") return true;
  if (typeof navigator.onLine === "boolean") return !navigator.onLine;
  return false;
}

function setLastSyncNow(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

/**
 * Syncs with Google Sheets (Apps Script as source of truth).
 *
 * Policy:
 * - Fetch remote list (source of truth)
 * - OVERWRITE local cache with remote (so deleted/offensive names removed from sheet disappear locally)
 * - Upload only locally-submitted pending entries (not the entire cache)
 * - Save canonical remote view back to local cache
 *
 * Failure modes:
 * - If offline / permissions / network errors happen, it logs a warning and returns without throwing.
 */
export async function syncLeaderboardWithGoogleSheets(options?: { timeoutMs?: number }): Promise<void> {
  if (typeof window === "undefined") return;

  if (!ENV_URL) {
    // Not configured — intentionally silent for normal gameplay.
    return;
  }

  if (isOfflineLikely()) {
    console.warn("[leaderboard] Offline — skipping Google Sheets sync");
    return;
  }

  const timeoutMs = options?.timeoutMs ?? 6000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const remoteRes = await gasRequest("list", {}, controller.signal);
    if (!remoteRes.ok) {
      console.warn("[leaderboard] Google Sheets list failed:", remoteRes.error, remoteRes.code ? `(${remoteRes.code})` : "");
      return;
    }

    const remote = remoteRes.entries;
    // Source of truth: remote overwrites cache immediately.
    saveLocalScores(remote);

    const pending = loadPendingScores();
    if (pending.length === 0) {
      setLastSyncNow();
      return;
    }

    const upsertRes = await gasRequest("upsertMany", { entries: pending }, controller.signal);
    if (!upsertRes.ok) {
      console.warn("[leaderboard] Google Sheets upsert failed:", upsertRes.error, upsertRes.code ? `(${upsertRes.code})` : "");
      // Keep remote cache (already saved), keep pending for next retry.
      setLastSyncNow();
      return;
    }

    // After successful upsert, accept remote canonical view and clear sent pending keys.
    const canonical = upsertRes.entries?.length ? upsertRes.entries : remote;
    saveLocalScores(canonical);
    clearPendingScores(pending.map((e) => entryKey(e)));
    setLastSyncNow();
  } finally {
    clearTimeout(t);
  }
}


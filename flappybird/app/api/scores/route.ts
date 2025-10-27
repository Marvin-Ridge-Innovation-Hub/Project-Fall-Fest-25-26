import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
// Use Vercel KV on Vercel deployments when available, else fall back to file storage locally
let kv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  kv = require("@vercel/kv").kv;
} catch {
  kv = null;
}

// Legacy entry (initial implementation)
type LegacyScore = {
  name: string;
  score: number;
  createdAt: string; // ISO string
};

// New schema entry
type ScoreEntry = {
  id: string; // student id or email prefix
  firstName: string;
  lastInitial: string; // single character
  score: number;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
};

const DATA_DIR = path.join(process.cwd(), "data");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(SCORES_FILE).catch(async () => {
      await fs.writeFile(SCORES_FILE, JSON.stringify([], null, 2), "utf-8");
    });
  } catch (e) {
    // swallow; read/write will surface errors
  }
}

async function readScores(): Promise<(LegacyScore | ScoreEntry)[]> {
  await ensureDataFile();
  const raw = await fs.readFile(SCORES_FILE, "utf-8").catch(() => "[]");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as (LegacyScore | ScoreEntry)[];
    return [];
  } catch {
    return [];
  }
}

async function writeScores(scores: (LegacyScore | ScoreEntry)[]) {
  await ensureDataFile();
  await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2), "utf-8");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const idParam = searchParams.get("id");
  // Prefer KV on Vercel when configured
  const useKV = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && kv;

  if (useKV) {
    // Lookup by id in KV
    if (idParam) {
      const idKey = `scores:users:${idParam.toLowerCase()}`;
      const entry = (await kv.get(idKey)) as ScoreEntry | null;
      return NextResponse.json({ exists: Boolean(entry), entry: entry ?? null }, { headers: { "Cache-Control": "no-store" } });
    }
    // List by sorted set
    const limit = limitParam ? Math.max(1, Math.min(10000, Number(limitParam))) : -1; // -1 means all
    // @vercel/kv: zrange supports {rev:true}
    const ids: string[] = await kv.zrange("scores:zset", 0, limit === -1 ? -1 : limit - 1, { rev: true });
    const entries = (
      await Promise.all(ids.map((id) => kv.get(`scores:users:${id}` as string)))
    ).filter(Boolean) as ScoreEntry[];
    return NextResponse.json(entries, { headers: { "Cache-Control": "no-store" } });
  }

  // Fallback to file storage locally
  const scores = await readScores();
  if (idParam) {
    const entry = (scores as ScoreEntry[]).find((s: any) => typeof s.id === "string" && s.id.toLowerCase() === idParam.toLowerCase());
    return NextResponse.json({ exists: Boolean(entry), entry: entry ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  const sorted = scores
    .slice()
    .sort((a: any, b: any) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const nameA = typeof a.firstName === "string" ? `${a.firstName} ${a.lastInitial ?? ""}` : a.name ?? "";
      const nameB = typeof b.firstName === "string" ? `${b.firstName} ${b.lastInitial ?? ""}` : b.name ?? "";
      return nameA.localeCompare(nameB);
    });
  if (limitParam) {
    const limit = Math.max(1, Math.min(10000, Number(limitParam)));
    return NextResponse.json(sorted.slice(0, limit), { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(sorted, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ScoreEntry & { score: number }> & { id?: string };
    const id = (body.id ?? "").toString().trim();
    const scoreRaw = Number(body.score);
    const firstNameRaw = (body.firstName ?? "").toString().trim();
    const lastInitialRaw = (body.lastInitial ?? "").toString().trim();

    // validation
    if (!id || !/^[A-Za-z0-9._-]{2,40}$/.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (!Number.isFinite(scoreRaw) || scoreRaw < 0 || scoreRaw > 1_000_000) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    const useKV = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && kv;
    if (useKV) {
      const idKey = `scores:users:${id.toLowerCase()}`;
      const existing = (await kv.get(idKey)) as ScoreEntry | null;
      if (existing) {
        const newScore = Math.floor(scoreRaw);
        const updatedScore = Math.max(existing.score ?? 0, newScore);
        const updated: ScoreEntry = { ...existing, score: updatedScore, updatedAt: new Date().toISOString() };
        await Promise.all([
          kv.set(idKey, updated),
          kv.zadd("scores:zset", { score: updatedScore, member: id.toLowerCase() }),
        ]);
        return NextResponse.json({ ok: true, updated: true, exists: true }, { status: 200 });
      }
      if (!firstNameRaw || !lastInitialRaw) {
        return NextResponse.json({ requiresProfile: true }, { status: 409 });
      }
      const createdAt = new Date().toISOString();
      const entry: ScoreEntry = {
        id,
        firstName: firstNameRaw.slice(0, 40),
        lastInitial: lastInitialRaw.charAt(0).toUpperCase(),
        score: Math.floor(scoreRaw),
        createdAt,
        updatedAt: createdAt,
      };
      await Promise.all([
        kv.set(idKey, entry),
        kv.zadd("scores:zset", { score: entry.score, member: id.toLowerCase() }),
      ]);
      return NextResponse.json({ ok: true, created: true, exists: false }, { status: 201 });
    }

    // file-based fallback (local dev)
    const scores = await readScores();
    const idx = (scores as ScoreEntry[]).findIndex((s: any) => typeof s.id === "string" && s.id.toLowerCase() === id.toLowerCase());
    if (idx >= 0) {
      const existing = scores[idx] as ScoreEntry;
      const newScore = Math.floor(scoreRaw);
      const updated: ScoreEntry = { ...existing, score: Math.max(existing.score ?? 0, newScore), updatedAt: new Date().toISOString() };
      scores[idx] = updated;
      await writeScores(scores);
      return NextResponse.json({ ok: true, updated: true, exists: true }, { status: 200 });
    }
    if (!firstNameRaw || !lastInitialRaw) {
      return NextResponse.json({ requiresProfile: true }, { status: 409 });
    }
    const createdAt = new Date().toISOString();
    const entry: ScoreEntry = {
      id,
      firstName: firstNameRaw.slice(0, 40),
      lastInitial: lastInitialRaw.charAt(0).toUpperCase(),
      score: Math.floor(scoreRaw),
      createdAt,
      updatedAt: createdAt,
    };
    scores.push(entry);
    await writeScores(scores);
    return NextResponse.json({ ok: true, created: true, exists: false }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

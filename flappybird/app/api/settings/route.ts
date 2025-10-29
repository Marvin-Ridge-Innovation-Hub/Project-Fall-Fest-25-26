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

export type GameSettings = {
  BASE_WIDTH: number;
  BASE_HEIGHT: number;
  BASE_PIPE_WIDTH: number;
  BASE_GAP: number;
  PIPE_INTERVAL_MS: number;
  BASE_SPEED: number;
  BASE_GRAVITY: number;
  BASE_FLAP: number;
  MAX_LEVEL: number;
  SPEED_PER_LEVEL: number;
  GRAVITY_PER_LEVEL: number;
  GAP_REDUCTION_PER_LEVEL: number;
  INTERVAL_REDUCTION_MS_PER_LEVEL: number;
  updatedAt?: string;
};

const DEFAULT_SETTINGS: GameSettings = {
  BASE_WIDTH: 480,
  BASE_HEIGHT: 640,
  BASE_PIPE_WIDTH: 70,
  BASE_GAP: 160,
  PIPE_INTERVAL_MS: 1400,
  BASE_SPEED: 3.5,
  BASE_GRAVITY: 0.45,
  BASE_FLAP: -8.5,
  MAX_LEVEL: 8,
  SPEED_PER_LEVEL: 0.05,
  GRAVITY_PER_LEVEL: 0.04,
  GAP_REDUCTION_PER_LEVEL: 0.02,
  INTERVAL_REDUCTION_MS_PER_LEVEL: 50,
};

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "game-settings.json");
const SETTINGS_KEY = "game:settings";
const DEV_PASSWORD = "mrdev123"; // Simple auth for dev menu

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(SETTINGS_FILE).catch(async () => {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
    });
  } catch (e) {
    // swallow; read/write will surface errors
  }
}

async function readSettings(): Promise<GameSettings> {
  await ensureDataFile();
  const raw = await fs.readFile(SETTINGS_FILE, "utf-8").catch(() => JSON.stringify(DEFAULT_SETTINGS));
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: GameSettings) {
  await ensureDataFile();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export async function GET() {
  const useKV = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && kv;

  try {
    if (useKV) {
      const settings = (await kv.get(SETTINGS_KEY)) as GameSettings | null;
      return NextResponse.json(settings || DEFAULT_SETTINGS, { headers: { "Cache-Control": "no-store" } });
    }

    // Fallback to file storage locally
    const settings = await readSettings();
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error reading settings:", error);
    return NextResponse.json(DEFAULT_SETTINGS, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Simple authentication check
    if (body.devPassword !== DEV_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate settings
    const settings: GameSettings = {
      BASE_WIDTH: Number(body.BASE_WIDTH) || DEFAULT_SETTINGS.BASE_WIDTH,
      BASE_HEIGHT: Number(body.BASE_HEIGHT) || DEFAULT_SETTINGS.BASE_HEIGHT,
      BASE_PIPE_WIDTH: Number(body.BASE_PIPE_WIDTH) || DEFAULT_SETTINGS.BASE_PIPE_WIDTH,
      BASE_GAP: Number(body.BASE_GAP) || DEFAULT_SETTINGS.BASE_GAP,
      PIPE_INTERVAL_MS: Number(body.PIPE_INTERVAL_MS) || DEFAULT_SETTINGS.PIPE_INTERVAL_MS,
      BASE_SPEED: Number(body.BASE_SPEED) || DEFAULT_SETTINGS.BASE_SPEED,
      BASE_GRAVITY: Number(body.BASE_GRAVITY) || DEFAULT_SETTINGS.BASE_GRAVITY,
      BASE_FLAP: Number(body.BASE_FLAP) || DEFAULT_SETTINGS.BASE_FLAP,
      MAX_LEVEL: Number(body.MAX_LEVEL) || DEFAULT_SETTINGS.MAX_LEVEL,
      SPEED_PER_LEVEL: Number(body.SPEED_PER_LEVEL) || DEFAULT_SETTINGS.SPEED_PER_LEVEL,
      GRAVITY_PER_LEVEL: Number(body.GRAVITY_PER_LEVEL) || DEFAULT_SETTINGS.GRAVITY_PER_LEVEL,
      GAP_REDUCTION_PER_LEVEL: Number(body.GAP_REDUCTION_PER_LEVEL) || DEFAULT_SETTINGS.GAP_REDUCTION_PER_LEVEL,
      INTERVAL_REDUCTION_MS_PER_LEVEL: Number(body.INTERVAL_REDUCTION_MS_PER_LEVEL) || DEFAULT_SETTINGS.INTERVAL_REDUCTION_MS_PER_LEVEL,
      updatedAt: new Date().toISOString(),
    };

    const useKV = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && kv;

    if (useKV) {
      await kv.set(SETTINGS_KEY, settings);
    } else {
      await writeSettings(settings);
    }

    return NextResponse.json({ ok: true, settings }, { status: 200 });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

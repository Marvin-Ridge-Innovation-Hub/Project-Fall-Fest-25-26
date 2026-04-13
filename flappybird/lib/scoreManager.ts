/**
 * Score Manager: Handles leaderboard data from embedded JSON and localStorage
 * Works offline by combining static data (public/data/scores.json) with user-submitted scores (localStorage)
 */

export type ScoreEntry = {
  id?: string;
  firstName?: string;
  lastInitial?: string;
  score: number;
  createdAt: string;
  updatedAt?: string;
};

const SCORES_STORAGE_KEY = "flappybird_scores";
const EMBEDDED_SCORES_URL = "/data/scores.json";

/**
 * Load embedded scores from the static JSON file (included in build output)
 */
export async function loadEmbeddedScores(): Promise<ScoreEntry[]> {
  try {
    const response = await fetch(EMBEDDED_SCORES_URL);
    if (!response.ok) return [];
    return (await response.json()) as ScoreEntry[];
  } catch (error) {
    console.warn("Failed to load embedded scores:", error);
    return [];
  }
}

/**
 * Load user-submitted scores from localStorage
 */
export function loadLocalScores(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SCORES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load local scores:", error);
    return [];
  }
}

/**
 * Save scores to localStorage
 */
export function saveLocalScores(scores: ScoreEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch (error) {
    console.warn("Failed to save local scores:", error);
  }
}

/**
 * Add or update a score in localStorage
 * Updates existing score if user (by ID) already exists, otherwise adds new entry
 */
export function addOrUpdateScore(entry: ScoreEntry): void {
  const local = loadLocalScores();
  const existingIndex = entry.id
    ? local.findIndex((s) => (s as any).id === entry.id)
    : -1;

  if (existingIndex >= 0) {
    // Update: keep higher score
    const existing = local[existingIndex];
    if (entry.score > (existing.score ?? 0)) {
      local[existingIndex] = entry;
    }
  } else {
    // New entry
    local.push(entry);
  }

  saveLocalScores(local);
}

/**
 * Get combined leaderboard: embedded scores + localStorage scores, sorted by score
 */
export async function getCombinedLeaderboard(): Promise<ScoreEntry[]> {
  const embedded = await loadEmbeddedScores();
  const local = loadLocalScores();

  // Combine and deduplicate by ID (prefer higher score)
  const combined: { [key: string]: ScoreEntry } = {};

  // Add embedded scores
  embedded.forEach((s) => {
    const key = (s as any).id ?? `embedded_${s.createdAt}`;
    combined[key] = s;
  });

  // Add/override with local scores (prefer local if exists)
  local.forEach((s) => {
    const key = (s as any).id ?? `local_${s.createdAt}`;
    if (combined[key]) {
      // Keep higher score
      combined[key] =
        (s.score ?? 0) > (combined[key].score ?? 0) ? s : combined[key];
    } else {
      combined[key] = s;
    }
  });

  // Sort by score (descending), then by name
  const sorted = Object.values(combined).sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const nameA =
      a.firstName ? `${a.firstName} ${a.lastInitial ?? ""}` : (a as any).name ?? "";
    const nameB =
      b.firstName ? `${b.firstName} ${b.lastInitial ?? ""}` : (b as any).name ?? "";
    return nameA.localeCompare(nameB);
  });

  return sorted;
}

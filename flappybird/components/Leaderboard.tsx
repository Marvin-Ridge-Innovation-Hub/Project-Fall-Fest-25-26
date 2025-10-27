"use client";

import { useEffect, useState } from "react";

type LegacyScore = {
  name: string;
  score: number;
  createdAt: string;
};

type ScoreEntry = {
  id?: string;
  firstName?: string;
  lastInitial?: string;
  score: number;
  createdAt: string;
};

export default function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
  const res = await fetch("/api/scores", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load scores");
  const data = (await res.json()) as ScoreEntry[];
      setScores(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="w-full h-full p-4">
      <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : scores.length === 0 ? (
        <p className="text-sm text-zinc-500">No scores yet. Be the first!</p>
      ) : (
        <ol className="space-y-2">
          {scores.map((s, i) => (
            <li
              key={`${(s as any).id ?? (s as any).name}-${s.createdAt}-${i}`}
              className="flex items-center justify-between rounded border border-black/10 dark:border-white/15 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 shrink-0 text-zinc-500">{i + 1}.</span>
                <span className="truncate font-medium">
                  {s.firstName ? (
                    <>
                      {s.firstName} {s.lastInitial ? `${s.lastInitial}.` : ""}
                    </>
                  ) : (
                    (s as any).name
                  )}
                </span>
              </div>
              <span className="font-mono">{s.score}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 text-xs text-zinc-500">All-time scores</div>
    </div>
  );
}

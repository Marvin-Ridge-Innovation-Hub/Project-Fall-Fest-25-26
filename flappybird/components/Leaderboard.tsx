"use client";

import { useEffect, useState } from "react";
import { getCombinedLeaderboard, type ScoreEntry } from "@/lib/scoreManager";

export default function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      // Keep showing previous scores while refreshing.
      if (scores.length === 0) setLoading(true);
      else setUpdating(true);
      setError(null);
      const data = await getCombinedLeaderboard();
      setScores(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      load();
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="w-full h-full p-4">
      <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
        🏆 Leaderboard
      </h2>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading && scores.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : scores.length === 0 ? (
        <p className="text-sm text-zinc-500">No scores yet. Be the first!</p>
      ) : (
        <ol className={`space-y-2 ${updating ? "opacity-90" : ""}`}>
          {scores.map((s, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            const isTopThree = i < 3;
            return (
              <li
                key={`${(s as any).id ?? (s as any).name}-${s.createdAt}-${i}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
                  isTopThree
                    ? "border-yellow-300 dark:border-yellow-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30"
                    : "border-black/10 dark:border-white/15 hover:border-blue-200 dark:hover:border-blue-800"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 shrink-0 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    {medal || `${i + 1}.`}
                  </span>
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
                <span className="font-mono font-bold text-lg">{s.score}</span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-4 text-xs text-zinc-500 text-center">
        {updating ? "Updating…" : "✨ All-time top scores ✨"}
      </div>
    </div>
  );
}

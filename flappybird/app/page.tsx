"use client";

import { useEffect, useState } from "react";
import FlappyBird from "@/components/FlappyBird";
import Leaderboard from "@/components/Leaderboard";
import Modal from "@/components/Modal";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [mobile, setMobile] = useState(false);
  const [showLB, setShowLB] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-zinc-950 dark:via-blue-950 dark:to-black font-sans">
      {/* Desktop/tablet layout */}
      {/* Fixed left sidebar on md+ that hugs the left and fills full height */}
      <aside className="hidden md:flex fixed left-0 top-0 h-dvh w-80 flex-col gap-4 p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-r border-black/10 dark:border-white/15 z-10 overflow-y-auto shadow-2xl">
        <div className="w-full flex items-center justify-center pt-1 animate-float">
          <img
            style={{borderRadius: 10}}
            src="/csclogo.png"
            alt="CSC Logo"
            className="w-full h-auto object-contain drop-shadow-lg"
            decoding="async"
            loading="eager"
          />
        </div>
        <div className="rounded-lg">
          <Leaderboard refreshKey={refreshKey} />
        </div>
      </aside>
      {/* Main game area shifted to the right of the sidebar */}
      <main className="hidden md:flex flex-1 md:ml-80 items-center justify-center">
        <section className="flex flex-col items-center justify-center w-full h-full p-6 gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-sm flex-shrink-0 leading-tight py-1">
            🎮 Fall Fest 25-26 - Flappy Bird 🏆
          </h1>
          <div className="flex items-center justify-center w-full" style={{ height: 'calc(100vh - 8rem)' }}>
            <FlappyBird onScoreSubmitted={() => setRefreshKey((k) => k + 1)} fullScreen />
          </div>
        </section>
      </main>

      {/* Mobile layout: full-screen game with floating leaderboard button */}
      <div className="md:hidden fixed inset-0">
        <FlappyBird
          fullScreen
          onScoreSubmitted={() => setRefreshKey((k) => k + 1)}
        />
        <button
          aria-label="Open leaderboard"
          onClick={(e) => {
            e.stopPropagation();
            setShowLB(true);
          }}
          className="absolute top-3 right-3 z-40 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-4 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        >
          🏆 Leaderboard
        </button>
        <Modal open={showLB} onClose={() => setShowLB(false)} title="Fall Fest 25-26 - Flappy Bird Leaderboard">
          <div className="w-full flex items-center justify-center mb-3">
            <img
              style={{borderRadius: 10}}
              src="/csclogo.png"
              alt="CSC Logo"
              className="w-full h-auto object-contain drop-shadow-md"
              decoding="async"
              loading="eager"
            />
          </div>
          <Leaderboard refreshKey={refreshKey} />
        </Modal>
      </div>
    </div>
  );
}

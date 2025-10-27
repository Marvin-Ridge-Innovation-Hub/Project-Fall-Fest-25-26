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
    <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-black font-sans">
      {/* Desktop/tablet layout */}
      {/* Fixed left sidebar on md+ that hugs the left and fills full height */}
      <aside className="hidden md:flex fixed left-0 top-0 h-dvh w-80 flex-col gap-4 p-4 bg-white dark:bg-black border-r border-black/10 dark:border-white/15 z-10 overflow-y-auto">
        <div className="w-full flex items-center justify-center pt-1">
          <img
            src="/csclogo.png"
            alt="CSC Logo"
            className="w-full h-auto object-contain"
            decoding="async"
            loading="eager"
          />
        </div>
        <div className="rounded-lg">
          <Leaderboard refreshKey={refreshKey} />
        </div>
      </aside>
      {/* Main game area shifted to the right of the sidebar */}
      <main className="hidden md:flex flex-1 md:ml-80">
        <section className="flex-1 flex flex-col items-center p-6 md:p-10 w-full">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">
            Fall Fest 25-26 - Flappy Bird
          </h1>
          <div className="flex items-start justify-center w-full">
            <FlappyBird onScoreSubmitted={() => setRefreshKey((k) => k + 1)} />
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
          className="absolute top-3 right-3 z-40 rounded-full bg-black/70 text-white px-3 py-2 text-sm shadow-md"
        >
          Leaderboard
        </button>
        <Modal open={showLB} onClose={() => setShowLB(false)} title="Fall Fest 25-26 - Flappy Bird Leaderboard">
          <div className="w-full flex items-center justify-center mb-3">
            <img
              src="/csclogo.png"
              alt="CSC Logo"
              className="w-full h-auto object-contain"
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

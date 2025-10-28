"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Base design values (used to scale physics and sizes for different viewports)
const BASE_WIDTH = 480;
const BASE_HEIGHT = 640;
const BASE_GROUND_H = 40; // ground thickness from bottom
const BASE_PIPE_WIDTH = 70;
const BASE_GAP = 160;
const PIPE_INTERVAL_MS = 1500;
const BASE_SPEED = 2.2; // px per frame baseline (horizontal)
const BASE_GRAVITY = 0.45; // velocity per frame (vertical)
const BASE_FLAP = -8.5; // jump impulse (vertical)
// Difficulty scaling
const MAX_LEVEL = 8; // stop scaling after score >= 80
const SPEED_PER_LEVEL = 0.08; // +8% horizontal speed per level
const GRAVITY_PER_LEVEL = 0.04; // +4% gravity per level
const GAP_REDUCTION_PER_LEVEL = 0.06; // -6% pipe gap per level
const INTERVAL_REDUCTION_MS_PER_LEVEL = 70; // -70ms spawn interval per level

type Pipe = {
  x: number;
  gapY: number;
  passed: boolean;
  hasTrigger?: boolean;
};

export default function FlappyBird({ onScoreSubmitted, fullScreen = false }: { onScoreSubmitted: () => void; fullScreen?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef<number>(BASE_WIDTH);
  const heightRef = useRef<number>(BASE_HEIGHT);

  // Assets
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const imagesRef = useRef<{ [k: string]: HTMLImageElement }>({});
  const audioRef = useRef<{ [k: string]: HTMLAudioElement }>({});
  const birdFrameRef = useRef<number>(0);
  const birdFrameTimeRef = useRef<number>(0);
  const digitsRef = useRef<HTMLImageElement[]>([]);
  // Pre-tinted pipe sprite variants per difficulty level to avoid per-frame filters (mobile perf)
  const tintedPipesRef = useRef<HTMLCanvasElement[]>([]);
  // Render scale to reduce fill rate on mobile (logical units stay the same)
  const renderScaleRef = useRef<number>(1);
  // Rate-limit point sound to avoid audio-induced jank
  const lastPointAtRef = useRef<number>(0);

  const [running, setRunning] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [studentId, setStudentId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastInitial, setLastInitial] = useState<string>("");
  const [requiresProfile, setRequiresProfile] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // game state refs (for raf loop without stale closures)
  const birdY = useRef<number>(BASE_HEIGHT / 2);
  const birdV = useRef<number>(0);
  const pipes = useRef<Pipe[]>([]);
  const lastSpawnAt = useRef<number>(0);
  const pipeSpawnCount = useRef<number>(0);
  // tint is tied to difficulty level

  const reset = useCallback(() => {
    setScore(0);
    setGameOver(false);
    setRunning(false);
    const H = heightRef.current;
    birdY.current = H / 2;
    birdV.current = 0;
    pipes.current = [];
    lastSpawnAt.current = 0;
  pipeSpawnCount.current = 0;
    // reset submission fields
    setStudentId("");
    setFirstName("");
    setLastInitial("");
    setRequiresProfile(false);
  }, []);

  const flap = useCallback(() => {
    if (!running && !gameOver) {
      setRunning(true);
    }
    if (gameOver) return;
  const hScale = heightRef.current / BASE_HEIGHT;
  birdV.current = BASE_FLAP * hScale;
    // play wing sound if available
    const wing = audioRef.current["wing"];
    if (wing) {
      try {
        wing.currentTime = 0;
        wing.play();
      } catch {}
    }
  }, [gameOver, running]);

  // input handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
      if (e.code === "Enter" && gameOver) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [flap, gameOver, reset]);

  // pointer input only on canvas to avoid triggering from overlay buttons
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onPointerDown = () => flap();
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [flap]);

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const spawnPipe = () => {
      const W = widthRef.current;
      const H = heightRef.current;
      const wScale = W / BASE_WIDTH;
      const hScale = H / BASE_HEIGHT;
      const GROUND_Y = H - BASE_GROUND_H * hScale;
      // difficulty-adjusted gap
      const level = Math.min(MAX_LEVEL, Math.floor(score / 10));
      const gapMul = Math.max(1 - GAP_REDUCTION_PER_LEVEL * level, 0.65);
      const GAP = Math.max(60 * hScale, BASE_GAP * hScale * gapMul);
      const PIPE_WIDTH = BASE_PIPE_WIDTH * wScale;
      const margin = 80 * hScale;
      const range = Math.max(1, GROUND_Y - GAP - margin * 2);
      const gapY = Math.floor(Math.random() * range) + margin;
  pipeSpawnCount.current += 1;
  const hasTrigger = pipeSpawnCount.current % 10 === 0;
  pipes.current.push({ x: W + 20 * wScale, gapY, passed: false, hasTrigger });
    };

    const loop = (now: number) => {
      const dt = Math.min(32, now - lastTime); // clamp dt for stability
      lastTime = now;

  // update when running
  if (running && !gameOver) {
        // spawn pipes
        if (lastSpawnAt.current === 0) lastSpawnAt.current = now;
        // difficulty-adjusted spawn interval
        {
          const level = Math.min(MAX_LEVEL, Math.floor(score / 10));
          const spawnInterval = Math.max(900, PIPE_INTERVAL_MS - INTERVAL_REDUCTION_MS_PER_LEVEL * level);
          if (now - lastSpawnAt.current > spawnInterval) {
            spawnPipe();
            lastSpawnAt.current = now;
          }
        }

        // physics
  const H = heightRef.current;
  const hScale = H / BASE_HEIGHT;
  const level = Math.min(MAX_LEVEL, Math.floor(score / 10));
  const gravityMul = Math.min(1 + GRAVITY_PER_LEVEL * level, 1.4);
  const GRAVITY = BASE_GRAVITY * hScale * gravityMul;
        birdV.current += GRAVITY * (dt / 16.67);
        birdY.current += birdV.current * (dt / 16.67);

        // bird flap animation timer (cycle frames ~10 fps)
        birdFrameTimeRef.current += dt;
        if (birdFrameTimeRef.current > 100) {
          birdFrameRef.current = (birdFrameRef.current + 1) % 3;
          birdFrameTimeRef.current = 0;
        }

        // move pipes
  const W = widthRef.current;
  const wScale = W / BASE_WIDTH;
  const speedMul = Math.min(1 + SPEED_PER_LEVEL * Math.min(MAX_LEVEL, Math.floor(score / 10)), 1.6);
  const dx = BASE_SPEED * speedMul * wScale * (dt / 16.67);
        pipes.current.forEach((p) => (p.x -= dx * 3));
        // remove offscreen
        const PIPE_WIDTH = BASE_PIPE_WIDTH * wScale;
        pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > -10 * wScale);

        // scoring and collisions
        pipes.current.forEach((p) => {
          const W2 = widthRef.current;
          const H2 = heightRef.current;
          const wS = W2 / BASE_WIDTH;
          const hS = H2 / BASE_HEIGHT;
          const level = Math.min(MAX_LEVEL, Math.floor(score / 10));
          const gapMul = Math.max(1 - GAP_REDUCTION_PER_LEVEL * level, 0.65);
          const GAP = Math.max(60 * hS, BASE_GAP * hS * gapMul);
          const PIPE_WIDTH = BASE_PIPE_WIDTH * wS;
          const GROUND_Y = H2 - BASE_GROUND_H * hS;
          const birdX = W2 * 0.25; // bird x
          const r = 12 * Math.min(wS, hS); // bird radius
          if (!p.passed && p.x + PIPE_WIDTH < birdX) {
            p.passed = true;
            setScore((s) => s + 1);
            const point = audioRef.current["point"];
            const nowTs = performance.now();
            if (point && nowTs - lastPointAtRef.current > 150) {
              lastPointAtRef.current = nowTs;
              try {
                point.currentTime = 0;
                point.play();
              } catch {}
            }
          }
          // collision check (AABB around bird)
          const inPipeX = birdX + r > p.x && birdX - r < p.x + PIPE_WIDTH;
          const topBottomY = birdY.current - r < p.gapY || birdY.current + r > p.gapY + GAP;
          if (inPipeX && topBottomY) {
            setGameOver(true);
            const hit = audioRef.current["hit"];
            const die = audioRef.current["die"];
            try {
              if (hit) {
                hit.currentTime = 0;
                hit.play();
              }
              if (die) {
                die.currentTime = 0;
                die.play();
              }
            } catch {}
          }

        });

        // ground/ceiling
        const H3 = heightRef.current;
        const hS2 = H3 / BASE_HEIGHT;
        const GROUND_Y = H3 - BASE_GROUND_H * hS2;
        const r2 = 12 * Math.min(widthRef.current / BASE_WIDTH, hS2);
        if (birdY.current + r2 >= GROUND_Y || birdY.current - r2 <= 0) {
          setGameOver(true);
        }
      }

      // draw
  // clear full backbuffer (unscaled)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw in logical coordinates at reduced backbuffer scale
  const scale = renderScaleRef.current;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const W = widthRef.current;
  const H = heightRef.current;
      const wScale = W / BASE_WIDTH;
      const hScale = H / BASE_HEIGHT;
      const PIPE_WIDTH = BASE_PIPE_WIDTH * wScale;
      // difficulty-adjusted gap for drawing to match collisions
      {
        /* scope block to avoid leaking variables */
      }
      const levelDraw = Math.min(MAX_LEVEL, Math.floor(score / 10));
      const gapMulDraw = Math.max(1 - GAP_REDUCTION_PER_LEVEL * levelDraw, 0.65);
      const GAP = Math.max(60 * hScale, BASE_GAP * hScale * gapMulDraw);
      const GROUND_Y = H - BASE_GROUND_H * hScale;
      const r = 12 * Math.min(wScale, hScale);

      ctx.clearRect(0, 0, W, H);
      // background image (draw if loaded, otherwise sky color)
      const bg = imagesRef.current["background-day"];
      if (bg && assetsLoaded) {
        ctx.drawImage(bg, 0, 0, W, H);
      } else {
        // fallback sky while assets load
        ctx.fillStyle = "#87CEEB";
        ctx.fillRect(0, 0, W, H);
      }
      // ground/base image (if loaded); otherwise a simple ground strip
      const baseImg = imagesRef.current["base"];
      if (baseImg && assetsLoaded) {
        const baseH = Math.max(1, H - GROUND_Y);
        const scale = baseH / baseImg.height;
        const tileW = baseImg.width * scale;
        for (let x = 0; x < W + tileW; x += tileW) {
          ctx.drawImage(baseImg, x, GROUND_Y, tileW, baseH);
        }
      } else {
        ctx.fillStyle = "#d0b07e";
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      }

      // pipes (use green pipe sprite; flip for top). Skip drawing until loaded.
      // choose pre-tinted pipe sprite for current level
      const levelIdx = Math.min(MAX_LEVEL, Math.floor(score / 10));
      const tintedPipe = tintedPipesRef.current[levelIdx];
      const pipeImg = imagesRef.current["pipe-green"];
      if ((tintedPipe || pipeImg) && assetsLoaded) {
        ctx.save();
        const sprite = tintedPipe || pipeImg;
        pipes.current.forEach((p) => {
          // top pipe (flipped)
          ctx.save();
          ctx.translate(p.x + PIPE_WIDTH / 2, p.gapY);
          ctx.scale(1, -1);
          ctx.drawImage(
            sprite,
            -PIPE_WIDTH / 2,
            0,
            PIPE_WIDTH,
            Math.max(1, p.gapY)
          );
          ctx.restore();
          // bottom pipe
          ctx.drawImage(
            sprite,
            p.x,
            p.gapY + GAP,
            PIPE_WIDTH,
            Math.max(1, GROUND_Y - (p.gapY + GAP))
          );

          // draw translucent trigger rectangle spanning the gap (every 10th pipe only)
          if (p.hasTrigger) {
            ctx.save();
            ctx.filter = "none"; // do not tint the rectangle
            const levelHue = Math.min(MAX_LEVEL, Math.floor(score / 10)) * 45;
            ctx.fillStyle = `hsla(${levelHue}, 90%, 50%, 0.18)`;
            ctx.fillRect(p.x, p.gapY, PIPE_WIDTH, GAP);
            ctx.restore();
          }
        });
        ctx.restore();
      }

      // bird sprite (yellow). Skip drawing until loaded.
      const birdX = W * 0.25;
      const frames = [
        imagesRef.current["yellowbird-upflap"],
        imagesRef.current["yellowbird-midflap"],
        imagesRef.current["yellowbird-downflap"],
      ];
      const frame = frames[birdFrameRef.current % frames.length];
      if (frame && assetsLoaded) {
        const bw = 34 * Math.min(wScale, hScale); // nominal sprite size ~34x24
        const bh = 24 * Math.min(wScale, hScale);
        // rotate slightly based on velocity
        const angle = Math.max(-0.8, Math.min(0.6, birdV.current / 10));
        ctx.save();
        ctx.translate(birdX, birdY.current);
        ctx.rotate(angle);
        ctx.drawImage(frame, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }

  // score using digit sprites only when available (skip until loaded)
      const digits = digitsRef.current;
      const sStr = String(score);
      if (digits.length === 10 && assetsLoaded) {
        const dH = 36 * Math.min(wScale, hScale);
        const dW = 24 * Math.min(wScale, hScale);
        const totalW = dW * sStr.length;
        let x = (W - totalW) / 2;
        const y = 20 * Math.min(wScale, hScale);
        for (const ch of sStr) {
          const idx = ch.charCodeAt(0) - 48;
          if (idx >= 0 && idx <= 9) {
            ctx.drawImage(digits[idx], x, y, dW, dH);
            x += dW;
          }
        }
      }

      if (!running) {
        // show start message image
        const msg = imagesRef.current["message"];
        if (msg && assetsLoaded) {
          const iw = msg.width;
          const ih = msg.height;
          const scale = Math.min(1, (W * 0.7) / iw);
          const w = iw * scale;
          const h = ih * scale;
          ctx.drawImage(msg, (W - w) / 2, H * 0.35 - h / 2, w, h);
        } else {
          // fallback start text
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(20 * Math.min(wScale, hScale))}px sans-serif`;
          const text = "Tap/Click or press Space to start";
          const metrics = ctx.measureText(text);
          ctx.fillText(text, (W - metrics.width) / 2, H * 0.5);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameOver, running, score]);

  // Size the canvas to the container (fullScreen) or base size
  useEffect(() => {
    const resizeToContainer = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;
      let newW = BASE_WIDTH;
      let newH = BASE_HEIGHT;
      if (fullScreen && container) {
        newW = Math.max(1, container.clientWidth);
        newH = Math.max(1, container.clientHeight);
      }
      // Pick a render scale < 1 on mobile to reduce fill rate
      const isSmall = Math.min(newW, newH) < 700;
      renderScaleRef.current = isSmall ? 0.75 : 1;
      // adjust positions proportionally to avoid sudden jumps
      const prevW = widthRef.current;
      const prevH = heightRef.current;
      if (prevW !== 0 && prevH !== 0) {
        const wRatio = newW / prevW;
        const hRatio = newH / prevH;
        birdY.current *= hRatio;
        pipes.current = pipes.current.map((p) => ({
          x: p.x * wRatio,
          gapY: p.gapY * hRatio,
          passed: p.passed,
          hasTrigger: p.hasTrigger,
        }));
      }
      widthRef.current = newW;
      heightRef.current = newH;
      // Set physical backbuffer size smaller by renderScale
      canvas.width = Math.max(1, Math.floor(newW * renderScaleRef.current));
      canvas.height = Math.max(1, Math.floor(newH * renderScaleRef.current));
    };
    resizeToContainer();
    window.addEventListener("resize", resizeToContainer);
    window.addEventListener("orientationchange", resizeToContainer);
    return () => {
      window.removeEventListener("resize", resizeToContainer);
      window.removeEventListener("orientationchange", resizeToContainer);
    };
  }, [fullScreen]);

  // Load assets from public folder
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      try {
        const base = "/flappy-bird-assets-master";
        const entries: [string, string][] = [
          ["background-day", `${base}/sprites/background-day.png`],
          ["base", `${base}/sprites/base.png`],
          ["pipe-green", `${base}/sprites/pipe-green.png`],
          ["yellowbird-upflap", `${base}/sprites/yellowbird-upflap.png`],
          ["yellowbird-midflap", `${base}/sprites/yellowbird-midflap.png`],
          ["yellowbird-downflap", `${base}/sprites/yellowbird-downflap.png`],
          ["message", `${base}/sprites/message.png`],
          ["gameover", `${base}/sprites/gameover.png`],
        ];
        const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
        const map: { [k: string]: HTMLImageElement } = {};
        entries.forEach(([key], i) => (map[key] = images[i]));
        if (!cancelled) {
          imagesRef.current = map;
        }

        // audio
        const audioMap: { [k: string]: HTMLAudioElement } = {
          wing: new Audio(`${base}/audio/wing.wav`),
          point: new Audio(`${base}/audio/point.wav`),
          hit: new Audio(`${base}/audio/hit.wav`),
          die: new Audio(`${base}/audio/die.wav`),
        };
        Object.values(audioMap).forEach((a) => {
          a.preload = "auto";
          a.volume = 0.6;
        });
        // digits
        const digitPaths = Array.from({ length: 10 }, (_, i) => `${base}/sprites/${i}.png`);
        const digitImgs = await Promise.all(digitPaths.map((p) => loadImage(p)));
        // Precompute tinted pipe variants for each level (0..MAX_LEVEL)
        const basePipe = map["pipe-green"];
        const tints: HTMLCanvasElement[] = [];
        if (basePipe) {
          for (let lvl = 0; lvl <= MAX_LEVEL; lvl++) {
            const deg = lvl * 45; // 0..360
            const c = document.createElement("canvas");
            c.width = basePipe.width;
            c.height = basePipe.height;
            const cctx = c.getContext("2d");
            if (cctx) {
              // draw original
              cctx.drawImage(basePipe, 0, 0);
              // overlay a color with multiply to tint while preserving shading
              cctx.globalCompositeOperation = "multiply";
              cctx.fillStyle = `hsl(${deg}, 80%, 60%)`;
              cctx.fillRect(0, 0, c.width, c.height);
              // keep alpha of original sprite
              cctx.globalCompositeOperation = "destination-in";
              cctx.drawImage(basePipe, 0, 0);
              cctx.globalCompositeOperation = "source-over";
            }
            tints.push(c);
          }
        }

        if (!cancelled) {
          audioRef.current = audioMap;
          digitsRef.current = digitImgs;
          tintedPipesRef.current = tints;
          setAssetsLoaded(true);
        }
      } catch {
        if (!cancelled) setAssetsLoaded(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitScore = useCallback(async () => {
    if (!studentId.trim()) {
      alert("Please enter your Student ID or email prefix.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { id: studentId.trim(), score };
      if (requiresProfile) {
        if (!firstName.trim() || !lastInitial.trim()) {
          alert("Please enter your first name and last initial.");
          setSubmitting(false);
          return;
        }
        payload.firstName = firstName.trim();
        payload.lastInitial = lastInitial.trim().charAt(0).toUpperCase();
      }
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        // server requests profile info for new id
        setRequiresProfile(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to submit score");
      onScoreSubmitted();
      reset();
    } catch (e) {
      alert((e as Error).message || "Failed to submit score");
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastInitial, onScoreSubmitted, reset, requiresProfile, score, studentId]);

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div
        ref={containerRef}
        className={fullScreen ? "relative w-screen h-dvh overflow-hidden" : "relative"}
        style={fullScreen ? undefined : { width: BASE_WIDTH, height: BASE_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={widthRef.current}
          height={heightRef.current}
          style={{ display: "block", width: fullScreen ? "100%" : BASE_WIDTH, height: fullScreen ? "100%" : BASE_HEIGHT, touchAction: "none" }}
          className="rounded-lg shadow border border-black/10 dark:border-white/15 bg-white cursor-pointer"
        />
        {/* Start message drawn into canvas; no HTML overlay needed */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex flex-col items-center">
              <img
                src="/flappy-bird-assets-master/sprites/gameover.png"
                alt="Game Over"
                className="mb-3 w-64 max-w-[80vw] h-auto pointer-events-none select-none"
                decoding="async"
                loading="eager"
              />
              <div className="w-[85%] max-w-sm rounded-lg bg-white/95 dark:bg-black/90 p-4 border border-black/10 dark:border-white/15">
              <div className="text-lg font-semibold mb-1">Score: {score}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Enter your Student ID (or teacher email prefix) to submit your score.
              </div>
              <input
                className="w-full mb-2 rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-400"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student ID or email prefix"
                maxLength={40}
              />
              {requiresProfile && (
                <div className="grid grid-cols-1 gap-2 mb-2">
                  <input
                    className="w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-400"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    maxLength={40}
                  />
                  <input
                    className="w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-400"
                    value={lastInitial}
                    onChange={(e) => setLastInitial(e.target.value)}
                    placeholder="Last initial"
                    maxLength={1}
                  />
                  <div className="text-xs text-zinc-500">We only store your first name and last initial.</div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  className="px-3 py-2 rounded border border-black/20 dark:border-white/20 text-sm"
                  onClick={reset}
                  disabled={submitting}
                >
                  Skip
                </button>
                <button
                  className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-50"
                  onClick={submitScore}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : requiresProfile ? "Submit" : "Continue"}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

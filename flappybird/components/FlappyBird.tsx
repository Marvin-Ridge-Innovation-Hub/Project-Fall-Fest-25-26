"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Base design values (used to scale physics and sizes for different viewports)
const BASE_WIDTH = 480;
const BASE_HEIGHT = 640;
const BASE_PIPE_WIDTH = 70;
const BASE_GAP = 160;
const PIPE_INTERVAL_MS = 1300; // Increased for better spacing between pipes
const BASE_SPEED = 3.5; // Increased for better game feel
const BASE_GRAVITY = 0.45; // velocity per frame (vertical)
const BASE_FLAP = -8.5; // jump impulse (vertical)
// Difficulty scaling
const MAX_LEVEL = 8; // stop scaling after score >= 80
const SPEED_PER_LEVEL = 0.06; // Reduced from 0.08 for more gradual difficulty increase
const GRAVITY_PER_LEVEL = 0.03; // Reduced from 0.04
const GAP_REDUCTION_PER_LEVEL = 0.05; // Reduced from 0.06
const INTERVAL_REDUCTION_MS_PER_LEVEL = 90; // Reduced from 70ms spawn interval per level

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
  // Use a ref for the RAF loop so it sees live asset state
  const assetsLoadedRef = useRef<boolean>(false);
  const imagesRef = useRef<{ [k: string]: HTMLImageElement }>({});
  // City backgrounds: array of cities, each containing array of layers
  const cityBackgroundsRef = useRef<HTMLImageElement[][]>([]);
  const audioRef = useRef<{ [k: string]: HTMLAudioElement }>({});
  const birdFrameRef = useRef<number>(0);
  const birdFrameTimeRef = useRef<number>(0);
  const digitsRef = useRef<HTMLImageElement[]>([]);
  // Pre-tinted pipe sprite variants per difficulty level to avoid per-frame filters (mobile perf)
  const tintedPipesRef = useRef<HTMLCanvasElement[]>([]);

  const [running, setRunning] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  // mirror critical states into refs so the RAF loop doesn't depend on React rerenders
  const runningRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
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
  // Background management: 0 = flappy bird default, 1-8 = cities
  const currentBgIndex = useRef<number>(0);
  // tint is tied to difficulty level
  // Parallax scrolling offset for background
  const parallaxOffsetRef = useRef<number>(0);

  // Audio pooling and throttling to reduce mobile stutter on tap
  const wingPoolRef = useRef<HTMLAudioElement[]>([]);
  const wingPoolIdxRef = useRef<number>(0);
  const wingLastAtRef = useRef<number>(0);
  // WebAudio for instant, non-blocking sounds on mobile
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wingBufferRef = useRef<AudioBuffer | null>(null);
  const pointBufferRef = useRef<AudioBuffer | null>(null);

  const reset = useCallback(() => {
    setScore(0);
    setGameOver(false);
    setRunning(false);
    // keep refs in sync
    scoreRef.current = 0;
    gameOverRef.current = false;
    runningRef.current = false;
    const H = heightRef.current;
    birdY.current = H / 2;
    birdV.current = 0;
    pipes.current = [];
    lastSpawnAt.current = 0;
  pipeSpawnCount.current = 0;
    currentBgIndex.current = 0; // Reset to default flappy bird background
    parallaxOffsetRef.current = 0;
    // reset submission fields
    setStudentId("");
    setFirstName("");
    setLastInitial("");
    setRequiresProfile(false);
  }, []);

  const flap = useCallback(() => {
    // start game on first tap
    if (!runningRef.current && !gameOverRef.current) {
      setRunning(true);
      runningRef.current = true;
    }
    if (gameOverRef.current) return;
    const hScale = heightRef.current / BASE_HEIGHT;
    birdV.current = BASE_FLAP * hScale;
    // play wing sound instantly using WebAudio (non-blocking, best for mobile)
    const now = performance.now();
    if (now - wingLastAtRef.current > 80) {
      const ctx = audioCtxRef.current;
      const buffer = wingBufferRef.current;
      if (ctx && buffer) {
        try {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        } catch {}
      }
      wingLastAtRef.current = now;
    }
  }, []);

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
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      flap();
    };
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false } as AddEventListenerOptions);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown as any);
    };
  }, [flap]);

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Avoid tiny seams by disabling smoothing (pixel art) and keeping integer draws
    ctx.imageSmoothingEnabled = false;

    let lastTime = performance.now();

    const spawnPipe = () => {
      const W = widthRef.current;
      const H = heightRef.current;
      const wScale = W / BASE_WIDTH;
      const hScale = H / BASE_HEIGHT;
      // Use hScale for pipe width so pipes don't get huge on wide screens
      // difficulty-adjusted gap
      const level = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
      const gapMul = Math.max(1 - GAP_REDUCTION_PER_LEVEL * level, 0.65);
      const GAP = Math.max(60 * hScale, BASE_GAP * hScale * gapMul);
      const PIPE_WIDTH = BASE_PIPE_WIDTH * hScale; // Changed from wScale to hScale
      const margin = 80 * hScale;
      const range = Math.max(1, H - GAP - margin * 2);
      const gapY = Math.floor(Math.random() * range) + margin;
  pipeSpawnCount.current += 1;
  const hasTrigger = pipeSpawnCount.current % 10 === 0;
  pipes.current.push({ x: W + 20 * wScale, gapY, passed: false, hasTrigger });
    };

    const loop = (now: number) => {
      const dt = Math.min(32, now - lastTime); // clamp dt for stability
      lastTime = now;

  // update when running
  if (runningRef.current && !gameOverRef.current) {
        // spawn pipes
        if (lastSpawnAt.current === 0) lastSpawnAt.current = now;
        // difficulty-adjusted spawn interval
        {
          const level = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
          const spawnInterval = Math.max(900, PIPE_INTERVAL_MS - INTERVAL_REDUCTION_MS_PER_LEVEL * level);
          if (now - lastSpawnAt.current > spawnInterval) {
            spawnPipe();
            lastSpawnAt.current = now;
          }
        }

        // physics
  const H = heightRef.current;
  const hScale = H / BASE_HEIGHT;
  const level = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
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
  const hScalePipe = heightRef.current / BASE_HEIGHT;
  const speedMul = Math.min(1 + SPEED_PER_LEVEL * Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10)), 1.6);
  const dx = BASE_SPEED * speedMul * wScale * (dt / 16.67);
        pipes.current.forEach((p) => (p.x -= dx)); // Removed * 3 multiplier
        // Update parallax offset (background scrolls at 30% of foreground speed)
        parallaxOffsetRef.current += dx * 0.3;
        // remove offscreen
        const PIPE_WIDTH = BASE_PIPE_WIDTH * hScalePipe; // Changed from wScale to hScale
        pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > -10 * wScale);

        // scoring and collisions
        pipes.current.forEach((p) => {
          const W2 = widthRef.current;
          const H2 = heightRef.current;
          const wS = W2 / BASE_WIDTH;
          const hS = H2 / BASE_HEIGHT;
          const level = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
          const gapMul = Math.max(1 - GAP_REDUCTION_PER_LEVEL * level, 0.65);
          const GAP = Math.max(60 * hS, BASE_GAP * hS * gapMul);
          const PIPE_WIDTH = BASE_PIPE_WIDTH * hS; // Changed from wS to hS
          const birdX = W2 * 0.25; // bird x
          const r = 12 * Math.min(wS, hS); // bird radius
          if (!p.passed && p.x + PIPE_WIDTH < birdX) {
            p.passed = true;
            setScore((s) => {
              const ns = s + 1;
              scoreRef.current = ns;
              // Update background every 10 points: 0-9=default, 10-19=city1, 20-29=city2, etc.
              const newBgIndex = Math.floor(ns / 10);
              if (newBgIndex !== currentBgIndex.current && newBgIndex <= 8) {
                currentBgIndex.current = newBgIndex;
              }
              return ns;
            });
            // Play point sound using WebAudio (instant, non-blocking)
            const ctx = audioCtxRef.current;
            const buffer = pointBufferRef.current;
            if (ctx && buffer) {
              try {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
              } catch {}
            }
          }
          // collision check (AABB around bird)
          const inPipeX = birdX + r > p.x && birdX - r < p.x + PIPE_WIDTH;
          const topBottomY = birdY.current - r < p.gapY || birdY.current + r > p.gapY + GAP;
          if (inPipeX && topBottomY) {
            setGameOver(true);
            gameOverRef.current = true;
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

        // ceiling collision (bird hits top)
        const H3 = heightRef.current;
        const hS2 = H3 / BASE_HEIGHT;
        const r2 = 12 * Math.min(widthRef.current / BASE_WIDTH, hS2);
        if (birdY.current - r2 <= 0 || birdY.current + r2 >= H3) {
          setGameOver(true);
          gameOverRef.current = true;
        }
      }

      // draw
      const W = widthRef.current;
      const H = heightRef.current;
      const wScale = W / BASE_WIDTH;
      const hScale = H / BASE_HEIGHT;
      const PIPE_WIDTH = BASE_PIPE_WIDTH * hScale; // Changed from wScale to hScale
      // difficulty-adjusted gap for drawing to match collisions
      const levelDraw = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
      const gapMulDraw = Math.max(1 - GAP_REDUCTION_PER_LEVEL * levelDraw, 0.65);
      const GAP = Math.max(60 * hScale, BASE_GAP * hScale * gapMulDraw);
      const r = 12 * Math.min(wScale, hScale);

      ctx.clearRect(0, 0, W, H);
      // background image with parallax scrolling (draw if loaded, otherwise sky color)
      if (assetsLoadedRef.current) {
        if (currentBgIndex.current === 0) {
          // Default flappy bird background
          const bg = imagesRef.current["background-day"];
          if (bg) {
            // Scale background to cover height, tile horizontally with parallax offset
            const bgScale = H / bg.height;
            const bgW = bg.width * bgScale;
            // Snap and slightly overlap tiles to remove thin slits on some DPRs
            const parallaxX = Math.floor((-parallaxOffsetRef.current % bgW));
            // Draw multiple tiles to cover the width with parallax
            for (let x = parallaxX - bgW; x < W + bgW; x += bgW) {
              const xi = Math.floor(x) - 1; // bleed by 1px on the left
              const ww = Math.ceil(bgW) + 2; // and 1px on the right
              ctx.drawImage(bg, xi, 0, ww, Math.ceil(H));
            }
          }
        } else {
          // City backgrounds with multi-layer parallax
          const cityLayers = cityBackgroundsRef.current[currentBgIndex.current - 1];
          if (cityLayers && cityLayers.length > 0) {
            // Render each layer with increasing parallax speed (layer 1 = slowest, higher layers = faster)
            cityLayers.forEach((layerImg, layerIndex) => {
              // Parallax speed increases with layer index: 0.1x, 0.2x, 0.3x, etc.
              const parallaxSpeed = (layerIndex + 1) * 0.1;
              const layerParallax = parallaxOffsetRef.current * parallaxSpeed;
              
              const bgScale = H / layerImg.height;
              const bgW = layerImg.width * bgScale;
              const parallaxX = Math.floor((-layerParallax % bgW));
              
              for (let x = parallaxX - bgW; x < W + bgW; x += bgW) {
                const xi = Math.floor(x) - 1;
                const ww = Math.ceil(bgW) + 2;
                ctx.drawImage(layerImg, xi, 0, ww, Math.ceil(H));
              }
            });
          }
        }
      } else {
        // fallback sky while assets load
        ctx.fillStyle = "#87CEEB";
        ctx.fillRect(0, 0, W, H);
      }

      // pipes (use green pipe sprite; flip for top). Skip drawing until loaded.
      // choose pre-tinted pipe sprite for current level
      const levelIdx = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
      const tintedPipe = tintedPipesRef.current[levelIdx];
      const pipeImg = imagesRef.current["pipe-green"];
      if ((tintedPipe || pipeImg) && assetsLoadedRef.current) {
        ctx.save();
        // Re-enable smoothing for pipes to avoid scaling artifacts
        ctx.imageSmoothingEnabled = true;
        const sprite = tintedPipe || pipeImg;
        
        pipes.current.forEach((p) => {
          // Snap positions/sizes to integers - consistent rounding is key
          const px = Math.round(p.x);
          const pw = Math.max(1, Math.round(PIPE_WIDTH));
          const gapY = Math.round(p.gapY);
          const gapH = Math.round(GAP);
          const bottomY = gapY + gapH;
          const bottomH = Math.max(1, H - bottomY); // Pipes extend to bottom of screen

          // The pipe sprite maintains its aspect ratio when scaled to width
          const spriteAspect = sprite.width / sprite.height;
          const scaledSpriteH = pw / spriteAspect;

          // Top pipe: Draw sprite flipped so the opening/notch appears at the gap
          // Fill from top (0) to gapY with the pipe, showing the notch at the bottom (gap edge)
          ctx.save();
          ctx.translate(px + pw / 2, gapY);
          ctx.scale(1, -1); // flip vertically
          // Tile the pipe upward from the gap
          for (let y = 0; y < gapY + scaledSpriteH; y += scaledSpriteH) {
            ctx.drawImage(sprite, -pw / 2, y, pw, scaledSpriteH);
          }
          ctx.restore();

          // Bottom pipe: Draw normally so the opening/notch appears at the gap
          // Tile the pipe downward from bottomY to canvas bottom
          for (let y = bottomY; y < H + scaledSpriteH; y += scaledSpriteH) {
            ctx.drawImage(sprite, px, y, pw, scaledSpriteH);
          }

          // draw translucent trigger rectangle spanning the gap (every 10th pipe only)
          if (p.hasTrigger) {
            ctx.save();
            ctx.filter = "none"; // do not tint the rectangle
            const levelIdx = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
            const colorHues = [120, 55, 30, 0, 280, 230, 195, 330, 0]; // match pipe colors
            const levelHue = colorHues[levelIdx] || 0;
            const levelSat = levelIdx === 8 ? 0 : 90; // desaturate for black
            const levelLight = levelIdx === 8 ? 20 : 60; // darker for black
            ctx.fillStyle = `hsla(${levelHue}, ${levelSat}%, ${levelLight}%, 0.2)`;
            // Use the same snapped values as the pipes
            ctx.fillRect(px, gapY, pw, gapH);
            ctx.restore();
          }
        });
        // Restore no-smoothing for pixel-perfect backgrounds
        ctx.imageSmoothingEnabled = false;
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
      if (frame && assetsLoadedRef.current) {
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
  const sStr = String(scoreRef.current);
      if (digits.length === 10 && assetsLoadedRef.current) {
        const dH = 36 * Math.min(wScale, hScale);
        const dW = 24 * Math.min(wScale, hScale);
        const totalW = dW * sStr.length;
        let x = Math.round((W - totalW) / 2);
        const y = Math.round(20 * Math.min(wScale, hScale));
        for (const ch of sStr) {
          const idx = ch.charCodeAt(0) - 48;
          if (idx >= 0 && idx <= 9) {
            ctx.drawImage(digits[idx], x, y, dW, dH);
            x += dW;
          }
        }
      }

      if (!runningRef.current) {
        // show start message image
        const msg = imagesRef.current["message"];
        if (msg && assetsLoadedRef.current) {
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
  }, []);

  // Size the canvas to the container (fullScreen) or base size
  useEffect(() => {
    const resizeToContainer = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;
      let newW = BASE_WIDTH;
      let newH = BASE_HEIGHT;
      if (fullScreen && container) {
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        // Maintain aspect ratio: fit height, then scale width proportionally
        const aspectRatio = BASE_WIDTH / BASE_HEIGHT;
        newH = containerH;
        newW = Math.round(newH * aspectRatio);
        // If width exceeds container, fit to width instead
        if (newW > containerW) {
          newW = containerW;
          newH = Math.round(newW / aspectRatio);
        }
      }
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
      canvas.width = newW;
      canvas.height = newH;
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
            // create a small wing sound pool to avoid currentTime resets on the same element
            const wingSrc = `${base}/audio/wing.wav`;
            const wingPool: HTMLAudioElement[] = [];
            for (let i = 0; i < 4; i++) {
              const clone = new Audio(wingSrc);
              clone.preload = "auto";
              clone.volume = 0.6;
              wingPool.push(clone);
            }
        const entries: [string, string][] = [
          ["background-day", `${base}/sprites/background-day.png`],
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
        
        // Load city backgrounds (8 cities, each with multiple layers)
        // Layer order: 1 (farthest/sky) to higher numbers (closer/foreground)
        const cityBgs: HTMLImageElement[][] = [];
        for (let cityNum = 1; cityNum <= 8; cityNum++) {
          const cityBase = `/free-city-backgrounds-pixel-art/city ${cityNum}`;
          // Try loading layers 1-10 (not all cities have all layers)
          const layerPromises = [1, 2, 3, 4, 5, 6, 7, 10].map(async (layerNum) => {
            try {
              return await loadImage(`${cityBase}/${layerNum}.png`);
            } catch {
              return null; // Layer doesn't exist for this city
            }
          });
          const layers = await Promise.all(layerPromises);
          // Filter out null values (non-existent layers)
          cityBgs.push(layers.filter((l): l is HTMLImageElement => l !== null));
        }
        
        if (!cancelled) {
          imagesRef.current = map;
          cityBackgroundsRef.current = cityBgs;
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
        
        // Load wing and point sounds into WebAudio buffers for instant, non-blocking playback on mobile
        let wingBuffer: AudioBuffer | null = null;
        let pointBuffer: AudioBuffer | null = null;
        let audioCtx: AudioContext | null = null;
        try {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const wingSrc = `${base}/audio/wing.wav`;
          const pointSrc = `${base}/audio/point.wav`;
          const [wingResponse, pointResponse] = await Promise.all([
            fetch(wingSrc),
            fetch(pointSrc)
          ]);
          const [wingArrayBuffer, pointArrayBuffer] = await Promise.all([
            wingResponse.arrayBuffer(),
            pointResponse.arrayBuffer()
          ]);
          [wingBuffer, pointBuffer] = await Promise.all([
            audioCtx.decodeAudioData(wingArrayBuffer),
            audioCtx.decodeAudioData(pointArrayBuffer)
          ]);
        } catch {
          // WebAudio not available or decode failed; fall back to HTMLAudio
        }
        
        // Precompute tinted pipe variants for each level (0..MAX_LEVEL)
        const basePipe = map["pipe-green"];
        const tints: HTMLCanvasElement[] = [];
              wingPoolRef.current = wingPool;
        if (basePipe) {
          // Vibrant color progression: green → yellow → orange → red → purple → navy blue → sky blue → pink → black
          const colorHues = [120, 55, 30, 0, 280, 230, 195, 330, 0]; // green, yellow, orange, red, purple, navy, sky blue, pink, black
          const saturations = [85, 95, 95, 95, 90, 95, 85, 90, 0]; // high saturation for vibrant colors, 0 for black
          const lightnesses = [50, 55, 55, 50, 50, 45, 60, 60, 15]; // adjusted for each color, very low for black
          
          for (let lvl = 0; lvl <= MAX_LEVEL; lvl++) {
            const hue = colorHues[lvl] || 0;
            const sat = saturations[lvl] || 0;
            const light = lightnesses[lvl] || 15;
            const c = document.createElement("canvas");
            c.width = basePipe.width;
            c.height = basePipe.height;
            const cctx = c.getContext("2d");
            if (cctx) {
              // Step 1: Draw original pipe
              cctx.drawImage(basePipe, 0, 0);
              
              // Step 2: Convert to grayscale using desaturation
              const imageData = cctx.getImageData(0, 0, c.width, c.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                // Calculate grayscale value (weighted average for better perception)
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = gray;     // R
                data[i + 1] = gray; // G
                data[i + 2] = gray; // B
                // Keep alpha (data[i + 3]) unchanged
              }
              cctx.putImageData(imageData, 0, 0);
              
              // Step 3: Apply vibrant color tint with multiply blend
              cctx.globalCompositeOperation = "multiply";
              cctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
              cctx.fillRect(0, 0, c.width, c.height);
              
              // Step 4: Restore alpha channel
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
          audioCtxRef.current = audioCtx;
          wingBufferRef.current = wingBuffer;
          pointBufferRef.current = pointBuffer;
          assetsLoadedRef.current = true;
          setAssetsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          assetsLoadedRef.current = false;
          setAssetsLoaded(false);
        }
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
    <div className={`w-full h-full flex flex-col ${fullScreen ? "items-center justify-center" : "items-center"}`}>
      <div
        ref={containerRef}
        className={fullScreen ? "relative w-full h-full flex items-center justify-center" : "relative"}
        style={fullScreen ? undefined : { width: BASE_WIDTH, height: BASE_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={widthRef.current}
          height={heightRef.current}
          style={{ 
            display: "block", 
            width: fullScreen ? `${widthRef.current}px` : BASE_WIDTH, 
            height: fullScreen ? `${heightRef.current}px` : BASE_HEIGHT, 
            touchAction: "none" 
          }}
          className="rounded-2xl shadow-2xl border-4 border-white/20 dark:border-white/10 bg-white cursor-pointer"
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
              <div className="w-[85%] max-w-sm rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-5 border-2 border-blue-200 dark:border-blue-800 shadow-2xl">
              <div className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Score: {score} 🎯
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Enter your Student ID (or teacher email prefix) to submit your score.
              </div>
              <input
                className="w-full mb-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student ID or email prefix"
                maxLength={40}
              />
              {requiresProfile && (
                <div className="grid grid-cols-1 gap-2 mb-2">
                  <input
                    className="w-full rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    maxLength={40}
                  />
                  <input
                    className="w-full rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                    value={lastInitial}
                    onChange={(e) => setLastInitial(e.target.value)}
                    placeholder="Last initial"
                    maxLength={1}
                  />
                  <div className="text-xs text-zinc-500">✨ We only store your first name and last initial.</div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2.5 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
                  onClick={reset}
                  disabled={submitting}
                >
                  Skip
                </button>
                <button
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={submitScore}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : requiresProfile ? "Submit 🚀" : "Continue →"}
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

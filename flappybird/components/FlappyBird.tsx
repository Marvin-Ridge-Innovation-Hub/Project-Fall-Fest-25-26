"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Base design values (used to scale physics and sizes for different viewports)
const BASE_WIDTH = 480;
const BASE_HEIGHT = 640;
const BASE_PIPE_WIDTH = 70;
const BASE_GAP = 160;
const PIPE_INTERVAL_MS = 1400; // Increased for better spacing between pipes
const BASE_SPEED = 3.5; // Increased for better game feel
const BASE_GRAVITY = 0.45; // velocity per frame (vertical)
const BASE_FLAP = -8.5; // jump impulse (vertical)
// Difficulty scaling
const MAX_LEVEL = 8; // stop scaling after score >= 80
const SPEED_PER_LEVEL = 0.05; // Reduced from 0.08 for more gradual difficulty increase
const GRAVITY_PER_LEVEL = 0.04; // Reduced from 0.04
const GAP_REDUCTION_PER_LEVEL = 0.02; // Reduced from 0.06
const INTERVAL_REDUCTION_MS_PER_LEVEL = 50; // Reduced from 70ms spawn interval per level

type Pipe = {
  x: number;
  gapY: number;
  passed: boolean;
  hasTrigger?: boolean;
  isFinishLine?: boolean;
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
  // Computed color configuration per level (matched to background dominant colors)
  const pipeColorConfigRef = useRef<{ hues: number[]; saturations: number[]; lightnesses: number[] }>({
    hues: [],
    saturations: [],
    lightnesses: [],
  });

  const [running, setRunning] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  // mirror critical states into refs so the RAF loop doesn't depend on React rerenders
  const runningRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
  const victoryFlyoutRef = useRef<boolean>(false); // Track if bird is flying out after victory
  const victoryFlyoutStartRef = useRef<number>(0); // When the flyout started
  const victoryCompleteRef = useRef<boolean>(false); // Track if bird has completely flown off screen
  // Dev: allow starting score from URL parameter (e.g., ?startScore=85)
  const startScoreRef = useRef<number>(0);
  const [studentId, setStudentId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastInitial, setLastInitial] = useState<string>("");
  const [requiresProfile, setRequiresProfile] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // game state refs (for raf loop without stale closures)
  const birdY = useRef<number>(BASE_HEIGHT / 2);
  const birdV = useRef<number>(0);
  const birdX = useRef<number>(0); // Track bird X position for victory flyout
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
  
  // Background music refs
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const currentMusicLevelRef = useRef<number>(-1); // Track which music is playing
  
  // Portal sound refs (using WebAudio for better iOS compatibility)
  const portalIdleBufferRef = useRef<AudioBuffer | null>(null);
  const portalIdleSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const portalIdleGainRef = useRef<GainNode | null>(null);
  const portalWarpSoundRef = useRef<HTMLAudioElement | null>(null);
  const activePortalRef = useRef<Pipe | null>(null); // Track which portal we're near

  const reset = useCallback(() => {
    const startScore = startScoreRef.current;
    setScore(startScore);
    setGameOver(false);
    setGameWon(false);
    setRunning(false);
    // keep refs in sync
    scoreRef.current = startScore;
    gameOverRef.current = false;
    runningRef.current = false;
    const H = heightRef.current;
    birdY.current = H / 2;
    birdV.current = 0;
    birdX.current = 0;
    pipes.current = [];
    lastSpawnAt.current = 0;
  pipeSpawnCount.current = 0;
    victoryFlyoutRef.current = false;
    victoryFlyoutStartRef.current = 0;
    victoryCompleteRef.current = false;
    currentBgIndex.current = Math.floor(startScore / 10); // Start with correct background
    parallaxOffsetRef.current = 0;
    
    // Stop and reset background music
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
    currentMusicLevelRef.current = -1;
    
    // Stop portal sounds
    if (portalIdleSourceRef.current) {
      try {
        portalIdleSourceRef.current.stop();
      } catch {}
      portalIdleSourceRef.current = null;
    }
    if (portalIdleGainRef.current) {
      portalIdleGainRef.current.gain.value = 0;
    }
    activePortalRef.current = null;
    
    // reset submission fields
    setStudentId("");
    setFirstName("");
    setLastInitial("");
    setRequiresProfile(false);
  }, []);

  // Dev: read startScore from URL parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const startScoreParam = params.get('startScore');
      if (startScoreParam) {
        const parsed = parseInt(startScoreParam, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          startScoreRef.current = parsed;
          setScore(parsed);
          scoreRef.current = parsed;
          currentBgIndex.current = Math.floor(parsed / 10);
          console.log('🎮 Dev mode: Starting at score', parsed);
        }
      }
    }
  }, []);

  const flap = useCallback(() => {
    // Unlock audio context on iOS (required for WebAudio to work)
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    // start game on first tap
    if (!runningRef.current && !gameOverRef.current) {
      setRunning(true);
      runningRef.current = true;
      // Initialize bird X position when game starts
      birdX.current = widthRef.current * 0.25;
      
      // Start background music if we're starting at a level with music (iOS needs user gesture)
      const startLevel = Math.floor(scoreRef.current / 10);
      if (startLevel > 0 && startLevel <= 8 && !backgroundMusicRef.current) {
        const musicFiles = [
          '/music/emotional-orchestra-short-145091.mp3',
          '/music/epic-love-inspirational-romantic-cinematic-30-seconds-406069.mp3',
          '/music/epic-middle-eastern-30-seconds-percussion-389431.mp3',
          '/music/falling-grace-348198.mp3',
          '/music/hopeful-acoustic-travel-30-seconds-368800.mp3',
          '/music/instrumental-music-for-video-blog-stories-cyborg-in-me-27-seconds-188532.mp3',
          '/music/pizzicato-play-30-seconds-children-music-394553.mp3',
          '/music/western-journey-30-seconds-183089.mp3'
        ];
        const musicFile = musicFiles[startLevel - 1];
        if (musicFile) {
          const audio = new Audio(musicFile);
          audio.volume = 0.6;
          audio.loop = true;
          audio.play().catch(() => {});
          backgroundMusicRef.current = audio;
          currentMusicLevelRef.current = startLevel;
        }
      }
    }
    if (gameOverRef.current) return;
    const hScale = heightRef.current / BASE_HEIGHT;
    birdV.current = BASE_FLAP * hScale;
    // play wing sound instantly using WebAudio (non-blocking, best for mobile)
    const now = performance.now();
    if (now - wingLastAtRef.current > 80) {
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
      // Don't spawn more pipes after the finish line (absolute pipe 90)
      const nextAbsolutePipeNumber = startScoreRef.current + pipeSpawnCount.current + 1;
      if (nextAbsolutePipeNumber > 90) {
        return;
      }
      
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
  // Adjust for start score: trigger should be absolute, not relative
  const absolutePipeNumber = startScoreRef.current + pipeSpawnCount.current;
  const hasTrigger = absolutePipeNumber % 10 === 0;
  const isFinishLine = absolutePipeNumber === 90;
  if (isFinishLine) {
    console.log('🏁 Finish line spawned! Absolute pipe:', absolutePipeNumber, 'Spawn count:', pipeSpawnCount.current);
  }
  pipes.current.push({ x: W + 20 * wScale, gapY, passed: false, hasTrigger, isFinishLine });
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

        // move pipes (freeze during victory flyout)
  const W = widthRef.current;
  const wScale = W / BASE_WIDTH;
  const hScalePipe = heightRef.current / BASE_HEIGHT;
  const speedMul = Math.min(1 + SPEED_PER_LEVEL * Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10)), 1.6);
  const dx = BASE_SPEED * speedMul * wScale * (dt / 16.67);
        
        // Only move pipes if not in victory flyout
        if (!victoryFlyoutRef.current) {
          pipes.current.forEach((p) => (p.x -= dx)); // Removed * 3 multiplier
          // Update parallax offset (background scrolls at 30% of foreground speed)
          parallaxOffsetRef.current += dx * 0.3;
        }
        
        // remove offscreen
        const PIPE_WIDTH = BASE_PIPE_WIDTH * hScalePipe; // Changed from wScale to hScale
        pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > -10 * wScale);

        // Portal sound effects (fade in/out idle sound, trigger warp when passing through)
        if (!victoryFlyoutRef.current) {
          const birdPosX = widthRef.current * 0.25;
          let nearestPortal: Pipe | null = null;
          let nearestDistance = Infinity;
          
          // Find the nearest portal ahead of the bird
          pipes.current.forEach((p) => {
            if (p.hasTrigger && !p.isFinishLine && !p.passed) {
              const portalCenterX = p.x + PIPE_WIDTH / 2;
              const distance = portalCenterX - birdPosX;
              
              // Only consider portals ahead of the bird
              if (distance > 0 && distance < nearestDistance) {
                nearestDistance = distance;
                nearestPortal = p;
              }
            }
          });
          
          const ctx = audioCtxRef.current;
          const idleBuffer = portalIdleBufferRef.current;
          const warpSound = portalWarpSoundRef.current;
          
          if (nearestPortal && ctx && idleBuffer && warpSound) {
            const fadeInDistance = PIPE_WIDTH * 1.5; // Start fading in 1.5 pipes away
            const warpDistance = PIPE_WIDTH * 0.3; // Trigger warp when very close
            
            // Calculate volume based on distance (0 to 1)
            const fadeVolume = Math.max(0, Math.min(1, 1 - (nearestDistance / fadeInDistance)));
            const targetVolume = fadeVolume * 0.4; // Max 40% volume for idle
            
            // Initialize WebAudio nodes if not already playing
            if (!portalIdleSourceRef.current && targetVolume > 0) {
              // Unlock audio context on iOS
              if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
              }
              
              // Create gain node for volume control
              const gainNode = ctx.createGain();
              gainNode.gain.value = 0;
              gainNode.connect(ctx.destination);
              portalIdleGainRef.current = gainNode;
              
              // Create looping buffer source
              const source = ctx.createBufferSource();
              source.buffer = idleBuffer;
              source.loop = true;
              source.connect(gainNode);
              source.start(0);
              portalIdleSourceRef.current = source;
            }
            
            // Update volume using gain node (smooth fade)
            if (portalIdleGainRef.current) {
              const currentGain = portalIdleGainRef.current.gain.value;
              const gainDelta = targetVolume - currentGain;
              // Smooth exponential fade
              portalIdleGainRef.current.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.1);
            }
            
            // Trigger warp sound when very close (only once per portal)
            if (nearestDistance < warpDistance && activePortalRef.current !== nearestPortal) {
              activePortalRef.current = nearestPortal;
              warpSound.currentTime = 0;
              warpSound.volume = 0.5;
              warpSound.play().catch(() => {});
            }
          } else {
            // No portal nearby, fade out and stop idle sound
            if (portalIdleGainRef.current && portalIdleSourceRef.current) {
              const gainNode = portalIdleGainRef.current;
              const currentGain = gainNode.gain.value;
              
              if (currentGain > 0.01) {
                // Smooth fade out
                gainNode.gain.setTargetAtTime(0, ctx!.currentTime, 0.15);
              } else {
                // Stop completely when volume is very low
                try {
                  portalIdleSourceRef.current.stop();
                } catch {}
                portalIdleSourceRef.current = null;
                portalIdleGainRef.current = null;
                activePortalRef.current = null;
              }
            }
          }
        }

        // scoring and collisions
        pipes.current.forEach((p) => {
          const W2 = widthRef.current;
          const H2 = heightRef.current;
          const wS = W2 / BASE_WIDTH;
          const hS = H2 / BASE_HEIGHT;
          const level = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
          const gapMul = Math.max(1 - GAP_REDUCTION_PER_LEVEL * level, 0.65);
          const GAP = Math.max(60 * hS, BASE_GAP * hS * gapMul);
          const birdPosX = W2 * 0.25; // bird x position
          const r = 12 * Math.min(wS, hS); // bird radius
          
          // Check if bird is approaching the finish line and trigger flyout early
          if (p.isFinishLine && !p.passed && !victoryFlyoutRef.current && p.x + PIPE_WIDTH < birdPosX + 50 * wS) {
            console.log('🎉 APPROACHING FINISH LINE! Starting victory flyout...');
            // Start victory flyout animation before passing the pipe
            victoryFlyoutRef.current = true;
            victoryFlyoutStartRef.current = now;
            birdX.current = W2 * 0.25; // Initialize bird X position
            birdV.current = BASE_FLAP * hS * 0.7; // Set upward velocity to keep bird airborne
            // Don't play sound yet - will play when bird goes off screen
          }
          
          if (!p.passed && p.x + PIPE_WIDTH < birdPosX) {
            p.passed = true;
            
            // Only update score if not finish line (finish line score update happens when bird flies off)
            if (!p.isFinishLine) {
              setScore((s) => {
                const ns = s + 1;
                scoreRef.current = ns;
                // Update background every 10 points: 0-9=default, 10-19=city1, 20-29=city2, etc.
                const newBgIndex = Math.floor(ns / 10);
                if (newBgIndex !== currentBgIndex.current && newBgIndex <= 8) {
                  currentBgIndex.current = newBgIndex;
                }
                
                // Switch background music at portals (every 10 points starting from 10)
                // Level 0 (0-9): no music
                // Level 1 (10-19): song 1
                // Level 2 (20-29): song 2, etc.
                const musicLevel = Math.floor(ns / 10);
                if (musicLevel > 0 && musicLevel <= 8 && musicLevel !== currentMusicLevelRef.current) {
                  const musicFiles = [
                    '/music/emotional-orchestra-short-145091.mp3',
                    '/music/epic-love-inspirational-romantic-cinematic-30-seconds-406069.mp3',
                    '/music/epic-middle-eastern-30-seconds-percussion-389431.mp3',
                    '/music/falling-grace-348198.mp3',
                    '/music/hopeful-acoustic-travel-30-seconds-368800.mp3',
                    '/music/instrumental-music-for-video-blog-stories-cyborg-in-me-27-seconds-188532.mp3',
                    '/music/pizzicato-play-30-seconds-children-music-394553.mp3',
                    '/music/western-journey-30-seconds-183089.mp3'
                  ];
                  
                  // Stop current music if playing
                  if (backgroundMusicRef.current) {
                    backgroundMusicRef.current.pause();
                  }
                  
                  // Start new music for this level
                  const musicFile = musicFiles[musicLevel - 1];
                  if (musicFile) {
                    try {
                      const audio = new Audio(musicFile);
                      audio.volume = 0.6; // Quieter than sound effects
                      audio.loop = true;
                      // Force play with promise handling for iOS
                      const playPromise = audio.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(() => {
                          // Autoplay blocked, will retry on next user interaction
                          console.log('Music autoplay blocked, will play on next interaction');
                        });
                      }
                      backgroundMusicRef.current = audio;
                      currentMusicLevelRef.current = musicLevel;
                      console.log('🎵 Playing music level', musicLevel, ':', musicFile);
                    } catch (err) {
                      console.error('Failed to play music:', err);
                    }
                  }
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
          }
          // collision check (AABB around bird) - skip during victory flyout
          if (!victoryFlyoutRef.current) {
            const inPipeX = birdPosX + r > p.x && birdPosX - r < p.x + PIPE_WIDTH;
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
          }

        });

        // ceiling collision (bird hits top or bottom) - skip during victory flyout
        if (!victoryFlyoutRef.current) {
          const H3 = heightRef.current;
          const hS2 = H3 / BASE_HEIGHT;
          const r2 = 12 * Math.min(widthRef.current / BASE_WIDTH, hS2);
          if (birdY.current - r2 <= 0 || birdY.current + r2 >= H3) {
            setGameOver(true);
            gameOverRef.current = true;
          }
        }
      }
      
      // Victory flyout animation (bird flies off screen after crossing finish line)
      if (victoryFlyoutRef.current && !victoryCompleteRef.current) {
        const W = widthRef.current;
        const wScale = W / BASE_WIDTH;
        const hScale = heightRef.current / BASE_HEIGHT;
        const dx = BASE_SPEED * 1.6 * wScale * (dt / 16.67); // Move at max speed
        
        const timeSinceFlyout = now - victoryFlyoutStartRef.current;
        
        // Auto-flap every 250ms to keep bird up with a smooth pattern
        const flapInterval = 250;
        const lastFlapTime = Math.floor((timeSinceFlyout - dt) / flapInterval) * flapInterval;
        const currentFlapTime = Math.floor(timeSinceFlyout / flapInterval) * flapInterval;
        
        if (currentFlapTime > lastFlapTime) {
          birdV.current = BASE_FLAP * hScale * 0.9; // Slightly gentler flaps
        }
        
        // Apply physics (gravity + velocity)
        const GRAVITY = BASE_GRAVITY * hScale * 1.2; // Reduced gravity for smoother flight
        birdV.current += GRAVITY * (dt / 16.67);
        birdY.current += birdV.current * (dt / 16.67);
        
        // Move bird right
        birdX.current += dx;
        
        // Check if bird is off screen
        if (birdX.current > W + 50 * wScale) {
          console.log('🏆 Bird flew off screen! Incrementing score to 90...');
          victoryCompleteRef.current = true; // Mark as complete to stop further updates
          victoryFlyoutRef.current = false; // Stop flyout animation
          
          // Increment score to 90
          setScore((s) => {
            const ns = s + 1;
            scoreRef.current = ns;
            return ns;
          });
          
          // Play victory sound (point sound 3 times)
          const ctx = audioCtxRef.current;
          const buffer = pointBufferRef.current;
          if (ctx && buffer) {
            try {
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  const source = ctx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(ctx.destination);
                  source.start(0);
                }, i * 100);
              }
            } catch {}
          }
          
          // Show victory modal after 500ms
          setTimeout(() => {
            setGameWon(true);
            setGameOver(true);
            gameOverRef.current = true;
          }, 500);
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

          // draw animated portal in the gap (every 10th pipe only)
          // Don't show portal on finish line
          if (p.hasTrigger && !p.isFinishLine) {
            ctx.save();
            ctx.filter = "none";
            
            const levelIdx = Math.min(MAX_LEVEL, Math.floor(scoreRef.current / 10));
            const cfg = pipeColorConfigRef.current;
            const levelHue = (cfg.hues && cfg.hues[levelIdx] !== undefined) ? cfg.hues[levelIdx] : 0;
            const levelSat = (cfg.saturations && cfg.saturations[levelIdx] !== undefined) ? cfg.saturations[levelIdx] : 70;
            const levelLight = (cfg.lightnesses && cfg.lightnesses[levelIdx] !== undefined) ? cfg.lightnesses[levelIdx] : 50;
            
            // Portal center
            const portalCenterX = px + pw / 2;
            const portalCenterY = gapY + gapH / 2;
            const portalRadius = Math.min(pw * 0.8, gapH * 0.4);
            
            // Create swirling portal effect with rotating gradient
            const rotationSpeed = now / 1000; // Rotate based on time
            
            // Draw multiple rotating rings for depth effect
            for (let ring = 3; ring >= 1; ring--) {
              const ringRadius = portalRadius * (ring / 3);
              const ringRotation = rotationSpeed * (4 - ring); // Outer rings rotate faster
              
              // Create radial gradient for this ring
              const gradient = ctx.createRadialGradient(
                portalCenterX, portalCenterY, ringRadius * 0.2,
                portalCenterX, portalCenterY, ringRadius
              );
              
              // Animate hue shift for swirling effect
              const hueShift = (rotationSpeed * 50 + ring * 30) % 360;
              const ringHue = (levelHue + hueShift) % 360;
              
              gradient.addColorStop(0, `hsla(${ringHue}, ${levelSat}%, ${levelLight + 20}%, 0.8)`);
              gradient.addColorStop(0.5, `hsla(${ringHue}, ${levelSat}%, ${levelLight}%, 0.5)`);
              gradient.addColorStop(1, `hsla(${ringHue}, ${levelSat}%, ${levelLight - 10}%, 0.1)`);
              
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(portalCenterX, portalCenterY, ringRadius, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // Draw sparkles/particles around portal
            const numSparkles = 8;
            for (let i = 0; i < numSparkles; i++) {
              const angle = (i / numSparkles) * Math.PI * 2 + rotationSpeed * 2;
              const sparkleDistance = portalRadius * 1.2;
              const sparkleX = portalCenterX + Math.cos(angle) * sparkleDistance;
              const sparkleY = portalCenterY + Math.sin(angle) * sparkleDistance;
              const sparkleSize = 3 + Math.sin(now / 200 + i) * 2;
              
              ctx.fillStyle = `hsla(${levelHue}, ${levelSat}%, ${levelLight + 30}%, ${0.6 + Math.sin(now / 300 + i) * 0.4})`;
              ctx.beginPath();
              ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
              ctx.fill();
            }
            
            ctx.restore();
          }

          // draw finish line (90th pipe) with checkered pattern
          if (p.isFinishLine) {
            ctx.save();
            ctx.filter = "none";
            
            // Draw a waving checkered flag in the gap
            const flagWidth = pw * 0.85; // Slightly narrower than pipes
            const flagHeight = gapH * 0.6;
            const flagX = px + (pw - flagWidth) / 2; // Center horizontally
            const flagY = gapY + (gapH - flagHeight) / 2; // Center vertically in gap
            const checkSize = Math.max(8, Math.round(flagWidth / 6));
            
            // Draw checkered pattern
            for (let row = 0; row < Math.ceil(flagHeight / checkSize); row++) {
              for (let col = 0; col < Math.ceil(flagWidth / checkSize); col++) {
                const x = flagX + col * checkSize;
                const y = flagY + row * checkSize + Math.sin((col / 2) * Math.PI / 2 + now / 200) * 3;
                const isBlack = (row + col) % 2 === 0;
                ctx.fillStyle = isBlack ? '#000' : '#FFF';
                ctx.fillRect(
                  x, 
                  y, 
                  Math.min(checkSize, flagWidth - col * checkSize),
                  Math.min(checkSize, flagHeight - row * checkSize)
                );
              }
            }
            
            // Add a pole mounted on the bottom pipe
            ctx.fillStyle = '#8B4513'; // Brown pole
            const poleX = flagX - 4;
            const poleWidth = 4;
            // Pole goes from bottom pipe up to top of flag
            ctx.fillRect(poleX, flagY, poleWidth, bottomY - flagY);
            
            ctx.restore();
          }
        });
        // Restore no-smoothing for pixel-perfect backgrounds
        ctx.imageSmoothingEnabled = false;
        ctx.restore();
      }

      // bird sprite (yellow). Skip drawing until loaded.
      // Use birdX ref during victory flyout, otherwise fixed position
      const birdDrawX = victoryFlyoutRef.current ? birdX.current : W * 0.25;
      const frames = [
        imagesRef.current["yellowbird-upflap"],
        imagesRef.current["yellowbird-midflap"],
        imagesRef.current["yellowbird-downflap"],
      ];
      const frame = frames[birdFrameRef.current % frames.length];
      // Don't draw bird if victory is complete (bird has flown off screen)
      if (frame && assetsLoadedRef.current && !victoryCompleteRef.current) {
        const bw = 34 * Math.min(wScale, hScale); // nominal sprite size ~34x24
        const bh = 24 * Math.min(wScale, hScale);
        // rotate slightly based on velocity
        const angle = Math.max(-0.8, Math.min(0.6, birdV.current / 10));
        ctx.save();
        ctx.translate(birdDrawX, birdY.current);
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
          const scale = Math.min(1, (W * 0.8) / iw); // Increased from 0.7 to 0.8 for better visibility
          const w = iw * scale;
          const h = ih * scale;
          ctx.drawImage(msg, (W - w) / 2, H * 0.4 - h / 2, w, h); // Moved down from 0.35 to 0.4 for better positioning
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
      // Stop background music when component unmounts
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current = null;
      }
      // Stop portal sounds when component unmounts
      if (portalIdleSourceRef.current) {
        try {
          portalIdleSourceRef.current.stop();
        } catch {}
        portalIdleSourceRef.current = null;
      }
      if (portalWarpSoundRef.current) {
        portalWarpSoundRef.current = null;
      }
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
          isFinishLine: p.isFinishLine,
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

        // Compute dominant colors for each background (default + 8 cities)
        // Helper: RGB to HSL
        const rgbToHsl = (r: number, g: number, b: number) => {
          r /= 255; g /= 255; b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h = 0, s = 0;
          const l = (max + min) / 2;
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }
          return { h: h * 360, s: s * 100, l: l * 100 };
        };

        // Helper: compute dominant HSL via downsampling + hue vector average
        const computeDominantHSL = (img: HTMLImageElement) => {
          const sampleW = 96;
          const scale = sampleW / img.width;
          const sampleH = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas');
          c.width = sampleW; c.height = sampleH;
          const cctx = c.getContext('2d');
          if (!cctx) return { h: 120, s: 70, l: 50 };
          cctx.drawImage(img, 0, 0, sampleW, sampleH);
          const data = cctx.getImageData(0, 0, sampleW, sampleH).data;
          let sumX = 0, sumY = 0, wSum = 0, sSum = 0, lSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] / 255;
            if (a < 0.3) continue; // ignore transparent
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const { h, s, l } = rgbToHsl(r, g, b);
            // ignore near-gray to avoid clouds/white borders
            const sat = s / 100;
            if (sat < 0.12) continue;
            const weight = sat * a;
            const rad = (h * Math.PI) / 180;
            sumX += Math.cos(rad) * weight;
            sumY += Math.sin(rad) * weight;
            sSum += s * weight;
            lSum += l * weight;
            wSum += weight;
          }
          if (wSum === 0) return { h: 120, s: 70, l: 50 };
          const avgRad = Math.atan2(sumY, sumX);
          const avgHue = (avgRad * 180) / Math.PI;
          const hue = (avgHue + 360) % 360;
          const sat = Math.min(95, Math.max(40, sSum / wSum));
          const light = Math.min(70, Math.max(30, lSum / wSum));
          return { h: hue, s: sat, l: light };
        };

        // Build color arrays for levels 0..8
        const hues: number[] = new Array(MAX_LEVEL + 1).fill(0);
        const sats: number[] = new Array(MAX_LEVEL + 1).fill(75);
        const lights: number[] = new Array(MAX_LEVEL + 1).fill(50);

        // Level 0: force vibrant pure green (classic Flappy Bird)
        hues[0] = 120; sats[0] = 90; lights[0] = 50;

        // Levels 1..8 from city backgrounds (use farthest layer if available)
        for (let i = 1; i <= 8; i++) {
          const layers = cityBgs[i - 1];
          const src = layers && layers.length > 0 ? layers[0] : undefined;
          if (src) {
            const d = computeDominantHSL(src);
            hues[i] = d.h; sats[i] = d.s; lights[i] = d.l;
          } else {
            // reasonable fallback palette
            const fallbackHues = [0, 190, 280, 30, 330, 230, 180, 0, 270];
            hues[i] = fallbackHues[i] || 120; sats[i] = 75; lights[i] = 50;
          }
        }

        // Persist for use in rendering (e.g., trigger rectangle)
        pipeColorConfigRef.current = { hues, saturations: sats, lightnesses: lights };

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
        
        // Load portal warp sound (one-shot, doesn't need WebAudio)
        const portalWarpSound = new Audio('/portalSounds/warp.mp3');
        portalWarpSound.volume = 0.5;
        portalWarpSound.preload = "auto";
        
        // digits
        const digitPaths = Array.from({ length: 10 }, (_, i) => `${base}/sprites/${i}.png`);
        const digitImgs = await Promise.all(digitPaths.map((p) => loadImage(p)));
        
        // Load wing, point, and portal idle sounds into WebAudio buffers for instant, non-blocking playback on mobile
        let wingBuffer: AudioBuffer | null = null;
        let pointBuffer: AudioBuffer | null = null;
        let portalIdleBuffer: AudioBuffer | null = null;
        let audioCtx: AudioContext | null = null;
        try {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const wingSrc = `${base}/audio/wing.wav`;
          const pointSrc = `${base}/audio/point.wav`;
          const portalIdleSrc = '/portalSounds/idle.mp3';
          const [wingResponse, pointResponse, portalIdleResponse] = await Promise.all([
            fetch(wingSrc),
            fetch(pointSrc),
            fetch(portalIdleSrc)
          ]);
          const [wingArrayBuffer, pointArrayBuffer, portalIdleArrayBuffer] = await Promise.all([
            wingResponse.arrayBuffer(),
            pointResponse.arrayBuffer(),
            portalIdleResponse.arrayBuffer()
          ]);
          [wingBuffer, pointBuffer, portalIdleBuffer] = await Promise.all([
            audioCtx.decodeAudioData(wingArrayBuffer),
            audioCtx.decodeAudioData(pointArrayBuffer),
            audioCtx.decodeAudioData(portalIdleArrayBuffer)
          ]);
        } catch {
          // WebAudio not available or decode failed; fall back to HTMLAudio
        }
        
        // Precompute tinted pipe variants for each level (0..MAX_LEVEL)
        const basePipe = map["pipe-green"];
        const tints: HTMLCanvasElement[] = [];
              wingPoolRef.current = wingPool;
        if (basePipe) {
          // Use computed dominant HSL values matched to backgrounds
          const colorHues = pipeColorConfigRef.current.hues.length ? pipeColorConfigRef.current.hues : [120, 190, 280, 30, 330, 230, 180, 0, 270];
          const saturations = pipeColorConfigRef.current.saturations.length ? pipeColorConfigRef.current.saturations : [85, 70, 85, 90, 80, 85, 75, 90, 70];
          const lightnesses = pipeColorConfigRef.current.lightnesses.length ? pipeColorConfigRef.current.lightnesses : [50, 55, 50, 55, 60, 40, 50, 50, 35];
          
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
          portalIdleBufferRef.current = portalIdleBuffer;
          portalWarpSoundRef.current = portalWarpSound;
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
              {gameWon ? (
                <div className="mb-3 text-center">
                  <div className="text-6xl mb-2 animate-bounce">🏆</div>
                  <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent drop-shadow-lg">
                    VICTORY!
                  </div>
                  <div className="text-xl font-semibold text-yellow-600 dark:text-yellow-400 mt-1">
                    You reached the finish line! 🏁
                  </div>
                </div>
              ) : (
                <img
                  src="/flappy-bird-assets-master/sprites/gameover.png"
                  alt="Game Over"
                  className="mb-3 w-64 max-w-[80vw] h-auto pointer-events-none select-none"
                  decoding="async"
                  loading="eager"
                />
              )}
              <div className="w-[85%] max-w-sm rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-5 border-2 border-blue-200 dark:border-blue-800 shadow-2xl">
              <div className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Score: {score} {gameWon ? '🎉' : '🎯'}
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

// Flappy Bird sprites
import backgroundDay from "@/public/flappy-bird-assets-master/sprites/background-day.png";
import pipeGreen from "@/public/flappy-bird-assets-master/sprites/pipe-green.png";
import yellowbirdUpflap from "@/public/flappy-bird-assets-master/sprites/yellowbird-upflap.png";
import yellowbirdMidflap from "@/public/flappy-bird-assets-master/sprites/yellowbird-midflap.png";
import yellowbirdDownflap from "@/public/flappy-bird-assets-master/sprites/yellowbird-downflap.png";
import redbirdUpflap from "@/public/flappy-bird-assets-master/sprites/redbird-upflap.png";
import redbirdMidflap from "@/public/flappy-bird-assets-master/sprites/redbird-midflap.png";
import redbirdDownflap from "@/public/flappy-bird-assets-master/sprites/redbird-downflap.png";
import bluebirdUpflap from "@/public/flappy-bird-assets-master/sprites/bluebird-upflap.png";
import bluebirdMidflap from "@/public/flappy-bird-assets-master/sprites/bluebird-midflap.png";
import bluebirdDownflap from "@/public/flappy-bird-assets-master/sprites/bluebird-downflap.png";
import message from "@/public/flappy-bird-assets-master/sprites/message.png";
import gameover from "@/public/flappy-bird-assets-master/sprites/gameover.png";
import base from "@/public/flappy-bird-assets-master/sprites/base.png";

// Number sprites for score display
import digit0 from "@/public/flappy-bird-assets-master/sprites/0.png";
import digit1 from "@/public/flappy-bird-assets-master/sprites/1.png";
import digit2 from "@/public/flappy-bird-assets-master/sprites/2.png";
import digit3 from "@/public/flappy-bird-assets-master/sprites/3.png";
import digit4 from "@/public/flappy-bird-assets-master/sprites/4.png";
import digit5 from "@/public/flappy-bird-assets-master/sprites/5.png";
import digit6 from "@/public/flappy-bird-assets-master/sprites/6.png";
import digit7 from "@/public/flappy-bird-assets-master/sprites/7.png";
import digit8 from "@/public/flappy-bird-assets-master/sprites/8.png";
import digit9 from "@/public/flappy-bird-assets-master/sprites/9.png";

// Audio files (using string paths for static export)
const wingAudio = "./flappy-bird-assets-master/audio/wing.wav";
const pointAudio = "./flappy-bird-assets-master/audio/point.wav";
const hitAudio = "./flappy-bird-assets-master/audio/hit.wav";
const dieAudio = "./flappy-bird-assets-master/audio/die.wav";

// Music files
const music1 = "./music/emotional-orchestra-short-145091.mp3";
const music2 = "./music/epic-love-inspirational-romantic-cinematic-30-seconds-406069.mp3";
const music3 = "./music/epic-middle-eastern-30-seconds-percussion-389431.mp3";
const music4 = "./music/falling-grace-348198.mp3";
const music5 = "./music/hopeful-acoustic-travel-30-seconds-368800.mp3";
const music6 = "./music/instrumental-music-for-video-blog-stories-cyborg-in-me-27-seconds-188532.mp3";
const music7 = "./music/pizzicato-play-30-seconds-children-music-394553.mp3";
const music8 = "./music/western-journey-30-seconds-183089.mp3";

// Ambient sounds
const rainSound = "./rainsound.mp3";
const windSound = "./windsound.mp3";

// Portal sounds
const portalIdleSound = "./portalSounds/idle.mp3";
const portalWarpSound = "./portalSounds/warp.mp3";

// Bird sound
const birdChippingSound = "./bird-chipping.mp3";

// UI assets
import cscLogo from "@/public/csclogo.png";

export const sprites = {
  backgroundDay: backgroundDay.src,
  pipeGreen: pipeGreen.src,
  yellowbirdUpflap: yellowbirdUpflap.src,
  yellowbirdMidflap: yellowbirdMidflap.src,
  yellowbirdDownflap: yellowbirdDownflap.src,
  redbirdUpflap: redbirdUpflap.src,
  redbirdMidflap: redbirdMidflap.src,
  redbirdDownflap: redbirdDownflap.src,
  bluebirdUpflap: bluebirdUpflap.src,
  bluebirdMidflap: bluebirdMidflap.src,
  bluebirdDownflap: bluebirdDownflap.src,
  message: message.src,
  gameover: gameover.src,
  base: base.src,
};
const rel = (src: string) => (src.startsWith('/') ? '.' + src : src);
export const digits = [rel(digit0.src), rel(digit1.src), rel(digit2.src), rel(digit3.src), rel(digit4.src), rel(digit5.src), rel(digit6.src), rel(digit7.src), rel(digit8.src), rel(digit9.src)];

export const audio = {
  wing: wingAudio,
  point: pointAudio,
  hit: hitAudio,
  die: dieAudio,
};

export const music = [music1, music2, music3, music4, music5, music6, music7, music8];

export const ambientSounds = {
  rain: rainSound,
  wind: windSound,
};

export const portalSounds = {
  idle: portalIdleSound,
  warp: portalWarpSound,
};

export const uiAssets = {
  cscLogo: cscLogo.src,
  birdChipping: birdChippingSound,
};

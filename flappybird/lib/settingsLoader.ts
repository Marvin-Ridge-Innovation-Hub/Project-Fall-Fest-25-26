/**
 * Settings Loader: Loads game settings from embedded static JSON
 * Works offline by fetching public/data/game-settings.json
 */

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

// Default settings (fallback if loading fails)
export const DEFAULT_SETTINGS: GameSettings = {
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

const EMBEDDED_SETTINGS_URL = "/data/game-settings.json";

/**
 * Load game settings from embedded static JSON file
 * Falls back to DEFAULT_SETTINGS if loading fails
 */
export async function loadGameSettings(): Promise<GameSettings> {
  try {
    const response = await fetch(EMBEDDED_SETTINGS_URL);
    if (!response.ok) {
      console.warn(
        "Failed to load game settings, using defaults:",
        response.status
      );
      return DEFAULT_SETTINGS;
    }
    const loaded = (await response.json()) as Partial<GameSettings>;
    // Merge with defaults to ensure all required fields are present
    return { ...DEFAULT_SETTINGS, ...loaded };
  } catch (error) {
    console.warn("Failed to load game settings, using defaults:", error);
    return DEFAULT_SETTINGS;
  }
}

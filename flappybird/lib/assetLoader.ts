/**
 * Asset Loader Utilities
 * Handles asset loading with protocol detection and graceful fallbacks
 */

export function isFileProtocol(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

export function isLocalOrOffline(): boolean {
  return isFileProtocol() || !navigator.onLine;
}

export interface AssetLoadResult {
  success: boolean;
  error?: string;
  isFileProtocol: boolean;
  isOffline: boolean;
}

/**
 * Load an image with error reporting
 */
export function loadImageWithFallback(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      const result: AssetLoadResult = {
        success: false,
        error: `Failed to load image: ${src}`,
        isFileProtocol: isFileProtocol(),
        isOffline: !navigator.onLine,
      };
      console.warn("Image load error:", result);
      reject(new Error(result.error));
    };
    img.src = src;
  });
}

/**
 * Load audio with error handling
 */
export function loadAudioWithFallback(src: string): HTMLAudioElement {
  const audio = new Audio();
  audio.addEventListener("error", () => {
    const result: AssetLoadResult = {
      success: false,
      error: `Failed to load audio: ${src}`,
      isFileProtocol: isFileProtocol(),
      isOffline: !navigator.onLine,
    };
    console.warn("Audio load error:", result);
  });
  audio.src = src;
  return audio;
}

/**
 * Fetch with automatic protocol detection and better error messages
 */
export async function fetchWithFallback<T>(
  url: string,
  parser: (text: string) => T = (t) => JSON.parse(t) as T
): Promise<T | null> {
  try {
    // First, try a HEAD request to check if URL is accessible
    try {
      const headResponse = await fetch(url, { method: "HEAD" });
      if (!headResponse.ok && headResponse.status !== 405) {
        // 405 is "Method Not Allowed" which is OK for fetch, means file exists
        throw new Error(`HEAD request failed: ${headResponse.status}`);
      }
    } catch (e) {
      // HEAD might fail, but GET could still work
    }

    // Now try the actual GET request
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return parser(text);
  } catch (error) {
    const result: AssetLoadResult = {
      success: false,
      error: `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
      isFileProtocol: isFileProtocol(),
      isOffline: !navigator.onLine,
    };
    console.warn("Fetch error:", result);

    // Log helpful diagnostic info
    if (isFileProtocol()) {
      console.info(
        "💡 Tip: You're using file:// protocol which has security restrictions. Consider using an HTTP server instead."
      );
      console.info(
        "   Quick fix: run 'python -m http.server' from the out/ directory and visit http://localhost:8000"
      );
    }

    return null;
  }
}

/**
 * Create a diagnostic report for asset loading
 */
export function createAssetDiagnostics(): object {
  if (typeof window === "undefined") return {};

  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    href: window.location.href,
    isFileProtocol: isFileProtocol(),
    isOnline: navigator.onLine,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };
}

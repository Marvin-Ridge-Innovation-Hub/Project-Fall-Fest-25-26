/**
 * Convert asset paths from absolute (/path) to relative (./path) format.
 * This ensures compatibility with file:// protocol on Chromebook deployments
 * where absolute paths don't resolve correctly.
 *
 * @param absolutePath - Asset path starting with / (e.g., "/flappy-bird-assets-master/sprites/bird.png")
 * @returns Relative path (e.g., "./flappy-bird-assets-master/sprites/bird.png")
 */
export const getAssetPath = (absolutePath: string): string => {
  if (absolutePath.startsWith('/')) {
    return '.' + absolutePath;
  }
  return absolutePath;
};

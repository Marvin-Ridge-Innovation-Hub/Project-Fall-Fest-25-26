/**
 * City Backgrounds Manifest
 * Statically imports all city background layers for file:// protocol compatibility
 * Structure: cityBackgrounds[cityIndex][layerIndex]
 * - cityIndex: 0-7 (city1-city8)
 * - layerIndex: 0-2 (layers where 0=farthest for color sampling, 2=closest parallax)
 */

// City 1 (Green/Natural)
import city1Layer1 from "@/public/free-city-backgrounds-pixel-art/city1/1.png";
import city1Layer2 from "@/public/free-city-backgrounds-pixel-art/city1/2.png";
import city1Layer3 from "@/public/free-city-backgrounds-pixel-art/city1/3.png";

// City 2 (Blue/Water)
import city2Layer1 from "@/public/free-city-backgrounds-pixel-art/city2/1.png";
import city2Layer2 from "@/public/free-city-backgrounds-pixel-art/city2/2.png";
import city2Layer3 from "@/public/free-city-backgrounds-pixel-art/city2/3.png";

// City 3 (Purple/Fantasy)
import city3Layer1 from "@/public/free-city-backgrounds-pixel-art/city3/1.png";
import city3Layer2 from "@/public/free-city-backgrounds-pixel-art/city3/2.png";
import city3Layer3 from "@/public/free-city-backgrounds-pixel-art/city3/3.png";

// City 4 (Orange/Desert)
import city4Layer1 from "@/public/free-city-backgrounds-pixel-art/city4/1.png";
import city4Layer2 from "@/public/free-city-backgrounds-pixel-art/city4/2.png";
import city4Layer3 from "@/public/free-city-backgrounds-pixel-art/city4/3.png";

// City 5 (Red/Lava)
import city5Layer1 from "@/public/free-city-backgrounds-pixel-art/city5/1.png";
import city5Layer2 from "@/public/free-city-backgrounds-pixel-art/city5/2.png";
import city5Layer3 from "@/public/free-city-backgrounds-pixel-art/city5/3.png";

// City 6 (Cyan/Ice)
import city6Layer1 from "@/public/free-city-backgrounds-pixel-art/city6/1.png";
import city6Layer2 from "@/public/free-city-backgrounds-pixel-art/city6/2.png";
import city6Layer3 from "@/public/free-city-backgrounds-pixel-art/city6/3.png";

// City 7 (Yellow/Sunny)
import city7Layer1 from "@/public/free-city-backgrounds-pixel-art/city7/1.png";
import city7Layer2 from "@/public/free-city-backgrounds-pixel-art/city7/2.png";
import city7Layer3 from "@/public/free-city-backgrounds-pixel-art/city7/3.png";

// City 8 (Pink/Sunset)
import city8Layer1 from "@/public/free-city-backgrounds-pixel-art/city8/1.png";
import city8Layer2 from "@/public/free-city-backgrounds-pixel-art/city8/2.png";
import city8Layer3 from "@/public/free-city-backgrounds-pixel-art/city8/3.png";

/**
 * City backgrounds organized by city index, then by layer (as source URLs)
 * Each layer is a string URL path from Next.js static import
 * Layer structure:
 *   [0] = Farthest/Background layer (used for color extraction)
 *   [1] = Middle parallax layer
 *   [2] = Closest/Foreground layer (moves fastest with parallax)
 */
const rel = (src: string) => (src.startsWith('/') ? '.' + src : src);

/* export const cityBackgrounds: string[][] = [
  [city1Layer1.src, city1Layer2.src, city1Layer3.src],
  [city2Layer1.src, city2Layer2.src, city2Layer3.src],
  [city3Layer1.src, city3Layer2.src, city3Layer3.src],
  [city4Layer1.src, city4Layer2.src, city4Layer3.src],
  [city5Layer1.src, city5Layer2.src, city5Layer3.src],
  [city6Layer1.src, city6Layer2.src, city6Layer3.src],
  [city7Layer1.src, city7Layer2.src, city7Layer3.src],
  [city8Layer1.src, city8Layer2.src, city8Layer3.src],
].map(layerSet => layerSet.map(rel)); // Convert to relative paths for static export
*/
export const cityBackgrounds: string[][] = [
  // City 1
  [
    "./free-city-backgrounds-pixel-art/city1/1.png",
    "./free-city-backgrounds-pixel-art/city1/2.png",
    "./free-city-backgrounds-pixel-art/city1/3.png",
  ],

  // City 2
  [
    "./free-city-backgrounds-pixel-art/city2/1.png",
    "./free-city-backgrounds-pixel-art/city2/2.png",
    "./free-city-backgrounds-pixel-art/city2/3.png",
  ],

  // City 3
  [
    "./free-city-backgrounds-pixel-art/city3/1.png",
    "./free-city-backgrounds-pixel-art/city3/2.png",
    "./free-city-backgrounds-pixel-art/city3/3.png",
  ],

  // City 4
  [
    "./free-city-backgrounds-pixel-art/city4/1.png",
    "./free-city-backgrounds-pixel-art/city4/2.png",
    "./free-city-backgrounds-pixel-art/city4/3.png",
  ],

  // City 5
  [
    "./free-city-backgrounds-pixel-art/city5/1.png",
    "./free-city-backgrounds-pixel-art/city5/2.png",
    "./free-city-backgrounds-pixel-art/city5/3.png",
  ],

  // City 6
  [
    "./free-city-backgrounds-pixel-art/city6/1.png",
    "./free-city-backgrounds-pixel-art/city6/2.png",
    "./free-city-backgrounds-pixel-art/city6/3.png",
  ],

  // City 7
  [
    "./free-city-backgrounds-pixel-art/city7/1.png",
    "./free-city-backgrounds-pixel-art/city7/2.png",
    "./free-city-backgrounds-pixel-art/city7/3.png",
  ],

  // City 8
  [
    "./free-city-backgrounds-pixel-art/city8/1.png",
    "./free-city-backgrounds-pixel-art/city8/2.png",
    "./free-city-backgrounds-pixel-art/city8/3.png",
  ],
];
/**
 * Get city background layers as image sources
 * Returns array of layer sources for the given city index
 * @param cityIndex 0-7 representing city1-city8
 * @returns Array of [farthestLayer, middleLayer, closestLayer]
 */
export function getCityBackgroundLayers(cityIndex: number): string[] {
  if (cityIndex < 0 || cityIndex >= cityBackgrounds.length) {
    return [city1Layer1.src, city1Layer2.src, city1Layer3.src];
  }
  return cityBackgrounds[cityIndex];
}

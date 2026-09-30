/**
 * Procedural Terrain & Elevation Generator for Depth Wizard
 * Generates coherent alpine/mountainous terrain, depth maps, and satellite rasters
 */

// Simple seeded PRNG & Perlin/Simplex gradient noise implementation
function createNoise2D(seed = 1337) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;

  function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const temp = p[i];
    p[i] = p[j];
    p[j] = temp;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }

  const grad2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  return function noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const a = perm[X] + Y;
    const aa = perm[a];
    const ab = perm[a + 1];
    const b = perm[X + 1] + Y;
    const ba = perm[b];
    const bb = perm[b + 1];

    function dot(gIndex: number, dx: number, dy: number) {
      const g = grad2[gIndex % 8];
      return g[0] * dx + g[1] * dy;
    }

    const x1 = dot(aa, xf, yf);
    const x2 = dot(ba, xf - 1, yf);
    const y1 = dot(ab, xf, yf - 1);
    const y2 = dot(bb, xf - 1, yf - 1);

    const lerpX1 = x1 + u * (x2 - x1);
    const lerpX2 = y1 + u * (y2 - y1);
    return lerpX1 + v * (lerpX2 - lerpX1);
  };
}

const noise1 = createNoise2D(42);
const noise2 = createNoise2D(999);
const noise3 = createNoise2D(2024);

/**
 * Returns normalized elevation in range [0, 1] for normalized coordinates [u, v] in [0, 1]
 */
export function getTerrainHeight(u: number, v: number): number {
  // Center mountain massif bias: higher near center, lower near borders
  const cx = u - 0.5;
  const cy = v - 0.5;
  const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 1.4;
  const islandMask = Math.max(0, 1.0 - Math.pow(distFromCenter, 1.8));

  // Multi-frequency fractal noise
  const nx = u * 4.0;
  const ny = v * 4.0;

  // Primary mountain ridge
  const n1 = (noise1(nx, ny) + 1) * 0.5;
  // Secondary ridgelines & cirques
  const n2 = Math.abs(noise2(nx * 2.2, ny * 2.2));
  const ridged = 1.0 - n2; // Sharp ridge tops
  // High frequency rock crags
  const n3 = (noise3(nx * 6.0, ny * 6.0) + 1) * 0.5;
  // Ultra fine detail
  const n4 = (noise1(nx * 14.0, ny * 14.0) + 1) * 0.5;

  let elevation = (n1 * 0.45 + ridged * 0.35 + n3 * 0.15 + n4 * 0.05);

  // Apply mountain mass falloff and valley carving
  elevation = Math.pow(elevation, 1.35) * islandMask + 0.08 * (1.0 - islandMask);

  // Carve a generic low strip through the preview surface
  const riverPath = Math.sin(u * 6.0) * 0.15 + 0.45;
  const riverDist = Math.abs(v - riverPath);
  if (riverDist < 0.08) {
    const riverT = 1.0 - riverDist / 0.08;
    elevation -= riverT * 0.14;
  }

  return Math.max(0.01, Math.min(0.99, elevation));
}

// These values belong only to the visual fallback preview. They are not model
// measurements and are replaced by real pipeline output after processing.
export const ELEVATION_MIN = 0;
export const ELEVATION_MAX = 100;

export function getElevationMeters(u: number, v: number): number {
  const norm = getTerrainHeight(u, v);
  return Math.round(ELEVATION_MIN + norm * (ELEVATION_MAX - ELEVATION_MIN));
}

// Generic bounds for the visual fallback preview only.
export const GEO_BOUNDS = {
  west: 0,
  east: 1,
  south: 0,
  north: 1,
  crs: 'No CRS loaded'
};

export function getGeoCoordinates(u: number, v: number) {
  const lon = GEO_BOUNDS.west + u * (GEO_BOUNDS.east - GEO_BOUNDS.west);
  const lat = GEO_BOUNDS.north - v * (GEO_BOUNDS.north - GEO_BOUNDS.south);
  return { lon, lat };
}

/**
 * Generates realistic satellite orthophoto canvas texture
 */
export function generateSatelliteCanvas(width = 1024, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;

      const elev = getTerrainHeight(u, v);
      // Slope estimate for shading
      const du = 1.0 / width;
      const dv = 1.0 / height;
      const eR = getTerrainHeight(Math.min(1, u + du), v);
      const eB = getTerrainHeight(u, Math.min(1, v + dv));
      const slope = Math.sqrt((eR - elev) * (eR - elev) + (eB - elev) * (eB - elev)) * 120;

      // Color banding based on realistic alpine biome:
      // High: Snow/Ice (elev > 0.72 and not too steep)
      // Mid-high: Exposed Granite/Slate Scree (0.48 - 0.72 or steep cliffs)
      // Mid: Alpine Tundra & Meadow (0.28 - 0.48)
      // Low: Dense Subalpine Coniferous Forest (0.12 - 0.28)
      // Valley: Riverbed & Glacial lake (elev < 0.12)
      // Natural geomorphological multi-biome color blending
      const rockNoise = (noise2(u * 28, v * 28) + 1) * 0.5;
      const grassNoise = (noise1(u * 20, v * 20) + 1) * 0.5;
      const snowNoise = (noise3(u * 40, v * 40) + 1) * 0.5;

      // Base biome colors
      const cWater = [32, 54, 72];
      const cForest = [44 + Math.floor(grassNoise * 16), 72 + Math.floor(grassNoise * 20), 45];
      const cMeadow = [88 + Math.floor(grassNoise * 24), 118 + Math.floor(grassNoise * 28), 66];
      const cRock = [118 + Math.floor(rockNoise * 32), 114 + Math.floor(rockNoise * 30), 110 + Math.floor(rockNoise * 28)];
      const cSnow = [234 + Math.floor(snowNoise * 20), 238 + Math.floor(snowNoise * 17), 246];

      function lerpColor(c1: number[], c2: number[], t: number): number[] {
        const ct = Math.max(0, Math.min(1, t));
        return [
          c1[0] + (c2[0] - c1[0]) * ct,
          c1[1] + (c2[1] - c1[1]) * ct,
          c1[2] + (c2[2] - c1[2]) * ct,
        ];
      }

      let col: number[];

      // Progressive elevation blend
      if (elev < 0.12) {
        col = lerpColor(cWater, cForest, elev / 0.12);
      } else if (elev < 0.32) {
        col = lerpColor(cForest, cMeadow, (elev - 0.12) / 0.20);
      } else if (elev < 0.60) {
        col = lerpColor(cMeadow, cRock, (elev - 0.32) / 0.28);
      } else if (elev < 0.74) {
        col = lerpColor(cRock, cSnow, (elev - 0.60) / 0.14);
      } else {
        col = cSnow;
      }

      // Steep cliff walls strip snow and expose bare granite
      if (slope > 0.65) {
        const cliffFactor = Math.min(1, (slope - 0.65) / 0.35);
        col = lerpColor(col, cRock, cliffFactor * 0.85);
      }

      // Photogrammetric hillshade modulation
      const sunDx = -0.55;
      const sunDy = -0.75;
      const shade = Math.max(0.62, Math.min(1.30, 1.0 - ((eR - elev) * sunDx + (eB - elev) * sunDy) * 48));

      data[idx] = Math.min(255, Math.floor(col[0] * shade));
      data[idx + 1] = Math.min(255, Math.floor(col[1] * shade));
      data[idx + 2] = Math.min(255, Math.floor(col[2] * shade));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Subtle GIS grid lines overlay on texture borders if needed
  return canvas;
}

/**
 * Generates depth map canvas (grayscale representation of elevation)
 */
export function generateDepthMapCanvas(width = 512, height = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;
      const val = Math.floor(getTerrainHeight(u, v) * 255);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generates hypsometric elevation tint canvas (GIS rainbow/viridis/turbo)
 */
export function generateHypsometricCanvas(width = 512, height = 512, preset = 'viridis'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;
      const t = getTerrainHeight(u, v);

      let r = 0, g = 0, b = 0;
      if (preset === 'viridis') {
        // Viridis approximation
        r = Math.floor(255 * (0.28 + 0.72 * Math.sin(t * Math.PI * 0.9)));
        g = Math.floor(255 * Math.sin(t * Math.PI));
        b = Math.floor(255 * Math.cos(t * Math.PI * 0.5));
      } else if (preset === 'turbo') {
        // Turbo color approximation
        r = Math.floor(255 * Math.sin(t * Math.PI * 0.8 + 0.2));
        g = Math.floor(255 * Math.sin(t * Math.PI * 0.9));
        b = Math.floor(255 * (1.0 - t));
      } else {
        // Standard GIS hypsometric tint (green -> yellow -> brown -> white)
        if (t < 0.25) {
          const k = t / 0.25;
          r = Math.floor(40 + k * 80);
          g = Math.floor(130 + k * 80);
          b = Math.floor(50);
        } else if (t < 0.55) {
          const k = (t - 0.25) / 0.3;
          r = Math.floor(120 + k * 100);
          g = Math.floor(210 - k * 30);
          b = Math.floor(50 - k * 20);
        } else if (t < 0.8) {
          const k = (t - 0.55) / 0.25;
          r = Math.floor(220 - k * 40);
          g = Math.floor(180 - k * 80);
          b = Math.floor(100 - k * 40);
        } else {
          const k = (t - 0.8) / 0.2;
          r = Math.floor(180 + k * 75);
          g = Math.floor(160 + k * 95);
          b = Math.floor(150 + k * 105);
        }
      }

      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

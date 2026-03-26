/**
 * Shared Color Utilities
 *
 * Common color manipulation functions used across visualization slides.
 */

import chroma from 'chroma-js';

/**
 * Calculate prominence weight for a color.
 * Higher values indicate more visually prominent colors.
 *
 * @param hex - The color in hex format
 * @returns A prominence score between 0.1 and ~1.0
 */
export function calculateProminence(hex: string): number {
  const sat = chroma(hex).get('hsl.s'); // 0-1
  const lum = chroma(hex).luminance(); // 0-1
  const lumDist = Math.abs(lum - 0.5) * 2; // 0-1 (distance from gray)
  const contrast = chroma.contrast(hex, '#ffffff');
  const normContrast = (contrast - 1) / 20; // 0-1

  return Math.max(sat * 0.4 + lumDist * 0.3 + normContrast * 0.3, 0.1);
}

/**
 * Generate a 9-step color scale from white through the color to black.
 *
 * @param hex - The base color in hex format
 * @returns Array of 9 hex colors: [0-3] light variants, [4] original, [5-8] dark variants
 */
export function generateScale(hex: string): string[] {
  const lightScale = chroma.scale(['#ffffff', hex]).mode('lab').colors(5);
  const darkScale = chroma.scale([hex, '#000000']).mode('lab').colors(5);
  // Combine: [0-3] light, [4] original, [5-8] dark
  return [...lightScale.slice(0, 4), hex, ...darkScale.slice(1)];
}

/**
 * Build a contrast matrix between all color pairs.
 *
 * @param colors - Array of colors with hex property
 * @returns 2D matrix where [i][j] is the contrast ratio between colors i and j
 */
export function buildContrastMatrix(colors: { hex: string }[]): number[][] {
  const n = colors.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(1));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ratio = chroma.contrast(colors[i].hex, colors[j].hex);
      matrix[i][j] = ratio;
      matrix[j][i] = ratio; // symmetric
    }
  }
  return matrix;
}

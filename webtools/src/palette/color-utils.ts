/**
 * Color Utilities
 *
 * Utilities for color manipulation, naming, and analysis using chroma.js.
 * Part of DES-004: Color Palette Panel
 */

import chroma from 'chroma-js';

/**
 * Color name mappings based on hue ranges.
 */
const HUE_NAMES: Array<{ min: number; max: number; name: string }> = [
  { min: 0, max: 15, name: 'Red' },
  { min: 15, max: 45, name: 'Orange' },
  { min: 45, max: 70, name: 'Yellow' },
  { min: 70, max: 150, name: 'Green' },
  { min: 150, max: 190, name: 'Cyan' },
  { min: 190, max: 260, name: 'Blue' },
  { min: 260, max: 290, name: 'Purple' },
  { min: 290, max: 330, name: 'Magenta' },
  { min: 330, max: 360, name: 'Red' },
];

/**
 * Lightness modifiers for color names.
 */
const LIGHTNESS_MODIFIERS: Array<{
  min: number;
  max: number;
  prefix: string;
}> = [
  { min: 0, max: 15, prefix: 'Black' },
  { min: 15, max: 30, prefix: 'Dark' },
  { min: 30, max: 45, prefix: 'Deep' },
  { min: 45, max: 65, prefix: '' },
  { min: 65, max: 80, prefix: 'Light' },
  { min: 80, max: 92, prefix: 'Pale' },
  { min: 92, max: 100, prefix: 'White' },
];

/**
 * Saturation modifiers for color names.
 */
const SATURATION_MODIFIERS: Array<{
  min: number;
  max: number;
  prefix: string;
}> = [
  { min: 0, max: 5, prefix: 'Gray' },
  { min: 5, max: 15, prefix: 'Grayish' },
  { min: 15, max: 30, prefix: 'Muted' },
  { min: 30, max: 60, prefix: '' },
  { min: 60, max: 85, prefix: 'Vibrant' },
  { min: 85, max: 100, prefix: 'Vivid' },
];

/**
 * Get a human-readable name for a color based on its hex value.
 * Uses chroma.js for color space conversion.
 *
 * Examples:
 * - #ff0000 -> "Vivid Red"
 * - #2a4a6a -> "Muted Blue"
 * - #f5e6d3 -> "Pale Orange"
 */
export function getColorName(hex: string): string {
  const color = chroma(hex);
  const [h, s, l] = color.hsl();
  const hue = isNaN(h) ? 0 : h;
  const sat = s * 100;
  const light = l * 100;

  // Handle grayscale colors
  if (sat < 5) {
    if (light < 15) return 'Black';
    if (light > 92) return 'White';
    if (light < 30) return 'Charcoal';
    if (light < 45) return 'Dark Gray';
    if (light < 65) return 'Gray';
    if (light < 80) return 'Light Gray';
    return 'Silver';
  }

  // Get base hue name
  const hueName =
    HUE_NAMES.find((range) => hue >= range.min && hue < range.max)?.name ||
    'Gray';

  // Get lightness modifier
  const lightnessModifier =
    LIGHTNESS_MODIFIERS.find(
      (range) => light >= range.min && light < range.max
    )?.prefix || '';

  // Get saturation modifier (only if lightness is in normal range)
  let saturationModifier = '';
  if (light >= 20 && light <= 85) {
    saturationModifier =
      SATURATION_MODIFIERS.find((range) => sat >= range.min && sat < range.max)
        ?.prefix || '';
  }

  // Handle edge cases
  if (lightnessModifier === 'Black') return `Black ${hueName}`;
  if (lightnessModifier === 'White') return `White ${hueName}`;

  // Combine modifiers
  const modifiers = [saturationModifier, lightnessModifier].filter(Boolean);
  if (modifiers.length === 0) return hueName;

  return `${modifiers.join(' ')} ${hueName}`;
}

/**
 * Check if a color is light (for contrast calculation).
 * Uses chroma.js luminance calculation.
 */
export function isLightColor(hex: string): boolean {
  return chroma(hex).luminance() > 0.179; // WCAG threshold
}

/**
 * Get contrast color class for icons/text.
 */
export function getContrastClass(hex: string): 'light' | 'dark' {
  return isLightColor(hex) ? 'dark' : 'light';
}

/**
 * Role presets for color palette.
 */
export const ROLE_PRESETS = [
  'Primary',
  'Secondary',
  'Accent',
  'Background',
  'Surface',
  'Text',
  'Muted',
  'Border',
] as const;

export type RolePreset = (typeof ROLE_PRESETS)[number];

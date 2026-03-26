/**
 * Palette Controller
 *
 * Handles business logic for color palette operations.
 * Separates concerns from the UI panel.
 *
 * Part of DES-004: Color Palette Panel
 */

import chroma from 'chroma-js';
import type { StateStore } from '../state';
import type { PaletteColor, PaletteState, Algorithm } from './types';
import { getColorName } from './color-utils';

/**
 * PaletteController - Business logic for palette operations
 */
export class PaletteController {
  constructor(private store: StateStore) {}

  /**
   * Subscribe to palette state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    return this.store.subscribe('palette', listener);
  }

  /**
   * Get the current palette state.
   */
  getState(): PaletteState {
    return (
      this.store.get('palette') ?? {
        colors: [],
        generationMode: 'algorithm',
        selectedAlgorithm: 'complementary',
        visualizerEnabled: false,
        visualizerSlide: 'palette-grid',
      }
    );
  }

  /**
   * Set the generation mode (algorithm or ai).
   */
  setGenerationMode(mode: 'algorithm' | 'ai'): void {
    this.store.update('palette', (state) => ({
      ...state,
      generationMode: mode,
    }));
  }

  /**
   * Set the selected algorithm.
   */
  setAlgorithm(algorithm: Algorithm): void {
    this.store.update('palette', (state) => ({
      ...state,
      selectedAlgorithm: algorithm,
    }));
  }

  /**
   * Toggle the visualizer on/off.
   */
  toggleVisualizer(): void {
    this.store.update('palette', (state) => ({
      ...state,
      visualizerEnabled: !state.visualizerEnabled,
    }));
  }

  /**
   * Generate colors using the selected algorithm.
   * - If locked colors exist: regenerate unlocked colors based on them
   * - If only one unlocked color: pick a random color for it
   * Uses color theory algorithms (complementary, analogous, triadic, etc.)
   */
  generateColors(): void {
    const state = this.getState();
    const lockedColors = state.colors.filter((c) => c.locked);
    const unlockedColors = state.colors.filter((c) => !c.locked);
    const algorithm = state.selectedAlgorithm;

    // Case 1: Only one unlocked color, no locked colors - randomize it
    if (lockedColors.length === 0 && unlockedColors.length === 1) {
      const newColor = this.generateRandomColor();
      this.store.update('palette', (s) => ({
        ...s,
        colors: [{ ...newColor, id: unlockedColors[0].id }],
      }));
      return;
    }

    // Case 2: Need locked colors to generate from
    if (lockedColors.length === 0) {
      return; // Nothing to generate from
    }

    // Case 3: Need unlocked colors to regenerate
    if (unlockedColors.length === 0) {
      return; // Nothing to regenerate
    }

    // Use the first locked color as the base for generation
    const baseColor = lockedColors[0].hex;

    // Generate colors using the selected algorithm
    let newUnlockedColors: PaletteColor[];
    if (algorithm === 'monochromatic') {
      newUnlockedColors = this.generateMonochromatic(baseColor, unlockedColors.length);
    } else {
      newUnlockedColors = this.generateColorsWithAlgorithm(
        baseColor,
        algorithm,
        unlockedColors.length
      );
    }

    // Rebuild the colors array, replacing unlocked colors with new ones
    let newColorIndex = 0;
    const newColors = state.colors.map((c) => {
      if (c.locked) {
        return c;
      }
      return { ...newUnlockedColors[newColorIndex++], id: c.id };
    });

    this.store.update('palette', (s) => ({
      ...s,
      colors: newColors,
    }));
  }

  /**
   * Add a new color to the palette.
   * @param index - Optional index to insert at (appends if not provided)
   */
  addColor(index?: number): void {
    // Add a random color for now
    // TODO: Open color picker (DES004-13)
    const newColor = this.generateRandomColor();

    this.store.update('palette', (state) => {
      const colors = [...state.colors];
      if (index !== undefined && index >= 0 && index <= colors.length) {
        colors.splice(index, 0, newColor);
      } else {
        colors.push(newColor);
      }
      return { ...state, colors };
    });
  }

  /**
   * Remove a color from the palette.
   */
  removeColor(colorId: string): void {
    this.store.update('palette', (state) => ({
      ...state,
      colors: state.colors.filter((c) => c.id !== colorId),
    }));
  }

  /**
   * Copy a color's hex code to clipboard.
   */
  async copyColor(colorId: string): Promise<void> {
    const state = this.getState();
    const color = state.colors.find((c) => c.id === colorId);
    if (!color) return;

    await navigator.clipboard.writeText(color.hex);
    // TODO: Show toast notification
  }

  /**
   * Toggle the lock state of a color.
   */
  toggleLock(colorId: string): void {
    this.store.update('palette', (state) => ({
      ...state,
      colors: state.colors.map((c) =>
        c.id === colorId ? { ...c, locked: !c.locked } : c
      ),
    }));
  }

  /**
   * Update a color's role.
   */
  setColorRole(colorId: string, role: string | undefined): void {
    this.store.update('palette', (state) => ({
      ...state,
      colors: state.colors.map((c) =>
        c.id === colorId ? { ...c, role } : c
      ),
    }));
  }

  /**
   * Update a color's hex value (from color picker).
   */
  updateColor(colorId: string, hex: string): void {
    const color = chroma(hex);
    const [l, c, h] = color.oklch();

    this.store.update('palette', (state) => ({
      ...state,
      colors: state.colors.map((col) =>
        col.id === colorId
          ? {
              ...col,
              hex,
              oklch: { l, c, h: isNaN(h) ? 0 : h },
              name: getColorName(hex),
            }
          : col
      ),
    }));
  }

  /**
   * Reorder colors by moving a color from one index to another.
   */
  reorderColors(fromIndex: number, toIndex: number): void {
    this.store.update('palette', (state) => {
      const colors = [...state.colors];
      const [moved] = colors.splice(fromIndex, 1);
      colors.splice(toIndex, 0, moved);
      return { ...state, colors };
    });
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Generate colors using the selected algorithm based on locked colors.
   * Uses chroma.js for color space manipulation.
   */
  private generateColorsWithAlgorithm(
    baseHex: string,
    algorithm: Algorithm,
    count: number
  ): PaletteColor[] {
    const baseColor = chroma(baseHex);
    const baseHue = baseColor.get('hsl.h') || 0;
    const baseSat = baseColor.get('hsl.s');
    const baseLit = baseColor.get('hsl.l');

    // Generate hue offsets based on algorithm
    const hueOffsets = this.getHueOffsets(algorithm, count);

    return hueOffsets.map((offset, i) => {
      const hue = (baseHue + offset) % 360;
      // Vary saturation and lightness slightly for more natural palettes
      const sat = Math.max(0.3, Math.min(1, baseSat + (Math.random() - 0.5) * 0.15));
      const lit = Math.max(0.25, Math.min(0.75, baseLit + (Math.random() - 0.5) * 0.15));

      const color = chroma.hsl(hue, sat, lit);
      const hex = color.hex();
      const [l, c, h] = color.oklch();

      return {
        id: `color-${Date.now()}-${i}`,
        hex,
        oklch: { l, c, h: isNaN(h) ? 0 : h },
        name: getColorName(hex),
        locked: false,
      };
    });
  }

  /**
   * Get hue offsets for a color theory algorithm.
   * Returns array of hue rotations from the base color.
   * Note: These offsets are for UNLOCKED colors only - the locked base color
   * already exists, so we exclude the 0° offset from harmony patterns.
   */
  private getHueOffsets(algorithm: Algorithm, count: number): number[] {
    switch (algorithm) {
      case 'complementary':
        // Opposite color (180°) - base is already locked
        // When multiple colors needed, spread them around the complement
        if (count === 1) {
          return [180];
        } else {
          // Spread colors ±30° around the complement (150° to 210° range)
          const spread = 30;
          const offsets: number[] = [];
          for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            offsets.push(180 - spread + t * spread * 2);
          }
          return offsets;
        }

      case 'analogous':
        // Adjacent colors (±30°) - exclude base (0°)
        // When multiple colors needed, widen to ±45° to avoid clustering near base hue
        if (count <= 2) {
          return this.distributeOffsets([-30, 30], count);
        } else {
          // Spread colors across ±45° range, avoiding 0° (base hue)
          const spread = 45;
          // Shift odd counts by 5° so middle value doesn't land on 0°
          const shift = count % 2 === 1 ? 5 : 0;
          const offsets: number[] = [];
          for (let i = 0; i < count; i++) {
            const t = (i + 1) / (count + 1);
            offsets.push(-spread + shift + t * spread * 2);
          }
          return offsets;
        }

      case 'triadic':
        // Two other colors at 120° intervals - exclude base
        // When more than 2 colors needed, spread across the 100°-260° range
        if (count <= 2) {
          return this.distributeOffsets([120, 240], count);
        } else {
          // Spread colors across range encompassing both triadic points
          const startAngle = 100;
          const endAngle = 260;
          const offsets: number[] = [];
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            offsets.push(startAngle + t * (endAngle - startAngle));
          }
          return offsets;
        }

      case 'split-complementary':
        // Two colors adjacent to complement (150°, 210°) - exclude base
        // When more than 2 colors needed, widen to 130°-230° range
        if (count <= 2) {
          return this.distributeOffsets([150, 210], count);
        } else {
          const startAngle = 130;
          const endAngle = 230;
          const offsets: number[] = [];
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            offsets.push(startAngle + t * (endAngle - startAngle));
          }
          return offsets;
        }

      case 'tetradic':
        // Three other colors in rectangle (90°, 180°, 270°) - exclude base
        // Perfect for up to 3 unlocked colors (4 total with base)
        // When more than 3 unlocked, spread across 60°-300° range
        if (count <= 3) {
          return this.distributeOffsets([90, 180, 270], count);
        } else {
          const startAngle = 60;
          const endAngle = 300;
          const offsets: number[] = [];
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            offsets.push(startAngle + t * (endAngle - startAngle));
          }
          return offsets;
        }

      case 'monochromatic':
        // Same hue, we'll vary saturation/lightness in the caller
        // Return all zeros, the variation comes from sat/lit changes
        return Array(count).fill(0);

      default:
        return this.distributeOffsets([180], count);
    }
  }

  /**
   * Distribute base offsets to fill the requested count.
   * If count > base offsets, interpolate between them.
   * If count < base offsets, take a subset.
   */
  private distributeOffsets(baseOffsets: number[], count: number): number[] {
    if (count <= 0) return [];
    if (count <= baseOffsets.length) {
      return baseOffsets.slice(0, count);
    }

    // Need more colors than base algorithm provides
    // Interpolate between the base offsets
    const result: number[] = [];
    const step = baseOffsets.length / count;

    for (let i = 0; i < count; i++) {
      const index = i * step;
      const lower = Math.floor(index) % baseOffsets.length;
      const upper = (lower + 1) % baseOffsets.length;
      const t = index - Math.floor(index);

      // Interpolate between adjacent offsets
      let offset = baseOffsets[lower] + t * (baseOffsets[upper] - baseOffsets[lower]);
      // Handle wraparound for hue
      if (Math.abs(baseOffsets[upper] - baseOffsets[lower]) > 180) {
        // Cross the 0/360 boundary
        const adjustedUpper = baseOffsets[upper] < baseOffsets[lower]
          ? baseOffsets[upper] + 360
          : baseOffsets[upper] - 360;
        offset = baseOffsets[lower] + t * (adjustedUpper - baseOffsets[lower]);
      }
      result.push(((offset % 360) + 360) % 360);
    }

    return result;
  }

  /**
   * Generate monochromatic palette by varying saturation and lightness.
   * Distributes colors evenly across the lightness range, avoiding the base color.
   */
  private generateMonochromatic(baseHex: string, count: number): PaletteColor[] {
    const baseColor = chroma(baseHex);
    const baseHue = baseColor.get('hsl.h') || 0;
    const baseLit = baseColor.get('hsl.l');
    const baseSat = baseColor.get('hsl.s');

    // Define bounds for lightness
    const minLit = 0.15;
    const maxLit = 0.85;
    const range = maxLit - minLit; // 0.7

    // Calculate minimum step to ensure colors are distinguishable
    const minStep = 0.08;

    const colors: PaletteColor[] = [];

    for (let i = 0; i < count; i++) {
      // Distribute evenly across the range
      let lit = minLit + ((i + 1) / (count + 1)) * range;

      // Check if too close to base lightness, adjust if needed
      if (Math.abs(lit - baseLit) < minStep) {
        // Shift away from base
        lit = lit < baseLit ? baseLit - minStep : baseLit + minStep;
        // Clamp to bounds
        lit = Math.max(minLit, Math.min(maxLit, lit));
      }

      // Vary saturation inversely with lightness for richer palette
      // Darker colors get more saturation, lighter get less
      const satAdjust = (0.5 - lit) * 0.5;
      const sat = Math.max(0.3, Math.min(0.95, baseSat + satAdjust));

      const color = chroma.hsl(baseHue, sat, lit);
      const hex = color.hex();
      const [l, c, h] = color.oklch();

      colors.push({
        id: `color-${Date.now()}-${i}`,
        hex,
        oklch: { l, c, h: isNaN(h) ? 0 : h },
        name: getColorName(hex),
        locked: false,
      });
    }

    return colors;
  }

  /**
   * Generate a random color.
   */
  private generateRandomColor(): PaletteColor {
    const hue = Math.random() * 360;
    const sat = 0.5 + Math.random() * 0.4;
    const lit = 0.35 + Math.random() * 0.3;

    const color = chroma.hsl(hue, sat, lit);
    const hex = color.hex();
    const [l, c, h] = color.oklch();

    return {
      id: `color-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      hex,
      oklch: { l, c, h: isNaN(h) ? 0 : h },
      name: getColorName(hex),
      locked: false,
    };
  }
}

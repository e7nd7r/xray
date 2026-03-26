/**
 * Palette Type Definitions
 *
 * Types specific to the Color Palette Panel (DES-004).
 */

/** Color in a palette */
export interface PaletteColor {
  id: string;
  hex: string;
  oklch: { l: number; c: number; h: number };
  role?: string; // e.g., 'primary', 'secondary', 'accent'
  name?: string; // Optional human-readable name
  locked?: boolean; // If true, color won't change on regenerate
}

/** Algorithm types for palette generation */
export type Algorithm =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'monochromatic';

/** Visualizer slide types */
export type VisualizerSlide =
  // Palette Visualization
  | 'palette-grid'
  | 'palette-wheel'
  | 'palette-gradient'
  // Color Properties
  | 'lightness-ramp'
  | 'chroma-ramp'
  | 'hue-shift'
  // Accessibility
  | 'contrast-matrix'
  | 'wcag-badges'
  | 'color-blindness'
  // Perceptual
  | 'oklch-gamut'
  | 'perceptual-uniformity'
  | 'hue-interpolation'
  // Practical
  | 'text-samples'
  | 'button-states'
  | 'card-preview'
  // Data Visualization
  | 'bar-chart'
  | 'pie-chart'
  | 'line-chart'
  // Artistic
  | 'gradient-mesh'
  | 'color-harmony-wheel'
  | 'mood-board'
  // Mockup
  | 'landing-page'
  | 'dashboard'
  | 'mobile-app';

/** Palette panel state */
export interface PaletteState {
  colors: PaletteColor[];
  generationMode: 'algorithm' | 'ai';
  selectedAlgorithm: Algorithm;
  visualizerEnabled: boolean;
  visualizerSlide: VisualizerSlide;
}

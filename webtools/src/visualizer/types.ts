/**
 * Visualizer Type Definitions
 *
 * Types for the palette visualizer component (DES-004).
 */

import type { PaletteColor } from '../palette/types';

/**
 * A visualizer slide that can render a palette visualization.
 */
export interface Slide {
  /** Unique identifier for the slide */
  id: string;
  /** Display name for the slide */
  name: string;
  /** Category for grouping slides */
  category: SlideCategory;
  /** Render the slide content into a container */
  render: (container: HTMLElement, colors: PaletteColor[]) => void;
  /** Clean up resources (optional) */
  destroy?: () => void;
}

/**
 * Slide categories for organization.
 */
export type SlideCategory =
  | 'gradients'
  | 'analysis'
  | 'data-viz'
  | 'geometric'
  | 'fractals'
  | 'mockups';

/**
 * Slide registry entry for lazy loading.
 */
export interface SlideRegistryEntry {
  id: string;
  name: string;
  category: SlideCategory;
  /** Factory function to create the slide (for lazy loading) */
  create: () => Slide | Promise<Slide>;
}

/**
 * Visualizer configuration options.
 */
export interface VisualizerConfig {
  /** Initial slide ID to display */
  initialSlide?: string;
  /** Whether to show navigation controls */
  showControls?: boolean;
  /** Whether to show slide indicators */
  showIndicators?: boolean;
}

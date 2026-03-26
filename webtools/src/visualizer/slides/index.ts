/**
 * Slide Registry
 *
 * Central registry for all visualizer slides.
 * Supports lazy loading for performance.
 */

import type { SlideRegistryEntry } from '../types';
import {
  createLinearGradientSlide,
  createRadialGradientSlide,
  createMeshGradientSlide,
} from './gradients';
import {
  createColorWheelSlide,
  createContrastGridSlide,
  createLightnessChartSlide,
  createSaturationChartSlide,
  createHueDistributionSlide,
  createSwatchesSlide,
} from './analysis';
import {
  createPieChartSlide,
  createBarChartSlide,
  createTreemapSlide,
  createDataTableSlide,
} from './dataviz';
import {
  createTessellationSlide,
  createVoronoiSlide,
  createSpirographSlide,
  createKaleidoscopeSlide,
} from './geometric';
import {
  createMandelbrotSlide,
  createJuliaSetSlide,
  createSierpinskiSlide,
  createFractalNoiseSlide,
} from './fractals';
import {
  createUIComponentsSlide,
  createDashboardSlide,
  createMobileAppSlide,
} from './mockups';

/**
 * Get all available slide registry entries.
 * Uses factory functions for lazy loading.
 */
export function getSlideRegistry(): SlideRegistryEntry[] {
  return [
    // Gradient slides
    {
      id: 'linear-gradient',
      name: 'Linear Gradient',
      category: 'gradients',
      create: () => createLinearGradientSlide(),
    },
    {
      id: 'radial-gradient',
      name: 'Radial Gradient',
      category: 'gradients',
      create: () => createRadialGradientSlide(),
    },
    {
      id: 'mesh-gradient',
      name: 'Mesh Gradient',
      category: 'gradients',
      create: () => createMeshGradientSlide(),
    },
    // Analysis slides
    {
      id: 'swatches',
      name: 'Color Swatches',
      category: 'analysis',
      create: () => createSwatchesSlide(),
    },
    {
      id: 'color-wheel',
      name: 'Color Wheel',
      category: 'analysis',
      create: () => createColorWheelSlide(),
    },
    {
      id: 'contrast-grid',
      name: 'Contrast Grid',
      category: 'analysis',
      create: () => createContrastGridSlide(),
    },
    {
      id: 'lightness-chart',
      name: 'Lightness Chart',
      category: 'analysis',
      create: () => createLightnessChartSlide(),
    },
    {
      id: 'saturation-chart',
      name: 'Saturation Chart',
      category: 'analysis',
      create: () => createSaturationChartSlide(),
    },
    {
      id: 'hue-distribution',
      name: 'Hue Distribution',
      category: 'analysis',
      create: () => createHueDistributionSlide(),
    },
    // Data Viz slides
    {
      id: 'pie-chart',
      name: 'Pie Chart',
      category: 'data-viz',
      create: () => createPieChartSlide(),
    },
    {
      id: 'bar-chart',
      name: 'Bar Chart',
      category: 'data-viz',
      create: () => createBarChartSlide(),
    },
    {
      id: 'treemap',
      name: 'Treemap',
      category: 'data-viz',
      create: () => createTreemapSlide(),
    },
    {
      id: 'data-table',
      name: 'Data Table',
      category: 'data-viz',
      create: () => createDataTableSlide(),
    },
    // Geometric slides
    {
      id: 'tessellation',
      name: 'Tessellation',
      category: 'geometric',
      create: () => createTessellationSlide(),
    },
    {
      id: 'voronoi',
      name: 'Voronoi',
      category: 'geometric',
      create: () => createVoronoiSlide(),
    },
    {
      id: 'spirograph',
      name: 'Spirograph',
      category: 'geometric',
      create: () => createSpirographSlide(),
    },
    {
      id: 'kaleidoscope',
      name: 'Kaleidoscope',
      category: 'geometric',
      create: () => createKaleidoscopeSlide(),
    },
    // Fractal slides
    {
      id: 'mandelbrot',
      name: 'Mandelbrot',
      category: 'fractals',
      create: () => createMandelbrotSlide(),
    },
    {
      id: 'julia-set',
      name: 'Julia Set',
      category: 'fractals',
      create: () => createJuliaSetSlide(),
    },
    {
      id: 'sierpinski',
      name: 'Sierpinski',
      category: 'fractals',
      create: () => createSierpinskiSlide(),
    },
    {
      id: 'fractal-noise',
      name: 'Fractal Noise',
      category: 'fractals',
      create: () => createFractalNoiseSlide(),
    },
    // Mockup slides
    {
      id: 'ui-components',
      name: 'UI Components',
      category: 'mockups',
      create: () => createUIComponentsSlide(),
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      category: 'mockups',
      create: () => createDashboardSlide(),
    },
    {
      id: 'mobile-app',
      name: 'Mobile App',
      category: 'mockups',
      create: () => createMobileAppSlide(),
    },
  ];
}

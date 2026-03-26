/**
 * Gradient Slides
 *
 * Gradient visualization slides for the color palette visualizer.
 * Part of DES004-07.
 */

import chroma from 'chroma-js';
import type { Slide } from '../types';
import type { PaletteColor } from '../../palette/types';

// ============================================================================
// Linear Gradient Slide
// ============================================================================

/**
 * Create a linear gradient slide - smooth blend through palette colors.
 */
export function createLinearGradientSlide(): Slide {
  return {
    id: 'linear-gradient',
    name: 'Linear Gradient',
    category: 'gradients',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      const stops = colors.map((c, i) => {
        const pct = (i / Math.max(colors.length - 1, 1)) * 100;
        return `${c.hex} ${pct}%`;
      }).join(', ');

      container.innerHTML = `<div class="slide-gradient" style="background: linear-gradient(90deg, ${stops});"></div>`;
    },
  };
}

// ============================================================================
// Radial Gradient Slide
// ============================================================================

/**
 * Create a radial gradient slide - circular blend from center.
 */
export function createRadialGradientSlide(): Slide {
  return {
    id: 'radial-gradient',
    name: 'Radial Gradient',
    category: 'gradients',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      const stops = colors.map((c, i) => {
        const pct = (i / Math.max(colors.length - 1, 1)) * 100;
        return `${c.hex} ${pct}%`;
      }).join(', ');

      container.innerHTML = `<div class="slide-gradient" style="background: radial-gradient(circle, ${stops});"></div>`;
    },
  };
}

// ============================================================================
// Mesh Gradient Slide
// ============================================================================

/**
 * Create a mesh gradient slide - multi-point organic blending.
 */
export function createMeshGradientSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;

  return {
    id: 'mesh-gradient',
    name: 'Mesh Gradient',
    category: 'gradients',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = '8px';

      // Generate control points for each color
      const controlPoints = generateControlPoints(colors, width, height);

      // Render mesh gradient using inverse distance weighting
      renderMeshGradient(ctx, controlPoints, width, height);
    },
    destroy: () => {
      canvas = null;
    },
  };
}

/**
 * Generate control points distributed across the canvas.
 */
function generateControlPoints(
  colors: PaletteColor[],
  width: number,
  height: number
): { x: number; y: number; color: number[] }[] {
  const points: { x: number; y: number; color: number[] }[] = [];
  const n = colors.length;

  if (n === 1) {
    // Single color - place in center
    points.push({
      x: width / 2,
      y: height / 2,
      color: chroma(colors[0].hex).rgb(),
    });
  } else if (n === 2) {
    // Two colors - opposite corners
    points.push({ x: width * 0.2, y: height * 0.2, color: chroma(colors[0].hex).rgb() });
    points.push({ x: width * 0.8, y: height * 0.8, color: chroma(colors[1].hex).rgb() });
  } else if (n === 3) {
    // Three colors - triangle
    points.push({ x: width * 0.5, y: height * 0.15, color: chroma(colors[0].hex).rgb() });
    points.push({ x: width * 0.15, y: height * 0.85, color: chroma(colors[1].hex).rgb() });
    points.push({ x: width * 0.85, y: height * 0.85, color: chroma(colors[2].hex).rgb() });
  } else if (n === 4) {
    // Four colors - corners
    points.push({ x: width * 0.2, y: height * 0.2, color: chroma(colors[0].hex).rgb() });
    points.push({ x: width * 0.8, y: height * 0.2, color: chroma(colors[1].hex).rgb() });
    points.push({ x: width * 0.2, y: height * 0.8, color: chroma(colors[2].hex).rgb() });
    points.push({ x: width * 0.8, y: height * 0.8, color: chroma(colors[3].hex).rgb() });
  } else {
    // 5+ colors - distribute in a pattern
    // Center point
    points.push({ x: width * 0.5, y: height * 0.5, color: chroma(colors[0].hex).rgb() });
    // Remaining colors around the edges
    for (let i = 1; i < n; i++) {
      const angle = ((i - 1) / (n - 1)) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.4;
      points.push({
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        color: chroma(colors[i].hex).rgb(),
      });
    }
  }

  return points;
}

/**
 * Render mesh gradient using inverse distance weighting (IDW).
 */
function renderMeshGradient(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number; color: number[] }[],
  width: number,
  height: number
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const power = 2.5; // IDW power parameter - higher = sharper transitions

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalWeight = 0;
      let r = 0, g = 0, b = 0;

      // Calculate weighted color contribution from each control point
      for (const point of points) {
        const dx = x - point.x;
        const dy = y - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Avoid division by zero
        if (dist < 1) {
          r = point.color[0];
          g = point.color[1];
          b = point.color[2];
          totalWeight = 1;
          break;
        }

        const weight = 1 / Math.pow(dist, power);
        totalWeight += weight;
        r += point.color[0] * weight;
        g += point.color[1] * weight;
        b += point.color[2] * weight;
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / totalWeight);
      data[idx + 1] = Math.round(g / totalWeight);
      data[idx + 2] = Math.round(b / totalWeight);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

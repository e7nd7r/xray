/**
 * Analysis Slides
 *
 * Color analysis visualization slides using Chart.js.
 * Part of DES004-08.
 */

import { Chart, registerables } from 'chart.js';
import chroma from 'chroma-js';
import type { Slide } from '../types';
import type { PaletteColor } from '../../palette/types';

// Register all Chart.js components
Chart.register(...registerables);

/**
 * Helper: Get relative luminance (0-1) from a hex color.
 */
function getLuminance(hex: string): number {
  return chroma(hex).luminance();
}

/**
 * Helper: Get HSL values from hex.
 */
function getHSL(hex: string): { h: number; s: number; l: number } {
  const [h, s, l] = chroma(hex).hsl();
  return { h: isNaN(h) ? 0 : h, s, l };
}

/**
 * Helper: Calculate WCAG contrast ratio between two colors.
 */
function getContrastRatio(hex1: string, hex2: string): number {
  return chroma.contrast(hex1, hex2);
}

/**
 * Helper: Get contrast level label.
 */
function getContrastLevel(ratio: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-lg';
  return 'Fail';
}

/**
 * Helper: Destroy a Chart.js instance if it exists.
 */
function destroyChart(canvas: HTMLCanvasElement): void {
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
}

// ============================================================================
// Color Wheel Slide
// ============================================================================

/**
 * Create Color Wheel slide - palette colors plotted on a wheel with harmony lines.
 */
export function createColorWheelSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;

  return {
    id: 'color-wheel',
    name: 'Color Wheel',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      // Use flex container - it will naturally fit within parent's content area (excluding padding)
      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get size from wrapper which respects parent padding via CSS
      const size = Math.min(wrapper.clientWidth, wrapper.clientHeight);
      canvas.width = size;
      canvas.height = size;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 4; // Maximum wheel size with minimal padding

      // Draw the color wheel background with soft edges
      drawColorWheelBackground(ctx, centerX, centerY, radius);

      // Plot each color on the wheel
      const colorPoints: { x: number; y: number; color: PaletteColor }[] = [];
      colors.forEach((color) => {
        const { h, s } = getHSL(color.hex);
        const angle = (h - 90) * (Math.PI / 180); // Adjust so 0° is at top
        const dist = s * radius * 0.9;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        colorPoints.push({ x, y, color });
      });

      // Draw harmony lines connecting colors
      if (colorPoints.length > 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        colorPoints.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // Draw color points - small markers
      colorPoints.forEach((pt) => {
        // Outer ring (white border)
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Inner color
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pt.color.hex;
        ctx.fill();
      });
    },
    destroy: () => {
      canvas = null;
    },
  };
}

/**
 * Draw a HSL color wheel background with soft edges.
 */
function drawColorWheelBackground(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void {
  const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const edgeSoftness = 2; // Pixels for edge anti-aliasing

  for (let y = 0; y < ctx.canvas.height; y++) {
    for (let x = 0; x < ctx.canvas.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius + edgeSoftness) {
        const angle = Math.atan2(dy, dx);
        const hue = ((angle * 180) / Math.PI + 90 + 360) % 360;
        const saturation = Math.min(dist / radius, 1);
        const [r, g, b] = chroma.hsl(hue, saturation, 0.5).rgb();

        // Calculate alpha for soft edge
        let alpha = 255;
        if (dist > radius - edgeSoftness) {
          alpha = Math.max(0, 255 * (1 - (dist - (radius - edgeSoftness)) / (edgeSoftness * 2)));
        }

        const idx = (y * ctx.canvas.width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = alpha;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================================================
// Contrast Grid Slide
// ============================================================================

/**
 * Create Contrast Grid slide - matrix of contrast ratios between color pairs.
 */
export function createContrastGridSlide(): Slide {
  return {
    id: 'contrast-grid',
    name: 'Contrast Grid',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      if (colors.length === 1) {
        container.innerHTML = '<div class="slide-empty">Add more colors to see contrast grid</div>';
        return;
      }

      // Build grid HTML
      let html = '<div class="contrast-grid-container"><table class="contrast-grid">';

      // Header row
      html += '<tr><th></th>';
      colors.forEach((c) => {
        html += `<th style="background:${c.hex}; width: 40px; height: 24px;"></th>`;
      });
      html += '</tr>';

      // Data rows
      colors.forEach((rowColor, i) => {
        html += `<tr><td style="background:${rowColor.hex}; width: 40px; height: 32px;"></td>`;
        colors.forEach((colColor, j) => {
          if (i === j) {
            html += '<td class="contrast-cell contrast-self">—</td>';
          } else {
            const ratio = getContrastRatio(rowColor.hex, colColor.hex);
            const level = getContrastLevel(ratio);
            const levelClass = level.toLowerCase().replace('-', '');
            html += `<td class="contrast-cell contrast-${levelClass}" title="${rowColor.name || rowColor.hex} / ${colColor.name || colColor.hex}">${ratio.toFixed(1)}</td>`;
          }
        });
        html += '</tr>';
      });

      html += '</table></div>';
      container.innerHTML = html;
    },
  };
}

// ============================================================================
// Lightness Chart Slide
// ============================================================================

/**
 * Create Lightness Chart slide - bar chart of luminance values.
 */
export function createLightnessChartSlide(): Slide {
  let chart: Chart | null = null;

  return {
    id: 'lightness-chart',
    name: 'Lightness Chart',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      destroyChart(canvas);

      const labels = colors.map((c) => c.name || c.hex.slice(0, 7));
      const luminances = colors.map((c) => Math.round(getLuminance(c.hex) * 100));
      const bgColors = colors.map((c) => c.hex);

      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Lightness %',
              data: luminances,
              backgroundColor: bgColors,
              borderColor: bgColors.map((c) => chroma(c).darken(0.5).hex()),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: '#888' },
              grid: { color: 'rgba(255,255,255,0.1)' },
            },
            x: {
              ticks: { color: '#888', maxRotation: 45 },
              grid: { display: false },
            },
          },
        },
      });
    },
    destroy: () => {
      chart?.destroy();
      chart = null;
    },
  };
}

// ============================================================================
// Saturation Chart Slide
// ============================================================================

/**
 * Create Saturation Chart slide - bar chart of saturation levels.
 */
export function createSaturationChartSlide(): Slide {
  let chart: Chart | null = null;

  return {
    id: 'saturation-chart',
    name: 'Saturation Chart',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      destroyChart(canvas);

      const labels = colors.map((c) => c.name || c.hex.slice(0, 7));
      const saturations = colors.map((c) => Math.round(getHSL(c.hex).s * 100));
      const bgColors = colors.map((c) => c.hex);

      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Saturation %',
              data: saturations,
              backgroundColor: bgColors,
              borderColor: bgColors.map((c) => chroma(c).darken(0.5).hex()),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: '#888' },
              grid: { color: 'rgba(255,255,255,0.1)' },
            },
            x: {
              ticks: { color: '#888', maxRotation: 45 },
              grid: { display: false },
            },
          },
        },
      });
    },
    destroy: () => {
      chart?.destroy();
      chart = null;
    },
  };
}

// ============================================================================
// Hue Distribution Slide
// ============================================================================

/**
 * Create Hue Distribution slide - polar chart showing hue spread.
 */
export function createHueDistributionSlide(): Slide {
  let chart: Chart | null = null;

  return {
    id: 'hue-distribution',
    name: 'Hue Distribution',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      destroyChart(canvas);

      // Create 12 hue buckets (30° each)
      const buckets = Array(12).fill(0);
      const bucketColors: string[][] = Array(12)
        .fill(null)
        .map(() => []);

      colors.forEach((c) => {
        const { h } = getHSL(c.hex);
        const bucket = Math.floor(h / 30) % 12;
        buckets[bucket]++;
        bucketColors[bucket].push(c.hex);
      });

      const labels = [
        'Red', 'Orange', 'Yellow', 'Lime',
        'Green', 'Teal', 'Cyan', 'Sky',
        'Blue', 'Purple', 'Magenta', 'Pink',
      ];

      // Use the first color in each bucket, or a default hue color
      const bgColors = buckets.map((_, i) => {
        if (bucketColors[i].length > 0) {
          return bucketColors[i][0];
        }
        return chroma.hsl(i * 30, 0.7, 0.5).hex();
      });

      chart = new Chart(canvas, {
        type: 'polarArea',
        data: {
          labels,
          datasets: [
            {
              data: buckets,
              backgroundColor: bgColors.map((c) => chroma(c).alpha(0.7).css()),
              borderColor: bgColors,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            r: {
              ticks: { display: false },
              grid: { color: 'rgba(255,255,255,0.1)' },
            },
          },
        },
      });
    },
    destroy: () => {
      chart?.destroy();
      chart = null;
    },
  };
}

// ============================================================================
// Color Swatches Slide
// ============================================================================

/**
 * Create a color swatches slide - simple color display.
 */
export function createSwatchesSlide(): Slide {
  return {
    id: 'swatches',
    name: 'Color Swatches',
    category: 'analysis',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      const swatches = colors.map((c) => `
        <div class="slide-swatch" style="background: ${c.hex};">
          <span class="slide-swatch-label">${c.name || c.hex}</span>
        </div>
      `).join('');

      container.innerHTML = `<div class="slide-swatches">${swatches}</div>`;
    },
  };
}

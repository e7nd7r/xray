/**
 * Data Visualization Slides
 *
 * Pie Chart, Bar Chart, Treemap, and Data Table slides
 * using relationship-aware color optimization.
 * Part of DES004-09.
 */

import { Chart, registerables } from 'chart.js';
import chroma from 'chroma-js';
import type { Slide } from '../types';
import type { PaletteColor } from '../../palette/types';
import { buildContrastMatrix, calculateProminence } from './color-utils';

// Register Chart.js components
Chart.register(...registerables);

// ============================================================================
// Types
// ============================================================================

interface Slot {
  id: number;
  importance: number; // visual prominence of this position (0-1)
  neighbors: number[]; // adjacent slot IDs
  weight: number; // relative size
}

interface OptimizedColor {
  color: PaletteColor;
  slotId: number;
  prominence: number;
  percentage: number;
}

// ============================================================================
// Matrix Building
// ============================================================================

/**
 * Build perceptual distance matrix using CIEDE2000.
 * distanceMatrix[i][j] = how different color i looks from color j
 */
function buildDistanceMatrix(colors: PaletteColor[]): number[][] {
  const n = colors.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // chroma.deltaE returns CIEDE2000 distance by default
      const dist = chroma.deltaE(colors[i].hex, colors[j].hex);
      matrix[i][j] = dist;
      matrix[j][i] = dist; // symmetric
    }
  }
  return matrix;
}


// ============================================================================
// Slot Generation
// ============================================================================

/**
 * Create slots for pie chart (circular arrangement).
 */
function createPieSlots(n: number, prominences: number[]): Slot[] {
  // Normalize prominences to percentages for weights
  const total = prominences.reduce((sum, p) => sum + p, 0);
  const percentages = prominences.map((p) => p / total);

  return Array(n)
    .fill(null)
    .map((_, i) => ({
      id: i,
      importance: 1 - (i / n) * 0.5, // first slot is most important
      neighbors: [(i - 1 + n) % n, (i + 1) % n], // circular
      weight: percentages[i],
    }));
}

/**
 * Create slots for bar chart (linear arrangement).
 */
function createBarSlots(n: number, prominences: number[]): Slot[] {
  return Array(n)
    .fill(null)
    .map((_, i) => ({
      id: i,
      importance: 1 - (i / n) * 0.3, // leftmost is most important
      neighbors: [i - 1, i + 1].filter((x) => x >= 0 && x < n),
      weight: prominences[i],
    }));
}

/**
 * Create slots for treemap (2D arrangement with computed adjacency).
 */
function createTreemapSlots(n: number, prominences: number[]): Slot[] {
  // For treemap, we'll compute adjacency after layout
  // For now, create slots with weights
  const total = prominences.reduce((sum, p) => sum + p, 0);

  return Array(n)
    .fill(null)
    .map((_, i) => ({
      id: i,
      importance: 1 - (i / n) * 0.3,
      neighbors: [], // will be computed from layout
      weight: prominences[i] / total,
    }));
}

// ============================================================================
// Optimization
// ============================================================================

/**
 * Evaluate a layout assignment.
 */
function evaluateLayout(
  assignment: Map<number, number>,
  slots: Slot[],
  distMatrix: number[][],
  contrastMatrix: number[][],
  prominence: number[]
): number {
  let score = 0;

  // Adjacency score: reward high distance and contrast between neighbors
  for (const slot of slots) {
    const colorA = assignment.get(slot.id)!;
    for (const neighborId of slot.neighbors) {
      const colorB = assignment.get(neighborId)!;
      if (colorA < colorB) {
        // count each pair once
        // Normalize: deltaE typically 0-100, contrast 1-21
        const distScore = Math.min(distMatrix[colorA][colorB] / 100, 1);
        const contrastScore = (contrastMatrix[colorA][colorB] - 1) / 20;
        score += distScore * 0.5 + contrastScore * 0.5;
      }
    }
  }

  // Placement score: prominent colors in important slots
  for (const slot of slots) {
    const colorIdx = assignment.get(slot.id)!;
    score += prominence[colorIdx] * slot.importance * 0.3;
  }

  return score;
}

/**
 * Generate all permutations of an array.
 */
function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }

  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

/**
 * Optimize layout using brute force for small N, greedy+swap for larger.
 */
function optimizeLayout(
  colors: PaletteColor[],
  slots: Slot[]
): Map<number, number> {
  const n = colors.length;
  if (n === 0) return new Map();
  if (n === 1) return new Map([[slots[0].id, 0]]);

  const distMatrix = buildDistanceMatrix(colors);
  const contrastMatrix = buildContrastMatrix(colors);
  const prominence = colors.map((c) => calculateProminence(c.hex));

  if (n <= 6) {
    // Brute force: try all n! permutations (max 720)
    let bestAssignment: Map<number, number> = new Map();
    let bestScore = -Infinity;

    const indices = Array(n)
      .fill(0)
      .map((_, i) => i);
    for (const perm of permutations(indices)) {
      const assignment = new Map(slots.map((s, i) => [s.id, perm[i]]));
      const score = evaluateLayout(
        assignment,
        slots,
        distMatrix,
        contrastMatrix,
        prominence
      );
      if (score > bestScore) {
        bestScore = score;
        bestAssignment = new Map(assignment);
      }
    }

    return bestAssignment;
  } else {
    // Greedy + local search for larger palettes
    const sortedSlots = [...slots].sort((a, b) => b.importance - a.importance);
    const sortedColors = prominence
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p);
    const assignment = new Map(
      sortedSlots.map((s, i) => [s.id, sortedColors[i].i])
    );

    // Local search: keep swapping until no improvement
    let improved = true;
    while (improved) {
      improved = false;
      const currentScore = evaluateLayout(
        assignment,
        slots,
        distMatrix,
        contrastMatrix,
        prominence
      );

      for (let i = 0; i < slots.length && !improved; i++) {
        for (let j = i + 1; j < slots.length && !improved; j++) {
          const slotA = slots[i].id;
          const slotB = slots[j].id;
          const colorA = assignment.get(slotA)!;
          const colorB = assignment.get(slotB)!;

          // Try swap
          assignment.set(slotA, colorB);
          assignment.set(slotB, colorA);

          const newScore = evaluateLayout(
            assignment,
            slots,
            distMatrix,
            contrastMatrix,
            prominence
          );

          if (newScore > currentScore) {
            improved = true;
          } else {
            // Revert
            assignment.set(slotA, colorA);
            assignment.set(slotB, colorB);
          }
        }
      }
    }

    return assignment;
  }
}

/**
 * Get optimized colors with slot assignments and percentages.
 */
function getOptimizedColors(
  colors: PaletteColor[],
  slotType: 'pie' | 'bar' | 'treemap'
): OptimizedColor[] {
  if (colors.length === 0) return [];

  const prominences = colors.map((c) => calculateProminence(c.hex));
  const total = prominences.reduce((sum, p) => sum + p, 0);

  let slots: Slot[];
  switch (slotType) {
    case 'pie':
      slots = createPieSlots(colors.length, prominences);
      break;
    case 'bar':
      slots = createBarSlots(colors.length, prominences);
      break;
    case 'treemap':
      slots = createTreemapSlots(colors.length, prominences);
      break;
  }

  const assignment = optimizeLayout(colors, slots);

  // Build result array in slot order
  const result: OptimizedColor[] = [];
  for (const slot of slots) {
    const colorIdx = assignment.get(slot.id)!;
    result.push({
      color: colors[colorIdx],
      slotId: slot.id,
      prominence: prominences[colorIdx],
      percentage: (prominences[colorIdx] / total) * 100,
    });
  }

  return result;
}

// ============================================================================
// Helper: Destroy Chart.js instance
// ============================================================================

function destroyChart(canvas: HTMLCanvasElement): void {
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
}

// ============================================================================
// Pie Chart Slide
// ============================================================================

/**
 * Create Pie Chart slide - segments sized by prominence, ordered by optimization.
 */
export function createPieChartSlide(): Slide {
  let chart: Chart | null = null;

  return {
    id: 'pie-chart',
    name: 'Pie Chart',
    category: 'data-viz',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML =
          '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML =
        '<div class="slide-wrapper"><canvas></canvas></div>';
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      destroyChart(canvas);

      const optimized = getOptimizedColors(colors, 'pie');
      const labels = optimized.map(
        (o) => o.color.name || o.color.hex.slice(0, 7)
      );
      const data = optimized.map((o) => o.percentage);
      const bgColors = optimized.map((o) => o.color.hex);
      const borderColors = optimized.map((o) =>
        chroma(o.color.hex).darken(0.5).hex()
      );

      chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = ctx.parsed as number;
                  return `${ctx.label}: ${value.toFixed(1)}%`;
                },
              },
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
// Bar Chart Slide
// ============================================================================

/**
 * Create Bar Chart slide - bar heights show raw prominence scores.
 */
export function createBarChartSlide(): Slide {
  let chart: Chart | null = null;

  return {
    id: 'bar-chart',
    name: 'Bar Chart',
    category: 'data-viz',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML =
          '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML =
        '<div class="slide-wrapper"><canvas></canvas></div>';
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      destroyChart(canvas);

      const optimized = getOptimizedColors(colors, 'bar');
      const labels = optimized.map(
        (o) => o.color.name || o.color.hex.slice(0, 7)
      );
      const data = optimized.map((o) => o.prominence);
      const bgColors = optimized.map((o) => o.color.hex);
      const borderColors = optimized.map((o) =>
        chroma(o.color.hex).darken(0.5).hex()
      );

      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Prominence',
              data,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1,
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
            y: {
              beginAtZero: true,
              max: 1,
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
// Treemap Slide
// ============================================================================

interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: PaletteColor;
  percentage: number;
}

/**
 * Squarified treemap algorithm - attempt to make rectangles as square as possible.
 */
function squarify(
  items: { color: PaletteColor; value: number }[],
  bounds: { x: number; y: number; width: number; height: number }
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [
      {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color: items[0].color,
        percentage: items[0].value * 100,
      },
    ];
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  const rects: TreemapRect[] = [];

  // Sort by value descending
  const sorted = [...items].sort((a, b) => b.value - a.value);

  let remaining = [...sorted];
  const currentBounds = { ...bounds };

  while (remaining.length > 0) {
    // Decide split direction based on aspect ratio
    const isWide = currentBounds.width >= currentBounds.height;

    // Take items for this row/column
    const rowItems: typeof remaining = [];
    let rowTotal = 0;
    const side = isWide ? currentBounds.height : currentBounds.width;
    const totalRemaining = remaining.reduce((sum, item) => sum + item.value, 0);

    // Greedy: add items while aspect ratio improves
    let bestAspect = Infinity;
    for (const item of remaining) {
      const testRow = [...rowItems, item];
      const testTotal = rowTotal + item.value;
      const rowFraction = testTotal / totalRemaining;
      const rowSize = isWide
        ? currentBounds.width * rowFraction
        : currentBounds.height * rowFraction;

      // Calculate worst aspect ratio in this row
      let worstAspect = 0;
      for (const ri of testRow) {
        const itemFraction = ri.value / testTotal;
        const itemSize = side * itemFraction;
        const aspect = Math.max(rowSize / itemSize, itemSize / rowSize);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect || rowItems.length === 0) {
        bestAspect = worstAspect;
        rowItems.push(item);
        rowTotal += item.value;
      } else {
        break;
      }
    }

    // Layout this row
    const rowFraction = rowTotal / totalRemaining;
    const rowSize = isWide
      ? currentBounds.width * rowFraction
      : currentBounds.height * rowFraction;

    let offset = 0;
    for (const item of rowItems) {
      const itemFraction = item.value / rowTotal;
      const itemSize = side * itemFraction;

      if (isWide) {
        rects.push({
          x: currentBounds.x,
          y: currentBounds.y + offset,
          width: rowSize,
          height: itemSize,
          color: item.color,
          percentage: (item.value / total) * 100,
        });
      } else {
        rects.push({
          x: currentBounds.x + offset,
          y: currentBounds.y,
          width: itemSize,
          height: rowSize,
          color: item.color,
          percentage: (item.value / total) * 100,
        });
      }
      offset += itemSize;
    }

    // Update bounds for remaining items
    if (isWide) {
      currentBounds.x += rowSize;
      currentBounds.width -= rowSize;
    } else {
      currentBounds.y += rowSize;
      currentBounds.height -= rowSize;
    }

    // Remove processed items
    remaining = remaining.filter((item) => !rowItems.includes(item));
  }

  return rects;
}

/**
 * Create Treemap slide - rectangles sized by prominence.
 */
export function createTreemapSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;

  return {
    id: 'treemap',
    name: 'Treemap',
    category: 'data-viz',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML =
          '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML =
        '<div class="slide-wrapper"><canvas></canvas></div>';
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

      // Get optimized colors with percentages
      const optimized = getOptimizedColors(colors, 'treemap');
      const items = optimized.map((o) => ({
        color: o.color,
        value: o.percentage / 100,
      }));

      // Generate treemap layout
      const padding = 2;
      const rects = squarify(items, {
        x: padding,
        y: padding,
        width: width - padding * 2,
        height: height - padding * 2,
      });

      // Render rectangles
      for (const rect of rects) {
        // Fill
        ctx.fillStyle = rect.color.hex;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Border
        ctx.strokeStyle = chroma(rect.color.hex).darken(0.5).hex();
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Label (if large enough)
        if (rect.width > 40 && rect.height > 30) {
          const lum = chroma(rect.color.hex).luminance();
          ctx.fillStyle = lum > 0.5 ? '#000' : '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const label = rect.color.name || rect.color.hex.slice(0, 7);
          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;

          ctx.fillText(label, centerX, centerY - 6);
          ctx.fillText(`${rect.percentage.toFixed(1)}%`, centerX, centerY + 6);
        }
      }
    },
    destroy: () => {
      canvas = null;
    },
  };
}

// ============================================================================
// Data Table Slide
// ============================================================================

/**
 * Create Data Table slide - displays all color metrics.
 */
export function createDataTableSlide(): Slide {
  return {
    id: 'data-table',
    name: 'Data Table',
    category: 'data-viz',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML =
          '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      // Calculate metrics for each color
      const rows = colors.map((c) => {
        const sat = chroma(c.hex).get('hsl.s');
        const lum = chroma(c.hex).luminance();
        const hue = chroma(c.hex).get('hsl.h');
        const prominence = calculateProminence(c.hex);

        return {
          color: c,
          hue: isNaN(hue) ? 0 : Math.round(hue),
          sat: Math.round(sat * 100),
          lum: Math.round(lum * 100),
          prominence: Math.round(prominence * 100),
        };
      });

      let html = `
        <div class="dataviz-table-container">
          <table class="dataviz-table">
            <thead>
              <tr>
                <th>Color</th>
                <th>Hex</th>
                <th>Hue</th>
                <th>Sat%</th>
                <th>Lum%</th>
                <th>Prom%</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const row of rows) {
        const lum = chroma(row.color.hex).luminance();
        const textColor = lum > 0.5 ? '#000' : '#fff';

        html += `
          <tr>
            <td>
              <span class="dataviz-color-swatch" style="background:${row.color.hex}; color:${textColor}">
                ${row.color.name || '—'}
              </span>
            </td>
            <td class="dataviz-mono">${row.color.hex}</td>
            <td>${row.hue}°</td>
            <td>${row.sat}</td>
            <td>${row.lum}</td>
            <td>${row.prominence}</td>
          </tr>
        `;
      }

      html += '</tbody></table></div>';
      container.innerHTML = html;
    },
  };
}

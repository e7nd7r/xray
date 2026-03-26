/**
 * UI Mockup Slides
 *
 * UI Components, Dashboard, and Mobile App mockups
 * using semantic slot tree optimization for color assignment.
 * Part of DES004-12.
 */

import chroma from 'chroma-js';
import type { Slide } from '../types';
import type { PaletteColor } from '../../palette/types';
import { calculateProminence, generateScale } from './color-utils';

// ============================================================================
// Types
// ============================================================================

type SlotType = 'background' | 'surface' | 'accent' | 'text' | 'border';

interface SlotNode {
  id: string;
  type: SlotType;
  importance: number; // 0-1, for prominence matching
  minContrast?: number; // WCAG ratio required with parent
  children: SlotNode[];
}

interface ExpandedColor {
  hex: string;
  sourceIndex: number; // which palette color this came from
  scalePosition: number; // 0-8 position in the scale
  prominence: number; // visual prominence score
}

/**
 * Expand palette into full color pool with scales.
 * Includes neutral grays, white, and black for flexibility.
 */
function expandPalette(colors: PaletteColor[]): ExpandedColor[] {
  const pool: ExpandedColor[] = [];

  // Add palette colors with their scales
  for (let i = 0; i < colors.length; i++) {
    const scale = generateScale(colors[i].hex);
    for (let j = 0; j < scale.length; j++) {
      pool.push({
        hex: scale[j],
        sourceIndex: i,
        scalePosition: j,
        prominence: calculateProminence(scale[j]),
      });
    }
  }

  // Add neutral gray scale (sourceIndex = -1 to mark as neutral)
  const neutralGrays = chroma.scale(['#ffffff', '#000000']).mode('lab').colors(9);
  for (let j = 0; j < neutralGrays.length; j++) {
    pool.push({
      hex: neutralGrays[j],
      sourceIndex: -1, // neutral
      scalePosition: j,
      prominence: calculateProminence(neutralGrays[j]),
    });
  }

  return pool;
}

// ============================================================================
// Scale Region Selection
// ============================================================================

/**
 * Get the scale region for a slot type.
 * Returns [min, max] inclusive positions in the 0-8 scale.
 */
function getScaleRegion(type: SlotType): [number, number] {
  switch (type) {
    case 'background':
      return [6, 8]; // darkest
    case 'surface':
      return [5, 7]; // dark
    case 'accent':
      return [2, 5]; // includes original (4)
    case 'text':
      return [0, 2]; // lightest (will check contrast)
    case 'border':
      return [3, 5]; // muted mid-tones
  }
}

/**
 * Check if a color is in the appropriate scale region for a type.
 */
function isInScaleRegion(color: ExpandedColor, type: SlotType): boolean {
  const [min, max] = getScaleRegion(type);
  return color.scalePosition >= min && color.scalePosition <= max;
}

// ============================================================================
// Tree Optimization
// ============================================================================

/**
 * Check if a color has good contrast with available text colors from the pool.
 * Returns the max contrast achievable with any text-region color (range: 1-21).
 */
function getMaxTextContrast(hex: string, colorPool: ExpandedColor[]): number {
  // Text colors come from positions 0-2 (light) or 6-8 (dark)
  const textCandidates = colorPool.filter(
    (c) => c.scalePosition <= 2 || c.scalePosition >= 6
  );

  let maxContrast = 1;
  for (const textColor of textCandidates) {
    const contrast = chroma.contrast(hex, textColor.hex);
    if (contrast > maxContrast) {
      maxContrast = contrast;
    }
  }
  return maxContrast;
}

/**
 * Optimize sibling color assignments.
 */
function optimizeSiblings(
  siblings: SlotNode[],
  colorPool: ExpandedColor[],
  parentColor: string | null
): Map<string, string> {
  if (siblings.length === 0) return new Map();

  // 1. Get candidates for each sibling
  const candidatesPerSlot: ExpandedColor[][] = siblings.map((s) => {
    let candidates = colorPool.filter((c) => isInScaleRegion(c, s.type));

    // For text, include both light and dark candidates - let contrast filter decide
    if (s.type === 'text') {
      candidates = colorPool.filter(
        (c) => c.scalePosition <= 2 || c.scalePosition >= 6
      );
    }

    // For accents with text children, ensure the color will have good contrast with text
    if (s.type === 'accent' && s.children.some((c) => c.type === 'text')) {
      const minTextContrast = 4.5; // WCAG AA for normal text
      const filtered = candidates.filter(
        (c) => getMaxTextContrast(c.hex, colorPool) >= minTextContrast
      );
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }

    // Filter by contrast requirement with parent
    if (parentColor && s.minContrast) {
      candidates = candidates.filter(
        (c) => chroma.contrast(c.hex, parentColor) >= s.minContrast!
      );
    }

    // Fallback: if no candidates meet contrast, pick highest contrast available
    if (candidates.length === 0 && parentColor) {
      const allSorted = [...colorPool].sort(
        (a, b) =>
          chroma.contrast(b.hex, parentColor) -
          chroma.contrast(a.hex, parentColor)
      );
      candidates = allSorted.slice(0, 5);
    }

    return candidates;
  });

  // 2. For small number of siblings, try all combinations
  if (siblings.length <= 4) {
    return bruteForceAssignment(siblings, candidatesPerSlot, parentColor);
  }

  // 3. For larger sets, use greedy assignment
  return greedyAssignment(siblings, candidatesPerSlot, parentColor);
}

/**
 * Brute force optimal assignment for small sibling sets.
 */
function bruteForceAssignment(
  siblings: SlotNode[],
  candidatesPerSlot: ExpandedColor[][],
  parentColor: string | null
): Map<string, string> {
  let bestAssignment = new Map<string, string>();
  let bestScore = -Infinity;

  // Limit candidates to prevent explosion
  const limitedCandidates = candidatesPerSlot.map((c) => c.slice(0, 8));

  function* combinations(
    index: number,
    current: ExpandedColor[]
  ): Generator<ExpandedColor[]> {
    if (index === siblings.length) {
      yield current;
      return;
    }
    for (const candidate of limitedCandidates[index]) {
      yield* combinations(index + 1, [...current, candidate]);
    }
  }

  for (const combo of combinations(0, [])) {
    const assignment = new Map<string, string>();
    for (let i = 0; i < siblings.length; i++) {
      assignment.set(siblings[i].id, combo[i].hex);
    }

    const score = evaluateAssignment(
      siblings,
      combo,
      parentColor
    );
    if (score > bestScore) {
      bestScore = score;
      bestAssignment = assignment;
    }
  }

  return bestAssignment;
}

/**
 * Greedy assignment for larger sibling sets.
 */
function greedyAssignment(
  siblings: SlotNode[],
  candidatesPerSlot: ExpandedColor[][],
  parentColor: string | null
): Map<string, string> {
  const assignment = new Map<string, string>();
  const usedSourceIndices = new Set<number>();

  // Sort siblings by importance (assign most important first)
  const sortedIndices = siblings
    .map((_, i) => i)
    .sort((a, b) => siblings[b].importance - siblings[a].importance);

  for (const i of sortedIndices) {
    const sibling = siblings[i];
    const candidates = candidatesPerSlot[i];

    // Find best candidate considering distance from already assigned
    let bestCandidate = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      // Prefer unused source colors for diversity
      const diversityBonus = usedSourceIndices.has(candidate.sourceIndex)
        ? 0
        : 0.5;

      // Calculate distance from already assigned siblings
      let distanceScore = 0;
      for (const [, hex] of assignment) {
        distanceScore += chroma.deltaE(candidate.hex, hex) / 100;
      }

      // Contrast margin bonus with parent
      let contrastBonus = 0;
      if (parentColor && sibling.minContrast) {
        const contrast = chroma.contrast(candidate.hex, parentColor);
        const margin = contrast - sibling.minContrast;
        contrastBonus = Math.min(margin / 10, 0.5);
      }

      // Prominence matching
      const prominenceScore = candidate.prominence * sibling.importance;

      const totalScore = diversityBonus + distanceScore + contrastBonus + prominenceScore * 0.3;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCandidate = candidate;
      }
    }

    assignment.set(sibling.id, bestCandidate.hex);
    usedSourceIndices.add(bestCandidate.sourceIndex);
  }

  return assignment;
}

/**
 * Evaluate an assignment's quality.
 */
function evaluateAssignment(
  siblings: SlotNode[],
  colors: ExpandedColor[],
  parentColor: string | null
): number {
  let score = 0;

  // 1. Contrast margin bonus
  if (parentColor) {
    for (let i = 0; i < siblings.length; i++) {
      const contrast = chroma.contrast(colors[i].hex, parentColor);
      const required = siblings[i].minContrast || 1;
      const margin = contrast - required;
      score += Math.min(margin / 10, 0.5);
    }
  }

  // 2. Sibling distance (perceptual distinctness)
  for (let i = 0; i < siblings.length; i++) {
    for (let j = i + 1; j < siblings.length; j++) {
      const dist = chroma.deltaE(colors[i].hex, colors[j].hex);
      score += Math.min(dist / 100, 1);
    }
  }

  // 3. Prominence matching
  for (let i = 0; i < siblings.length; i++) {
    score += colors[i].prominence * siblings[i].importance * 0.3;
  }

  // 4. Source diversity bonus
  const sources = new Set(colors.map((c) => c.sourceIndex));
  score += sources.size * 0.2;

  return score;
}

/**
 * Optimize entire tree top-down.
 */
function optimizeTree(
  node: SlotNode,
  colorPool: ExpandedColor[],
  parentColor: string | null = null
): Map<string, string> {
  const assignments = new Map<string, string>();

  // Assign this node
  const nodeAssignment = optimizeSiblings([node], colorPool, parentColor);
  const nodeColor = nodeAssignment.get(node.id)!;
  assignments.set(node.id, nodeColor);

  // Optimize children as siblings (they share this node as parent)
  if (node.children.length > 0) {
    const childAssignments = optimizeSiblings(
      node.children,
      colorPool,
      nodeColor
    );

    for (const [id, hex] of childAssignments) {
      assignments.set(id, hex);
    }

    // Process grandchildren directly (don't re-assign the child)
    for (const child of node.children) {
      if (child.children.length > 0) {
        const childColor = assignments.get(child.id)!;
        // Optimize grandchildren with child's color as parent
        const grandchildAssignments = optimizeSiblings(
          child.children,
          colorPool,
          childColor
        );
        for (const [id, hex] of grandchildAssignments) {
          assignments.set(id, hex);
        }

        // Recursively process great-grandchildren
        for (const grandchild of child.children) {
          if (grandchild.children.length > 0) {
            const grandchildColor = assignments.get(grandchild.id)!;
            const greatGrandchildAssignments = optimizeSiblings(
              grandchild.children,
              colorPool,
              grandchildColor
            );
            for (const [id, hex] of greatGrandchildAssignments) {
              assignments.set(id, hex);
            }
          }
        }
      }
    }
  }

  return assignments;
}

/**
 * Result of optimization including assignments and the color pool used.
 */
interface OptimizationResult {
  assignments: Map<string, string>;
  colorPool: ExpandedColor[];
}

/**
 * Main optimization entry point.
 */
function optimizeMockup(
  tree: SlotNode,
  colors: PaletteColor[]
): OptimizationResult {
  if (colors.length === 0) {
    return { assignments: new Map(), colorPool: [] };
  }

  const colorPool = expandPalette(colors);
  const assignments = optimizeTree(tree, colorPool, null);
  return { assignments, colorPool };
}

// ============================================================================
// Helper: Get text color for a background
// ============================================================================

function getTextColor(
  bgHex: string,
  assignments: Map<string, string>,
  textSlotId: string,
  colorPool?: ExpandedColor[]
): string {
  const assigned = assignments.get(textSlotId);
  if (assigned) {
    return assigned;
  }

  // If we have a pool, find the best contrast color from text regions
  if (colorPool && colorPool.length > 0) {
    const textCandidates = colorPool.filter(
      (c) => c.scalePosition <= 2 || c.scalePosition >= 6
    );

    let bestColor = '#000000'; // Default to black
    let bestContrast = 0;

    for (const candidate of textCandidates) {
      const contrastVal = chroma.contrast(bgHex, candidate.hex);
      if (contrastVal > bestContrast) {
        bestContrast = contrastVal;
        bestColor = candidate.hex;
      }
    }

    return bestColor;
  }

  // Fallback only if no pool provided
  const whiteContrast = chroma.contrast(bgHex, '#ffffff');
  const blackContrast = chroma.contrast(bgHex, '#000000');
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
}

// ============================================================================
// UI Components Slide
// ============================================================================

const uiComponentsTree: SlotNode = {
  id: 'page-bg',
  type: 'background',
  importance: 0.1,
  children: [
    {
      id: 'surface',
      type: 'surface',
      importance: 0.3,
      minContrast: 1.5,
      children: [],
    },
    {
      id: 'btn-primary',
      type: 'accent',
      importance: 1.0,
      minContrast: 3,
      children: [
        { id: 'btn-primary-text', type: 'text', importance: 0.5, minContrast: 4.5, children: [] },
      ],
    },
    {
      id: 'btn-secondary',
      type: 'accent',
      importance: 0.7,
      minContrast: 3,
      children: [
        { id: 'btn-secondary-text', type: 'text', importance: 0.5, minContrast: 4.5, children: [] },
      ],
    },
    {
      id: 'btn-tertiary',
      type: 'accent',
      importance: 0.5,
      minContrast: 3,
      children: [
        { id: 'btn-tertiary-text', type: 'text', importance: 0.5, minContrast: 4.5, children: [] },
      ],
    },
    {
      id: 'badge-1',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'badge-2',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'badge-3',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'input-border',
      type: 'border',
      importance: 0.4,
      minContrast: 2,
      children: [],
    },
  ],
};

export function createUIComponentsSlide(): Slide {
  return {
    id: 'ui-components',
    name: 'UI Components',
    category: 'mockups',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see mockup</div>';
        return;
      }

      const { assignments, colorPool } = optimizeMockup(uiComponentsTree, colors);
      const bg = assignments.get('page-bg') || colors[0].hex;
      const surface = assignments.get('surface') || colors[0].hex;
      const btnPrimary = assignments.get('btn-primary') || colors[0].hex;
      const btnPrimaryText = getTextColor(btnPrimary, assignments, 'btn-primary-text', colorPool);
      const btnSecondary = assignments.get('btn-secondary') || colors[0].hex;
      const btnSecondaryText = getTextColor(btnSecondary, assignments, 'btn-secondary-text', colorPool);
      const btnTertiary = assignments.get('btn-tertiary') || colors[0].hex;
      const btnTertiaryText = getTextColor(btnTertiary, assignments, 'btn-tertiary-text', colorPool);
      const badge1 = assignments.get('badge-1') || colors[0].hex;
      const badge2 = assignments.get('badge-2') || colors[0].hex;
      const badge3 = assignments.get('badge-3') || colors[0].hex;
      const inputBorder = assignments.get('input-border') || colors[0].hex;
      const textColor = getTextColor(surface, assignments, '', colorPool);
      const mutedText = chroma(textColor).alpha(0.6).css();

      container.innerHTML = `
        <div class="mockup-components" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px;
          width: 100%;
          height: 100%;
          overflow: auto;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          background: ${bg};
          border-radius: 8px;
          color: ${textColor};
        ">
          <!-- Buttons -->
          <div style="background: ${surface}; border-radius: 6px; padding: 10px;">
            <div style="color: ${mutedText}; font-size: 9px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Buttons</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button style="background: ${btnPrimary}; color: ${btnPrimaryText}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 500;">Primary</button>
              <button style="background: ${btnSecondary}; color: ${btnSecondaryText}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 500;">Secondary</button>
              <button style="background: ${btnTertiary}; color: ${btnTertiaryText}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 500;">Tertiary</button>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <button style="background: transparent; color: ${btnPrimary}; border: 1px solid ${btnPrimary}; padding: 6px 12px; border-radius: 4px; font-size: 10px;">Outline</button>
              <button style="background: ${chroma(btnPrimary).alpha(0.15).css()}; color: ${btnPrimary}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px;">Ghost</button>
            </div>
          </div>

          <!-- Inputs -->
          <div style="background: ${surface}; border-radius: 6px; padding: 10px;">
            <div style="color: ${mutedText}; font-size: 9px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Inputs</div>
            <input type="text" placeholder="Text input..." style="width: 100%; padding: 8px 10px; background: ${bg}; border: 1px solid ${inputBorder}; border-radius: 4px; color: ${textColor}; font-size: 10px; box-sizing: border-box; margin-bottom: 6px;">
            <input type="text" value="Focused" style="width: 100%; padding: 8px 10px; background: ${bg}; border: 2px solid ${btnPrimary}; border-radius: 4px; color: ${textColor}; font-size: 10px; box-sizing: border-box; outline: none;">
          </div>

          <!-- Cards -->
          <div style="background: ${surface}; border-radius: 6px; padding: 10px;">
            <div style="color: ${mutedText}; font-size: 9px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Cards</div>
            <div style="background: ${bg}; border-radius: 6px; padding: 10px; border-left: 3px solid ${btnPrimary};">
              <div style="font-weight: 600; margin-bottom: 4px; color: ${textColor};">Card Title</div>
              <div style="font-size: 9px; color: ${mutedText};">Card description with content.</div>
            </div>
          </div>

          <!-- Badges -->
          <div style="background: ${surface}; border-radius: 6px; padding: 10px;">
            <div style="color: ${mutedText}; font-size: 9px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Badges</div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <span style="background: ${chroma(badge1).alpha(0.2).css()}; color: ${badge1}; padding: 3px 8px; border-radius: 10px; font-size: 9px; font-weight: 500;">Tag 1</span>
              <span style="background: ${chroma(badge2).alpha(0.2).css()}; color: ${badge2}; padding: 3px 8px; border-radius: 10px; font-size: 9px; font-weight: 500;">Tag 2</span>
              <span style="background: ${chroma(badge3).alpha(0.2).css()}; color: ${badge3}; padding: 3px 8px; border-radius: 10px; font-size: 9px; font-weight: 500;">Tag 3</span>
            </div>
            <div style="display: flex; gap: 4px; margin-top: 8px;">
              <span style="background: ${badge1}; color: ${getTextColor(badge1, assignments, '', colorPool)}; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">NEW</span>
              <span style="background: ${badge2}; color: ${getTextColor(badge2, assignments, '', colorPool)}; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">HOT</span>
              <span style="background: ${badge3}; color: ${getTextColor(badge3, assignments, '', colorPool)}; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">SALE</span>
            </div>
          </div>
        </div>
      `;
    },
  };
}

// ============================================================================
// Dashboard Slide
// ============================================================================

const dashboardTree: SlotNode = {
  id: 'page-bg',
  type: 'background',
  importance: 0.1,
  children: [
    {
      id: 'header',
      type: 'accent',
      importance: 0.9,
      minContrast: 3,
      children: [
        { id: 'header-text', type: 'text', importance: 0.5, minContrast: 4.5, children: [] },
      ],
    },
    {
      id: 'stat-1',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'stat-2',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'stat-3',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'surface',
      type: 'surface',
      importance: 0.3,
      minContrast: 1.5,
      children: [
        { id: 'bar-1', type: 'accent', importance: 0.7, minContrast: 3, children: [] },
        { id: 'bar-2', type: 'accent', importance: 0.7, minContrast: 3, children: [] },
        { id: 'bar-3', type: 'accent', importance: 0.7, minContrast: 3, children: [] },
        { id: 'bar-4', type: 'accent', importance: 0.7, minContrast: 3, children: [] },
        { id: 'bar-5', type: 'accent', importance: 0.7, minContrast: 3, children: [] },
      ],
    },
  ],
};

export function createDashboardSlide(): Slide {
  return {
    id: 'dashboard',
    name: 'Dashboard',
    category: 'mockups',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see mockup</div>';
        return;
      }

      const { assignments, colorPool } = optimizeMockup(dashboardTree, colors);
      const bg = assignments.get('page-bg') || colors[0].hex;
      const surface = assignments.get('surface') || colors[0].hex;
      const header = assignments.get('header') || colors[0].hex;
      const headerText = getTextColor(header, assignments, 'header-text', colorPool);
      const stat1 = assignments.get('stat-1') || colors[0].hex;
      const stat2 = assignments.get('stat-2') || colors[0].hex;
      const stat3 = assignments.get('stat-3') || colors[0].hex;
      const bars = [
        assignments.get('bar-1') || colors[0].hex,
        assignments.get('bar-2') || colors[0].hex,
        assignments.get('bar-3') || colors[0].hex,
        assignments.get('bar-4') || colors[0].hex,
        assignments.get('bar-5') || colors[0].hex,
      ];
      const textColor = getTextColor(bg, assignments, '', colorPool);
      const surfaceMuted = chroma(getTextColor(surface, assignments, '', colorPool)).alpha(0.6).css();

      const barHeights = [65, 45, 80, 55, 70];

      container.innerHTML = `
        <div class="mockup-dashboard" style="
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
          width: 100%;
          height: 100%;
          overflow: auto;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 10px;
          background: ${bg};
          border-radius: 8px;
          color: ${textColor};
        ">
          <!-- Header -->
          <div style="background: ${header}; color: ${headerText}; padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 12px;">
            Dashboard
          </div>

          <!-- Stats Row -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            ${[
              { color: stat1, label: 'Users', value: '1,234', change: '+12%' },
              { color: stat2, label: 'Revenue', value: '$12.5k', change: '+8%' },
              { color: stat3, label: 'Orders', value: '89', change: '+23%' },
            ]
              .map(
                (stat) => `
              <div style="background: ${surface}; border-radius: 6px; padding: 8px; border-top: 2px solid ${stat.color};">
                <div style="font-size: 9px; color: ${surfaceMuted};">${stat.label}</div>
                <div style="font-size: 14px; font-weight: 700; color: ${stat.color};">${stat.value}</div>
                <div style="font-size: 8px; color: ${chroma(stat.color).brighten(0.5).hex()};">${stat.change}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Chart -->
          <div style="flex: 1; background: ${surface}; border-radius: 6px; padding: 8px; display: flex; flex-direction: column;">
            <div style="font-size: 9px; color: ${surfaceMuted}; margin-bottom: 6px;">Weekly Overview</div>
            <div style="flex: 1; display: flex; align-items: flex-end; gap: 4px;">
              ${barHeights
                .map(
                  (h, i) => `
                <div style="flex: 1; height: ${h}%; background: ${bars[i]}; border-radius: 3px 3px 0 0;"></div>
              `
                )
                .join('')}
            </div>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              ${['M', 'T', 'W', 'T', 'F']
                .map(
                  (d) => `
                <div style="flex: 1; text-align: center; font-size: 8px; color: ${surfaceMuted};">${d}</div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    },
  };
}

// ============================================================================
// Mobile App Slide
// ============================================================================

const mobileAppTree: SlotNode = {
  id: 'page-bg',
  type: 'background',
  importance: 0.1,
  children: [
    {
      id: 'header',
      type: 'accent',
      importance: 1.0,
      minContrast: 3,
      children: [
        { id: 'header-text', type: 'text', importance: 0.5, minContrast: 4.5, children: [] },
      ],
    },
    {
      id: 'action-1',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'action-2',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'action-3',
      type: 'accent',
      importance: 0.8,
      minContrast: 3,
      children: [],
    },
    {
      id: 'surface',
      type: 'surface',
      importance: 0.3,
      minContrast: 1.5,
      children: [],
    },
    {
      id: 'list-1',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'list-2',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'list-3',
      type: 'accent',
      importance: 0.6,
      minContrast: 3,
      children: [],
    },
    {
      id: 'tab-active',
      type: 'accent',
      importance: 0.7,
      minContrast: 3,
      children: [],
    },
  ],
};

export function createMobileAppSlide(): Slide {
  return {
    id: 'mobile-app',
    name: 'Mobile App',
    category: 'mockups',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see mockup</div>';
        return;
      }

      const { assignments, colorPool } = optimizeMockup(mobileAppTree, colors);
      const bg = assignments.get('page-bg') || colors[0].hex;
      const surface = assignments.get('surface') || colors[0].hex;
      const header = assignments.get('header') || colors[0].hex;
      const headerText = getTextColor(header, assignments, 'header-text', colorPool);
      const action1 = assignments.get('action-1') || colors[0].hex;
      const action2 = assignments.get('action-2') || colors[0].hex;
      const action3 = assignments.get('action-3') || colors[0].hex;
      const list1 = assignments.get('list-1') || colors[0].hex;
      const list2 = assignments.get('list-2') || colors[0].hex;
      const list3 = assignments.get('list-3') || colors[0].hex;
      const tabActive = assignments.get('tab-active') || colors[0].hex;
      const textColor = getTextColor(bg, assignments, '', colorPool);
      const surfaceText = getTextColor(surface, assignments, '', colorPool);
      const surfaceMuted = chroma(surfaceText).alpha(0.5).css();

      container.innerHTML = `
        <div class="mockup-mobile" style="
          width: 100%;
          height: 100%;
          overflow: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 8px;
          box-sizing: border-box;
        ">
          <!-- Phone Frame - fixed size -->
          <div style="
            width: 200px;
            height: 380px;
            background: #111;
            border-radius: 24px;
            padding: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            flex-shrink: 0;
          ">
            <!-- Screen -->
            <div style="
              width: 100%;
              height: 100%;
              background: ${bg};
              border-radius: 16px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
              <!-- Status Bar -->
              <div style="height: 18px; background: ${surface}; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; font-size: 9px; color: ${surfaceText}; flex-shrink: 0;">
                <span>9:41</span>
                <span style="width: 16px; height: 8px; border: 1px solid ${surfaceText}; border-radius: 2px; display: flex; align-items: center;">
                  <span style="width: 70%; height: 100%; background: ${tabActive};"></span>
                </span>
              </div>

              <!-- Header -->
              <div style="padding: 10px 12px; background: ${header}; color: ${headerText}; flex-shrink: 0;">
                <div style="font-size: 13px; font-weight: 600;">My App</div>
                <div style="font-size: 9px; opacity: 0.8;">Welcome back!</div>
              </div>

              <!-- Content -->
              <div style="flex: 1; padding: 8px; overflow: auto; color: ${textColor};">
                <!-- Quick Actions -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px;">
                  ${[
                    { color: action1, label: 'Home' },
                    { color: action2, label: 'Search' },
                    { color: action3, label: 'Settings' },
                  ]
                    .map(
                      ({ color, label }) => `
                    <div style="background: ${color}; border-radius: 8px; padding: 8px 4px; text-align: center;">
                      <div style="width: 16px; height: 16px; background: ${getTextColor(color, assignments, '', colorPool)}; border-radius: 50%; margin: 0 auto 4px; opacity: 0.3;"></div>
                      <div style="font-size: 8px; color: ${getTextColor(color, assignments, '', colorPool)};">${label}</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <!-- List Items -->
                ${[
                  { color: list1, title: 'Notifications', desc: '3 new messages' },
                  { color: list2, title: 'Activity', desc: 'Recent updates' },
                  { color: list3, title: 'Favorites', desc: '12 items saved' },
                ]
                  .map(
                    ({ color, title, desc }) => `
                  <div style="background: ${surface}; border-radius: 6px; padding: 8px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    <div style="width: 26px; height: 26px; background: ${color}; border-radius: 5px; flex-shrink: 0;"></div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 10px; color: ${surfaceText}; font-weight: 500;">${title}</div>
                      <div style="font-size: 8px; color: ${surfaceMuted};">${desc}</div>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>

              <!-- Tab Bar -->
              <div style="height: 36px; background: ${surface}; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid ${chroma(surface).brighten(0.3).hex()}; flex-shrink: 0;">
                ${['Home', 'Search', 'Profile']
                  .map(
                    (tab, i) => `
                  <div style="text-align: center; color: ${i === 0 ? tabActive : surfaceMuted}; font-size: 8px;">
                    <div style="width: 14px; height: 14px; background: ${i === 0 ? tabActive : surfaceMuted}; border-radius: 3px; margin: 0 auto 2px; opacity: ${i === 0 ? 1 : 0.3};"></div>
                    ${tab}
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    },
  };
}

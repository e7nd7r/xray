/**
 * XRay Webtools - Main Entry Point
 *
 * Unified tools for browser annotation:
 * - Element selection
 * - Drawing (freehand, arrow, rectangle, ellipse)
 * - Text annotations
 * - Snapshots
 *
 * Architecture:
 * - XRay: Top-level orchestrator (owns StateStore, TabDock)
 * - ToolsController: Manages tools panel and its managers
 * - Panels: UI components in the TabDock
 *
 * Exports as IIFE global (window.XRayToolbar)
 */

import { XRay } from './xray';
import { ToolsController } from './tools/controller';
import { ColorPalettePanel, PaletteController } from './palette';
import type { ToolbarConfig, ToolbarResult, CaptureState } from './tools/types';

// Re-export types from modules
export type { XRayState } from './types';
export * from './tools/types';
export * from './palette/types';

// Re-export classes
export { XRay };
export { ToolsController } from './tools/controller';
export { ToolsPanel } from './tools/panel';
export { ColorPalettePanel, PaletteController } from './palette';

// Global XRay instance
let xray: XRay | null = null;
let toolsController: ToolsController | null = null;
let palettePanel: ColorPalettePanel | null = null;
let paletteController: PaletteController | null = null;
let paletteUnsubscribe: (() => void) | null = null;

/**
 * Inject palette colors as CSS custom properties on the document root.
 * - Colors with roles get `--{role}` (e.g., --primary, --accent)
 * - All colors get `--color-{n}` where n is 1-indexed position
 */
function injectPaletteCssVariables(): void {
  if (!xray) return;

  const state = xray.getStore().get('palette');
  if (!state?.colors) return;

  const root = document.documentElement;

  // Clear previous palette variables
  // Remove --color-N variables
  for (let i = 1; i <= 20; i++) {
    root.style.removeProperty(`--color-${i}`);
  }
  // Remove common role variables
  const commonRoles = [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'surface',
    'error',
    'warning',
    'success',
    'info',
  ];
  for (const role of commonRoles) {
    root.style.removeProperty(`--${role}`);
  }

  // Set new variables
  state.colors.forEach((color, index) => {
    // Always set --color-N (1-indexed)
    root.style.setProperty(`--color-${index + 1}`, color.hex);

    // If color has a role, also set --{role}
    if (color.role) {
      root.style.setProperty(`--${color.role}`, color.hex);
    }
  });
}

/**
 * Initialize the XRay system with tools panel.
 * The toolbar stays visible and state can be polled at any time.
 */
export function initToolbar(config?: ToolbarConfig): void {
  if (xray) {
    return; // Already initialized
  }

  xray = new XRay({ persistState: true });
  toolsController = new ToolsController(xray.getStore(), config);

  // Create palette panel and controller
  palettePanel = new ColorPalettePanel();
  paletteController = new PaletteController(xray.getStore());
  palettePanel.setController(paletteController);

  // Subscribe to palette changes and inject CSS variables
  paletteUnsubscribe = paletteController.subscribe(() => {
    injectPaletteCssVariables();
  });
  // Initial injection
  injectPaletteCssVariables();

  // Register panels
  xray.registerPanel('tools', toolsController.getPanel(), {
    icon: 'pencil',
    label: 'Tools',
  });

  xray.registerPanel('palette', palettePanel, {
    icon: 'palette',
    label: 'Palette',
  });

  xray.show();
  toolsController.activate();
}

/**
 * Show the toolbar and wait for user to click Done/Cancel.
 * For blocking mode when model needs user input.
 */
export async function showToolbar(config?: ToolbarConfig): Promise<ToolbarResult> {
  if (!xray || !toolsController) {
    initToolbar(config);
  }

  return toolsController!.waitForDone();
}

/**
 * Wait for user to click Done (blocking).
 * Use when model needs user input.
 */
export async function waitForDone(): Promise<ToolbarResult> {
  if (!xray || !toolsController) {
    initToolbar();
  }

  return toolsController!.waitForDone();
}

/**
 * Get current state without waiting (non-blocking).
 * Returns current selections, drawings, annotations, snapshots.
 */
export function getState(): CaptureState | null {
  if (!toolsController) {
    return null;
  }

  return toolsController.getCurrentState();
}

/**
 * Get the palette state.
 * Returns the current palette colors and settings.
 */
export function getPaletteState(): import('./palette/types').PaletteState | null {
  if (!xray) {
    return null;
  }
  return xray.getStore().get('palette') ?? null;
}

/**
 * Set the palette state.
 * Replaces the entire palette state.
 */
export function setPaletteState(state: import('./palette/types').PaletteState): void {
  if (!xray) {
    initToolbar();
  }
  xray!.getStore().set('palette', state);
}

/**
 * Check if XRay system is visible.
 */
export function isVisible(): boolean {
  return xray?.isShown() ?? false;
}

/**
 * Clear all XRay elements from the page.
 */
export function clearToolbar(): void {
  // Unsubscribe from palette changes
  if (paletteUnsubscribe) {
    paletteUnsubscribe();
    paletteUnsubscribe = null;
  }

  // Clear injected CSS variables
  const root = document.documentElement;
  for (let i = 1; i <= 20; i++) {
    root.style.removeProperty(`--color-${i}`);
  }
  const commonRoles = [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'surface',
    'error',
    'warning',
    'success',
    'info',
  ];
  for (const role of commonRoles) {
    root.style.removeProperty(`--${role}`);
  }

  if (xray) {
    xray.destroy();
    xray = null;
  }

  if (toolsController) {
    toolsController.destroy();
    toolsController = null;
  }

  palettePanel = null;
  paletteController = null;

  // Fallback cleanup for orphaned elements
  document.getElementById('xray-tab-dock')?.remove();
  document.getElementById('xray-panel-tools')?.remove();
  document.getElementById('panel-palette')?.remove();
  document.getElementById('xray-svg-document')?.remove();
  document.getElementById('xray-svg-fixed')?.remove();
  document.getElementById('xray-styles')?.remove();
  document.getElementById('xray-script')?.remove();

  // Clean up any text inputs
  document.querySelectorAll('.xray-text-input').forEach((el) => el.remove());

  document
    .querySelectorAll('.xray-selected, .xray-hover-highlight')
    .forEach((el) => {
      el.classList.remove('xray-selected', 'xray-hover-highlight');
    });
}

// Default export for IIFE bundle
export default {
  XRay,
  ToolsController,
  ColorPalettePanel,
  PaletteController,
  initToolbar,
  showToolbar,
  waitForDone,
  getState,
  getPaletteState,
  setPaletteState,
  isVisible,
  clearToolbar,
};

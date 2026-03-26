/**
 * XRay Controller - Top-level orchestrator for multi-panel architecture
 *
 * Manages:
 * - StateStore for centralized state management
 * - TabDock for panel registration and tab management
 * - Panel lifecycle (show/hide/destroy)
 *
 * Usage:
 * ```typescript
 * const xray = new XRay({ persistState: true });
 * xray.registerPanel('toolbar', new ToolbarPanel());
 * xray.show();
 * ```
 */

import { StateStore } from './state/store';
import { TabDock, type TabDockConfig } from './ui/tab-dock';
import type { Panel } from './ui/panel';

/** Configuration options for XRay controller */
export interface XRayConfig {
  /** TabDock configuration (side, position) */
  tabDock?: TabDockConfig;
  /** If true, state is persisted to sessionStorage */
  persistState?: boolean;
}

/** Default XRay configuration */
const DEFAULT_CONFIG: Required<XRayConfig> = {
  tabDock: { side: 'right', position: 100 },
  persistState: false,
};

/**
 * XRay - Top-level controller for the multi-panel system
 *
 * Coordinates panels, state, and the tab dock.
 */
export class XRay {
  private store: StateStore;
  private tabDock: TabDock;
  private panels: Map<string, Panel> = new Map();
  private isVisible: boolean = false;
  private config: Required<XRayConfig>;
  private boundBeforeUnload: (() => void) | null = null;

  constructor(config: XRayConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      tabDock: { ...DEFAULT_CONFIG.tabDock, ...config.tabDock },
    };

    this.store = new StateStore();
    this.tabDock = new TabDock(this.config.tabDock);

    if (this.config.persistState) {
      this.store.restore();
    }
  }

  /**
   * Register a panel with the XRay system.
   *
   * The panel will be:
   * 1. Given access to the shared StateStore
   * 2. Added to the TabDock with a tab
   *
   * @param id - Unique identifier for the panel
   * @param panel - The panel instance
   * @param options - Optional tab configuration (icon, label override)
   */
  registerPanel(
    id: string,
    panel: Panel,
    options?: { icon?: string; label?: string }
  ): void {
    this.panels.set(id, panel);

    // Register with tab dock
    this.tabDock.addTab({
      id,
      label: options?.label ?? this.getPanelLabel(panel, id),
      icon: options?.icon ?? this.getPanelIcon(panel),
      panel,
    });
  }

  /**
   * Get a registered panel by ID.
   */
  getPanel<T extends Panel>(id: string): T | undefined {
    return this.panels.get(id) as T | undefined;
  }

  /**
   * Check if a panel is registered.
   */
  hasPanel(id: string): boolean {
    return this.panels.has(id);
  }

  /**
   * Unregister a panel.
   */
  unregisterPanel(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.destroy();
      this.panels.delete(id);
      this.tabDock.removeTab(id);
    }
  }

  /**
   * Show the XRay system (tab dock and all panels).
   */
  show(): void {
    if (this.isVisible) return;

    // Render tab dock first
    this.tabDock.render();

    // Render all panels
    this.panels.forEach((panel) => {
      panel.render();
    });

    // Update tab states to match panel visibility
    this.tabDock.updateAllTabStates();

    // Save state before page unload (navigation away)
    if (this.config.persistState) {
      this.boundBeforeUnload = () => this.store.save();
      window.addEventListener('beforeunload', this.boundBeforeUnload);
    }

    this.isVisible = true;
  }

  /**
   * Hide the XRay system (destroys all panels and tab dock).
   */
  hide(): void {
    if (!this.isVisible) return;

    // Remove beforeunload listener
    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }

    // Destroy all panels
    this.panels.forEach((panel) => {
      panel.destroy();
    });

    // Destroy tab dock
    this.tabDock.destroy();

    this.isVisible = false;
  }

  /**
   * Destroy the XRay system and clean up resources.
   * Saves state if persistence is enabled.
   */
  destroy(): void {
    this.hide();

    if (this.config.persistState) {
      this.store.save();
    }

    // Clear listeners to prevent memory leaks
    this.store.clearListeners();
    this.panels.clear();
  }

  /**
   * Check if the XRay system is currently visible.
   */
  isShown(): boolean {
    return this.isVisible;
  }

  /**
   * Get the shared StateStore.
   * Useful for MCP tools that need to access state.
   */
  getStore(): StateStore {
    return this.store;
  }

  /**
   * Get the TabDock.
   */
  getTabDock(): TabDock {
    return this.tabDock;
  }

  /**
   * Get all registered panel IDs.
   */
  getPanelIds(): string[] {
    return Array.from(this.panels.keys());
  }

  /**
   * Get panel label - checks for getTitle method or uses ID.
   */
  private getPanelLabel(panel: Panel, fallbackId: string): string {
    if ('getTitle' in panel && typeof panel.getTitle === 'function') {
      return (panel as Panel & { getTitle: () => string }).getTitle();
    }
    // Capitalize first letter of ID as fallback
    return fallbackId.charAt(0).toUpperCase() + fallbackId.slice(1);
  }

  /**
   * Get panel icon - checks for getIcon method.
   */
  private getPanelIcon(panel: Panel): string | undefined {
    if ('getIcon' in panel && typeof panel.getIcon === 'function') {
      return (panel as Panel & { getIcon: () => string }).getIcon();
    }
    return undefined;
  }
}

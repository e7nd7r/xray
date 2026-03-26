/**
 * StateStore - Central state management for XRay
 *
 * Provides a simple pub/sub state container with typed slices,
 * subscription support, and session storage persistence.
 */

import type { XRayState } from '../types';
import type { ToolbarState } from '../tools/types';
import type { PaletteState } from '../palette/types';

/** Type-safe state keys */
export type StateKey = keyof XRayState;

/** Listener callback for state changes */
export type StateListener<T> = (newValue: T, oldValue: T) => void;

/** Unsubscribe function returned by subscribe */
export type Unsubscribe = () => void;

/** Create default toolbar state */
function createDefaultToolbarState(): ToolbarState {
  return {
    currentTool: 'select',
    currentColor: '#94a3b8',
    currentStrokeWidth: 2,
    selectedElements: [],
    drawings: [],
    annotations: [],
    snapshots: [],
  };
}

/** Create default palette state */
function createDefaultPaletteState(): PaletteState {
  return {
    colors: [],
    generationMode: 'algorithm',
    selectedAlgorithm: 'complementary',
    visualizerEnabled: false,
    visualizerSlide: 'palette-grid',
  };
}

/**
 * StateStore - Centralized state management for XRay
 *
 * Usage:
 * ```typescript
 * const store = new StateStore();
 *
 * // Get state
 * const toolbar = store.get('toolbar');
 *
 * // Update state
 * store.update('toolbar', state => ({ ...state, currentTool: 'freehand' }));
 *
 * // Subscribe to changes
 * const unsub = store.subscribe('toolbar', (newState, oldState) => {
 *   console.log('Toolbar changed:', newState);
 * });
 *
 * // Later: unsubscribe
 * unsub();
 * ```
 */
export class StateStore {
  private state: XRayState;
  private listeners: Map<StateKey, Set<StateListener<unknown>>> = new Map();

  constructor(initialState?: Partial<XRayState>) {
    this.state = {
      toolbar: initialState?.toolbar ?? createDefaultToolbarState(),
      palette: initialState?.palette ?? createDefaultPaletteState(),
    };
  }

  /**
   * Get a state slice by key
   */
  get<K extends StateKey>(key: K): XRayState[K] {
    return this.state[key];
  }

  /**
   * Set a state slice (triggers listeners)
   */
  set<K extends StateKey>(key: K, value: XRayState[K]): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  /**
   * Update a state slice using a callback (triggers listeners)
   */
  update<K extends StateKey>(
    key: K,
    updater: (current: XRayState[K]) => XRayState[K]
  ): void {
    const oldValue = this.state[key];
    const newValue = updater(oldValue);
    this.state[key] = newValue;
    this.notify(key, newValue, oldValue);
  }

  /**
   * Subscribe to state changes for a specific key
   * Returns an unsubscribe function
   */
  subscribe<K extends StateKey>(
    key: K,
    listener: StateListener<XRayState[K]>
  ): Unsubscribe {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as StateListener<unknown>);

    return () => {
      this.listeners.get(key)?.delete(listener as StateListener<unknown>);
    };
  }

  /**
   * Get the full state (for debugging/serialization)
   * Returns a deep copy to prevent external mutation
   */
  getState(): XRayState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Save state to session storage (per-URL)
   */
  save(): void {
    const key = this.getStorageKey();
    try {
      sessionStorage.setItem(key, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[XRay] Failed to save state:', e);
    }
  }

  /**
   * Restore state from session storage (per-URL)
   */
  restore(): void {
    const key = this.getStorageKey();
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<XRayState>;
        // Merge with current state to preserve any new fields
        if (parsed.toolbar) {
          this.state.toolbar = { ...this.state.toolbar, ...parsed.toolbar };
        }
        if (parsed.palette) {
          this.state.palette = { ...this.state.palette, ...parsed.palette };
        }
      } catch (e) {
        console.warn('[XRay] Failed to restore state:', e);
      }
    }
  }

  /**
   * Clear all listeners (useful for cleanup)
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Notify listeners of a state change
   */
  private notify<K extends StateKey>(
    key: K,
    newValue: XRayState[K],
    oldValue: XRayState[K]
  ): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(newValue, oldValue);
        } catch (e) {
          console.error(`[XRay] Error in state listener for '${key}':`, e);
        }
      });
    }
  }

  /**
   * Get storage key for current page
   */
  private getStorageKey(): string {
    return `xray-state-${window.location.pathname}`;
  }
}

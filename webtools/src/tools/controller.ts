/**
 * ToolsController - Controller for drawing and annotation tools
 *
 * Manages:
 * - SvgManager (drawings, annotations)
 * - SelectionManager (element selection)
 * - SnapshotManager (page captures)
 * - ToolsPanel (UI)
 *
 * Uses StateStore for centralized state management.
 * Does NOT own TabDock - XRay owns that.
 */

import type { StateStore } from '../state';
import type { Panel } from '../ui/panel';
import {
  type ToolbarConfig,
  type ToolbarResult,
  type ToolbarState,
  type CaptureState,
  type ElementSelection,
  type DrawingStroke,
  type TextAnnotation,
  type Tool,
  DEFAULT_CONFIG,
} from './types';
import { ToolsPanel } from './panel';
import { SvgManager } from './svg-manager';
import { SelectionManager } from './selection-manager';
import { SnapshotManager } from './snapshot-manager';

export class ToolsController {
  private store: StateStore;
  private config: Required<ToolbarConfig>;
  private panel: ToolsPanel;
  private svgManager: SvgManager;
  private selectionManager: SelectionManager;
  private snapshotManager: SnapshotManager;
  private resolvePromise: ((result: ToolbarResult) => void) | null = null;
  private isActive: boolean = false;
  private isWaiting: boolean = false;

  constructor(store: StateStore, config: ToolbarConfig = {}) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize with config defaults if state has defaults
    const currentState = this.store.get('toolbar');
    if (currentState.currentColor === '#94a3b8') {
      this.store.update('toolbar', (s) => ({
        ...s,
        currentColor: this.config.colors[0],
        currentStrokeWidth: this.config.strokeWidths[1],
      }));
    }

    // Initialize managers
    this.svgManager = new SvgManager(this);
    this.selectionManager = new SelectionManager(this);
    this.snapshotManager = new SnapshotManager(this);

    // Initialize panel
    this.panel = new ToolsPanel(this, { toolbarConfig: this.config });
  }

  /**
   * Get the panel for registration with XRay.
   */
  getPanel(): Panel {
    return this.panel;
  }

  /**
   * Activate the tools (called when panel becomes visible).
   */
  activate(): void {
    if (this.isActive) return;

    this.svgManager.create();
    this.isActive = true;

    // Restore visual state from store
    this.selectionManager.render();
    this.svgManager.redraw();
    this.panel.updateSnapshotList();

    // Start with select tool active
    this.setTool('select');
  }

  /**
   * Deactivate the tools (called when panel is hidden).
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.deactivateCurrentTool();
    this.svgManager.destroy();
    this.selectionManager.cleanup();
    this.isActive = false;
  }

  /**
   * Wait for user to click Done (blocking).
   */
  async waitForDone(): Promise<ToolbarResult> {
    this.isWaiting = true;
    this.panel.setWaitingState(true);

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  /**
   * Check if model is waiting for user input.
   */
  isModelWaiting(): boolean {
    return this.isWaiting;
  }

  /**
   * Get current state without waiting (non-blocking).
   */
  getCurrentState(): CaptureState {
    const state = this.store.get('toolbar');
    const sortedSnapshots = [...state.snapshots].sort((a, b) => a.timestamp - b.timestamp);

    return {
      selectedElements: [...state.selectedElements],
      drawings: [...state.drawings],
      annotations: [...state.annotations],
      snapshots: sortedSnapshots,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Check if tools are currently active.
   */
  isToolsActive(): boolean {
    return this.isActive;
  }

  /**
   * Set the current tool.
   */
  setTool(tool: Tool): void {
    // Clear any selection when switching tools
    this.svgManager.clearCurrentSelection();

    // Deactivate previous tool
    this.deactivateCurrentTool();

    this.store.update('toolbar', (s) => ({ ...s, currentTool: tool }));
    this.panel.updateToolIndicator(tool);

    // Activate new tool
    this.activateCurrentTool();
  }

  private deactivateCurrentTool(): void {
    const state = this.store.get('toolbar');
    switch (state.currentTool) {
      case 'select':
        this.svgManager.deactivate();
        break;
      case 'element-select':
        this.selectionManager.deactivate();
        break;
      case 'freehand':
      case 'arrow':
      case 'rectangle':
      case 'ellipse':
      case 'text':
        this.svgManager.deactivate();
        break;
    }
  }

  private activateCurrentTool(): void {
    const state = this.store.get('toolbar');
    switch (state.currentTool) {
      case 'select':
        // Only enable SVG selection for drawings and annotations
        // to allow normal page navigation
        this.svgManager.activateSelection();
        break;
      case 'element-select':
        // Enable element selection (SelectionManager)
        // This prevents normal page navigation - clicks select elements
        this.selectionManager.activate();
        break;
      case 'freehand':
      case 'arrow':
      case 'rectangle':
      case 'ellipse':
        this.svgManager.activate(state.currentTool);
        break;
      case 'text':
        this.svgManager.activateTextMode();
        break;
      case 'snapshot':
        // Snapshot is instant action, not a mode
        this.takeSnapshot();
        // Switch back to previous tool or select
        this.setTool('select');
        break;
    }
  }

  /**
   * Take a snapshot of the current state.
   */
  async takeSnapshot(): Promise<void> {
    const state = this.store.get('toolbar');
    const snapshot = await this.snapshotManager.capture(
      state.selectedElements,
      state.drawings,
      state.annotations
    );
    this.store.update('toolbar', (s) => ({
      ...s,
      snapshots: [...s.snapshots, snapshot],
    }));
    this.panel.updateSnapshotList();
  }

  /**
   * Delete a snapshot.
   */
  deleteSnapshot(id: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      snapshots: s.snapshots.filter((snap) => snap.id !== id),
    }));
    this.panel.updateSnapshotList();
  }

  /**
   * Clear all snapshots.
   */
  clearAllSnapshots(): void {
    this.store.update('toolbar', (s) => ({ ...s, snapshots: [] }));
    this.panel.updateSnapshotList();
  }

  /**
   * Clear all drawings from canvas.
   */
  clearDrawings(): void {
    this.store.update('toolbar', (s) => ({ ...s, drawings: [] }));
    this.svgManager.clear();
  }

  /**
   * Clear everything - drawings, annotations, and selections.
   */
  clearAll(): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      drawings: [],
      annotations: [],
      selectedElements: [],
    }));
    this.svgManager.clear();
    this.selectionManager.clearAll();
  }

  /**
   * Clear all selections.
   */
  clearSelections(): void {
    this.selectionManager.clearAll();
    this.store.update('toolbar', (s) => ({ ...s, selectedElements: [] }));
  }

  /**
   * Clear all annotations.
   */
  clearAnnotations(): void {
    this.store.update('toolbar', (s) => ({ ...s, annotations: [] }));
    this.svgManager.redraw();
  }

  /**
   * Submit and return all captured data.
   */
  submit(): void {
    const captureState = this.getCurrentState();

    this.isWaiting = false;
    this.panel.setWaitingState(false);

    this.resolvePromise?.({ success: true, data: captureState });
    this.resolvePromise = null;
  }

  /**
   * Cancel and resolve with cancelled state.
   */
  cancel(): void {
    this.isWaiting = false;
    this.panel.setWaitingState(false);

    this.resolvePromise?.({ success: false, cancelled: true });
    this.resolvePromise = null;
  }

  /**
   * Destroy the controller and clean up.
   */
  destroy(): void {
    this.deactivate();
    this.panel.destroy();
    this.resolvePromise?.({ success: false, cancelled: true });
    this.resolvePromise = null;
  }

  // State accessors
  getConfig(): Required<ToolbarConfig> {
    return this.config;
  }

  getToolbarState(): ToolbarState {
    return this.store.get('toolbar');
  }

  // Selection management
  addSelection(selection: ElementSelection): void {
    const state = this.store.get('toolbar');
    const exists = state.selectedElements.some((s) => s.id === selection.id);
    if (!exists) {
      this.store.update('toolbar', (s) => ({
        ...s,
        selectedElements: [...s.selectedElements, selection],
      }));
    }
  }

  removeSelection(id: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      selectedElements: s.selectedElements.filter((sel) => sel.id !== id),
    }));
  }

  // Drawing management
  addDrawing(drawing: DrawingStroke): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      drawings: [...s.drawings, drawing],
    }));
  }

  removeDrawing(id: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      drawings: s.drawings.filter((d) => d.id !== id),
    }));
  }

  // Annotation management
  addAnnotation(annotation: TextAnnotation): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: [...s.annotations, annotation],
    }));
  }

  updateAnnotation(id: string, text: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, text } : a)),
    }));
  }

  updateAnnotationPosition(id: string, position: { x: number; y: number }): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, position } : a)),
    }));
  }

  updateAnnotationFixed(id: string, isFixed: boolean): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, isFixed } : a)),
    }));
  }

  updateDrawingFixed(id: string, isFixed: boolean): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      drawings: s.drawings.map((d) => (d.id === id ? { ...d, isFixed } : d)),
    }));
  }

  updateDrawingColor(id: string, color: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      drawings: s.drawings.map((d) => (d.id === id ? { ...d, color } : d)),
    }));
  }

  updateAnnotationColor(id: string, color: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, color } : a)),
    }));
  }

  removeAnnotation(id: string): void {
    this.store.update('toolbar', (s) => ({
      ...s,
      annotations: s.annotations.filter((a) => a.id !== id),
    }));
  }

  // Tool state
  setColor(color: string): void {
    this.store.update('toolbar', (s) => ({ ...s, currentColor: color }));
    this.panel.updateColorIndicator(color);

    // Also update the selected element's color if one is selected
    this.svgManager.updateSelectedColor(color);
  }

  setStrokeWidth(width: number): void {
    this.store.update('toolbar', (s) => ({ ...s, currentStrokeWidth: width }));
    this.panel.updateStrokeWidthIndicator(width);
  }

  getSvgManager(): SvgManager {
    return this.svgManager;
  }
}

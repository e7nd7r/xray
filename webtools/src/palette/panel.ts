/**
 * Color Palette Panel
 *
 * A panel for creating, managing, and generating color palettes.
 * Colors can be manually picked, algorithmically generated, or AI-assisted.
 *
 * Part of DES-004: Color Palette Panel
 */

import { Panel, type PanelConfig } from '../ui/panel';
import { icon, renderIcons } from '../ui/icons';
import type { PaletteController } from './controller';
import type { PaletteColor, PaletteState, Algorithm } from './types';
import { getContrastClass, ROLE_PRESETS } from './color-utils';
import { Visualizer, getSlideRegistry } from '../visualizer';
import { ColorPicker } from './color-picker';

/** Algorithm display names */
const ALGORITHM_NAMES: Record<Algorithm, string> = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  'split-complementary': 'Split-Complementary',
  tetradic: 'Tetradic',
  monochromatic: 'Monochromatic',
};

export type ColorPalettePanelConfig = Partial<PanelConfig>;

/**
 * ColorPalettePanel - Panel for color palette management
 *
 * This panel handles UI rendering and event binding.
 * Business logic is delegated to PaletteController.
 */
export class ColorPalettePanel extends Panel {
  private controller: PaletteController | null = null;
  private unsubscribe: (() => void) | null = null;
  private visualizer: Visualizer | null = null;
  private colorPicker: ColorPicker | null = null;
  private colorPickerWasVisible = false;
  private lastColorPickerColorId: string | null = null;

  constructor(config: ColorPalettePanelConfig = {}) {
    super({
      id: 'palette',
      title: 'Color Palette',
      initialPosition: { x: 20, y: 340 }, // Below tools panel
      width: 400,
      ...config,
    });
  }

  /**
   * Set the controller for this panel.
   * The controller provides state and handles actions.
   */
  setController(controller: PaletteController): void {
    this.controller = controller;
    this.subscribeToState();
  }

  /**
   * Get icon for TabDock.
   */
  override getIcon(): string {
    return 'palette';
  }

  /**
   * Subscribe to state changes via controller.
   */
  private subscribeToState(): void {
    if (!this.controller) return;

    // Unsubscribe from previous if any
    this.unsubscribe?.();

    this.unsubscribe = this.controller.subscribe(() => this.refresh());
  }

  /**
   * Called after render - re-subscribe to state.
   */
  protected override onRender(): void {
    this.subscribeToState();
  }

  /**
   * Called before destroy - cleanup subscription.
   */
  protected override onDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.visualizer?.destroy();
    this.visualizer = null;
    this.colorPicker?.destroy();
    this.colorPicker = null;
  }

  /**
   * Override collapse to also hide the color picker.
   */
  override collapse(): void {
    // Track if color picker was visible before collapsing
    this.colorPickerWasVisible = this.colorPicker?.isVisible() ?? false;
    if (this.colorPickerWasVisible) {
      this.lastColorPickerColorId = this.colorPicker?.getSelectedColorId() ?? null;
    }
    super.collapse();
    this.colorPicker?.hide();
  }

  /**
   * Override expand to restore the color picker if it was visible.
   */
  override expand(): void {
    super.expand();
    // Restore color picker if it was visible before collapse
    if (this.colorPickerWasVisible && this.lastColorPickerColorId) {
      const strip = this.element?.querySelector(
        `.palette-color-strip[data-color-id="${this.lastColorPickerColorId}"]`
      ) as HTMLElement;
      if (strip) {
        this.showColorPicker(this.lastColorPickerColorId, strip);
      }
      this.colorPickerWasVisible = false;
    }
  }

  /**
   * Initialize the visualizer if enabled.
   */
  private initVisualizerIfNeeded(): void {
    const state = this.getPaletteState();
    if (!state.visualizerEnabled) {
      this.visualizer?.destroy();
      this.visualizer = null;
      return;
    }

    const container = this.element?.querySelector('.palette-visualizer-container') as HTMLElement;
    if (!container) return;

    // Create new visualizer
    this.visualizer = new Visualizer(container, state.colors, {
      showControls: true,
      showIndicators: true,
    });
    this.visualizer.registerSlides(getSlideRegistry());
    this.visualizer.init();
  }

  /**
   * Refresh the panel content.
   */
  private refresh(): void {
    if (!this.element) return;

    const body = this.element.querySelector('.panel-body');
    if (body) {
      body.innerHTML = this.getContentHTML();
      renderIcons(body as HTMLElement);
      this.attachContentEvents();
    }
  }

  /**
   * Get the palette state from controller.
   */
  private getPaletteState(): PaletteState {
    return (
      this.controller?.getState() ?? {
        colors: [],
        generationMode: 'algorithm',
        selectedAlgorithm: 'complementary',
        visualizerEnabled: false,
        visualizerSlide: 'palette-grid',
      }
    );
  }

  /**
   * Generate the panel body HTML.
   */
  protected override getContentHTML(): string {
    const state = this.getPaletteState();

    return `
      <div class="palette-section">
        <div class="palette-section-header">
          <span class="palette-section-label">COLORS</span>
          <div class="palette-view-toggle" data-action="toggle-visualizer">
            <span class="palette-view-option ${!state.visualizerEnabled ? 'active' : ''}" title="Color strips">
              ${icon('palette', 14)}
            </span>
            <span class="palette-view-option ${state.visualizerEnabled ? 'active' : ''}" title="Visualizer">
              ${icon('presentation', 14)}
            </span>
          </div>
        </div>
        ${state.visualizerEnabled ? this.renderVisualizerContainer() : this.renderColorStripsContainer(state.colors)}
      </div>

      <div class="palette-section">
        <div class="palette-section-label">GENERATION MODE</div>
        <div class="palette-mode-toggle" data-action="toggle-mode">
          <span class="palette-toggle-label ${state.generationMode === 'algorithm' ? 'active' : ''}">Algorithm</span>
          <span class="palette-toggle-label ${state.generationMode === 'ai' ? 'active' : ''}">AI</span>
          <span class="palette-toggle-slider ${state.generationMode === 'ai' ? 'right' : ''}"></span>
        </div>

        <div class="palette-mode-options ${state.generationMode === 'algorithm' ? 'active' : ''}" data-options="algorithm">
          <select class="palette-algorithm-select">
            ${Object.entries(ALGORITHM_NAMES)
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${state.selectedAlgorithm === value ? 'selected' : ''}>${label}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="palette-mode-options ${state.generationMode === 'ai' ? 'active' : ''}" data-options="ai">
          <div class="palette-ai-note">
            <strong>AI Generation</strong>
            Ask Claude to generate colors. Example: "Generate a warm palette based on my locked color"
          </div>
        </div>

        ${this.renderGenerateButton(state)}
      </div>
    `;
  }

  /**
   * Render the generate button with appropriate state.
   * Enable when:
   * - Only one unlocked color (randomize it)
   * - Has locked colors AND unlocked colors (regenerate based on locked)
   */
  private renderGenerateButton(state: PaletteState): string {
    const lockedCount = state.colors.filter((c) => c.locked).length;
    const unlockedCount = state.colors.filter((c) => !c.locked).length;
    const isAiMode = state.generationMode === 'ai';

    if (isAiMode) {
      return `<button class="palette-generate-btn" disabled>Ask Claude to generate</button>`;
    }

    // Case 1: Only one unlocked color - can randomize
    if (lockedCount === 0 && unlockedCount === 1) {
      return `<button class="palette-generate-btn">✦ Randomize Color</button>`;
    }

    // Case 2: No colors at all
    if (state.colors.length === 0) {
      return `
        <button class="palette-generate-btn" disabled>
          ✦ Generate Unlocked Colors
        </button>
        <small class="palette-hint">Add a color to get started</small>
      `;
    }

    // Case 3: Multiple unlocked but no locked - need to lock one
    if (lockedCount === 0) {
      return `
        <button class="palette-generate-btn" disabled>
          ✦ Generate Unlocked Colors
        </button>
        <small class="palette-hint">Lock a color first to generate from it</small>
      `;
    }

    // Case 4: Has locked but no unlocked - nothing to regenerate
    if (unlockedCount === 0) {
      return `
        <button class="palette-generate-btn" disabled>
          ✦ Generate Unlocked Colors
        </button>
        <small class="palette-hint">Add or unlock colors to regenerate</small>
      `;
    }

    // Case 5: Has both locked and unlocked - can generate
    return `<button class="palette-generate-btn">✦ Generate Unlocked Colors</button>`;
  }

  /**
   * Render the color strips container.
   */
  private renderColorStripsContainer(colors: PaletteColor[]): string {
    return `
      <div class="palette-strips">
        ${this.renderColorStrips(colors)}
        <div class="palette-add-strip" data-action="add-color">
          <span>+</span>
          <small>Add</small>
        </div>
      </div>
    `;
  }

  /**
   * Render the visualizer container (placeholder for mounting).
   */
  private renderVisualizerContainer(): string {
    return `<div class="palette-visualizer-container"></div>`;
  }

  /**
   * Render insert zone HTML (hover to reveal add button).
   */
  private renderInsertZone(index: number): string {
    return `
      <div class="palette-insert-zone" data-insert-index="${index}">
        <span class="palette-insert-btn">+</span>
      </div>
    `;
  }

  /**
   * Render the role dropdown HTML.
   */
  private renderRoleDropdown(colorId: string, currentRole?: string): string {
    const options = ROLE_PRESETS.map(
      (role) =>
        `<div class="palette-role-option" data-role="${role}">${role}</div>`
    ).join('');

    return `
      <div class="palette-role-dropdown" data-color-id="${colorId}">
        <div class="palette-role-option" data-role="">None</div>
        ${options}
        <div class="palette-role-custom">
          <input type="text"
                 class="palette-role-input"
                 placeholder="Custom role..."
                 value="${currentRole && !ROLE_PRESETS.includes(currentRole as typeof ROLE_PRESETS[number]) ? currentRole : ''}" />
        </div>
      </div>
    `;
  }

  /**
   * Render color strips HTML.
   * Uses lucide icons via icon() helper - call renderIcons() after inserting HTML.
   */
  private renderColorStrips(colors: PaletteColor[]): string {
    if (colors.length === 0) {
      return ''; // Just show add button
    }

    return colors
      .map((color, index) => {
        const contrastClass = getContrastClass(color.hex);
        const isFirst = index === 0;
        const isLast = index === colors.length - 1;

        // Insert zone before each strip (except first - add button at end handles that)
        const insertZone = index > 0 ? this.renderInsertZone(index) : '';

        return `${insertZone}
          <div class="palette-color-strip ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}"
               style="background-color: ${color.hex};"
               data-color-id="${color.id}"
               data-index="${index}"
               draggable="true">
            <div class="palette-strip-controls ${contrastClass}">
              <span class="palette-icon-btn" data-action="remove" title="Remove">${icon('x', 18)}</span>
              <span class="palette-icon-btn" data-action="shades" title="View Shades">${icon('pipette', 18)}</span>
              <span class="palette-icon-btn drag" data-action="drag" title="Drag to reorder">${icon('grip-vertical', 18)}</span>
              <span class="palette-icon-btn" data-action="copy" title="Copy hex">${icon('copy', 18)}</span>
              <span class="palette-icon-btn" data-action="lock" title="Toggle lock">
                ${color.locked ? icon('lock', 18) : icon('lock-open', 18)}
              </span>
              <div class="palette-color-info">
                <span class="palette-hex-code">${color.hex}</span>
                ${color.name ? `<span class="palette-color-name">${color.name}</span>` : ''}
                <span class="palette-color-role" data-action="edit-role" title="Click to edit role">
                  ${color.role || 'Set role...'}
                </span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Attach event listeners for panel interactions.
   * Delegates actions to the controller.
   */
  protected override attachContentEvents(): void {
    if (!this.element || !this.controller) return;

    // Visualizer toggle
    const vizToggle = this.element.querySelector('[data-action="toggle-visualizer"]');
    if (vizToggle) {
      vizToggle.addEventListener('click', () => {
        this.controller?.toggleVisualizer();
      });
    }

    // Initialize visualizer if enabled
    this.initVisualizerIfNeeded();

    // Mode toggle click
    const modeToggle = this.element.querySelector('[data-action="toggle-mode"]');
    if (modeToggle) {
      modeToggle.addEventListener('click', () => {
        const state = this.getPaletteState();
        const newMode = state.generationMode === 'algorithm' ? 'ai' : 'algorithm';
        this.controller?.setGenerationMode(newMode);
      });
    }

    // Algorithm select change
    const algorithmSelect = this.element.querySelector(
      '.palette-algorithm-select'
    ) as HTMLSelectElement;
    if (algorithmSelect) {
      algorithmSelect.addEventListener('change', () => {
        this.controller?.setAlgorithm(algorithmSelect.value as Algorithm);
      });
    }

    // Generate button click
    const generateBtn = this.element.querySelector('.palette-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        this.controller?.generateColors();
      });
    }

    // Add color button (at end)
    const addBtn = this.element.querySelector('[data-action="add-color"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.controller?.addColor();
      });
    }

    // Insert zone buttons (between strips)
    this.element.querySelectorAll('.palette-insert-zone').forEach((zone) => {
      zone.addEventListener('click', (e) => {
        const index = parseInt(
          (e.currentTarget as HTMLElement).dataset.insertIndex || '0',
          10
        );
        this.controller?.addColor(index);
      });
    });

    // Color strip actions (buttons)
    this.element.querySelectorAll('.palette-icon-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        const strip = (e.currentTarget as HTMLElement).closest(
          '.palette-color-strip'
        );
        const colorId = strip?.getAttribute('data-color-id');

        if (!colorId) return;

        switch (action) {
          case 'remove':
            this.controller?.removeColor(colorId);
            break;
          case 'copy':
            this.controller?.copyColor(colorId);
            break;
          case 'lock':
            this.controller?.toggleLock(colorId);
            break;
          case 'shades':
            this.showColorPicker(colorId, strip as HTMLElement);
            break;
        }
      });
    });

    // Role editing
    this.element.querySelectorAll('[data-action="edit-role"]').forEach((roleEl) => {
      roleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const strip = (e.currentTarget as HTMLElement).closest('.palette-color-strip');
        const colorId = strip?.getAttribute('data-color-id');
        if (!colorId) return;

        this.showRoleDropdown(e.currentTarget as HTMLElement, colorId);
      });
    });

    // Drag and drop
    this.setupDragAndDrop();
  }

  /**
   * Show the role editing dropdown.
   */
  private showRoleDropdown(target: HTMLElement, colorId: string): void {
    // Remove any existing dropdown
    this.hideRoleDropdown();

    const state = this.getPaletteState();
    const color = state.colors.find((c) => c.id === colorId);
    const dropdown = document.createElement('div');
    dropdown.innerHTML = this.renderRoleDropdown(colorId, color?.role);
    const dropdownEl = dropdown.firstElementChild as HTMLElement;

    // Position dropdown near the target
    document.body.appendChild(dropdownEl);
    const rect = target.getBoundingClientRect();
    dropdownEl.style.position = 'fixed';
    dropdownEl.style.left = `${rect.left}px`;
    dropdownEl.style.top = `${rect.bottom + 4}px`;
    dropdownEl.style.zIndex = '1000001';

    // Handle option clicks
    dropdownEl.querySelectorAll('.palette-role-option').forEach((option) => {
      option.addEventListener('click', () => {
        const role = (option as HTMLElement).dataset.role;
        this.controller?.setColorRole(colorId, role || undefined);
        this.hideRoleDropdown();
      });
    });

    // Handle custom input
    const input = dropdownEl.querySelector('.palette-role-input') as HTMLInputElement;
    if (input) {
      // Stop clicks inside input from bubbling
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('mousedown', (e) => e.stopPropagation());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const role = input.value.trim();
          this.controller?.setColorRole(colorId, role || undefined);
          this.hideRoleDropdown();
        } else if (e.key === 'Escape') {
          this.hideRoleDropdown();
        }
      });

      // Focus the input if there's already a custom role
      if (input.value) {
        input.focus();
        input.select();
      }
    }

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
      if (!dropdownEl.contains(e.target as Node)) {
        this.hideRoleDropdown();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  /**
   * Hide the role dropdown.
   */
  private hideRoleDropdown(): void {
    document.querySelectorAll('.palette-role-dropdown').forEach((el) => el.remove());
  }

  /**
   * Show the color picker for a color.
   */
  private showColorPicker(colorId: string, anchorElement: HTMLElement): void {
    // Create picker lazily (reuse instance to preserve marker positions)
    if (!this.colorPicker) {
      this.colorPicker = new ColorPicker({
        onColorChange: (id, hex) => {
          this.controller?.updateColor(id, hex);
        },
      });
    }

    // Get current colors from state
    const state = this.getPaletteState();

    // Show picker
    const rect = anchorElement.getBoundingClientRect();
    this.colorPicker.show(state.colors, colorId, rect);
  }

  /**
   * Set up drag and drop for color reordering.
   */
  private setupDragAndDrop(): void {
    if (!this.element) return;

    const strips = this.element.querySelectorAll('.palette-color-strip');
    let draggedIndex: number | null = null;

    strips.forEach((strip) => {
      const el = strip as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(el.dataset.index || '0', 10);
        el.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', el.dataset.colorId || '');
        }
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        draggedIndex = null;
        // Remove all drag-over states
        strips.forEach((s) => s.classList.remove('drag-over-left', 'drag-over-right'));
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedIndex === null) return;

        const targetIndex = parseInt(el.dataset.index || '0', 10);
        if (targetIndex === draggedIndex) return;

        // Show visual indicator
        strips.forEach((s) => s.classList.remove('drag-over-left', 'drag-over-right'));
        if (targetIndex < draggedIndex) {
          el.classList.add('drag-over-left');
        } else {
          el.classList.add('drag-over-right');
        }
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over-left', 'drag-over-right');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedIndex === null) return;

        const targetIndex = parseInt(el.dataset.index || '0', 10);
        if (targetIndex !== draggedIndex) {
          this.controller?.reorderColors(draggedIndex, targetIndex);
        }

        strips.forEach((s) => s.classList.remove('drag-over-left', 'drag-over-right'));
      });
    });
  }
}

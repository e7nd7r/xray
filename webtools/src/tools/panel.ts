/**
 * ToolbarPanel - Toolbar content inside a Panel
 *
 * Extends the base Panel class with toolbar-specific content:
 * - Tool selection (select, draw, annotate, snapshot)
 * - Color and stroke size pickers
 * - Snapshot list
 * - Clear and submit actions
 */

import { Panel, PanelConfig } from '../ui/panel';
import type { ToolsController } from './controller';
import type { ToolbarConfig, Tool } from './types';
import { icon, renderIcons } from '../ui/icons';

export interface ToolsPanelConfig extends Partial<PanelConfig> {
  toolbarConfig: Required<ToolbarConfig>;
}

export class ToolsPanel extends Panel {
  private controller: ToolsController;
  private toolbarConfig: Required<ToolbarConfig>;

  constructor(controller: ToolsController, config: ToolsPanelConfig) {
    super({
      id: 'tools',
      title: 'Tools',
      initialPosition: { x: window.innerWidth - 340, y: 100 },
      initialExpanded: true,
      width: 280,
      ...config,
    });

    this.controller = controller;
    this.toolbarConfig = config.toolbarConfig;
  }

  /**
   * Override render to add icon rendering after DOM mount.
   */
  render(): void {
    super.render();

    const element = this.getElement();
    if (element) {
      renderIcons(element);
    }
  }

  /**
   * Get the HTML content for the toolbar panel body.
   */
  protected getContentHTML(): string {
    const state = this.controller.getToolbarState();

    // Tool buttons with Lucide icons
    const tools: { id: Tool; iconName: string; title: string }[] = [
      { id: 'select', iconName: 'mouse-pointer-2', title: 'Select drawings (move/delete annotations)' },
      { id: 'element-select', iconName: 'square-dashed-mouse-pointer', title: 'Select page elements (blocks navigation)' },
      { id: 'freehand', iconName: 'pencil', title: 'Freehand (draw freely with mouse)' },
      { id: 'arrow', iconName: 'move-up-right', title: 'Arrow (click and drag to draw arrow)' },
      { id: 'rectangle', iconName: 'square', title: 'Rectangle (click and drag to draw rectangle)' },
      { id: 'ellipse', iconName: 'circle', title: 'Ellipse (click and drag to draw ellipse)' },
      { id: 'text', iconName: 'type', title: 'Text (click anywhere to add text annotation)' },
      { id: 'snapshot', iconName: 'camera', title: 'Snapshot (capture page with annotations)' },
    ];

    const toolButtons = tools
      .map(
        (t) => `
        <button class="tool-btn ${state.currentTool === t.id ? 'active' : ''}"
                data-tool="${t.id}" data-tooltip="${t.title}">
          ${icon(t.iconName)}
        </button>
      `
      )
      .join('');

    // Color buttons
    const colorButtons = this.toolbarConfig.colors
      .map(
        (c) => `
        <button class="color-btn ${state.currentColor === c ? 'active' : ''}"
                data-color="${c}"
                style="background-color: ${c}"
                title="${c}">
        </button>
      `
      )
      .join('');

    // Stroke width buttons
    const strokeButtons = this.toolbarConfig.strokeWidths
      .map(
        (w) => `
        <button class="stroke-btn ${state.currentStrokeWidth === w ? 'active' : ''}"
                data-width="${w}" title="Width ${w}">
          <span style="height: ${w}px"></span>
        </button>
      `
      )
      .join('');

    return `
      <div class="toolbar-prompt">${this.toolbarConfig.prompt}</div>

      <div class="toolbar-section">
        <div class="section-label">Tools</div>
        <div class="tool-row">${toolButtons}</div>
      </div>

      <div class="toolbar-section">
        <div class="section-label">Color & Size</div>
        <div class="color-row">${colorButtons}</div>
        <div class="stroke-row">${strokeButtons}</div>
      </div>

      <div class="toolbar-section">
        <button class="clear-btn" id="xray-clear-all">${icon('trash-2', 14)} Clear All</button>
      </div>

      <div class="toolbar-section snapshots-section">
        <div class="section-label">
          Snapshots <span class="snapshot-count">(0)</span>
          <button class="clear-all-btn" id="xray-clear-snapshots">Clear All</button>
        </div>
        <div class="snapshot-list"></div>
      </div>

      <div class="toolbar-footer">
        <div class="waiting-indicator">
          <span class="waiting-pulse"></span>
          <span class="waiting-text">Claude is waiting...</span>
        </div>
        <button id="xray-submit" class="primary">Done</button>
      </div>
    `;
  }

  /**
   * Attach event listeners for toolbar content.
   */
  protected attachContentEvents(): void {
    const element = this.getElement();
    if (!element) return;

    // Tool buttons
    element.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as Tool;
        if (tool) this.controller.setTool(tool);
      });
    });

    // Color buttons
    element.querySelectorAll('.color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) this.controller.setColor(color);
      });
    });

    // Stroke width buttons
    element.querySelectorAll('.stroke-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const width = btn.getAttribute('data-width');
        if (width) this.controller.setStrokeWidth(Number(width));
      });
    });

    // Clear all (drawings, annotations, selections)
    element.querySelector('#xray-clear-all')?.addEventListener('click', () => {
      this.controller.clearAll();
    });

    // Clear all snapshots
    element.querySelector('#xray-clear-snapshots')?.addEventListener('click', () => {
      this.controller.clearAllSnapshots();
    });

    // Submit button (Done)
    element.querySelector('#xray-submit')?.addEventListener('click', () => {
      this.controller.submit();
    });
  }

  /**
   * Update the active tool indicator.
   */
  updateToolIndicator(tool: Tool): void {
    const element = this.getElement();
    const buttons = element?.querySelectorAll('.tool-btn');
    buttons?.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
  }

  /**
   * Update the active color indicator.
   */
  updateColorIndicator(color: string): void {
    const element = this.getElement();
    const buttons = element?.querySelectorAll('.color-btn');
    buttons?.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-color') === color);
    });
  }

  /**
   * Update the stroke width indicator.
   */
  updateStrokeWidthIndicator(width: number): void {
    const element = this.getElement();
    const buttons = element?.querySelectorAll('.stroke-btn');
    buttons?.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-width') === String(width));
    });
  }

  /**
   * Set the waiting state (shows/hides Done button and waiting indicator).
   */
  setWaitingState(waiting: boolean): void {
    const element = this.getElement();
    if (!element) return;

    element.classList.toggle('waiting', waiting);
  }

  /**
   * Update the snapshot list.
   */
  updateSnapshotList(): void {
    const element = this.getElement();
    const list = element?.querySelector('.snapshot-list');
    const countEl = element?.querySelector('.snapshot-count');
    if (!list) return;

    const state = this.controller.getToolbarState();
    if (countEl) {
      countEl.textContent = `(${state.snapshots.length})`;
    }

    // Sort by timestamp (chronological order)
    const sortedSnapshots = [...state.snapshots].sort((a, b) => a.timestamp - b.timestamp);

    list.innerHTML = sortedSnapshots
      .map(
        (s, i) => `
        <div class="snapshot-item" data-id="${s.id}">
          <div class="snapshot-thumb-container">
            <img class="snapshot-thumbnail" src="${s.imageDataUrl}" alt="Snapshot ${i + 1}" />
            <div class="snapshot-preview">
              <img src="${s.imageDataUrl}" alt="Snapshot ${i + 1} preview" />
            </div>
          </div>
          <div class="snapshot-info">
            <span class="snapshot-name">Snapshot ${i + 1}</span>
            <span class="snapshot-time">${this.formatTimestamp(s.timestamp)}</span>
          </div>
          <button class="snapshot-delete" data-id="${s.id}">×</button>
        </div>
      `
      )
      .join('');

    // Attach click handlers for preview
    list.querySelectorAll('.snapshot-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking delete button
        if ((e.target as HTMLElement).classList.contains('snapshot-delete')) return;

        const id = (item as HTMLElement).getAttribute('data-id');
        if (id) this.showSnapshotPreview(id);
      });
    });

    // Reattach delete handlers
    list.querySelectorAll('.snapshot-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) this.controller.deleteSnapshot(id);
      });
    });

    // Attach hover handlers for thumbnail preview
    list.querySelectorAll('.snapshot-thumb-container').forEach((container) => {
      const preview = container.querySelector('.snapshot-preview') as HTMLElement;
      if (!preview) return;

      container.addEventListener('mouseenter', () => {
        const thumb = container.querySelector('.snapshot-thumbnail') as HTMLElement;
        if (!thumb) return;

        const rect = thumb.getBoundingClientRect();
        // Position preview above and to the left of the thumbnail
        const previewWidth = 288; // 280px img + 8px padding
        let left = rect.left;
        const top = rect.top - 8; // 8px gap above

        // Adjust if preview would go off screen to the right
        if (left + previewWidth > window.innerWidth) {
          left = window.innerWidth - previewWidth - 10;
        }

        preview.style.left = `${left}px`;
        preview.style.bottom = `${window.innerHeight - top}px`;
        preview.style.top = 'auto';
        preview.classList.add('visible');
      });

      container.addEventListener('mouseleave', () => {
        preview.classList.remove('visible');
      });
    });
  }

  /**
   * Open snapshot in a new tab.
   */
  private async showSnapshotPreview(id: string): Promise<void> {
    const state = this.controller.getToolbarState();
    const snapshot = state.snapshots.find((s) => s.id === id);
    if (!snapshot || !snapshot.imageDataUrl) return;

    // Convert data URL to blob URL (works better with window.open)
    try {
      const response = await fetch(snapshot.imageDataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      // Fallback to data URL
      window.open(snapshot.imageDataUrl, '_blank');
    }
  }

  /**
   * Format timestamp to a readable time string.
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

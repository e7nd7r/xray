/**
 * TabDock - Fixed container on screen edge with vertical tabs
 *
 * Tabs are docked to the screen edge and clicking them toggles
 * their associated panels.
 */

import type { Panel } from './panel';
import { icon, renderIcons } from './icons';

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  panel: Panel;
}

export interface TabDockConfig {
  side: 'left' | 'right';
  position?: number; // Y position from top (default: 100)
}

export class TabDock {
  private config: Required<TabDockConfig>;
  private tabs: TabConfig[] = [];
  private element: HTMLElement | null = null;

  constructor(config: TabDockConfig) {
    this.config = {
      side: config.side,
      position: config.position ?? 100,
    };
  }

  /**
   * Register a tab with its associated panel.
   */
  addTab(tab: TabConfig): void {
    this.tabs.push(tab);
    if (this.element) {
      this.renderTab(tab);
    }
  }

  /**
   * Remove a tab by id.
   */
  removeTab(id: string): void {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tabs.splice(index, 1);
      const tabEl = this.element?.querySelector(`[data-tab-id="${id}"]`);
      tabEl?.remove();
    }
  }

  /**
   * Render the tab dock to the DOM.
   */
  render(): void {
    this.destroy();

    this.element = document.createElement('div');
    this.element.className = 'xray-tab-dock';
    this.element.setAttribute('data-side', this.config.side);
    this.element.style.top = `${this.config.position}px`;

    // Render all tabs
    for (const tab of this.tabs) {
      this.renderTab(tab);
    }

    document.body.appendChild(this.element);
  }

  /**
   * Render a single tab element.
   */
  private renderTab(tab: TabConfig): void {
    if (!this.element) return;

    const tabEl = document.createElement('div');
    tabEl.className = 'xray-tab';
    tabEl.setAttribute('data-tab-id', tab.id);
    tabEl.setAttribute('title', tab.label);

    // Use icon if provided, otherwise use label text
    const content = tab.icon
      ? `<span class="tab-icon">${icon(tab.icon, 18)}</span>`
      : `<span class="tab-label">${tab.label}</span>`;

    tabEl.innerHTML = `
      ${content}
      <span class="tab-handle"></span>
    `;

    // Click handler to toggle panel
    tabEl.addEventListener('click', () => {
      this.togglePanel(tab);
    });

    this.element.appendChild(tabEl);

    // Render icons if any
    renderIcons(tabEl);

    // Update tab active state based on panel visibility
    this.updateTabState(tab);
  }

  /**
   * Toggle the panel associated with a tab.
   */
  private togglePanel(tab: TabConfig): void {
    if (tab.panel.isOpen()) {
      tab.panel.collapse();
    } else {
      tab.panel.expand();
    }
    this.updateTabState(tab);
  }

  /**
   * Update the visual state of a tab based on panel state.
   */
  private updateTabState(tab: TabConfig): void {
    const tabEl = this.element?.querySelector(`[data-tab-id="${tab.id}"]`);
    if (tabEl) {
      tabEl.classList.toggle('active', tab.panel.isOpen());
    }
  }

  /**
   * Update all tab states.
   */
  updateAllTabStates(): void {
    for (const tab of this.tabs) {
      this.updateTabState(tab);
    }
  }

  /**
   * Destroy the tab dock.
   */
  destroy(): void {
    this.element?.remove();
    this.element = null;
  }

  /**
   * Get the dock element.
   */
  getElement(): HTMLElement | null {
    return this.element;
  }
}

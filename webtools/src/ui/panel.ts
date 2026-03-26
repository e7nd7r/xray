/**
 * Base Panel Class
 *
 * A draggable floating panel (no attached tab).
 * Tabs are managed separately by TabDock.
 * Extend this class to create specific panel types.
 *
 * This is a pure UI component - it handles rendering, dragging,
 * expand/collapse. State management should be handled by controllers.
 */

export interface PanelConfig {
  id: string;
  title: string;
  initialPosition?: { x: number; y: number };
  initialExpanded?: boolean;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
}

const DEFAULT_PANEL_CONFIG: Partial<PanelConfig> = {
  initialPosition: { x: 20, y: 20 },
  initialExpanded: true,
  width: 280,
};

export abstract class Panel {
  protected config: Required<PanelConfig>;
  protected element: HTMLElement | null = null;
  protected isExpanded: boolean;
  protected position: { x: number; y: number };

  // Dragging state
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private elementStartX: number = 0;
  private elementStartY: number = 0;

  // Bound event handlers
  private boundDragMove: (e: MouseEvent) => void;
  private boundDragEnd: (e: MouseEvent) => void;
  private boundResize: () => void;

  constructor(config: PanelConfig) {
    this.config = {
      ...DEFAULT_PANEL_CONFIG,
      ...config,
    } as Required<PanelConfig>;

    this.isExpanded = this.config.initialExpanded;
    this.position = { ...this.config.initialPosition };

    this.boundDragMove = this.onDragMove.bind(this);
    this.boundDragEnd = this.onDragEnd.bind(this);
    this.boundResize = this.handleResize.bind(this);
  }

  /**
   * Render the panel to the DOM.
   */
  render(): void {
    this.destroy();

    this.element = document.createElement('div');
    this.element.className = 'xray-panel';
    this.element.id = `panel-${this.config.id}`;
    this.element.setAttribute('data-expanded', String(this.isExpanded));
    this.element.innerHTML = this.getPanelHTML();

    // Apply initial position
    this.element.style.position = 'fixed';
    this.element.style.left = `${this.position.x}px`;
    this.element.style.top = `${this.position.y}px`;

    // Hide if not expanded
    if (!this.isExpanded) {
      this.element.style.display = 'none';
    }

    document.body.appendChild(this.element);

    this.attachContentEvents();
    this.setupDragging();
    this.onRender();

    window.addEventListener('resize', this.boundResize);
  }

  /**
   * Remove the panel from the DOM.
   */
  destroy(): void {
    this.onDestroy();
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
    this.element?.remove();
    this.element = null;
  }

  /**
   * Expand the panel (show).
   */
  expand(): void {
    this.isExpanded = true;
    if (this.element) {
      this.element.setAttribute('data-expanded', 'true');
      this.element.style.display = '';
    }
  }

  /**
   * Collapse the panel (hide).
   */
  collapse(): void {
    this.isExpanded = false;
    if (this.element) {
      this.element.setAttribute('data-expanded', 'false');
      this.element.style.display = 'none';
    }
  }

  /**
   * Toggle expand/collapse state.
   */
  toggle(): void {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * Check if panel is currently expanded.
   */
  isOpen(): boolean {
    return this.isExpanded;
  }

  /**
   * Get the panel element.
   */
  getElement(): HTMLElement | null {
    return this.element;
  }

  /**
   * Generate the full panel HTML structure.
   */
  private getPanelHTML(): string {
    return `
      <div class="panel-header" id="panel-${this.config.id}-drag-handle">
        <div class="panel-title-row">
          <span class="panel-pulse"></span>
          <span class="panel-title">${this.config.title}</span>
        </div>
        <span class="panel-drag-indicator">&#8942;&#8942;</span>
      </div>
      <div class="panel-body">
        ${this.getContentHTML()}
      </div>
    `;
  }

  /**
   * Setup dragging on the panel header.
   */
  private setupDragging(): void {
    if (!this.element) return;

    const dragHandle = this.element.querySelector('.panel-header');
    if (!dragHandle) return;

    dragHandle.addEventListener('mousedown', (e) => {
      const event = e as MouseEvent;

      // Don't start drag if clicking on buttons inside header
      if ((event.target as HTMLElement).tagName === 'BUTTON') return;

      event.preventDefault();
      this.isDragging = true;

      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;

      const rect = this.element!.getBoundingClientRect();
      this.elementStartX = rect.left;
      this.elementStartY = rect.top;

      document.addEventListener('mousemove', this.boundDragMove);
      document.addEventListener('mouseup', this.boundDragEnd);

      (dragHandle as HTMLElement).style.cursor = 'grabbing';
    });
  }

  /**
   * Handle mouse move during drag.
   */
  private onDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.element) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    let newX = this.elementStartX + deltaX;
    let newY = this.elementStartY + deltaY;

    // Constrain to viewport
    const rect = this.element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    this.position.x = newX;
    this.position.y = newY;

    this.element.style.left = `${newX}px`;
    this.element.style.top = `${newY}px`;
  }

  /**
   * Handle mouse up to end drag.
   */
  private onDragEnd(): void {
    this.isDragging = false;

    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);

    const dragHandle = this.element?.querySelector('.panel-header') as HTMLElement;
    if (dragHandle) {
      dragHandle.style.cursor = 'grab';
    }
  }

  /**
   * Handle window resize to keep panel in bounds.
   */
  private handleResize(): void {
    if (!this.element || !this.isExpanded) return;

    const rect = this.element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    if (this.position.x > maxX) {
      this.position.x = Math.max(0, maxX);
      this.element.style.left = `${this.position.x}px`;
    }
    if (this.position.y > maxY) {
      this.position.y = Math.max(0, maxY);
      this.element.style.top = `${this.position.y}px`;
    }
  }

  /**
   * Get the HTML content for the panel body.
   * Override in subclasses to provide specific content.
   */
  protected abstract getContentHTML(): string;

  /**
   * Attach event listeners for the panel content.
   * Override in subclasses to handle specific interactions.
   */
  protected abstract attachContentEvents(): void;

  /**
   * Called after render completes.
   * Override in subclasses to perform post-render setup (e.g., subscriptions).
   */
  protected onRender(): void {
    // Override in subclasses
  }

  /**
   * Called before destroy.
   * Override in subclasses to perform cleanup (e.g., unsubscribe).
   */
  protected onDestroy(): void {
    // Override in subclasses
  }

  // ============================================================================
  // Optional methods for TabDock integration
  // ============================================================================

  /**
   * Get the panel title for the tab dock.
   * Override to provide a custom title.
   */
  getTitle(): string {
    return this.config.title;
  }

  /**
   * Get the icon name for the tab dock.
   * Override to provide a custom icon.
   * Returns undefined to use text label instead.
   */
  getIcon(): string | undefined {
    return undefined;
  }
}

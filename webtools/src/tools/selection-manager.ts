/**
 * Selection Manager - Handles element selection
 */

import { getCssSelector } from 'css-selector-generator';
import type { ToolsController } from './controller';
import type { ElementSelection, Rect } from './types';

export class SelectionManager {
  private controller: ToolsController;
  private isActive: boolean = false;
  private hoveredElement: HTMLElement | null = null;

  // Bound event handlers
  private boundMouseOver: (e: MouseEvent) => void;
  private boundMouseOut: (e: MouseEvent) => void;
  private boundClick: (e: MouseEvent) => void;

  constructor(controller: ToolsController) {
    this.controller = controller;
    this.boundMouseOver = this.onMouseOver.bind(this);
    this.boundMouseOut = this.onMouseOut.bind(this);
    this.boundClick = this.onClick.bind(this);
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    document.addEventListener('mouseover', this.boundMouseOver, true);
    document.addEventListener('mouseout', this.boundMouseOut, true);
    document.addEventListener('click', this.boundClick, true);
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    document.removeEventListener('mouseover', this.boundMouseOver, true);
    document.removeEventListener('mouseout', this.boundMouseOut, true);
    document.removeEventListener('click', this.boundClick, true);

    // Clear hover highlight
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('xray-hover-highlight');
      this.hoveredElement = null;
    }
  }

  cleanup(): void {
    this.deactivate();
    // Remove all selection highlights
    document.querySelectorAll('.xray-selected').forEach((el) => {
      el.classList.remove('xray-selected');
    });
  }

  clearAll(): void {
    document.querySelectorAll('.xray-selected').forEach((el) => {
      el.classList.remove('xray-selected');
    });
  }

  /**
   * Restore selections from state, removing stale references.
   */
  render(): void {
    const state = this.controller.getToolbarState();
    const staleIds: string[] = [];

    for (const selection of state.selectedElements) {
      const element = this.findElement(selection);
      if (element) {
        element.classList.add('xray-selected');
      } else {
        // Element no longer exists, mark for removal
        staleIds.push(selection.id);
      }
    }

    // Remove stale selections from state
    for (const id of staleIds) {
      this.controller.removeSelection(id);
    }
  }

  /**
   * Find an element by selection info, preferring ID.
   */
  private findElement(selection: ElementSelection): HTMLElement | null {
    // Prefer ID - most reliable
    if (selection.elementId) {
      const byId = document.getElementById(selection.elementId);
      if (byId) return byId;
    }

    // Fall back to selector
    if (selection.selector) {
      try {
        const bySelector = document.querySelector(selection.selector) as HTMLElement | null;
        if (bySelector) return bySelector;
      } catch {
        // Invalid selector, ignore
      }
    }

    return null;
  }

  private isToolbarElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;

    const element = target as Element;

    // Check for XRay container IDs
    if (element.closest('#xray-toolbar, #xray-document-svg, #xray-fixed-svg')) return true;

    // Check for XRay UI components
    if (element.closest('.xray-panel, .xray-tab-dock, .xray-tab')) return true;

    // Check if element itself has an xray- class (excluding selection highlights applied to page elements)
    const excludedClasses = ['xray-selected', 'xray-hover-highlight'];
    const classList = Array.from(element.classList);
    const hasXrayClass = classList.some(cls => cls.startsWith('xray-') && !excludedClasses.includes(cls));
    if (hasXrayClass) return true;

    // Check ancestors for xray- classes (strokes, annotations, icons, etc.)
    let parent = element.parentElement;
    while (parent) {
      const parentClasses = Array.from(parent.classList);
      if (parentClasses.some(cls => cls.startsWith('xray-') && !excludedClasses.includes(cls))) {
        return true;
      }
      // Stop at body
      if (parent === document.body) break;
      parent = parent.parentElement;
    }

    return false;
  }

  private onMouseOver(e: MouseEvent): void {
    if (this.isToolbarElement(e.target)) return;

    const target = e.target as HTMLElement;

    // Remove highlight from previous hovered element
    if (this.hoveredElement && !this.hoveredElement.classList.contains('xray-selected')) {
      this.hoveredElement.classList.remove('xray-hover-highlight');
    }

    this.hoveredElement = target;

    // Don't add hover highlight to already selected elements
    if (!this.hoveredElement.classList.contains('xray-selected')) {
      this.hoveredElement.classList.add('xray-hover-highlight');
    }
  }

  private onMouseOut(e: MouseEvent): void {
    if (this.isToolbarElement(e.target)) return;

    const target = e.target as HTMLElement;
    if (!target.classList.contains('xray-selected')) {
      target.classList.remove('xray-hover-highlight');
    }
  }

  private onClick(e: MouseEvent): void {
    if (this.isToolbarElement(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target as HTMLElement;
    const selection = this.getElementInfo(element);

    // Toggle selection
    if (element.classList.contains('xray-selected')) {
      element.classList.remove('xray-selected');
      this.controller.removeSelection(selection.id);
    } else {
      element.classList.remove('xray-hover-highlight');
      element.classList.add('xray-selected');
      this.controller.addSelection(selection);
    }
  }

  /**
   * Generate a unique ID for an element.
   */
  private getElementId(el: HTMLElement): string {
    if (el.id) return `id-${el.id}`;
    const selector = this.getSelector(el);
    return `sel-${btoa(selector).slice(0, 16)}`;
  }

  /**
   * Generate a unique CSS selector for an element using css-selector-generator.
   */
  private getSelector(el: HTMLElement): string {
    try {
      return getCssSelector(el, {
        // Prefer ID over other selectors
        selectors: ['id', 'tag', 'nthchild'],
        // Exclude xray classes from selectors
        blacklist: [/^\.xray-/],
      });
    } catch {
      // Fallback if library fails
      return el.id ? `#${el.id}` : el.tagName.toLowerCase();
    }
  }

  /**
   * Get element info for selection result.
   */
  private getElementInfo(element: HTMLElement): ElementSelection {
    const rect = element.getBoundingClientRect();
    const bounds: Rect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };

    return {
      id: this.getElementId(element),
      selector: this.getSelector(element),
      tagName: element.tagName.toLowerCase(),
      elementId: element.id || null,
      className: element.className || null,
      text: element.innerText?.substring(0, 200) || null,
      bounds,
    };
  }
}

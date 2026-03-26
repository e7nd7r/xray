/**
 * Lucide Icons Integration
 * Uses lucide library to render SVG icons after DOM mount
 */

import { createIcons } from 'lucide';
import {
  MousePointer2,
  SquareDashedMousePointer,
  Pencil,
  MoveUpRight,
  Square,
  Circle,
  Type,
  Camera,
  Trash2,
  GripVertical,
  PenTool,
  Palette,
  X,
  Copy,
  Lock,
  LockOpen,
  Pipette,
  ChevronLeft,
  ChevronRight,
  Presentation,
} from 'lucide';

// Map of icon names used in our app to lucide icon objects
export const iconMap = {
  MousePointer2,
  SquareDashedMousePointer,
  Pencil,
  MoveUpRight,
  Square,
  Circle,
  Type,
  Camera,
  Trash2,
  GripVertical,
  PenTool,
  Palette,
  X,
  Copy,
  Lock,
  LockOpen,
  Pipette,
  ChevronLeft,
  ChevronRight,
  Presentation,
};

/**
 * Render all lucide icons in the given container.
 * Call this after setting innerHTML on an element.
 */
export function renderIcons(_container: HTMLElement): void {
  createIcons({
    icons: iconMap,
    attrs: {
      'stroke-width': '2',
      'class': 'xray-icon', // Exclude from element selection
    },
  });
}

/**
 * Get an icon placeholder element string.
 * Use this in HTML templates, then call renderIcons() after mount.
 *
 * @param name - Lucide icon name in kebab-case (e.g., 'mouse-pointer-2')
 * @param size - Icon size in pixels (default: 16)
 */
export function icon(name: string, size = 16): string {
  return `<i data-lucide="${name}" class="xray-icon" style="width: ${size}px; height: ${size}px;"></i>`;
}

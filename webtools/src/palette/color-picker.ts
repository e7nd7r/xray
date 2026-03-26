/**
 * OkHSL Color Picker
 *
 * A modal color picker based on OkHSL (perceptually uniform cylindrical color space).
 * Shows all palette colors as draggable markers on a hue/saturation wheel.
 * Selected color shows a lightness scrubber for fine-tuning.
 *
 * Part of DES-004: Color Palette Panel (Task DES004-13)
 */

import chroma from 'chroma-js';
import type { PaletteColor } from './types';
import { getColorName } from './color-utils';

/** Psychology tags for color hues */
const COLOR_PSYCHOLOGY: Record<string, string[]> = {
  red: ['Energy', 'Passion', 'Urgency', 'Power'],
  orange: ['Warmth', 'Enthusiasm', 'Creativity', 'Adventure'],
  yellow: ['Optimism', 'Clarity', 'Warmth', 'Caution'],
  green: ['Growth', 'Nature', 'Harmony', 'Health'],
  cyan: ['Calm', 'Trust', 'Clarity', 'Freshness'],
  blue: ['Trust', 'Stability', 'Calm', 'Professionalism'],
  purple: ['Luxury', 'Creativity', 'Mystery', 'Wisdom'],
  magenta: ['Innovation', 'Imagination', 'Passion', 'Transformation'],
  neutral: ['Balance', 'Sophistication', 'Timelessness', 'Neutrality'],
};

/** Get psychology tags for a color based on its hue */
function getPsychologyTags(hex: string): string[] {
  const color = chroma(hex);
  const [h, s] = color.hsl();
  const hue = isNaN(h) ? 0 : h;
  const sat = s;

  // Low saturation = neutral
  if (sat < 0.15) {
    return COLOR_PSYCHOLOGY.neutral;
  }

  // Map hue to color name
  if (hue < 15 || hue >= 330) return COLOR_PSYCHOLOGY.red;
  if (hue < 45) return COLOR_PSYCHOLOGY.orange;
  if (hue < 70) return COLOR_PSYCHOLOGY.yellow;
  if (hue < 150) return COLOR_PSYCHOLOGY.green;
  if (hue < 190) return COLOR_PSYCHOLOGY.cyan;
  if (hue < 260) return COLOR_PSYCHOLOGY.blue;
  if (hue < 290) return COLOR_PSYCHOLOGY.purple;
  return COLOR_PSYCHOLOGY.magenta;
}

/**
 * OkLCH Color Space Utilities
 * Using chroma.js oklch (cylindrical OkLab) for perceptually uniform colors
 * OkLCH: L (lightness 0-1), C (chroma 0-0.4+), H (hue 0-360)
 */

// Convert hex to OkLCH
function hexToOklab(hex: string): { h: number; c: number; l: number } {
  const [l, c, h] = chroma(hex).oklch();
  return { h: isNaN(h) ? 0 : h, c, l };
}

// Convert OkLCH to hex
function oklabToHex(h: number, c: number, l: number): string {
  return chroma.oklch(l, c, h).hex();
}

export interface ColorPickerOptions {
  onColorChange?: (colorId: string, hex: string) => void;
  onClose?: () => void;
}

/**
 * ColorPicker - Modal OkHSL color picker
 */
export class ColorPicker {
  private element: HTMLElement | null = null;
  private colors: PaletteColor[] = [];
  private selectedColorId: string | null = null;
  private options: ColorPickerOptions;

  // Wheel dimensions
  private wheelSize = 200;
  private wheelCenter = 100;
  private wheelRadius = 90;
  private markerRadius = 10;

  // Drag state for color markers
  private isDragging = false;
  private dragColorId: string | null = null;
  private dragPosition: { x: number; y: number } | null = null;

  // Store visual positions for markers (to avoid gamut clipping jumps)
  private markerPositions: Map<string, { x: number; y: number }> = new Map();

  // Current wheel lightness (only changes via lightness slider or marker selection)
  private wheelLightness = 0.7;

  // Drag state for modal
  private isModalDragging = false;
  private modalDragOffset = { x: 0, y: 0 };

  constructor(options: ColorPickerOptions = {}) {
    this.options = options;
  }

  /**
   * Show the color picker modal.
   */
  show(colors: PaletteColor[], selectedColorId: string, anchorRect: DOMRect): void {
    this.colors = colors;
    this.selectedColorId = selectedColorId;

    // Remove any existing picker
    this.hide();

    // Create picker element
    this.element = document.createElement('div');
    this.element.className = 'color-picker-modal';
    this.element.innerHTML = this.render();

    // Position near anchor
    document.body.appendChild(this.element);
    this.positionModal(anchorRect);

    // Attach events
    this.attachEvents();

    // Set wheel lightness from initially selected color
    const selectedColor = this.colors.find((c) => c.id === this.selectedColorId);
    if (selectedColor) {
      const oklab = hexToOklab(selectedColor.hex);
      this.wheelLightness = oklab.l;
      this.updateLightnessGradient(oklab.h, oklab.c);
    }

    // Draw the wheel and markers
    this.drawWheel();
    this.updateMarkers();
  }

  /**
   * Hide the color picker modal.
   */
  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.options.onClose?.();
  }

  /**
   * Check if the color picker is currently visible.
   */
  isVisible(): boolean {
    return this.element !== null;
  }

  /**
   * Get the currently selected color ID.
   */
  getSelectedColorId(): string | null {
    return this.selectedColorId;
  }

  /**
   * Update colors (called when palette state changes).
   */
  updateColors(colors: PaletteColor[]): void {
    this.colors = colors;
    this.updateMarkers();
    this.updateInfoPanel();
  }

  /**
   * Render the picker HTML.
   */
  private render(): string {
    const selectedColor = this.colors.find((c) => c.id === this.selectedColorId);
    const oklab = selectedColor ? hexToOklab(selectedColor.hex) : { h: 0, s: 0, l: 0.5 };

    return `
      <div class="color-picker-header">
        <span class="color-picker-title">Color Picker</span>
        <button class="color-picker-close" data-action="close">×</button>
      </div>
      <div class="color-picker-body">
        <div class="color-picker-wheel-container">
          <canvas class="color-picker-wheel" width="${this.wheelSize}" height="${this.wheelSize}"></canvas>
          <div class="color-picker-markers"></div>
        </div>

        <div class="color-picker-lightness">
          <span class="color-picker-lightness-label">Lightness</span>
          <div class="color-picker-lightness-track" data-action="lightness-track">
            <div class="color-picker-lightness-gradient"></div>
            <div class="color-picker-lightness-handle" style="left: ${oklab.l * 100}%"></div>
          </div>
          <span class="color-picker-lightness-value">${Math.round(oklab.l * 100)}%</span>
        </div>

        <div class="color-picker-info">
          ${this.renderInfoPanel()}
        </div>
      </div>
    `;
  }

  /**
   * Render the color info panel.
   */
  private renderInfoPanel(): string {
    const selectedColor = this.colors.find((c) => c.id === this.selectedColorId);
    if (!selectedColor) {
      return '<div class="color-picker-no-selection">No color selected</div>';
    }

    const name = selectedColor.name || getColorName(selectedColor.hex);
    const tags = getPsychologyTags(selectedColor.hex);

    return `
      <div class="color-picker-preview">
        <div class="color-picker-swatch" style="background-color: ${selectedColor.hex}"></div>
        <div class="color-picker-details">
          <span class="color-picker-name">${name}</span>
          <span class="color-picker-hex">${selectedColor.hex}</span>
        </div>
      </div>
      <div class="color-picker-psychology">
        <span class="color-picker-psychology-label">Psychology</span>
        <div class="color-picker-tags">
          ${tags.map((tag) => `<span class="color-picker-tag">${tag}</span>`).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Update the info panel without full re-render.
   */
  private updateInfoPanel(): void {
    const infoEl = this.element?.querySelector('.color-picker-info');
    if (infoEl) {
      infoEl.innerHTML = this.renderInfoPanel();
    }

    // Update lightness slider using wheelLightness (not from hex, which may be gamut-clipped)
    const selectedColor = this.colors.find((c) => c.id === this.selectedColorId);
    if (selectedColor) {
      const oklab = hexToOklab(selectedColor.hex);
      const handle = this.element?.querySelector('.color-picker-lightness-handle') as HTMLElement;
      const value = this.element?.querySelector('.color-picker-lightness-value');
      if (handle) handle.style.left = `${this.wheelLightness * 100}%`;
      if (value) value.textContent = `${Math.round(this.wheelLightness * 100)}%`;

      // Update gradient to show selected color's hue/chroma
      this.updateLightnessGradient(oklab.h, oklab.c);
    }
  }

  /**
   * Update the lightness gradient based on current hue/saturation.
   */
  private updateLightnessGradient(h: number, s: number): void {
    const gradient = this.element?.querySelector('.color-picker-lightness-gradient') as HTMLElement;
    if (!gradient) return;

    // Create gradient from dark to light at current hue/sat
    const darkColor = oklabToHex(h, s, 0.15);
    const midColor = oklabToHex(h, s, 0.5);
    const lightColor = oklabToHex(h, s, 0.85);

    gradient.style.background = `linear-gradient(to right, ${darkColor}, ${midColor}, ${lightColor})`;
  }

  /**
   * Position the modal so it doesn't overlap the palette panel.
   */
  private positionModal(anchorRect: DOMRect): void {
    if (!this.element) return;

    const modalWidth = 280;
    const modalHeight = 420;
    const padding = 12;

    // Find the palette panel to avoid overlapping it
    const palettePanel = document.querySelector('#panel-palette');
    const panelRect = palettePanel?.getBoundingClientRect();

    let left: number;
    let top: number;

    if (panelRect) {
      // Position to the right of the palette panel
      left = panelRect.right + padding;
      top = panelRect.top;

      // If not enough space on the right, try left side
      if (left + modalWidth > window.innerWidth - padding) {
        left = panelRect.left - modalWidth - padding;
      }

      // If still not enough space, position below the panel
      if (left < padding) {
        left = panelRect.left;
        top = panelRect.bottom + padding;
      }
    } else {
      // Fallback: position near anchor
      left = anchorRect.right + padding;
      top = anchorRect.top;
    }

    // Keep within viewport
    if (top + modalHeight > window.innerHeight - padding) {
      top = window.innerHeight - modalHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }
    if (left + modalWidth > window.innerWidth - padding) {
      left = window.innerWidth - modalWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  // Maximum chroma for the wheel (allow full range for all colors)
  private maxChroma = 0.4;
  // Rotation offset for the wheel (180 degrees so red is on left)
  private hueOffset = 180;

  /**
   * Draw the OkLCH color wheel on canvas (perceptually uniform).
   * Uses the selected color's lightness to show the correct "slice".
   */
  private drawWheel(): void {
    const canvas = this.element?.querySelector('.color-picker-wheel') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = this.wheelCenter;
    const cy = this.wheelCenter;
    const radius = this.wheelRadius;

    // Clear canvas
    ctx.clearRect(0, 0, this.wheelSize, this.wheelSize);

    // Draw the wheel pixel by pixel using OkLCH
    const imageData = ctx.createImageData(this.wheelSize, this.wheelSize);
    const data = imageData.data;

    // Use stored wheel lightness
    const lightness = this.wheelLightness;

    for (let y = 0; y < this.wheelSize; y++) {
      for (let x = 0; x < this.wheelSize; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Anti-aliasing: smooth edge with alpha
        const edgeSoftness = 1.5;
        let alpha = 255;
        if (distance > radius - edgeSoftness && distance <= radius + edgeSoftness) {
          alpha = Math.round(255 * (1 - (distance - (radius - edgeSoftness)) / (edgeSoftness * 2)));
        } else if (distance > radius + edgeSoftness) {
          continue; // Outside wheel
        }

        if (distance <= radius + edgeSoftness) {
          // Calculate hue from angle (0-360) with rotation offset
          let hue = Math.atan2(dy, dx) * (180 / Math.PI) + this.hueOffset;
          hue = ((hue % 360) + 360) % 360;

          // Calculate chroma from distance (0 at center, maxChroma at edge)
          const chromaVal = (Math.min(distance, radius) / radius) * this.maxChroma;

          // Convert OkLCH to RGB using chroma.js
          const rgb = chroma.oklch(lightness, chromaVal, hue).rgb();
          const idx = (y * this.wheelSize + x) * 4;
          data[idx] = rgb[0];
          data[idx + 1] = rgb[1];
          data[idx + 2] = rgb[2];
          data[idx + 3] = alpha;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Update marker positions based on current colors.
   * Uses stored positions when available to avoid gamut clipping jumps.
   */
  private updateMarkers(): void {
    const container = this.element?.querySelector('.color-picker-markers');
    if (!container) return;

    container.innerHTML = this.colors
      .map((color) => {
        let pos: { x: number; y: number };

        // Priority: drag position > stored position > calculated from hex
        if (this.isDragging && this.dragColorId === color.id && this.dragPosition) {
          pos = this.dragPosition;
        } else if (this.markerPositions.has(color.id)) {
          pos = this.markerPositions.get(color.id)!;
        } else {
          const oklab = hexToOklab(color.hex);
          pos = this.hueAndChromaToPosition(oklab.h, oklab.c);
        }
        const isSelected = color.id === this.selectedColorId;

        return `
          <div class="color-picker-marker ${isSelected ? 'selected' : ''}"
               data-color-id="${color.id}"
               style="left: ${pos.x}px; top: ${pos.y}px; background-color: ${color.hex};">
          </div>
        `;
      })
      .join('');
  }

  /**
   * Convert hue/chroma to x/y position on the wheel.
   */
  private hueAndChromaToPosition(hue: number, chroma: number): { x: number; y: number } {
    // Apply hue offset for wheel rotation
    const angle = ((hue - this.hueOffset) * Math.PI) / 180;
    // Normalize chroma to wheel radius - clamp to edge for high-chroma colors
    const normalizedChroma = Math.min(chroma / this.maxChroma, 1);
    const distance = normalizedChroma * this.wheelRadius;

    return {
      x: this.wheelCenter + Math.cos(angle) * distance,
      y: this.wheelCenter + Math.sin(angle) * distance,
    };
  }

  /**
   * Convert x/y position to hue/chroma.
   */
  private positionToHueAndChroma(x: number, y: number): { h: number; c: number } {
    const dx = x - this.wheelCenter;
    const dy = y - this.wheelCenter;
    let distance = Math.sqrt(dx * dx + dy * dy);

    // Clamp distance to wheel radius (markers can't go outside)
    distance = Math.min(distance, this.wheelRadius);

    // Calculate hue with offset
    let hue = Math.atan2(dy, dx) * (180 / Math.PI) + this.hueOffset;
    hue = ((hue % 360) + 360) % 360;

    // Convert distance to chroma (0-maxChroma range, proportional to radius)
    const chroma = (distance / this.wheelRadius) * this.maxChroma;

    return { h: hue, c: chroma };
  }

  /**
   * Attach event listeners.
   */
  private attachEvents(): void {
    if (!this.element) return;

    // Close button
    this.element.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.hide();
    });

    // Modal dragging via header
    const header = this.element.querySelector('.color-picker-header');
    if (header) {
      header.addEventListener('mousedown', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        // Don't start drag if clicking close button
        if ((mouseEvent.target as HTMLElement).closest('[data-action="close"]')) return;

        this.isModalDragging = true;
        const rect = this.element!.getBoundingClientRect();
        this.modalDragOffset = {
          x: mouseEvent.clientX - rect.left,
          y: mouseEvent.clientY - rect.top,
        };
        (header as HTMLElement).style.cursor = 'grabbing';
      });
    }


    // Marker click to select, drag to move
    this.element.querySelector('.color-picker-markers')?.addEventListener('mousedown', (e) => {
      const marker = (e.target as HTMLElement).closest('.color-picker-marker');
      if (!marker) {
        return;
      }

      e.preventDefault();
      const colorId = marker.getAttribute('data-color-id');

      // Start dragging FIRST before any DOM updates
      this.isDragging = true;
      this.dragColorId = colorId;

      // Select this color (both on click and drag)
      if (colorId && colorId !== this.selectedColorId) {
        this.selectedColorId = colorId;
        // Update wheel lightness to match new selected color
        const selectedColor = this.colors.find((c) => c.id === colorId);
        if (selectedColor) {
          this.wheelLightness = hexToOklab(selectedColor.hex).l;
        }
        this.drawWheel();
        this.updateMarkers();
        this.updateInfoPanel();
      }
    });

    // Mouse move for dragging
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Lightness scrubber
    this.setupLightnessScrubber();
  }

  /**
   * Handle mouse move during drag.
   */
  private handleMouseMove = (e: MouseEvent): void => {
    // Handle modal dragging
    if (this.isModalDragging && this.element) {
      const left = e.clientX - this.modalDragOffset.x;
      const top = e.clientY - this.modalDragOffset.y;
      this.element.style.left = `${Math.max(0, left)}px`;
      this.element.style.top = `${Math.max(0, top)}px`;
      return;
    }

    // Handle color marker dragging
    if (!this.isDragging || !this.dragColorId) {
      return;
    }

    const canvas = this.element?.querySelector('.color-picker-wheel') as HTMLCanvasElement;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.handleWheelDrag(x, y);
  };

  /**
   * Handle mouse up to end drag.
   */
  private handleMouseUp = (): void => {
    // End modal dragging
    if (this.isModalDragging) {
      this.isModalDragging = false;
      const header = this.element?.querySelector('.color-picker-header') as HTMLElement;
      if (header) header.style.cursor = '';
    }

    // End color marker dragging - commit change to controller
    if (this.isDragging && this.dragColorId) {
      const color = this.colors.find((c) => c.id === this.dragColorId);
      if (color) {
        this.options.onColorChange?.(this.dragColorId, color.hex);
      }
    }

    // Save the drag position so marker stays where user put it
    if (this.dragColorId && this.dragPosition) {
      this.markerPositions.set(this.dragColorId, this.dragPosition);
    }

    this.isDragging = false;
    this.dragColorId = null;
    this.dragPosition = null;
  };

  /**
   * Handle dragging on the wheel.
   */
  private handleWheelDrag(x: number, y: number): void {
    if (!this.dragColorId) return;

    const color = this.colors.find((c) => c.id === this.dragColorId);
    if (!color) return;

    // Clamp position to wheel bounds
    const dx = x - this.wheelCenter;
    const dy = y - this.wheelCenter;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, this.wheelRadius);
    const scale = distance > 0 ? clampedDistance / distance : 1;
    const clampedX = this.wheelCenter + dx * scale;
    const clampedY = this.wheelCenter + dy * scale;

    // Store the clamped position for marker rendering (avoids gamut clipping)
    this.dragPosition = { x: clampedX, y: clampedY };

    // Calculate new hue/chroma from position
    const { h, c } = this.positionToHueAndChroma(clampedX, clampedY);

    // Convert to hex using wheel lightness (keeps lightness constant during drag)
    const newHex = oklabToHex(h, c, this.wheelLightness);

    // Update local state and UI (defer controller update to mouseup for smooth dragging)
    const colorIndex = this.colors.findIndex((col) => col.id === this.dragColorId);
    if (colorIndex >= 0) {
      this.colors[colorIndex] = {
        ...this.colors[colorIndex],
        hex: newHex,
        name: getColorName(newHex),
      };
    }

    this.updateMarkers();
    this.updateInfoPanel();
  }

  /**
   * Set up the lightness scrubber.
   */
  private setupLightnessScrubber(): void {
    const track = this.element?.querySelector('.color-picker-lightness-track');
    if (!track) return;

    let isDraggingLightness = false;

    const updateLightness = (e: MouseEvent) => {
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const lightness = x / rect.width;

      if (!this.selectedColorId) return;

      const color = this.colors.find((c) => c.id === this.selectedColorId);
      if (!color) return;

      // Get current hue/saturation
      const currentOklab = hexToOklab(color.hex);

      // Create new color with new lightness
      const newHex = oklabToHex(currentOklab.h, currentOklab.c, lightness);

      // Update wheel lightness
      this.wheelLightness = lightness;

      // Update
      this.options.onColorChange?.(this.selectedColorId, newHex);

      // Update local state
      const colorIndex = this.colors.findIndex((c) => c.id === this.selectedColorId);
      if (colorIndex >= 0) {
        this.colors[colorIndex] = {
          ...this.colors[colorIndex],
          hex: newHex,
          name: getColorName(newHex),
        };
      }

      // Update UI
      const handle = this.element?.querySelector('.color-picker-lightness-handle') as HTMLElement;
      const value = this.element?.querySelector('.color-picker-lightness-value');
      if (handle) handle.style.left = `${lightness * 100}%`;
      if (value) value.textContent = `${Math.round(lightness * 100)}%`;

      this.drawWheel();
      this.updateMarkers();
      this.updateInfoPanel();
    };

    track.addEventListener('mousedown', (e) => {
      isDraggingLightness = true;
      updateLightness(e as MouseEvent);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDraggingLightness) {
        updateLightness(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDraggingLightness = false;
    });
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.hide();
  }
}

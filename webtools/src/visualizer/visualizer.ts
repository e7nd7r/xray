/**
 * Visualizer Component
 *
 * Displays palette visualizations with slide navigation.
 * Part of DES-004: Color Palette Panel.
 */

import type { PaletteColor } from '../palette/types';
import type { Slide, SlideRegistryEntry, VisualizerConfig } from './types';
import { icon, renderIcons } from '../ui/icons';

/**
 * Visualizer - Displays palette visualizations with slide navigation.
 */
export class Visualizer {
  private container: HTMLElement;
  private colors: PaletteColor[];
  private config: Required<VisualizerConfig>;

  private slides: Slide[] = [];
  private registry: SlideRegistryEntry[] = [];
  private currentIndex: number = 0;
  private currentSlide: Slide | null = null;

  private contentEl: HTMLElement | null = null;
  private indicatorsEl: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    colors: PaletteColor[],
    config: VisualizerConfig = {}
  ) {
    this.container = container;
    this.colors = colors;
    this.config = {
      initialSlide: config.initialSlide ?? '',
      showControls: config.showControls ?? true,
      showIndicators: config.showIndicators ?? true,
    };
  }

  /**
   * Register slides for the visualizer.
   */
  registerSlides(entries: SlideRegistryEntry[]): void {
    this.registry = entries;
  }

  /**
   * Initialize and render the visualizer.
   */
  async init(): Promise<void> {
    this.render();

    // Load initial slide
    if (this.registry.length > 0) {
      // Find initial slide by ID or use first
      const initialIndex = this.config.initialSlide
        ? this.registry.findIndex((e) => e.id === this.config.initialSlide)
        : 0;
      this.currentIndex = initialIndex >= 0 ? initialIndex : 0;
      await this.loadSlide(this.currentIndex);
    }
  }

  /**
   * Update colors and re-render current slide.
   */
  updateColors(colors: PaletteColor[]): void {
    this.colors = colors;
    if (this.currentSlide && this.contentEl) {
      this.renderCurrentSlide();
    }
  }

  /**
   * Navigate to the next slide.
   */
  async next(): Promise<void> {
    if (this.registry.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.registry.length;
    await this.loadSlide(this.currentIndex);
  }

  /**
   * Navigate to the previous slide.
   */
  async prev(): Promise<void> {
    if (this.registry.length === 0) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.registry.length) % this.registry.length;
    await this.loadSlide(this.currentIndex);
  }

  /**
   * Navigate to a specific slide by index.
   */
  async goTo(index: number): Promise<void> {
    if (index < 0 || index >= this.registry.length) return;
    this.currentIndex = index;
    await this.loadSlide(this.currentIndex);
  }

  /**
   * Get the current slide index.
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get the total number of slides.
   */
  getSlideCount(): number {
    return this.registry.length;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.currentSlide?.destroy?.();
    this.currentSlide = null;
    this.container.innerHTML = '';
  }

  /**
   * Render the visualizer structure.
   */
  private render(): void {
    const controlsHTML = this.config.showControls
      ? `
        <button class="visualizer-nav prev" data-action="prev" title="Previous">
          ${icon('chevron-left', 24)}
        </button>
        <button class="visualizer-nav next" data-action="next" title="Next">
          ${icon('chevron-right', 24)}
        </button>
      `
      : '';

    const indicatorsHTML = this.config.showIndicators
      ? '<div class="visualizer-indicators"></div>'
      : '';

    this.container.innerHTML = `
      <div class="visualizer">
        <div class="visualizer-header">
          <span class="visualizer-title"></span>
        </div>
        <div class="visualizer-viewport">
          ${controlsHTML}
          <div class="visualizer-content"></div>
        </div>
        ${indicatorsHTML}
      </div>
    `;

    renderIcons(this.container);
    this.contentEl = this.container.querySelector('.visualizer-content');
    this.indicatorsEl = this.container.querySelector('.visualizer-indicators');

    this.attachEvents();
  }

  /**
   * Attach event listeners.
   */
  private attachEvents(): void {
    // Navigation buttons
    this.container.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      this.prev();
    });

    this.container.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this.next();
    });

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.prev();
      } else if (e.key === 'ArrowRight') {
        this.next();
      }
    });
  }

  /**
   * Load a slide by index.
   */
  private async loadSlide(index: number): Promise<void> {
    if (index < 0 || index >= this.registry.length) return;

    const entry = this.registry[index];

    // Clean up previous slide
    this.currentSlide?.destroy?.();

    // Load new slide
    this.currentSlide = await entry.create();
    this.renderCurrentSlide();
    this.updateIndicators();
    this.updateTitle();
  }

  /**
   * Render the current slide content.
   */
  private renderCurrentSlide(): void {
    if (!this.contentEl || !this.currentSlide) return;

    this.contentEl.innerHTML = '';
    this.currentSlide.render(this.contentEl, this.colors);
  }

  /**
   * Update the slide title.
   */
  private updateTitle(): void {
    const titleEl = this.container.querySelector('.visualizer-title');
    if (titleEl && this.currentSlide) {
      titleEl.textContent = this.currentSlide.name;
    }
  }

  /**
   * Update the slide indicators (slider scrubber).
   */
  private updateIndicators(): void {
    if (!this.indicatorsEl) return;

    const total = this.registry.length;
    if (total === 0) return;

    const progress = this.currentIndex / Math.max(1, total - 1);
    const percent = progress * 100;

    // Only render the slider HTML once
    if (!this.indicatorsEl.querySelector('.visualizer-slider')) {
      this.indicatorsEl.innerHTML = `
        <div class="visualizer-slider" title="${this.registry[this.currentIndex]?.name || ''}">
          <div class="visualizer-slider-track">
            <div class="visualizer-slider-fill" style="width: ${percent}%"></div>
            <div class="visualizer-slider-handle" style="left: ${percent}%"></div>
          </div>
          <span class="visualizer-slider-label">${this.currentIndex + 1} / ${total}</span>
        </div>
      `;
      this.attachSliderEvents();
    } else {
      // Update existing slider
      const fill = this.indicatorsEl.querySelector('.visualizer-slider-fill') as HTMLElement;
      const handle = this.indicatorsEl.querySelector('.visualizer-slider-handle') as HTMLElement;
      const label = this.indicatorsEl.querySelector('.visualizer-slider-label') as HTMLElement;
      const slider = this.indicatorsEl.querySelector('.visualizer-slider') as HTMLElement;

      if (fill) fill.style.width = `${percent}%`;
      if (handle) handle.style.left = `${percent}%`;
      if (label) label.textContent = `${this.currentIndex + 1} / ${total}`;
      if (slider) slider.title = this.registry[this.currentIndex]?.name || '';
    }
  }

  /**
   * Attach slider interaction events.
   */
  private attachSliderEvents(): void {
    if (!this.indicatorsEl) return;

    const track = this.indicatorsEl.querySelector('.visualizer-slider-track') as HTMLElement;
    if (!track) return;

    let isDragging = false;

    const updateFromPosition = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const newIndex = Math.round(percent * (this.registry.length - 1));
      if (newIndex !== this.currentIndex) {
        this.goTo(newIndex);
      }
    };

    // Click on track
    track.addEventListener('click', (e) => {
      updateFromPosition(e.clientX);
    });

    // Drag handle
    track.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        updateFromPosition(e.clientX);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
}

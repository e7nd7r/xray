/**
 * Snapshot Manager - Captures screenshots with annotations
 */

import html2canvas from 'html2canvas';
import type { ToolsController } from './controller';
import type { Snapshot, ElementSelection, DrawingStroke, TextAnnotation } from './types';

export class SnapshotManager {
  private controller: ToolsController;

  constructor(controller: ToolsController) {
    this.controller = controller;
  }

  /**
   * Capture a snapshot of the current state.
   * Captures the full page with SVG drawings and annotations.
   */
  async capture(
    selectedElements: ElementSelection[],
    drawings: DrawingStroke[],
    annotations: TextAnnotation[]
  ): Promise<Snapshot> {
    let imageDataUrl = '';

    try {
      // Capture the full page (excluding only the toolbar)
      // SVG drawings and annotations are part of the DOM and will be captured
      const pageCanvas = await html2canvas(document.documentElement, {
        ignoreElements: (element) => {
          const id = element.id || '';
          // Only exclude the toolbar UI
          return id === 'xray-toolbar';
        },
        backgroundColor: null, // Capture actual background
        scale: 2, // Higher quality
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
      });

      imageDataUrl = pageCanvas.toDataURL('image/png');
    } catch (error) {
      console.warn('Failed to capture page with html2canvas:', error);
    }

    return {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      imageDataUrl,
      selectedElements: [...selectedElements],
      drawings: [...drawings],
      annotations: [...annotations],
    };
  }
}

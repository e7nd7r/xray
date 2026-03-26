/**
 * SVG Manager - Manages drawing and annotations with SVG elements
 * Handles both drawings (freehand, arrow, rectangle, ellipse) and text annotations
 */

import type { ToolsController } from './controller';
import type { DrawingStroke, TextAnnotation, Point } from './types';

type DrawingTool = 'freehand' | 'arrow' | 'rectangle' | 'ellipse';

export class SvgManager {
  private controller: ToolsController;

  // Two SVG containers: one for document elements, one for fixed elements
  private documentSvg: SVGSVGElement | null = null;
  private fixedSvg: SVGSVGElement | null = null;

  private isActive: boolean = false;
  private currentTool: DrawingTool | null = null;
  private currentStroke: DrawingStroke | null = null;
  private currentElement: SVGElement | null = null;
  private isDrawing: boolean = false;
  private isOnFixedElement: boolean = false;

  // Text annotation mode
  private isTextMode: boolean = false;
  private editingAnnotationId: string | null = null;
  private textInput: HTMLTextAreaElement | null = null;

  // Text annotation with draggable pointer handle
  private pendingAnnotationId: string | null = null;
  private pointerHandle: SVGCircleElement | null = null;
  private isDraggingPointer: boolean = false;
  private annotationIsFixed: boolean = false;

  // Selection state (works for both strokes and annotations)
  private selectedId: string | null = null;
  private selectedType: 'stroke' | 'annotation' | null = null;
  private isDragging: boolean = false;
  private dragStartPoint: Point | null = null;
  private dragElementStart: Point | null = null;
  private dragPointerTargetStart: Point | null = null;
  private dragStrokeStart: { points: Point[]; startPoint?: Point; endPoint?: Point } | null = null;

  // Bound event handlers
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundResize: () => void;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(controller: ToolsController) {
    this.controller = controller;
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundResize = this.handleResize.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
  }

  /**
   * Create the SVG containers.
   */
  create(): void {
    if (this.documentSvg) return;

    // Document SVG - scrolls with page, lower z-index
    this.documentSvg = this.createSvgElement('xray-svg-document', false);
    document.body.appendChild(this.documentSvg);

    // Fixed SVG - stays in viewport, higher z-index
    this.fixedSvg = this.createSvgElement('xray-svg-fixed', true);
    document.body.appendChild(this.fixedSvg);

    window.addEventListener('resize', this.boundResize);
    this.updateSvgSizes();
  }

  /**
   * Create an SVG element with proper attributes.
   */
  private createSvgElement(id: string, isFixed: boolean): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = id;
    svg.style.position = isFixed ? 'fixed' : 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    // Fixed SVG above page fixed elements but below toolbar (999999)
    // Document SVG below page fixed elements
    svg.style.zIndex = isFixed ? '999998' : '1';
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return svg;
  }

  /**
   * Update SVG sizes to match document/viewport.
   */
  private updateSvgSizes(): void {
    if (this.documentSvg) {
      const docWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        window.innerWidth
      );
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      );
      this.documentSvg.style.width = `${docWidth}px`;
      this.documentSvg.style.height = `${docHeight}px`;
      this.documentSvg.setAttribute('viewBox', `0 0 ${docWidth} ${docHeight}`);
    }

    if (this.fixedSvg) {
      this.fixedSvg.style.width = '100vw';
      this.fixedSvg.style.height = '100vh';
      this.fixedSvg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    }
  }

  /**
   * Destroy the SVG containers.
   */
  destroy(): void {
    this.deactivate();
    this.removeTextInput();
    window.removeEventListener('resize', this.boundResize);
    this.documentSvg?.remove();
    this.fixedSvg?.remove();
    this.documentSvg = null;
    this.fixedSvg = null;
  }

  /**
   * Activate drawing mode with a specific tool.
   */
  activate(tool: DrawingTool): void {
    this.deactivate();
    this.isActive = true;
    this.currentTool = tool;
    this.isTextMode = false;

    if (this.documentSvg) {
      this.documentSvg.style.pointerEvents = 'auto';
      this.documentSvg.style.cursor = 'crosshair';
    }
    if (this.fixedSvg) {
      this.fixedSvg.style.pointerEvents = 'auto';
      this.fixedSvg.style.cursor = 'crosshair';
    }

    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
  }

  /**
   * Activate text annotation mode.
   */
  activateTextMode(): void {
    this.deactivate();
    this.isActive = true;
    this.isTextMode = true;
    this.currentTool = null;

    if (this.documentSvg) {
      this.documentSvg.style.pointerEvents = 'auto';
      this.documentSvg.style.cursor = 'text';
    }
    if (this.fixedSvg) {
      this.fixedSvg.style.pointerEvents = 'auto';
      this.fixedSvg.style.cursor = 'text';
    }

    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
  }

  /**
   * Deactivate drawing/selection mode.
   */
  deactivate(): void {
    this.isActive = false;
    this.selectedId = null;
    this.selectedType = null;
    this.isDragging = false;
    this.isDrawing = false;
    this.isTextMode = false;
    this.currentStroke = null;
    this.currentElement = null;
    this.currentTool = null;

    // Clean up pending annotation
    if (this.pendingAnnotationId) {
      this.finalizePendingAnnotation();
    }
    this.isDraggingPointer = false;
    this.removePointerHandle();

    if (this.documentSvg) {
      this.documentSvg.style.pointerEvents = 'none';
      this.documentSvg.style.cursor = 'default';
    }
    if (this.fixedSvg) {
      this.fixedSvg.style.pointerEvents = 'none';
      this.fixedSvg.style.cursor = 'default';
    }

    document.removeEventListener('mousedown', this.boundMouseDown, true);
    document.removeEventListener('mousemove', this.boundMouseMove, true);
    document.removeEventListener('mouseup', this.boundMouseUp, true);
    document.removeEventListener('keydown', this.boundKeyDown);

    this.clearSelection();
  }

  /**
   * Activate selection mode for drawings and annotations.
   * SVG containers stay pointer-events: none so page clicks pass through.
   * Individual strokes/annotations have their own pointer-events to capture clicks.
   */
  activateSelection(): void {
    this.deactivate();
    this.isActive = true;
    this.currentTool = null;
    this.isTextMode = false;

    // Keep SVG containers with pointer-events: none so page interactions work
    // Individual strokes/annotations have pointer-events set on them
    if (this.documentSvg) {
      this.documentSvg.style.pointerEvents = 'none';
      this.documentSvg.style.cursor = 'default';
    }
    if (this.fixedSvg) {
      this.fixedSvg.style.pointerEvents = 'none';
      this.fixedSvg.style.cursor = 'default';
    }

    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
    document.addEventListener('keydown', this.boundKeyDown);
  }

  /**
   * Clear all drawings and annotations from SVG.
   */
  clear(): void {
    if (this.documentSvg) {
      this.documentSvg.innerHTML = '';
    }
    if (this.fixedSvg) {
      this.fixedSvg.innerHTML = '';
    }
  }

  /**
   * Redraw all strokes and annotations from state.
   */
  redraw(): void {
    this.clear();
    const state = this.controller.getToolbarState();
    for (const stroke of state.drawings) {
      this.renderStroke(stroke);
    }
    for (const annotation of state.annotations) {
      this.renderAnnotation(annotation);
    }
  }

  /**
   * Check if an element or any of its ancestors has position: fixed or sticky.
   */
  private isElementFixed(element: Element | null): boolean {
    while (element && element !== document.documentElement) {
      const style = window.getComputedStyle(element);
      if (style.position === 'fixed' || style.position === 'sticky') {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  /**
   * Get the element at click position (excluding our SVGs).
   */
  private getElementAtPoint(x: number, y: number): Element | null {
    // Temporarily hide SVGs to get element underneath
    const oldDocPointer = this.documentSvg?.style.pointerEvents;
    const oldFixedPointer = this.fixedSvg?.style.pointerEvents;

    if (this.documentSvg) this.documentSvg.style.pointerEvents = 'none';
    if (this.fixedSvg) this.fixedSvg.style.pointerEvents = 'none';

    const element = document.elementFromPoint(x, y);

    if (this.documentSvg) this.documentSvg.style.pointerEvents = oldDocPointer || 'none';
    if (this.fixedSvg) this.fixedSvg.style.pointerEvents = oldFixedPointer || 'none';

    return element;
  }

  /**
   * Check if target is toolbar element.
   */
  private isToolbarElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;
    return target.closest('#xray-toolbar') !== null;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.isToolbarElement(e.target)) return;

    // If we're editing text, finalize it first
    if (this.editingAnnotationId) {
      this.finalizeTextInput();
    }

    // Check if clicking on a fixed/sticky element
    const elementAtPoint = this.getElementAtPoint(e.clientX, e.clientY);
    this.isOnFixedElement = this.isElementFixed(elementAtPoint);

    // Get appropriate coordinates
    const point: Point = this.isOnFixedElement
      ? { x: e.clientX, y: e.clientY }
      : { x: e.pageX, y: e.pageY };

    // Check if clicking on pointer handle to drag it (works in any mode)
    // Use position-based detection since e.target may not be the handle element
    if (this.pointerHandle) {
      const handleRect = this.pointerHandle.getBoundingClientRect();
      const centerX = handleRect.left + handleRect.width / 2;
      const centerY = handleRect.top + handleRect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const handleRadius = 10; // Slightly larger than visual radius for easier clicking

      if (distance <= handleRadius) {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingPointer = true;
        return;
      }
    }

    // Text annotation mode - create bubble with draggable pointer handle
    if (this.isTextMode) {

      // Clear any current selection first
      this.clearSelection();

      // If there's a pending annotation, finalize it first
      if (this.pendingAnnotationId) {
        this.finalizePendingAnnotation();
      }

      e.preventDefault();
      e.stopPropagation();

      this.annotationIsFixed = this.isOnFixedElement;

      // Create annotation at click position with default pointer
      const state = this.controller.getToolbarState();
      const defaultPointerOffset = { x: -30, y: 40 }; // Default: point down-left

      const annotation: TextAnnotation = {
        id: `ann-${Date.now()}`,
        position: point,
        text: '',
        color: state.currentColor,
        fontSize: 14,
        isFixed: this.isOnFixedElement,
        pointerTarget: {
          x: point.x + defaultPointerOffset.x,
          y: point.y + defaultPointerOffset.y,
        },
      };

      this.controller.addAnnotation(annotation);
      this.renderAnnotation(annotation);
      this.pendingAnnotationId = annotation.id;

      // Add draggable handle at pointer tip
      this.createPointerHandle(annotation);

      // Show text input immediately - user can type while also adjusting handle
      this.showTextInput(annotation);
      return;
    }

    // Selection mode (no tool selected)
    if (!this.currentTool) {
      // Check if clicking on an existing stroke or annotation
      const clickedStroke = this.findStrokeAtPoint(e.clientX, e.clientY);
      const clickedAnnotation = this.findAnnotationAtPoint(e.clientX, e.clientY);

      if (clickedAnnotation) {
        e.preventDefault();
        e.stopPropagation();
        this.selectElement(clickedAnnotation.id, 'annotation');
        this.isDragging = true;
        this.dragStartPoint = point;
        this.dragElementStart = { ...clickedAnnotation.position };
        this.dragPointerTargetStart = clickedAnnotation.pointerTarget
          ? { ...clickedAnnotation.pointerTarget }
          : null;
      } else if (clickedStroke) {
        e.preventDefault();
        e.stopPropagation();
        this.selectElement(clickedStroke.id, 'stroke');
        this.isDragging = true;
        this.dragStartPoint = point;
        this.dragStrokeStart = {
          points: clickedStroke.points.map(p => ({ ...p })),
          startPoint: clickedStroke.startPoint ? { ...clickedStroke.startPoint } : undefined,
          endPoint: clickedStroke.endPoint ? { ...clickedStroke.endPoint } : undefined,
        };
      } else {
        this.clearSelection();
      }
      return;
    }

    // Drawing mode
    e.preventDefault();
    e.stopPropagation();

    // Clear any current selection first
    this.clearSelection();

    this.isDrawing = true;
    const state = this.controller.getToolbarState();

    this.currentStroke = {
      id: `stroke-${Date.now()}`,
      tool: this.currentTool,
      color: state.currentColor,
      strokeWidth: state.currentStrokeWidth,
      points: [point],
      startPoint: point,
      isFixed: this.isOnFixedElement,
    };

    // Create the SVG element
    this.currentElement = this.createStrokeElement(this.currentStroke);
    const svg = this.isOnFixedElement ? this.fixedSvg : this.documentSvg;
    svg?.appendChild(this.currentElement);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isActive) return;

    const point: Point = this.isOnFixedElement
      ? { x: e.clientX, y: e.clientY }
      : { x: e.pageX, y: e.pageY };

    // Handle dragging
    if (this.isDragging && this.selectedId && this.dragStartPoint) {
      const dx = point.x - this.dragStartPoint.x;
      const dy = point.y - this.dragStartPoint.y;

      if (this.selectedType === 'annotation' && this.dragElementStart) {
        // Drag annotation
        const state = this.controller.getToolbarState();
        const annotation = state.annotations.find(a => a.id === this.selectedId);
        if (annotation) {
          annotation.position = {
            x: this.dragElementStart.x + dx,
            y: this.dragElementStart.y + dy,
          };
          // Also move the pointer target
          if (this.dragPointerTargetStart && annotation.pointerTarget) {
            annotation.pointerTarget = {
              x: this.dragPointerTargetStart.x + dx,
              y: this.dragPointerTargetStart.y + dy,
            };
            // Update handle position
            if (this.pointerHandle) {
              this.pointerHandle.setAttribute('cx', String(annotation.pointerTarget.x));
              this.pointerHandle.setAttribute('cy', String(annotation.pointerTarget.y));
            }
          }
          this.updateAnnotationElement(annotation);
        }
      } else if (this.selectedType === 'stroke' && this.dragStrokeStart) {
        // Drag stroke
        const state = this.controller.getToolbarState();
        const stroke = state.drawings.find(s => s.id === this.selectedId);
        if (stroke) {
          stroke.points = this.dragStrokeStart.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          if (this.dragStrokeStart.startPoint) {
            stroke.startPoint = {
              x: this.dragStrokeStart.startPoint.x + dx,
              y: this.dragStrokeStart.startPoint.y + dy,
            };
          }
          if (this.dragStrokeStart.endPoint) {
            stroke.endPoint = {
              x: this.dragStrokeStart.endPoint.x + dx,
              y: this.dragStrokeStart.endPoint.y + dy,
            };
          }
          this.updateStrokeElement(stroke);
        }
      }
      return;
    }

    // Dragging pointer handle to adjust annotation pointer direction
    if (this.isDraggingPointer && this.pendingAnnotationId && this.pointerHandle) {
      let currentPoint: Point = this.annotationIsFixed
        ? { x: e.clientX, y: e.clientY }
        : { x: e.pageX, y: e.pageY };

      // Update pointer target in annotation
      const state = this.controller.getToolbarState();
      const annotation = state.annotations.find(a => a.id === this.pendingAnnotationId);
      if (annotation) {
        // Ensure pointer stays outside the bubble
        currentPoint = this.clampPointerOutsideBubble(annotation, currentPoint);

        annotation.pointerTarget = currentPoint;

        // Update handle position
        this.pointerHandle.setAttribute('cx', String(currentPoint.x));
        this.pointerHandle.setAttribute('cy', String(currentPoint.y));

        // Re-render annotation with new pointer direction
        this.updateAnnotationElement(annotation);
      }
      return;
    }

    // Update cursor on hover in selection mode
    if (!this.currentTool && !this.isTextMode) {
      const hitStroke = this.findStrokeAtPoint(e.clientX, e.clientY);
      const hitAnnotation = this.findAnnotationAtPoint(e.clientX, e.clientY);
      const cursor = (hitStroke || hitAnnotation) ? 'move' : 'default';
      if (this.documentSvg) this.documentSvg.style.cursor = cursor;
      if (this.fixedSvg) this.fixedSvg.style.cursor = cursor;
    }

    // Drawing
    if (!this.isDrawing || !this.currentStroke || !this.currentElement) return;

    this.currentStroke.points.push(point);
    this.currentStroke.endPoint = point;

    this.updateStrokeElement(this.currentStroke, this.currentElement);
  }

  private onMouseUp(e: MouseEvent): void {
    // Finish dragging pointer handle
    if (this.isDraggingPointer) {
      this.isDraggingPointer = false;
      // Position is already updated via controller methods
      return;
    }

    if (this.isDragging && this.selectedId) {
      this.isDragging = false;
      this.dragStartPoint = null;

      // Re-evaluate fixed status based on new position
      const elementAtPoint = this.getElementAtPoint(e.clientX, e.clientY);
      const isNowFixed = this.isElementFixed(elementAtPoint);

      if (this.selectedType === 'annotation') {
        this.handleAnnotationDragEnd(isNowFixed);
      } else if (this.selectedType === 'stroke') {
        this.handleStrokeDragEnd(isNowFixed);
      }

      this.dragElementStart = null;
      this.dragPointerTargetStart = null;
      this.dragStrokeStart = null;
      // State is already updated via controller methods
      return;
    }

    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragElementStart = null;
    this.dragPointerTargetStart = null;
    this.dragStrokeStart = null;

    if (this.currentStroke && this.currentStroke.points.length > 1) {
      const strokeId = this.currentStroke.id;
      this.controller.addDrawing(this.currentStroke);
      this.currentStroke = null;
      this.currentElement = null;
      this.isDrawing = false;
      // Switch to select mode and auto-select the newly created stroke
      this.controller.setTool('select');
      this.selectElement(strokeId, 'stroke');
      return;
    } else if (this.currentElement) {
      this.currentElement.remove();
    }

    this.currentStroke = null;
    this.currentElement = null;
    this.isDrawing = false;
  }

  private handleAnnotationDragEnd(isNowFixed: boolean): void {
    const state = this.controller.getToolbarState();
    const annotation = state.annotations.find(a => a.id === this.selectedId);
    if (!annotation) return;

    const wasFixed = annotation.isFixed ?? false;

    if (wasFixed !== isNowFixed) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      if (wasFixed && !isNowFixed) {
        // Moving from fixed to document - add scroll offset
        annotation.position = {
          x: annotation.position.x + scrollX,
          y: annotation.position.y + scrollY,
        };
      } else {
        // Moving from document to fixed - subtract scroll offset
        annotation.position = {
          x: annotation.position.x - scrollX,
          y: annotation.position.y - scrollY,
        };
      }

      // Move element to correct SVG container
      const element = document.getElementById(annotation.id);
      if (element) {
        element.remove();
        annotation.isFixed = isNowFixed;
        const targetSvg = isNowFixed ? this.fixedSvg : this.documentSvg;
        targetSvg?.appendChild(element);
        this.updateAnnotationElement(annotation);

        if (this.selectedId === annotation.id) {
          element.classList.add('xray-selected');
        }
      }

      this.controller.updateAnnotationFixed(annotation.id, isNowFixed);
    }
  }

  private handleStrokeDragEnd(isNowFixed: boolean): void {
    const state = this.controller.getToolbarState();
    const stroke = state.drawings.find(s => s.id === this.selectedId);
    if (!stroke) return;

    const wasFixed = stroke.isFixed ?? false;

    if (wasFixed !== isNowFixed) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      const convertPoint = (p: Point): Point => {
        if (wasFixed && !isNowFixed) {
          return { x: p.x + scrollX, y: p.y + scrollY };
        } else {
          return { x: p.x - scrollX, y: p.y - scrollY };
        }
      };

      stroke.points = stroke.points.map(convertPoint);
      if (stroke.startPoint) {
        stroke.startPoint = convertPoint(stroke.startPoint);
      }
      if (stroke.endPoint) {
        stroke.endPoint = convertPoint(stroke.endPoint);
      }

      const element = document.getElementById(stroke.id);
      if (element) {
        element.remove();
        stroke.isFixed = isNowFixed;
        const targetSvg = isNowFixed ? this.fixedSvg : this.documentSvg;
        targetSvg?.appendChild(element);
        this.updateStrokeElement(stroke);

        if (this.selectedId === stroke.id) {
          element.classList.add('xray-selected');
        }
      }

      this.controller.updateDrawingFixed(stroke.id, isNowFixed);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
      if (this.selectedType === 'stroke') {
        this.controller.removeDrawing(this.selectedId);
      } else if (this.selectedType === 'annotation') {
        this.controller.removeAnnotation(this.selectedId);
      }
      this.removeElement(this.selectedId);
      this.selectedId = null;
      this.selectedType = null;
    }
  }

  // ============ SELECTION ============

  private findStrokeAtPoint(clientX: number, clientY: number): DrawingStroke | null {
    const state = this.controller.getToolbarState();

    for (let i = state.drawings.length - 1; i >= 0; i--) {
      const stroke = state.drawings[i];
      const element = document.getElementById(stroke.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = Math.max(stroke.strokeWidth, 5);
        if (
          clientX >= rect.left - padding &&
          clientX <= rect.right + padding &&
          clientY >= rect.top - padding &&
          clientY <= rect.bottom + padding
        ) {
          return stroke;
        }
      }
    }
    return null;
  }

  private findAnnotationAtPoint(clientX: number, clientY: number): TextAnnotation | null {
    const state = this.controller.getToolbarState();

    for (let i = state.annotations.length - 1; i >= 0; i--) {
      const annotation = state.annotations[i];
      const element = document.getElementById(annotation.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return annotation;
        }
      }
    }
    return null;
  }

  private selectElement(id: string, type: 'stroke' | 'annotation'): void {
    this.clearSelection();
    this.selectedId = id;
    this.selectedType = type;
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('xray-selected');
    }

    // Show pointer handle for annotations
    if (type === 'annotation') {
      const state = this.controller.getToolbarState();
      const annotation = state.annotations.find(a => a.id === id);
      if (annotation && annotation.pointerTarget) {
        this.pendingAnnotationId = id;
        this.annotationIsFixed = annotation.isFixed ?? false;
        this.createPointerHandle(annotation);
      }
    }
  }

  /**
   * Clear the current selection (public method for toolbar to call).
   */
  clearCurrentSelection(): void {
    this.clearSelection();
  }

  private clearSelection(): void {
    if (this.selectedId) {
      const element = document.getElementById(this.selectedId);
      if (element) {
        element.classList.remove('xray-selected');
      }
    }
    this.selectedId = null;
    this.selectedType = null;

    // Remove pointer handle when deselecting
    this.removePointerHandle();
    this.pendingAnnotationId = null;
  }

  /**
   * Update the color of the currently selected element.
   * Returns true if an element was updated, false otherwise.
   */
  updateSelectedColor(color: string): boolean {
    if (!this.selectedId || !this.selectedType) return false;

    if (this.selectedType === 'stroke') {
      this.controller.updateDrawingColor(this.selectedId, color);
      this.redraw();
      // Re-select the element after redraw
      this.selectElement(this.selectedId, 'stroke');
      return true;
    } else if (this.selectedType === 'annotation') {
      this.controller.updateAnnotationColor(this.selectedId, color);
      this.redraw();
      // Re-select the element after redraw
      this.selectElement(this.selectedId, 'annotation');
      return true;
    }

    return false;
  }

  /**
   * Check if an element is currently selected.
   */
  hasSelection(): boolean {
    return this.selectedId !== null;
  }

  private removeElement(id: string): void {
    document.getElementById(id)?.remove();
  }

  // ============ STROKE RENDERING ============

  private renderStroke(stroke: DrawingStroke): void {
    const element = this.createStrokeElement(stroke);
    const svg = stroke.isFixed ? this.fixedSvg : this.documentSvg;
    svg?.appendChild(element);
  }

  private createStrokeElement(stroke: DrawingStroke): SVGElement {
    let element: SVGElement;

    switch (stroke.tool) {
      case 'freehand':
        element = this.createPathElement(stroke);
        break;
      case 'arrow':
        element = this.createArrowElement(stroke);
        break;
      case 'rectangle':
        element = this.createRectElement(stroke);
        break;
      case 'ellipse':
        element = this.createEllipseElement(stroke);
        break;
      default:
        element = this.createPathElement(stroke);
    }

    element.id = stroke.id;
    element.classList.add('xray-stroke');
    element.style.pointerEvents = 'stroke';

    return element;
  }

  private updateStrokeElement(stroke: DrawingStroke, element?: SVGElement): void {
    const el = element || document.getElementById(stroke.id);
    if (!el) return;

    switch (stroke.tool) {
      case 'freehand':
        this.updatePathElement(stroke, el as SVGPathElement);
        break;
      case 'arrow':
        this.updateArrowElement(stroke, el as SVGGElement);
        break;
      case 'rectangle':
        this.updateRectElement(stroke, el as SVGRectElement);
        break;
      case 'ellipse':
        this.updateEllipseElement(stroke, el as SVGEllipseElement);
        break;
    }
  }

  // --- Path (Freehand) ---
  private createPathElement(stroke: DrawingStroke): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', String(stroke.strokeWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', this.pointsToPath(stroke.points));
    return path;
  }

  private updatePathElement(stroke: DrawingStroke, path: SVGPathElement): void {
    path.setAttribute('d', this.pointsToPath(stroke.points));
  }

  private pointsToPath(points: Point[]): string {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  // --- Arrow ---
  private createArrowElement(stroke: DrawingStroke): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', stroke.color);
    line.setAttribute('stroke-width', String(stroke.strokeWidth));
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);

    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('fill', stroke.color);
    g.appendChild(arrowhead);

    this.updateArrowElement(stroke, g);
    return g;
  }

  private updateArrowElement(stroke: DrawingStroke, g: SVGGElement): void {
    const line = g.querySelector('line');
    const arrowhead = g.querySelector('polygon');
    if (!line || !arrowhead || !stroke.startPoint || !stroke.endPoint) return;

    const start = stroke.startPoint;
    const end = stroke.endPoint;

    line.setAttribute('x1', String(start.x));
    line.setAttribute('y1', String(start.y));
    line.setAttribute('x2', String(end.x));
    line.setAttribute('y2', String(end.y));

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 15;
    const headAngle = Math.PI / 6;

    const p1 = end;
    const p2 = {
      x: end.x - headLength * Math.cos(angle - headAngle),
      y: end.y - headLength * Math.sin(angle - headAngle),
    };
    const p3 = {
      x: end.x - headLength * Math.cos(angle + headAngle),
      y: end.y - headLength * Math.sin(angle + headAngle),
    };

    arrowhead.setAttribute('points', `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`);
  }

  // --- Rectangle ---
  private createRectElement(stroke: DrawingStroke): SVGRectElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', stroke.color);
    rect.setAttribute('stroke-width', String(stroke.strokeWidth));
    this.updateRectElement(stroke, rect);
    return rect;
  }

  private updateRectElement(stroke: DrawingStroke, rect: SVGRectElement): void {
    if (!stroke.startPoint || !stroke.endPoint) return;

    const x = Math.min(stroke.startPoint.x, stroke.endPoint.x);
    const y = Math.min(stroke.startPoint.y, stroke.endPoint.y);
    const width = Math.abs(stroke.endPoint.x - stroke.startPoint.x);
    const height = Math.abs(stroke.endPoint.y - stroke.startPoint.y);

    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
  }

  // --- Ellipse ---
  private createEllipseElement(stroke: DrawingStroke): SVGEllipseElement {
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('fill', 'none');
    ellipse.setAttribute('stroke', stroke.color);
    ellipse.setAttribute('stroke-width', String(stroke.strokeWidth));
    this.updateEllipseElement(stroke, ellipse);
    return ellipse;
  }

  private updateEllipseElement(stroke: DrawingStroke, ellipse: SVGEllipseElement): void {
    if (!stroke.startPoint || !stroke.endPoint) return;

    const cx = (stroke.startPoint.x + stroke.endPoint.x) / 2;
    const cy = (stroke.startPoint.y + stroke.endPoint.y) / 2;
    const rx = Math.abs(stroke.endPoint.x - stroke.startPoint.x) / 2;
    const ry = Math.abs(stroke.endPoint.y - stroke.startPoint.y) / 2;

    ellipse.setAttribute('cx', String(cx));
    ellipse.setAttribute('cy', String(cy));
    ellipse.setAttribute('rx', String(rx));
    ellipse.setAttribute('ry', String(ry));
  }

  // ============ ANNOTATION RENDERING ============

  private createAnnotationAtPoint(point: Point, isFixed: boolean, pointerTarget?: Point): void {
    const state = this.controller.getToolbarState();

    const annotation: TextAnnotation = {
      id: `ann-${Date.now()}`,
      position: point,
      text: '',
      color: state.currentColor,
      fontSize: 14,
      isFixed,
      pointerTarget,
    };

    this.controller.addAnnotation(annotation);
    this.renderAnnotation(annotation);
    this.showTextInput(annotation);
  }

  renderAnnotation(annotation: TextAnnotation): void {
    const element = this.createAnnotationElement(annotation);
    const svg = annotation.isFixed ? this.fixedSvg : this.documentSvg;
    svg?.appendChild(element);
  }

  /**
   * Create a draggable handle at the pointer tip for adjusting direction.
   */
  private createPointerHandle(annotation: TextAnnotation): void {
    if (!annotation.pointerTarget) return;

    const svg = annotation.isFixed ? this.fixedSvg : this.documentSvg;
    if (!svg) return;

    // Remove existing handle if any
    this.removePointerHandle();

    // Create handle circle at pointer target
    this.pointerHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.pointerHandle.setAttribute('cx', String(annotation.pointerTarget.x));
    this.pointerHandle.setAttribute('cy', String(annotation.pointerTarget.y));
    this.pointerHandle.setAttribute('r', '5');
    this.pointerHandle.setAttribute('fill', '#f59e0b');
    this.pointerHandle.setAttribute('stroke', '#fff');
    this.pointerHandle.setAttribute('stroke-width', '2');
    this.pointerHandle.style.cursor = 'grab';
    this.pointerHandle.style.pointerEvents = 'auto';
    this.pointerHandle.classList.add('xray-pointer-handle');

    svg.appendChild(this.pointerHandle);

    // Also add to the other SVG if it exists (ensures handle is on top in both)
    // Re-append to ensure it's the last child (rendered on top in SVG)
    this.bringHandleToFront();
  }

  /**
   * Ensure the handle is rendered on top of all other elements.
   */
  private bringHandleToFront(): void {
    if (this.pointerHandle && this.pointerHandle.parentElement) {
      const parent = this.pointerHandle.parentElement;
      parent.appendChild(this.pointerHandle);
    }
  }

  /**
   * Remove the pointer handle from DOM.
   */
  private removePointerHandle(): void {
    this.pointerHandle?.remove();
    this.pointerHandle = null;
  }

  /**
   * Finalize a pending annotation (remove handle, save state).
   */
  private finalizePendingAnnotation(): void {
    if (!this.pendingAnnotationId) return;

    // Remove the handle
    this.removePointerHandle();

    // Check if annotation has text, if not remove it
    const state = this.controller.getToolbarState();
    const annotation = state.annotations.find(a => a.id === this.pendingAnnotationId);
    if (annotation && !annotation.text) {
      this.controller.removeAnnotation(this.pendingAnnotationId);
      document.getElementById(this.pendingAnnotationId)?.remove();
    }

    this.pendingAnnotationId = null;
    // State is already updated via controller methods
  }

  /**
   * Calculate bubble bounds for an annotation.
   */
  private getBubbleBounds(annotation: TextAnnotation): { x: number; y: number; width: number; height: number } {
    const padding = 12;
    const maxWidth = 250;
    const minWidth = 80;

    const { width: textWidth, height: textHeight } = this.measureText(
      annotation.text || '',
      annotation.fontSize,
      maxWidth - padding * 2
    );

    const bubbleWidth = Math.max(minWidth, Math.min(maxWidth, textWidth + padding * 2));
    const bubbleHeight = Math.max(annotation.fontSize + padding * 2, textHeight + padding * 2);

    const bubbleX = annotation.position.x;
    const bubbleY = annotation.position.y - bubbleHeight;

    return { x: bubbleX, y: bubbleY, width: bubbleWidth, height: bubbleHeight };
  }

  /**
   * Clamp pointer target to stay outside the bubble bounds.
   */
  private clampPointerOutsideBubble(annotation: TextAnnotation, point: Point): Point {
    const bounds = this.getBubbleBounds(annotation);
    const minDistance = 15; // Minimum distance from bubble edge

    // Expand bounds by minDistance to create exclusion zone
    const excludeLeft = bounds.x - minDistance;
    const excludeRight = bounds.x + bounds.width + minDistance;
    const excludeTop = bounds.y - minDistance;
    const excludeBottom = bounds.y + bounds.height + minDistance;

    // Check if point is inside the exclusion zone
    if (point.x > excludeLeft && point.x < excludeRight &&
        point.y > excludeTop && point.y < excludeBottom) {
      // Find nearest edge and push point outside
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      const dx = point.x - centerX;
      const dy = point.y - centerY;

      // Determine which edge is closest based on direction from center
      const aspectRatio = bounds.width / bounds.height;
      if (Math.abs(dx) * (1 / aspectRatio) > Math.abs(dy)) {
        // Push horizontally
        if (dx > 0) {
          return { x: excludeRight, y: point.y };
        } else {
          return { x: excludeLeft, y: point.y };
        }
      } else {
        // Push vertically
        if (dy > 0) {
          return { x: point.x, y: excludeBottom };
        } else {
          return { x: point.x, y: excludeTop };
        }
      }
    }

    return point;
  }

  private createAnnotationElement(annotation: TextAnnotation): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = annotation.id;
    g.classList.add('xray-annotation');
    g.style.pointerEvents = 'all';

    // Calculate dimensions based on text with max width
    const padding = 12;
    const maxWidth = 250;
    const minWidth = 80;

    // Measure text to determine bubble size
    const { width: textWidth, height: textHeight } = this.measureText(
      annotation.text || '',
      annotation.fontSize,
      maxWidth - padding * 2
    );

    const bubbleWidth = Math.max(minWidth, Math.min(maxWidth, textWidth + padding * 2));
    const bubbleHeight = Math.max(annotation.fontSize + padding * 2, textHeight + padding * 2);

    // Pointer dimensions - make it prominent
    const pointerSize = 16;
    const cornerRadius = 8;

    // Position bubble - for custom pointer, position relative to annotation.position
    // For default pointer, offset from position
    const bubbleX = annotation.position.x;
    const bubbleY = annotation.position.y - bubbleHeight;

    // Calculate pointer that points precisely toward the target
    if (annotation.pointerTarget) {
      // Create bubble with precise pointer toward target
      this.createBubbleWithPrecisePointer(
        g, bubbleX, bubbleY, bubbleWidth, bubbleHeight,
        cornerRadius, pointerSize, annotation.pointerTarget, annotation.color
      );
    } else {
      // Default: simple bottom-left pointer
      this.createSimpleBubble(g, bubbleX, bubbleY, bubbleWidth, bubbleHeight, cornerRadius, pointerSize, 'bottom-left', annotation.color);
    }

    // Text using foreignObject for wrapping support
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', String(bubbleX + padding));
    fo.setAttribute('y', String(bubbleY + padding));
    fo.setAttribute('width', String(bubbleWidth - padding * 2));
    fo.setAttribute('height', String(bubbleHeight - padding * 2));

    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
      font-family: system-ui, -apple-system, sans-serif;
      font-size: ${annotation.fontSize}px;
      color: ${annotation.color};
      line-height: 1.3;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    `;
    textDiv.textContent = annotation.text || '';
    fo.appendChild(textDiv);
    g.appendChild(fo);

    return g;
  }

  /**
   * Create a bubble with pointer that points to the target point.
   * The target IS the tip of the pointer (where the handle sits).
   */
  private createBubbleWithPrecisePointer(
    g: SVGGElement,
    x: number, y: number, w: number, h: number,
    r: number, _pointerSize: number,
    target: Point, color: string
  ): void {
    // Find the point on the bubble edge closest to the target
    const bubbleCenterX = x + w / 2;
    const bubbleCenterY = y + h / 2;

    // Calculate angle from bubble center to target (tip)
    const dx = target.x - bubbleCenterX;
    const dy = target.y - bubbleCenterY;
    const angle = Math.atan2(dy, dx);

    // Find intersection with bubble edge (avoiding rounded corners)
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    let edgeX: number | undefined;
    let edgeY: number | undefined;
    let isHorizontalEdge = true;

    // Check horizontal edges (top/bottom) first
    if (Math.abs(sinAngle) > 0.001) {
      const yEdge = sinAngle > 0 ? y + h : y;
      const tanAngle = Math.tan(angle);
      const xAtYEdge = bubbleCenterX + (yEdge - bubbleCenterY) / tanAngle;
      // Ensure we're not in the rounded corner area
      if (xAtYEdge >= x + r && xAtYEdge <= x + w - r) {
        edgeX = xAtYEdge;
        edgeY = yEdge;
        isHorizontalEdge = true;
      }
    }

    // Check vertical edges (left/right) if not found on horizontal
    if (edgeX === undefined) {
      const xEdge = cosAngle > 0 ? x + w : x;
      const tanAngle = Math.tan(angle);
      const yAtXEdge = bubbleCenterY + (xEdge - bubbleCenterX) * tanAngle;
      // Ensure we're not in the rounded corner area
      if (yAtXEdge >= y + r && yAtXEdge <= y + h - r) {
        edgeX = xEdge;
        edgeY = yAtXEdge;
        isHorizontalEdge = false;
      }
    }

    // Fallback: find closest point on non-corner edge
    if (edgeX === undefined || edgeY === undefined) {
      // Determine which edge based on angle quadrant
      if (Math.abs(cosAngle) > Math.abs(sinAngle)) {
        // Left or right edge
        edgeX = cosAngle > 0 ? x + w : x;
        edgeY = Math.max(y + r, Math.min(y + h - r, bubbleCenterY));
        isHorizontalEdge = false;
      } else {
        // Top or bottom edge
        edgeY = sinAngle > 0 ? y + h : y;
        edgeX = Math.max(x + r, Math.min(x + w - r, bubbleCenterX));
        isHorizontalEdge = true;
      }
    }

    // Calculate pointer base width (proportional to distance, but capped)
    const dist = Math.sqrt(dx * dx + dy * dy);
    const baseHalfWidth = Math.min(10, Math.max(6, dist * 0.15));

    // Base points along the edge
    let p1X: number, p1Y: number, p2X: number, p2Y: number;

    if (isHorizontalEdge) {
      p1X = edgeX - baseHalfWidth;
      p2X = edgeX + baseHalfWidth;
      p1Y = p2Y = edgeY;
      // Clamp to avoid going into corners
      p1X = Math.max(x + r, p1X);
      p2X = Math.min(x + w - r, p2X);
    } else {
      p1X = p2X = edgeX;
      p1Y = edgeY - baseHalfWidth;
      p2Y = edgeY + baseHalfWidth;
      // Clamp to avoid going into corners
      p1Y = Math.max(y + r, p1Y);
      p2Y = Math.min(y + h - r, p2Y);
    }

    // Create the main rounded rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
    rect.setAttribute('fill', '#f8fafc');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    // Create the pointer triangle - tip is exactly at target
    const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    pointer.setAttribute('points', `${p1X},${p1Y} ${target.x},${target.y} ${p2X},${p2Y}`);
    pointer.setAttribute('fill', '#f8fafc');
    pointer.setAttribute('stroke', color);
    pointer.setAttribute('stroke-width', '1.5');
    pointer.setAttribute('stroke-linejoin', 'round');
    g.appendChild(pointer);

    // Cover the border between rect and pointer with a thick line
    const cover = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    if (isHorizontalEdge) {
      cover.setAttribute('x1', String(p1X + 1));
      cover.setAttribute('y1', String(p1Y));
      cover.setAttribute('x2', String(p2X - 1));
      cover.setAttribute('y2', String(p2Y));
    } else {
      cover.setAttribute('x1', String(p1X));
      cover.setAttribute('y1', String(p1Y + 1));
      cover.setAttribute('x2', String(p2X));
      cover.setAttribute('y2', String(p2Y - 1));
    }
    cover.setAttribute('stroke', '#f8fafc');
    cover.setAttribute('stroke-width', '3');
    g.appendChild(cover);
  }

  /**
   * Create a simple, clean speech bubble with pointer in one of 8 directions.
   */
  private createSimpleBubble(
    g: SVGGElement,
    x: number, y: number, w: number, h: number,
    r: number, pointerSize: number,
    direction: 'bottom-left' | 'bottom' | 'bottom-right' | 'left' | 'right' | 'top-left' | 'top' | 'top-right',
    color: string
  ): void {
    // Create the main rounded rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
    rect.setAttribute('fill', '#f8fafc');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    // Calculate pointer position based on direction
    let px: number, py: number; // Point on the bubble edge
    let tipX: number, tipY: number; // Tip of the pointer
    let p1X: number, p1Y: number; // First base point
    let p2X: number, p2Y: number; // Second base point
    const baseSize = pointerSize * 0.8;

    switch (direction) {
      case 'bottom-left':
        px = x + w * 0.2;
        py = y + h;
        tipX = px - pointerSize * 0.7;
        tipY = py + pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
      case 'bottom':
        px = x + w * 0.5;
        py = y + h;
        tipX = px;
        tipY = py + pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
      case 'bottom-right':
        px = x + w * 0.8;
        py = y + h;
        tipX = px + pointerSize * 0.7;
        tipY = py + pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
      case 'left':
        px = x;
        py = y + h * 0.5;
        tipX = px - pointerSize;
        tipY = py;
        p1X = px;
        p1Y = py - baseSize / 2;
        p2X = px;
        p2Y = py + baseSize / 2;
        break;
      case 'right':
        px = x + w;
        py = y + h * 0.5;
        tipX = px + pointerSize;
        tipY = py;
        p1X = px;
        p1Y = py - baseSize / 2;
        p2X = px;
        p2Y = py + baseSize / 2;
        break;
      case 'top-left':
        px = x + w * 0.2;
        py = y;
        tipX = px - pointerSize * 0.7;
        tipY = py - pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
      case 'top':
        px = x + w * 0.5;
        py = y;
        tipX = px;
        tipY = py - pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
      case 'top-right':
        px = x + w * 0.8;
        py = y;
        tipX = px + pointerSize * 0.7;
        tipY = py - pointerSize;
        p1X = px - baseSize / 2;
        p1Y = py;
        p2X = px + baseSize / 2;
        p2Y = py;
        break;
    }

    // Create the pointer triangle
    const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    pointer.setAttribute('points', `${p1X},${p1Y} ${tipX},${tipY} ${p2X},${p2Y}`);
    pointer.setAttribute('fill', '#f8fafc');
    pointer.setAttribute('stroke', color);
    pointer.setAttribute('stroke-width', '1');
    pointer.setAttribute('stroke-linejoin', 'round');
    g.appendChild(pointer);

    // Cover the border between rect and pointer with a line
    const cover = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cover.setAttribute('x1', String(p1X + 0.5));
    cover.setAttribute('y1', String(p1Y));
    cover.setAttribute('x2', String(p2X - 0.5));
    cover.setAttribute('y2', String(p2Y));
    cover.setAttribute('stroke', '#f8fafc');
    cover.setAttribute('stroke-width', '2');
    g.appendChild(cover);
  }

  /**
   * Create an SVG path for a rounded rectangle with an angled triangular pointer.
   * The pointer direction is specified in radians, allowing for smooth granular angles.
   */
  private createBubblePathWithAngledPointer(
    x: number, y: number, w: number, h: number,
    r: number, pointerSize: number,
    angle: number | null // null = default bottom-left pointer
  ): string {
    // Ensure corner radius doesn't exceed half of smallest dimension
    r = Math.min(r, w / 2, h / 2);

    // Default angle: bottom-left (pointing down and slightly left)
    if (angle === null) {
      angle = Math.PI * 0.75; // 135 degrees (bottom-left)
    }

    // Bubble center
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Find where the ray from center at `angle` intersects the rounded rect edge
    // We'll use a simplified approach: find intersection with the rect (ignoring corner radius for base position)
    const intersection = this.findRectIntersection(cx, cy, angle, x, y, w, h, r);

    // The pointer tip extends outward from the intersection point in the direction of the angle
    const tipX = intersection.x + Math.cos(angle) * pointerSize;
    const tipY = intersection.y + Math.sin(angle) * pointerSize;

    // The base of the pointer is perpendicular to the angle direction
    // Make it wider for a more prominent look
    const perpAngle = angle + Math.PI / 2;
    const baseHalfWidth = pointerSize * 0.7;
    const base1X = intersection.x + Math.cos(perpAngle) * baseHalfWidth;
    const base1Y = intersection.y + Math.sin(perpAngle) * baseHalfWidth;
    const base2X = intersection.x - Math.cos(perpAngle) * baseHalfWidth;
    const base2Y = intersection.y - Math.sin(perpAngle) * baseHalfWidth;

    // Build the rounded rect path, inserting the pointer at the appropriate edge
    return this.buildRoundedRectWithPointer(
      x, y, w, h, r,
      intersection.edge,
      intersection.t, // Position along edge (0-1)
      { base1: { x: base1X, y: base1Y }, base2: { x: base2X, y: base2Y }, tip: { x: tipX, y: tipY } }
    );
  }

  /**
   * Find where a ray from (cx, cy) at angle intersects the rectangle bounds.
   * Returns the intersection point and which edge it's on.
   */
  private findRectIntersection(
    cx: number, cy: number, angle: number,
    x: number, y: number, w: number, h: number, r: number
  ): { x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right'; t: number } {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Check intersection with each edge
    const candidates: Array<{ x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right'; t: number; dist: number }> = [];

    // Right edge (x = x + w)
    if (cos > 0.001) {
      const t = (x + w - cx) / cos;
      const iy = cy + t * sin;
      if (iy >= y + r && iy <= y + h - r) {
        candidates.push({ x: x + w, y: iy, edge: 'right', t: (iy - (y + r)) / (h - 2 * r), dist: t });
      }
    }

    // Left edge (x = x)
    if (cos < -0.001) {
      const t = (x - cx) / cos;
      const iy = cy + t * sin;
      if (iy >= y + r && iy <= y + h - r) {
        candidates.push({ x: x, y: iy, edge: 'left', t: (iy - (y + r)) / (h - 2 * r), dist: t });
      }
    }

    // Bottom edge (y = y + h)
    if (sin > 0.001) {
      const t = (y + h - cy) / sin;
      const ix = cx + t * cos;
      if (ix >= x + r && ix <= x + w - r) {
        candidates.push({ x: ix, y: y + h, edge: 'bottom', t: (ix - (x + r)) / (w - 2 * r), dist: t });
      }
    }

    // Top edge (y = y)
    if (sin < -0.001) {
      const t = (y - cy) / sin;
      const ix = cx + t * cos;
      if (ix >= x + r && ix <= x + w - r) {
        candidates.push({ x: ix, y: y, edge: 'top', t: (ix - (x + r)) / (w - 2 * r), dist: t });
      }
    }

    // Return the closest intersection (should only be one valid one)
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0];
    }

    // Fallback: bottom edge center
    return { x: x + w / 2, y: y + h, edge: 'bottom', t: 0.5 };
  }

  /**
   * Build a rounded rect path with a triangular pointer inserted at the specified edge position.
   */
  private buildRoundedRectWithPointer(
    x: number, y: number, w: number, h: number, r: number,
    edge: 'top' | 'bottom' | 'left' | 'right',
    edgeT: number, // Position along the edge (0-1, within the straight portion)
    pointer: { base1: Point; base2: Point; tip: Point }
  ): string {
    // Clamp edgeT to valid range
    edgeT = Math.max(0.1, Math.min(0.9, edgeT));

    let d = '';

    // Start at top-left corner after the arc
    d += `M ${x + r} ${y}`;

    // Top edge
    if (edge === 'top') {
      const edgeStart = x + r;
      const edgeLength = w - 2 * r;
      const pointerX = edgeStart + edgeLength * edgeT;
      d += ` L ${pointerX - 1} ${y}`;
      d += ` L ${pointer.base1.x} ${pointer.base1.y}`;
      d += ` L ${pointer.tip.x} ${pointer.tip.y}`;
      d += ` L ${pointer.base2.x} ${pointer.base2.y}`;
      d += ` L ${pointerX + 1} ${y}`;
    }
    d += ` L ${x + w - r} ${y}`;

    // Top-right corner
    d += ` Q ${x + w} ${y} ${x + w} ${y + r}`;

    // Right edge
    if (edge === 'right') {
      const edgeStart = y + r;
      const edgeLength = h - 2 * r;
      const pointerY = edgeStart + edgeLength * edgeT;
      d += ` L ${x + w} ${pointerY - 1}`;
      d += ` L ${pointer.base1.x} ${pointer.base1.y}`;
      d += ` L ${pointer.tip.x} ${pointer.tip.y}`;
      d += ` L ${pointer.base2.x} ${pointer.base2.y}`;
      d += ` L ${x + w} ${pointerY + 1}`;
    }
    d += ` L ${x + w} ${y + h - r}`;

    // Bottom-right corner
    d += ` Q ${x + w} ${y + h} ${x + w - r} ${y + h}`;

    // Bottom edge (going right to left)
    if (edge === 'bottom') {
      const edgeStart = x + r;
      const edgeLength = w - 2 * r;
      const pointerX = edgeStart + edgeLength * edgeT;
      d += ` L ${pointerX + 1} ${y + h}`;
      d += ` L ${pointer.base2.x} ${pointer.base2.y}`;
      d += ` L ${pointer.tip.x} ${pointer.tip.y}`;
      d += ` L ${pointer.base1.x} ${pointer.base1.y}`;
      d += ` L ${pointerX - 1} ${y + h}`;
    }
    d += ` L ${x + r} ${y + h}`;

    // Bottom-left corner
    d += ` Q ${x} ${y + h} ${x} ${y + h - r}`;

    // Left edge (going bottom to top)
    if (edge === 'left') {
      const edgeStart = y + r;
      const edgeLength = h - 2 * r;
      const pointerY = edgeStart + edgeLength * edgeT;
      d += ` L ${x} ${pointerY + 1}`;
      d += ` L ${pointer.base2.x} ${pointer.base2.y}`;
      d += ` L ${pointer.tip.x} ${pointer.tip.y}`;
      d += ` L ${pointer.base1.x} ${pointer.base1.y}`;
      d += ` L ${x} ${pointerY - 1}`;
    }
    d += ` L ${x} ${y + r}`;

    // Top-left corner
    d += ` Q ${x} ${y} ${x + r} ${y}`;

    d += ' Z';

    return d;
  }

  /**
   * Measure text dimensions with word wrapping
   */
  private measureText(text: string, fontSize: number, maxWidth: number): { width: number; height: number } {
    if (!text) {
      return { width: 0, height: fontSize };
    }

    // Create a temporary div to measure text
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute;
      visibility: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.3;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      max-width: ${maxWidth}px;
    `;
    div.textContent = text;
    document.body.appendChild(div);

    const rect = div.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    document.body.removeChild(div);

    return { width, height };
  }

  private updateAnnotationElement(annotation: TextAnnotation): void {
    const element = document.getElementById(annotation.id);
    if (!element) return;

    // Remove old element and create new one with updated position
    const parent = element.parentElement;
    element.remove();

    const newElement = this.createAnnotationElement(annotation);
    parent?.appendChild(newElement);

    // Restore selection state
    if (this.selectedId === annotation.id) {
      newElement.classList.add('xray-selected');
    }

    // Ensure handle stays on top after re-rendering annotation
    this.bringHandleToFront();
  }

  // ============ TEXT INPUT ============

  private showTextInput(annotation: TextAnnotation): void {
    this.removeTextInput();
    this.editingAnnotationId = annotation.id;

    // Hide the SVG annotation while editing
    const svgElement = document.getElementById(annotation.id);
    if (svgElement) {
      svgElement.style.display = 'none';
    }

    // Remove pointer handle during text editing
    this.removePointerHandle();

    // Create textarea element for multi-line support
    const textarea = document.createElement('textarea');
    textarea.className = 'xray-text-input';
    textarea.placeholder = 'Type annotation...';
    textarea.value = annotation.text;

    // Position input at the annotation position
    const padding = 12;
    const maxWidth = 250;
    const minHeight = annotation.fontSize + 4;
    const bubbleX = annotation.position.x + 16;
    const bubbleY = annotation.position.y - (minHeight + padding * 2) - 12;

    // Convert to viewport coordinates if annotation is not fixed
    let inputX = bubbleX;
    let inputY = bubbleY;

    if (!annotation.isFixed) {
      inputX -= window.scrollX;
      inputY -= window.scrollY;
    }

    textarea.style.cssText = `
      position: fixed;
      left: ${inputX}px;
      top: ${inputY}px;
      width: ${maxWidth - padding * 2}px;
      min-height: ${minHeight}px;
      max-height: 200px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: ${annotation.fontSize}px;
      line-height: 1.3;
      color: #334155;
      background: #f8fafc;
      border: 1px solid ${annotation.color};
      border-radius: 8px;
      outline: none;
      padding: ${padding}px;
      margin: 0;
      z-index: 1000000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      resize: none;
      overflow-y: auto;
    `;

    textarea.addEventListener('blur', () => this.finalizeTextInput());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.finalizeTextInput();
      } else if (e.key === 'Escape') {
        this.cancelTextInput();
      }
    });
    textarea.addEventListener('input', () => {
      if (this.editingAnnotationId) {
        this.controller.updateAnnotation(this.editingAnnotationId, textarea.value);
        // Auto-resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(200, textarea.scrollHeight) + 'px';
      }
    });

    document.body.appendChild(textarea);
    this.textInput = textarea;

    // Focus the textarea
    setTimeout(() => textarea.focus(), 0);
  }

  private finalizeTextInput(): void {
    if (!this.textInput || !this.editingAnnotationId) return;

    const text = this.textInput.value.trim();
    const annotationId = this.editingAnnotationId;

    this.removeTextInput();

    // Clean up pointer handle if this was a pending annotation
    if (this.pendingAnnotationId === annotationId) {
      this.removePointerHandle();
      this.pendingAnnotationId = null;
    }

    if (!text) {
      // Remove empty annotation
      this.controller.removeAnnotation(annotationId);
      document.getElementById(annotationId)?.remove();
    } else {
      // Update annotation with final text and re-render to correct size
      this.controller.updateAnnotation(annotationId, text);
      const state = this.controller.getToolbarState();
      const annotation = state.annotations.find(a => a.id === annotationId);
      if (annotation) {
        // Show and update the SVG annotation
        const svgElement = document.getElementById(annotationId);
        if (svgElement) {
          svgElement.style.display = '';
        }
        this.updateAnnotationElement(annotation);
        // Switch to select mode and auto-select the newly created annotation
        this.controller.setTool('select');
        this.selectElement(annotationId, 'annotation');
      }
    }
  }

  private cancelTextInput(): void {
    if (!this.editingAnnotationId) return;

    const annotationId = this.editingAnnotationId;
    this.removeTextInput();

    // Clean up pointer handle if this was a pending annotation
    if (this.pendingAnnotationId === annotationId) {
      this.removePointerHandle();
      this.pendingAnnotationId = null;
    }

    // Check if annotation had existing text
    const state = this.controller.getToolbarState();
    const annotation = state.annotations.find(a => a.id === annotationId);

    if (annotation && !annotation.text) {
      // Remove new empty annotation
      this.controller.removeAnnotation(annotationId);
      document.getElementById(annotationId)?.remove();
    } else {
      // Show the SVG element again (cancel editing existing annotation)
      const svgElement = document.getElementById(annotationId);
      if (svgElement) {
        svgElement.style.display = '';
      }
    }
  }

  private removeTextInput(): void {
    // Capture reference and null it first to prevent re-entry from blur event
    const input = this.textInput;
    this.textInput = null;
    this.editingAnnotationId = null;

    // Now safely remove if still in DOM
    if (input && input.parentElement) {
      input.remove();
    }
  }

  private handleResize(): void {
    this.updateSvgSizes();
  }
}

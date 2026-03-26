/**
 * Tools Type Definitions
 *
 * Types specific to the Tools Panel and annotation system.
 */

// Tool types
// 'select' - select/drag existing drawings and annotations
// 'element-select' - select page elements (prevents navigation)
export type Tool =
  | 'select'
  | 'element-select'
  | 'freehand'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'snapshot';

// Point representation
export interface Point {
  x: number;
  y: number;
}

// Rectangle/bounds
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Element selection result
export interface ElementSelection {
  id: string;
  selector: string;
  tagName: string;
  elementId: string | null;
  className: string | null;
  text: string | null;
  bounds: Rect;
}

// Drawing stroke
export interface DrawingStroke {
  id: string;
  tool: 'freehand' | 'arrow' | 'rectangle' | 'ellipse';
  color: string;
  strokeWidth: number;
  points: Point[]; // For freehand
  startPoint?: Point; // For shapes
  endPoint?: Point; // For shapes
  /** If true, drawing is positioned relative to viewport (for fixed elements) */
  isFixed?: boolean;
}

// Text annotation
export interface TextAnnotation {
  id: string;
  position: Point;
  text: string;
  color: string;
  fontSize: number;
  /** If true, annotation is positioned relative to viewport (for fixed elements) */
  isFixed?: boolean;
  /** The point where the pointer arrow points to (the target element) */
  pointerTarget?: Point;
}

// Snapshot - captures current state at a point in time
export interface Snapshot {
  id: string;
  timestamp: number;
  imageDataUrl: string; // Base64 screenshot with drawings overlaid
  selectedElements: ElementSelection[];
  drawings: DrawingStroke[];
  annotations: TextAnnotation[];
}

// Complete capture state returned to Python
export interface CaptureState {
  // Current state (what's on screen now)
  selectedElements: ElementSelection[];
  drawings: DrawingStroke[];
  annotations: TextAnnotation[];
  // All snapshots taken during session
  snapshots: Snapshot[];
  // Metadata
  viewport: { width: number; height: number };
  timestamp: number;
}

// Toolbar configuration
export interface ToolbarConfig {
  prompt?: string;
  colors?: string[];
  strokeWidths?: number[];
  /** If true, toolbar stays visible after Done/Cancel */
  persistent?: boolean;
}

// Result types
export interface SuccessResult {
  success: true;
  data: CaptureState;
}

export interface CancelledResult {
  success: false;
  cancelled: true;
}

export type ToolbarResult = SuccessResult | CancelledResult;

// Internal toolbar state
export interface ToolbarState {
  currentTool: Tool;
  currentColor: string;
  currentStrokeWidth: number;
  selectedElements: ElementSelection[];
  drawings: DrawingStroke[];
  annotations: TextAnnotation[];
  snapshots: Snapshot[];
}

// Default configuration
export const DEFAULT_CONFIG: Required<ToolbarConfig> = {
  prompt: 'Annotate the page',
  // Soft pastel colors - neutral and non-aggressive
  colors: ['#94a3b8', '#a5b4fc', '#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5'],
  strokeWidths: [2, 4, 6],
  persistent: false,
};

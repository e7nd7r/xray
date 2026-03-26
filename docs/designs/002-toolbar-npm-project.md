---
title: "DES-002: XRay Toolbar NPM Project"
date: 2025-12-23
status: draft
iteration: 1
author: Esteban Dorador
tags: [design, xray, toolbar, typescript, esbuild, npm]
priority: medium
related_adrs: []
related_designs: [DES-001]
changelog:
  - 2025-12-23 (v1): Initial design - npm project for toolbar with TypeScript and esbuild
---

# DES-002: XRay Toolbar NPM Project

## Overview

This document defines the implementation plan for creating an npm project for the XRay toolbar. The goal is to enable complex interactive features (canvas drawing, text annotations, screenshot capture) using TypeScript and modern tooling while maintaining integration with the Python MCP server.

**Key Objectives:**
- Set up npm project with TypeScript and esbuild bundler
- Port existing selection mode to TypeScript
- Add canvas drawing mode with freehand, arrows, rectangles, ellipses
- Add text annotation mode with click-to-place labels
- Maintain backward compatibility with existing Python API

---

## Current State

### File Structure
```
apps/xray/src/xray/toolbar/
├── __init__.py
├── manager.py           # Python manager that loads and injects assets
└── assets/
    ├── styles.css       # 96 lines - toolbar styling
    └── selection.js     # 144 lines - selection mode logic
```

### Limitations
| Issue | Impact |
|-------|--------|
| Plain JavaScript | No type safety, harder to refactor |
| No build process | Can't use modern JS features, no minification |
| Single mode only | Only selection, no drawing or annotations |
| Hard to extend | Adding features requires editing monolithic JS file |

---

## Proposed Architecture

### Directory Structure

```
apps/xray/src/xray/toolbar/
├── package.json
├── tsconfig.json
├── build.mjs                    # esbuild build script
├── src/
│   ├── index.ts                 # Main entry - exports XRayToolbar
│   ├── types.ts                 # TypeScript interfaces
│   ├── toolbar.ts               # Main toolbar controller
│   ├── modes/
│   │   ├── index.ts
│   │   ├── base-mode.ts         # Abstract base class
│   │   ├── selection-mode.ts    # Element selection (port existing)
│   │   ├── drawing-mode.ts      # Canvas drawing
│   │   └── annotation-mode.ts   # Text annotations
│   ├── canvas/
│   │   ├── index.ts
│   │   ├── canvas-manager.ts    # Canvas overlay lifecycle
│   │   └── tools/
│   │       ├── index.ts
│   │       ├── freehand-tool.ts
│   │       ├── arrow-tool.ts
│   │       ├── rectangle-tool.ts
│   │       └── ellipse-tool.ts
│   ├── annotations/
│   │   ├── index.ts
│   │   └── annotation-manager.ts
│   └── ui/
│       ├── index.ts
│       ├── toolbar-ui.ts        # DOM rendering
│       └── tool-palette.ts      # Tool selector
├── styles/
│   ├── index.css                # Main CSS entry
│   ├── toolbar.css
│   ├── selection.css
│   ├── canvas.css
│   └── annotations.css
├── dist/                        # Build output
│   ├── xray-toolbar.js          # IIFE bundle
│   └── xray-toolbar.css         # Combined CSS
├── __init__.py                  # Python module init
├── manager.py                   # Updated Python manager
└── assets/                      # Legacy (deprecated after migration)
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `src/toolbar.ts` | Main controller - mode switching, state management |
| `src/modes/` | Mode implementations (selection, drawing, annotation) |
| `src/canvas/` | Canvas overlay and drawing tools |
| `src/annotations/` | Text label management |
| `src/ui/` | DOM rendering for toolbar and tool palette |
| `manager.py` | Python integration - loads bundle, injects into page |

---

## Design Decisions

### DD-1: esbuild Bundler

Use esbuild for bundling TypeScript to a single IIFE JavaScript file.

**Rationale:**
- Extremely fast builds (10-100x faster than webpack)
- Simple configuration - single build.mjs file
- Built-in TypeScript support
- Produces small, optimized bundles
- Great for library/tool development

### DD-2: IIFE Bundle Format

Bundle as IIFE (Immediately Invoked Function Expression) exposing `window.XRayToolbar`.

```javascript
// Output format
var XRayToolbar = (function() {
  // ... bundled code
  return { showToolbar, clearToolbar, Toolbar };
})();
```

**Rationale:**
- No module loader needed in browser
- Clean global API for Python to call via `page.evaluate()`
- No async import complications
- Works in any browser context

### DD-3: Separate CSS Bundle

Keep CSS separate from JavaScript bundle.

**Rationale:**
- Easier to debug styles
- Can be cached independently
- No runtime CSS injection complexity
- Simpler Python injection (inject CSS, then JS)

### DD-4: Mode-based Architecture

Organize features into distinct modes with a common interface.

```typescript
abstract class BaseMode {
  abstract activate(): void;
  abstract deactivate(): void;
  abstract getState(): ModeState;
}
```

**Rationale:**
- Clear separation of concerns
- Easy to add new modes
- Modes can share common infrastructure (canvas, annotations)
- User can switch between modes during session

---

## API Design

### JavaScript API (IIFE Global)

```typescript
// Show toolbar and wait for result
const result = await window.XRayToolbar.showToolbar({
  prompt: "Annotate the issues",
  initialMode: "selection",  // or "drawing", "annotation"
  allowModeSwitch: true,
  colors: ["#ef4444", "#3b82f6", "#22c55e"],
  strokeWidths: [2, 4, 6],
});

// Cleanup
window.XRayToolbar.clearToolbar();
```

### Python API

```python
# Selection only (backward compatible)
result = await toolbar.show_selection_toolbar("Select element")

# Full toolbar with all modes
result = await toolbar.show_toolbar(
    prompt="Annotate issues",
    initial_mode="drawing",
    allow_mode_switch=True,
)
```

### Result Structure

```typescript
interface ToolbarResult {
  success: boolean;
  cancelled?: boolean;
  data?: {
    mode: "selection" | "drawing" | "annotation";
    selectedElements: ElementSelection[];
    drawings: DrawingStroke[];
    annotations: TextAnnotation[];
    viewport: { width: number; height: number };
    timestamp: number;
  };
}
```

---

## Implementation Plan

### Phase 1: Project Setup

#### Task 1.1: Create package.json
**File:** `apps/xray/src/xray/toolbar/package.json`

```json
{
  "name": "xray-toolbar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.4.5"
  }
}
```

#### Task 1.2: Create tsconfig.json
**File:** `apps/xray/src/xray/toolbar/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

#### Task 1.3: Create build.mjs
**File:** `apps/xray/src/xray/toolbar/build.mjs`

esbuild config for IIFE bundle with separate CSS.

#### Task 1.4: Initialize npm
```bash
cd apps/xray/src/xray/toolbar
npm install
```

### Phase 2: Core Types & Entry Point

#### Task 2.1: Create types.ts
**File:** `src/types.ts`

Define all TypeScript interfaces:
- `ToolbarMode`, `DrawingTool`, `Point`, `Rect`
- `ElementSelection`, `DrawingStroke`, `TextAnnotation`
- `CaptureState`, `ToolbarConfig`, `ToolbarResult`

#### Task 2.2: Create index.ts
**File:** `src/index.ts`

Main entry point exporting:
- `showToolbar(config)` - convenience function
- `clearToolbar()` - cleanup function
- `Toolbar` class - for advanced usage

#### Task 2.3: Create toolbar.ts
**File:** `src/toolbar.ts`

Main controller class managing:
- Mode lifecycle
- State aggregation
- Submit/cancel handling

### Phase 3: Selection Mode (Port Existing)

#### Task 3.1: Create base-mode.ts
**File:** `src/modes/base-mode.ts`

Abstract base class for all modes.

#### Task 3.2: Create selection-mode.ts
**File:** `src/modes/selection-mode.ts`

Port existing `assets/selection.js` to TypeScript:
- Hover highlighting
- Click to select
- Multi-select with Shift
- Selector generation

#### Task 3.3: Create toolbar-ui.ts
**File:** `src/ui/toolbar-ui.ts`

DOM rendering for the toolbar panel.

#### Task 3.4: Migrate CSS
**File:** `styles/selection.css`

Extract selection-specific styles from `assets/styles.css`.

#### Task 3.5: Verify Build
```bash
npm run build
# Test that selection mode works via Python
```

### Phase 4: Drawing Mode

#### Task 4.1: Create canvas-manager.ts
**File:** `src/canvas/canvas-manager.ts`

Canvas overlay lifecycle:
- Create/destroy canvas element
- Resize handling
- Drawing state management
- Export drawings as data

#### Task 4.2: Create Drawing Tools
**Files:** `src/canvas/tools/*.ts`

| Tool | Behavior |
|------|----------|
| `freehand-tool.ts` | Mouse drag creates path of points |
| `arrow-tool.ts` | Click-drag creates arrow from start to end |
| `rectangle-tool.ts` | Click-drag creates rectangle |
| `ellipse-tool.ts` | Click-drag creates ellipse |

#### Task 4.3: Create drawing-mode.ts
**File:** `src/modes/drawing-mode.ts`

Drawing mode implementation:
- Tool selection
- Color/stroke width picker
- Canvas event handling

#### Task 4.4: Create tool-palette.ts
**File:** `src/ui/tool-palette.ts`

UI for selecting drawing tools and colors.

#### Task 4.5: Add canvas.css
**File:** `styles/canvas.css`

Canvas overlay and tool palette styles.

### Phase 5: Annotation Mode

#### Task 5.1: Create annotation-manager.ts
**File:** `src/annotations/annotation-manager.ts`

Text annotation management:
- Create/update/delete annotations
- Position tracking
- Serialization

#### Task 5.2: Create annotation-mode.ts
**File:** `src/modes/annotation-mode.ts`

Annotation mode implementation:
- Click to place text label
- Edit existing annotations
- Drag to reposition

#### Task 5.3: Add annotations.css
**File:** `styles/annotations.css`

Text label styles.

### Phase 6: Python Integration

#### Task 6.1: Update manager.py
**File:** `apps/xray/src/xray/toolbar/manager.py`

```python
def _load_asset(self, filename: str) -> str:
    """Load from dist/ folder."""
    dist = importlib.resources.files("xray.toolbar.dist")
    return (dist / filename).read_text()

async def show_toolbar(
    self,
    prompt: str = "Select an element",
    initial_mode: str = "selection",
    allow_mode_switch: bool = True,
) -> dict:
    """Show full toolbar with all modes."""
    ...
```

#### Task 6.2: Update pyproject.toml
**File:** `apps/xray/pyproject.toml`

Include dist/ folder in package:
```toml
[tool.hatch.build.targets.wheel.force-include]
"src/xray/toolbar/dist" = "xray/toolbar/dist"
```

#### Task 6.3: Add new MCP tool (optional)
Consider adding `show_annotation_toolbar` tool for full annotation workflow.

---

## Files Summary

### Files to Create (20+)

| Category | Files |
|----------|-------|
| Project Config | `package.json`, `tsconfig.json`, `build.mjs`, `.gitignore` |
| Core | `src/index.ts`, `src/types.ts`, `src/toolbar.ts` |
| Modes | `src/modes/base-mode.ts`, `selection-mode.ts`, `drawing-mode.ts`, `annotation-mode.ts` |
| Canvas | `src/canvas/canvas-manager.ts`, `tools/*.ts` (4 files) |
| Annotations | `src/annotations/annotation-manager.ts` |
| UI | `src/ui/toolbar-ui.ts`, `tool-palette.ts` |
| Styles | `styles/index.css`, `toolbar.css`, `selection.css`, `canvas.css`, `annotations.css` |

### Files to Modify

| File | Changes |
|------|---------|
| `manager.py` | Load from dist/, add `show_toolbar()` method |
| `pyproject.toml` | Include dist/ in wheel |

---

## Build & Development

### Commands

```bash
cd apps/xray/src/xray/toolbar

# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### Output

```
dist/
├── xray-toolbar.js    # ~50-100KB minified IIFE bundle
└── xray-toolbar.css   # ~5-10KB minified CSS
```

---

## Future Considerations

1. **Screenshot with annotations**: Python can composite drawings onto Playwright screenshots using Pillow
2. **Undo/Redo**: Drawing canvas can maintain history stack
3. **Export formats**: Support SVG export for vector quality
4. **Collaborative mode**: WebSocket support for shared annotations
5. **Toolbar themes**: CSS variables for light/dark themes

---

## Acceptance Criteria

- [ ] npm project builds successfully with `npm run build`
- [ ] Selection mode works identically to current implementation
- [ ] Drawing mode allows freehand, arrows, rectangles, ellipses
- [ ] Annotation mode allows placing and editing text labels
- [ ] Mode switching works without losing state
- [ ] Python `show_toolbar()` returns combined state from all modes
- [ ] Existing `show_selection_toolbar()` API remains backward compatible
- [ ] Bundle size is reasonable (<100KB JS, <10KB CSS)

---
title: XRay Architecture
date: 2024-12-24
status: active
iteration: 2
author: Esteban & Claude
tags: [architecture, xray, mcp, browser-automation, toolbar]
changelog:
  - 2024-12-25 (v2): Updated to reflect multi-panel architecture (DES-005)
  - 2024-12-24 (v1): Initial architecture document
---

# XRay Architecture

## Overview

XRay is an **MCP (Model Context Protocol) server** for browser automation that enables AI agents to interact with web pages through a shared browser session. It consists of a Python MCP server layer and a TypeScript browser UI injected into pages.

Key capabilities:
- **Browser Control**: Start/stop browsers, connect to existing browsers via CDP
- **Interactive Toolbar**: Drawing, annotations, element selection, snapshots
- **Panel System**: Draggable floating panels with tab dock
- **Centralized State**: StateStore for shared state across panels

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Python MCP Server                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  server.py ──► Handler Registry                                         │
│                    │                                                    │
│                    ├── BrowserHandler      (lifecycle)                  │
│                    ├── NavigationHandler   (navigation)                 │
│                    ├── InteractionHandler  (DOM interaction)            │
│                    ├── CaptureHandler      (screenshots)                │
│                    └── SelectionHandler    (toolbar interaction)        │
│                                                                         │
│  toolbar/manager.py ──► Injects TypeScript bundle via Playwright        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ page.evaluate()
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TypeScript (Browser Injection)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  XRay (top-level controller)                                            │
│    │                                                                    │
│    ├── StateStore (centralized state management)                        │
│    │     └── toolbar: ToolbarState                                      │
│    │                                                                    │
│    ├── TabDock (panel registry, lateral tabs)                           │
│    │                                                                    │
│    └── ToolsController                                                  │
│          ├── ToolsPanel (extends Panel) ─► UI                           │
│          ├── SvgManager (drawings & annotations)                        │
│          ├── SelectionManager (DOM element selection)                   │
│          └── SnapshotManager (screenshot capture)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Python Layer

| Component | Technology | Purpose |
|:----------|:-----------|:--------|
| MCP Server | `mcp` library | Model Context Protocol implementation |
| Browser Automation | Playwright | Browser lifecycle, page interaction |
| Dependency Injection | Dataclass-based | Simple DI via `XRayContext` |
| Build Hook | Hatch | Compile TypeScript before wheel |

### TypeScript Layer

| Component | Technology | Purpose |
|:----------|:-----------|:--------|
| Build Tool | esbuild | Fast IIFE bundling |
| Type System | TypeScript | Type safety |
| Icons | Lucide | SVG icon library |
| Selectors | css-selector-generator | Generate CSS selectors from DOM elements |
| Screenshots | html2canvas | Capture page as image |

**Why no React?** The TypeScript bundle is injected into pages via MCP (`page.evaluate()`). A lightweight vanilla TypeScript bundle loads instantly without blocking the page. React would add ~140kb+ and initialization overhead, degrading the user experience on every page injection.

## Project Structure

```
apps/xray/
├── webtools/                         # TypeScript project (npm)
│   ├── src/
│   │   ├── index.ts                  # IIFE entry point (window.XRayToolbar)
│   │   ├── xray.ts                   # XRay controller (owns StateStore, TabDock)
│   │   ├── types.ts                  # Type definitions
│   │   ├── state/
│   │   │   ├── index.ts
│   │   │   └── store.ts              # StateStore implementation
│   │   ├── tools/                    # Tools panel
│   │   │   ├── controller.ts         # ToolsController
│   │   │   ├── panel.ts              # ToolsPanel (extends Panel)
│   │   │   ├── svg-manager.ts        # Drawings & annotations
│   │   │   ├── selection-manager.ts  # DOM element selection
│   │   │   └── snapshot-manager.ts   # Screenshot capture
│   │   └── ui/
│   │       ├── panel.ts              # Base Panel class
│   │       ├── tab-dock.ts           # Tab dock system
│   │       ├── icons.ts              # Lucide icon helpers
│   │       └── index.ts              # UI exports
│   ├── styles/                       # CSS files
│   ├── build.mjs                     # esbuild config
│   └── package.json
├── src/xray/
│   ├── server.py                     # MCP server entry point
│   ├── context.py                    # DI context (XRayContext)
│   ├── browser.py                    # BrowserManager (Playwright)
│   ├── handlers/                     # MCP tool handlers
│   │   ├── __init__.py               # Handler registry
│   │   ├── base.py                   # BaseHandler abstract class
│   │   ├── browser.py                # Browser lifecycle tools
│   │   ├── navigation.py             # Navigation tools
│   │   ├── interaction.py            # DOM interaction tools
│   │   ├── capture.py                # Screenshot tool
│   │   └── selection.py              # Toolbar interaction tools
│   ├── toolbar/
│   │   └── manager.py                # Python manager for injection
│   └── webtools_dist/                # Built JS/CSS (included in wheel)
│       ├── __init__.py
│       ├── xray-toolbar.js
│       └── xray-toolbar.css
├── hatch_build.py                    # Build hook - compiles webtools
├── pyproject.toml
└── README.md
```

## Key Patterns

### 1. Handler Pattern (Python)

All MCP tools are implemented as handlers extending `BaseHandler`:

```python
class BaseHandler(ABC):
    @abstractmethod
    def get_tools(self) -> list[Tool]:
        """Return tool definitions with JSON schemas"""
        pass

    @abstractmethod
    async def handle(self, name: str, arguments: dict) -> list[Content] | None:
        """Handle tool invocation, return None if not handled"""
        pass
```

Handlers are registered in `handlers/__init__.py` and auto-discovered by the server.

### 2. XRay Controller (TypeScript)

Top-level orchestrator that owns shared resources:

```typescript
class XRay {
  private store: StateStore;
  private tabDock: TabDock;
  private panels: Map<string, Panel>;

  registerPanel(id: string, panel: Panel): void;
  show(): void;
  hide(): void;
  getStore(): StateStore;
}
```

### 3. StateStore (TypeScript)

Centralized state management with subscriptions:

```typescript
class StateStore {
  get<K extends StateKey>(key: K): XRayState[K];
  set<K extends StateKey>(key: K, value: XRayState[K]): void;
  update<K extends StateKey>(key: K, updater: (current) => XRayState[K]): void;
  subscribe<K extends StateKey>(key: K, listener: StateListener): Unsubscribe;
  save(): void;    // Persist to sessionStorage
  restore(): void; // Load from sessionStorage
}
```

### 4. Panel Abstraction (TypeScript)

Reusable base class for draggable floating panels:

```typescript
abstract class Panel {
  protected config: PanelConfig;
  protected element: HTMLElement | null;
  protected isExpanded: boolean;
  protected position: { x: number; y: number };

  render(): void;
  destroy(): void;
  expand(): void;
  collapse(): void;
  toggle(): void;

  protected abstract getContentHTML(): string;
  protected abstract attachContentEvents(): void;
}
```

### 5. Manager Pattern (TypeScript)

Domain-specific managers handle distinct concerns:

| Manager | Responsibility |
|:--------|:---------------|
| `SvgManager` | Drawing strokes, annotations, selection mode |
| `SelectionManager` | DOM element highlighting and selection |
| `SnapshotManager` | Screenshot capture with html2canvas |

### 6. TabDock (TypeScript)

Fixed container on screen edge with vertical tabs for panel switching:

```typescript
class TabDock {
  addTab(tab: TabConfig): void;
  removeTab(id: string): void;
  render(): void;
  togglePanel(tab: TabConfig): void;
}
```

## Build System

The TypeScript bundle is compiled during Python wheel creation:

1. `hatch_build.py` hook runs `npm run build` in `webtools/`
2. esbuild outputs to `src/xray/webtools_dist/`
3. Python uses `importlib.resources` to load bundled assets
4. Assets are included in the wheel automatically

## MCP Tools

| Handler | Tools |
|:--------|:------|
| Browser | `browser_start`, `browser_connect`, `browser_stop`, `list_pages`, `select_page` |
| Navigation | `goto`, `page_info` |
| Interaction | `click`, `fill`, `get_text`, `get_html`, `wait_for`, `execute_js`, `inject_css` |
| Capture | `screenshot` |
| Selection | `show_toolbar`, `wait_for_selection`, `get_toolbar_state`, `clear_highlights`, `get_snapshot`, `save_snapshot` |

## State Management

State is managed centrally via `StateStore`:

```typescript
interface XRayState {
  toolbar: ToolbarState;
  // Future: palette, history, etc.
}

interface ToolbarState {
  selectedElements: ElementSelection[];
  drawings: DrawingStroke[];
  annotations: TextAnnotation[];
  snapshots: Snapshot[];
  currentTool: Tool;
  currentColor: string;
  currentStrokeWidth: number;
}
```

State is persisted to `sessionStorage` per URL.

## Adding New Panels

To add a new panel to XRay:

1. **Create a controller** in `webtools/src/{feature}/controller.ts`:
   ```typescript
   export class MyController {
     private store: StateStore;
     private panel: MyPanel;

     constructor(store: StateStore) {
       this.store = store;
       this.panel = new MyPanel(this);
     }

     getPanel(): Panel { return this.panel; }
     activate(): void { /* setup */ }
     deactivate(): void { /* cleanup */ }
   }
   ```

2. **Create a panel** extending `Panel` in `webtools/src/{feature}/panel.ts`:
   ```typescript
   export class MyPanel extends Panel {
     constructor(controller: MyController) {
       super({ id: 'my-panel', title: 'My Panel', ... });
     }

     protected getContentHTML(): string { return '<div>...</div>'; }
     protected attachContentEvents(): void { /* event handlers */ }
   }
   ```

3. **Add state slice** to `webtools/src/types.ts`:
   ```typescript
   export interface XRayState {
     toolbar: ToolbarState;
     myFeature: MyFeatureState;  // Add new slice
   }
   ```

4. **Register in `index.ts`**:
   ```typescript
   const myController = new MyController(xray.getStore());
   xray.registerPanel('my-feature', myController.getPanel(), {
     icon: 'icon-name',
     label: 'My Feature',
   });
   ```

5. **Add styles** in `webtools/styles/` and import in `styles/index.css`

## Related Documentation

- [DES-005: Multi-Panel Architecture](./designs/005-multi-panel-architecture.md) - Current architecture refactoring
- [DES-004: Color Palette Panel](./designs/004-color-palette-panel.md) - Color palette feature
- [DES-003: Panel System](./designs/003-panel-system.md) - Panel abstraction design
- [DES-002: Toolbar NPM Project](./designs/002-toolbar-npm-project.md) - TypeScript toolbar setup
- [DES-001: Modular Architecture](./designs/001-modular-architecture.md) - Python handler pattern

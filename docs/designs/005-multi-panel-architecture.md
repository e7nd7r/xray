---
title: "DES-005: Multi-Panel Architecture"
date: 2024-12-24
status: implemented
iteration: 5
author: Esteban & Claude
tags: [design, xray, architecture, refactoring, panels, state-management]
priority: high
epic: EPIC-001
related_adrs: []
related_designs: [DES-003]
changelog:
  - 2025-01-02 (v5): Updated nomenclature to EPIC001-F1-XX format
  - 2024-12-25 (v4): All tasks complete - integration testing done
  - 2024-12-25 (v3): Updated to reflect actual implementation
  - 2024-12-25 (v2): Focused scope - multi-panel core only
  - 2024-12-24 (v1): Initial design
---

# DES-005: Multi-Panel Architecture

## Overview

Refactor the XRay TypeScript layer to support multiple independent panels with shared state management.

**Goal**: Enable adding new panels without modifying core toolbar code, with shared state.

**Non-goals**:
- Changing the Python MCP server structure
- Implementing specific panel features (covered in separate designs)
- UI/UX changes to existing toolbar

---

## Scope

### In Scope

1. `XRay` top-level controller class
2. `StateStore` for centralized state management
3. `Panel` base class with store integration
4. `TabDock` panel registration system
5. Refactoring `Toolbar` to work with new architecture

### Out of Scope

- Panel-specific features (each panel has its own design doc)
- New MCP tools (each panel design defines its own)

---

## Implemented Architecture

### Component Diagram

```
XRay (top-level controller)
│
├── StateStore (central state)
│     └── toolbar: ToolbarState
│
├── TabDock (panel registry)
│     └── ToolsPanel (registered via ToolsController.getPanel())
│
└── ToolsController (tools panel logic)
      ├── ToolsPanel (UI)
      ├── SvgManager (drawings, annotations)
      ├── SelectionManager (element selection)
      └── SnapshotManager (page captures)
```

### File Structure (Implemented)

The TypeScript project was moved from `src/xray/toolbar/` to `apps/xray/webtools/`:

```
apps/xray/
├── webtools/                    # TypeScript project (npm)
│   ├── src/
│   │   ├── index.ts             # IIFE entry point
│   │   ├── xray.ts              # XRay controller (owns TabDock, StateStore)
│   │   ├── types.ts             # Types including XRayState
│   │   ├── state/
│   │   │   ├── index.ts
│   │   │   └── store.ts         # StateStore implementation
│   │   ├── tools/               # Tools panel (formerly toolbar)
│   │   │   ├── controller.ts    # ToolsController (renamed from Toolbar)
│   │   │   ├── panel.ts         # ToolsPanel (UI, extends Panel)
│   │   │   ├── svg-manager.ts   # Drawings and annotations
│   │   │   ├── selection-manager.ts
│   │   │   └── snapshot-manager.ts
│   │   └── ui/
│   │       ├── panel.ts         # Base Panel class
│   │       ├── tab-dock.ts      # Tab dock component
│   │       ├── icons.ts         # Lucide icon helpers
│   │       └── index.ts         # UI exports
│   ├── styles/                  # CSS files
│   ├── build.mjs                # esbuild config
│   └── package.json
├── src/xray/
│   ├── webtools_dist/           # Built JS/CSS (included in wheel)
│   │   ├── __init__.py
│   │   ├── xray-toolbar.js
│   │   └── xray-toolbar.css
│   └── toolbar/
│       └── manager.py           # Python ToolbarManager (loads dist assets)
├── hatch_build.py               # Hatch hook - builds webtools before wheel
└── pyproject.toml
```

### Build System

The build system uses Hatch build hooks to compile TypeScript before wheel creation:

1. `hatch_build.py` runs `npm run build` in `webtools/`
2. Build outputs to `src/xray/webtools_dist/` (inside Python package)
3. Python uses `importlib.resources` to load bundled assets
4. Assets are included in the wheel via standard packaging

---

## Design Details

### 1. XRay Controller (Implemented)

Top-level class that orchestrates everything. Owns StateStore and TabDock.

```typescript
// src/xray.ts
export class XRay {
  private store: StateStore;
  private tabDock: TabDock;
  private panels: Map<string, Panel> = new Map();

  constructor(config: XRayConfig = {}) {
    this.store = new StateStore();
    this.tabDock = new TabDock(config.tabDock);
    if (config.persistState) {
      this.store.restore();
    }
  }

  registerPanel(id: string, panel: Panel, options?: { icon?: string; label?: string }): void {
    // Give panel access to store if it has setStore method
    if ('setStore' in panel) {
      panel.setStore(this.store);
    }
    this.panels.set(id, panel);
    this.tabDock.addTab({ id, label, icon, panel });
  }

  show(): void { /* render tabDock and panels */ }
  hide(): void { /* destroy panels and tabDock */ }
  destroy(): void { /* cleanup */ }
  getStore(): StateStore { return this.store; }
}
```

### 2. StateStore (Implemented)

Central state management with subscriptions and persistence:

```typescript
// src/state/store.ts
export class StateStore {
  private state: XRayState;
  private listeners: Map<StateKey, Set<StateListener<any>>> = new Map();

  get<K extends StateKey>(key: K): XRayState[K];
  set<K extends StateKey>(key: K, value: XRayState[K]): void;
  update<K extends StateKey>(key: K, updater: (current: XRayState[K]) => XRayState[K]): void;
  subscribe<K extends StateKey>(key: K, listener: StateListener<XRayState[K]>): Unsubscribe;
  save(): void;    // Persist to sessionStorage
  restore(): void; // Load from sessionStorage
}
```

### 3. ToolsController (Implemented)

Renamed from `Toolbar`. Uses StateStore instead of managing its own state:

```typescript
// src/tools/controller.ts
export class ToolsController {
  private store: StateStore;
  private panel: ToolsPanel;
  private svgManager: SvgManager;
  private selectionManager: SelectionManager;
  private snapshotManager: SnapshotManager;

  constructor(store: StateStore, config: ToolbarConfig = {}) {
    this.store = store;
    // Initialize managers (pass `this` as controller reference)
    this.svgManager = new SvgManager(this);
    this.selectionManager = new SelectionManager(this);
    this.snapshotManager = new SnapshotManager(this);
    this.panel = new ToolsPanel(this, { toolbarConfig: this.config });
  }

  getPanel(): Panel { return this.panel; }
  activate(): void { /* activate tools, render visuals */ }
  deactivate(): void { /* cleanup */ }

  // State accessors - all use store
  getToolbarState(): ToolbarState { return this.store.get('toolbar'); }
  setTool(tool: Tool): void {
    this.store.update('toolbar', s => ({ ...s, currentTool: tool }));
  }
  addDrawing(drawing: DrawingStroke): void {
    this.store.update('toolbar', s => ({ ...s, drawings: [...s.drawings, drawing] }));
  }
  // ... etc
}
```

### 4. ToolsPanel (Implemented)

Extends Panel base class, provides toolbar UI:

```typescript
// src/tools/panel.ts
export class ToolsPanel extends Panel {
  private controller: ToolsController;

  constructor(controller: ToolsController, config: ToolsPanelConfig) {
    super({ id: 'tools', title: 'Tools', ... });
    this.controller = controller;
  }

  protected getContentHTML(): string { /* render tools UI */ }
  protected attachContentEvents(): void { /* button handlers */ }
  updateToolIndicator(tool: Tool): void;
  updateColorIndicator(color: string): void;
  updateSnapshotList(): void;
}
```

---

## Implementation Checklist

**Epic:** [EPIC-001] Multi-Panel Architecture
**Feature:** [EPIC001-F1] State Management & Controller

| Task | Description | Status |
|------|-------------|--------|
| EPIC001-F1-01 | Create StateStore class | ✅ Done |
| EPIC001-F1-02 | Create XRay controller | ✅ Done |
| EPIC001-F1-03 | Add store integration to Panel | ✅ Done |
| EPIC001-F1-04 | Refactor Toolbar to use StateStore | ✅ Done |
| EPIC001-F1-05 | Update entry point with backward compat | ✅ Done |
| EPIC001-F1-06 | Integration testing | ✅ Done |
| EPIC001-F1-07 | Fix state persistence | ✅ Done |

### Task Details

#### EPIC001-F1-01: Create StateStore class
- [x] Create `src/state/store.ts` - StateStore class
- [x] Create `src/state/index.ts` - exports
- [x] Update `src/types.ts` - add XRayState types
- [x] Add unit tests (39 tests passing)

#### EPIC001-F1-02: Create XRay controller
- [x] Create `src/xray.ts` - XRay controller
- [x] Implement panel registration
- [x] Implement lifecycle methods (show/hide/destroy)
- [x] Add unit tests

#### EPIC001-F1-03: Add store integration to Panel
- [x] Update `src/ui/panel.ts` - base Panel class exists
- [x] XRay passes store to panels that have `setStore` method
- [x] Subscription cleanup handled in Panel.destroy()

#### EPIC001-F1-04: Refactor Toolbar to use StateStore
- [x] Move TypeScript project to `apps/xray/webtools/`
- [x] Rename `Toolbar` → `ToolsController`
- [x] Move managers to `tools/` directory
- [x] Update all state access to use `store.get/update('toolbar')`
- [x] Remove old `saveState()` calls (StateStore handles persistence)
- [x] Add `updateDrawingColor()`, `updateAnnotationColor()` methods
- [x] Remove dead code (annotations/, canvas/ directories)
- [x] Add hatch build hook for wheel creation
- [x] Update CI workflow path

#### EPIC001-F1-05: Update entry point with backward compat
*Completed as part of EPIC001-F1-04*
- [x] `src/index.ts` exports `window.XRayToolbar` API (via IIFE default export)
- [x] Legacy API preserved: `initToolbar`, `showToolbar`, `getState`, `clearToolbar`, `isVisible`, `waitForDone`
- [x] New classes exported: `XRay`, `ToolsController`, `ToolsPanel`

#### EPIC001-F1-06: Integration testing
- [x] Test existing toolbar functionality unchanged
- [x] Test state persistence across page loads (partial - visual re-rendering needs follow-up)
- [x] Test panel registration
- [x] Browser testing with MCP server

**Bugs found and fixed:**
- Tab dock default side: `left` → `right`
- CSS selector mismatch: `#xray-toolbar` → `#panel-tools`

#### EPIC001-F1-07: Fix state persistence
- [x] Visual re-rendering from restored state

---

## Bundle Impact

| Before | After | Delta |
|:-------|:------|:------|
| ~50kb | ~270kb | +220kb |

Note: Bundle size increased due to including all dependencies. Consider tree-shaking optimizations in future.

---

## Open Questions

1. ~~**State persistence**: Should we use `sessionStorage` (current) or `localStorage` for longer persistence?~~ → Using sessionStorage (per-session state).

2. **Bundle size**: Current bundle is larger than expected. Consider splitting or lazy-loading in future.

---

## References

- [Architecture](../architecture.md) - Current system architecture
- [DES-003: Panel System](./003-panel-system.md) - Panel abstraction

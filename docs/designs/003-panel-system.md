---
title: "DES-003: XRay Panel System"
date: 2024-12-24
status: superseded
iteration: 2
author: Claude
tags: [design, xray, panels, ui]
priority: medium
related_adrs: []
related_designs: []
changelog:
  - 2025-01-02 (v2): Added YAML frontmatter, marked as superseded by DES-005
  - 2024-12-24 (v1): Initial design - Panel abstraction concept
---

# DES-003: XRay Panel System

> **Note:** This design has been superseded by [DES-005: Multi-Panel Architecture](./005-multi-panel-architecture.md) which extends the panel concept with centralized state management.

## Summary

Refactor the XRay toolbar into a Panel abstraction that supports:
- Draggable floating panels with lateral tabs for expand/collapse
- Multiple panels with different sizes and content
- Configurable tab position (left or right side)

## Motivation

The current toolbar is a monolithic UI component. To support more complex workflows (multiple tool palettes, separate snapshot panel, etc.), we need a reusable Panel abstraction where each panel:
- Can be positioned anywhere on screen
- Has a small tab that remains visible when collapsed
- Can be expanded/collapsed by clicking the tab
- Maintains its position when toggled

## Design

### Component Structure

```
src/
├── ui/
│   ├── panel.ts           # Base Panel class
│   ├── toolbar-panel.ts   # Toolbar-specific panel (refactored from toolbar-ui.ts)
│   └── icons.ts           # Existing
├── toolbar.ts             # Updated to use ToolbarPanel
└── types.ts               # Add Panel types
```

### Panel Configuration

```typescript
interface PanelConfig {
  id: string;
  title: string;
  icon?: string;                        // Icon for the tab
  initialPosition?: { x: number; y: number };
  initialExpanded?: boolean;
  tabSide?: 'left' | 'right';           // Which side the tab appears on
  width?: number;                       // Panel width when expanded
  minHeight?: number;
  maxHeight?: number;
}
```

### Panel Class

```typescript
abstract class Panel {
  protected config: PanelConfig;
  protected element: HTMLElement | null = null;
  protected isExpanded: boolean = true;
  protected position: { x: number; y: number };

  // Lifecycle
  render(): void;
  destroy(): void;

  // State
  expand(): void;
  collapse(): void;
  toggle(): void;

  // Dragging
  private setupDragging(): void;
  private onDragStart(e: MouseEvent): void;
  private onDragMove(e: MouseEvent): void;
  private onDragEnd(e: MouseEvent): void;

  // Content (override in subclasses)
  protected abstract getContentHTML(): string;
  protected abstract attachContentEvents(): void;
}
```

### DOM Structure

#### Expanded Panel
```html
<div class="xray-panel" id="panel-{id}" data-expanded="true">
  <!-- Lateral Tab (always visible, attached to edge) -->
  <div class="panel-tab" data-side="left">
    <span class="tab-icon">{icon}</span>
  </div>

  <!-- Panel Content (draggable, visible when expanded) -->
  <div class="panel-content">
    <div class="panel-header" id="panel-{id}-drag-handle">
      <span class="panel-title">{title}</span>
      <span class="panel-drag-indicator"></span>
    </div>
    <div class="panel-body">
      <!-- Subclass content here -->
    </div>
  </div>
</div>
```

#### Collapsed Panel
```html
<div class="xray-panel" id="panel-{id}" data-expanded="false">
  <div class="panel-tab" data-side="left">
    <span class="tab-icon">{icon}</span>
  </div>
  <!-- panel-content hidden via CSS -->
</div>
```

### CSS Structure

```css
/* Base panel */
.xray-panel {
  position: fixed;
  z-index: 999999;
  display: flex;
  user-select: none;
}

/* Tab - small lateral handle */
.panel-tab {
  width: 28px;
  height: 48px;
  background: #1a1a2e;
  border-radius: 8px 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  transition: background 0.15s;
}

.panel-tab:hover {
  background: #2a2a3e;
  color: #fff;
}

/* Right-side tab */
.panel-tab[data-side="right"] {
  border-radius: 0 8px 8px 0;
  order: 1;
}

/* Panel content */
.panel-content {
  background: #1a1a2e;
  border-radius: 0 12px 12px 0;
  min-width: 260px;
  max-width: 300px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

/* Left tab = content on right */
.xray-panel:has(.panel-tab[data-side="left"]) .panel-content {
  border-radius: 0 12px 12px 0;
}

/* Right tab = content on left */
.xray-panel:has(.panel-tab[data-side="right"]) .panel-content {
  border-radius: 12px 0 0 12px;
}

/* Collapsed state */
.xray-panel[data-expanded="false"] .panel-content {
  display: none;
}

.xray-panel[data-expanded="false"] .panel-tab {
  border-radius: 8px;
}
```

## Behavior

### Tab Behavior
- **Click tab** - Toggle expand/collapse
- **Tab always visible** - Even when panel is collapsed
- **Tab position** - Configurable left or right side

### Panel Behavior
- **Drag header** - Move entire panel (tab + content)
- **Collapsed** - Only tab visible, positioned where panel was
- **Expanded** - Full panel content visible next to tab
- **Viewport bounds** - Panel constrained to stay within window

### Multiple Panels (Future)
- Each panel has independent position/state
- Panels can overlap (z-index stacking)
- Future: dock/snap behavior

## Implementation Plan

### Phase 1: Create Base Panel Class
1. Create `src/ui/panel.ts` with:
   - `PanelConfig` interface
   - `Panel` class with dragging, expand/collapse, render
   - Tab click handler for toggle
   - Viewport bounds constraint
   - Abstract `getContentHTML()` and `attachContentEvents()` methods

2. Create `styles/panel.css` with base panel and tab styles

### Phase 2: Create ToolbarPanel
1. Create `src/ui/toolbar-panel.ts` that extends Panel
2. Move toolbar-specific content rendering to `getContentHTML()`
3. Move event attachment to `attachContentEvents()`
4. Keep tool/color/stroke/snapshot UI logic

### Phase 3: Update Toolbar Controller
1. Update `src/toolbar.ts` to use `ToolbarPanel` instead of `ToolbarUI`
2. Ensure all existing functionality works

### Phase 4: Add Panel Types
1. Update `src/types.ts` with Panel-related types

## File Changes

### New Files
- `src/ui/panel.ts` - Base Panel class (~200 lines)
- `src/ui/toolbar-panel.ts` - Toolbar-specific panel (~300 lines)
- `styles/panel.css` - Panel styling (~100 lines)

### Modified Files
- `src/toolbar.ts` - Use ToolbarPanel instead of ToolbarUI
- `src/types.ts` - Add Panel types
- `styles/index.css` - Import panel.css
- `src/ui/index.ts` - Export Panel, ToolbarPanel

### Removed/Deprecated
- `src/ui/toolbar-ui.ts` - Replaced by toolbar-panel.ts

## Current Features to Preserve

From the existing toolbar:
- Dragging (mousedown/mousemove/mouseup on header)
- Viewport constraint (keep panel in bounds)
- Position persistence
- Tool/color/stroke selection UI
- Snapshot list with previews
- Waiting state UI

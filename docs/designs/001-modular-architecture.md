---
title: "DES-001: XRay Modular Architecture"
date: 2025-12-23
status: implemented
iteration: 1
author: Esteban Dorador
tags: [design, xray, mcp, browser-automation, refactoring]
priority: medium
related_adrs: []
related_designs: []
changelog:
  - 2025-12-23 (v1): Initial design - modularize MCP server with DI and toolbar module
---

# DES-001: XRay Modular Architecture

## Overview

This document defines the implementation plan for refactoring the XRay MCP server from a monolithic structure to a modular architecture. The goal is to improve maintainability, enable future extensibility (drawing tools, annotations), and separate concerns using dependency injection.

**Key Objectives:**
- Separate tool handlers into domain-specific modules
- Extract toolbar functionality into a dedicated module with external JS/CSS assets
- Use simple dataclass-based dependency injection
- Prepare architecture for future interactive features (drawing, annotations)

---

## Current State

### File Structure
```
src/xray/
├── __init__.py
├── server.py      # 419 lines - all tool definitions + handlers
└── browser.py     # 387 lines - browser ops + embedded toolbar JS/CSS
```

### Problems
| Issue | Impact |
|-------|--------|
| Monolithic `server.py` | Hard to navigate, all 17 tools in one file |
| Embedded JS/CSS in Python | No syntax highlighting, hard to edit |
| Global browser instance | No proper DI, tight coupling |
| Mixed concerns in `browser.py` | Browser lifecycle + toolbar logic combined |

---

## Proposed Architecture

### Directory Structure

```
src/xray/
├── __init__.py
├── server.py              # Thin MCP server wiring
├── browser.py             # BrowserManager - browser lifecycle only
├── context.py             # DI context (simple dataclass)
├── handlers/
│   ├── __init__.py        # Handler registry
│   ├── base.py            # BaseHandler with context injection
│   ├── browser.py         # browser_start, browser_connect, browser_stop, list_pages, select_page
│   ├── navigation.py      # goto, page_info
│   ├── interaction.py     # click, fill, get_text, get_html, wait_for, execute_js, inject_css
│   ├── capture.py         # screenshot
│   └── selection.py       # wait_for_selection, clear_highlights
├── toolbar/
│   ├── __init__.py
│   ├── manager.py         # ToolbarManager - inject/show/hide/cleanup
│   └── assets/
│       ├── styles.css     # CSS for toolbar and highlights
│       └── selection.js   # JS for selection mode
└── tools/
    ├── __init__.py
    └── definitions.py     # All Tool() schema definitions
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `server.py` | MCP server setup, routes tool calls to handlers |
| `context.py` | DI container holding shared dependencies |
| `handlers/` | Domain-specific tool implementations |
| `toolbar/` | UI injection and interaction management |
| `tools/` | Tool schema definitions (JSON schemas) |

---

## Design Decisions

### DD-1: Simple Dataclass DI

Use a simple dataclass for dependency injection rather than a formal container pattern.

```python
from dataclasses import dataclass
from .browser import BrowserManager

@dataclass
class XRayContext:
    browser: BrowserManager
```

**Rationale:** The project is small with few dependencies. A dataclass is explicit, type-safe, and easy to understand. Can evolve to a container pattern if needed.

### DD-2: External JS/CSS Assets

Store toolbar JavaScript and CSS in external files (`toolbar/assets/`) rather than embedded Python strings.

**Rationale:**
- Proper syntax highlighting in editors
- Easier to edit and debug
- Can use JS/CSS linters
- Load via `importlib.resources` for clean package access

### DD-3: Handler Registry Pattern

Handlers register themselves with the server, providing both tool definitions and implementations.

```python
class BaseHandler:
    def __init__(self, ctx: XRayContext):
        self.ctx = ctx
        self.browser = ctx.browser

    def get_tools(self) -> list[Tool]:
        """Return tool definitions this handler provides."""
        ...

    async def handle(self, name: str, args: dict) -> list[TextContent | ImageContent]:
        """Handle a tool call."""
        ...
```

**Rationale:** Each handler owns its tools completely - both schema and implementation. Easy to add new handlers without modifying server.py.

---

## Implementation Plan

### Phase 1: Create Infrastructure

#### Task 1.1: Create DI Context
**File:** `src/xray/context.py`

```python
from dataclasses import dataclass
from .browser import BrowserManager

@dataclass
class XRayContext:
    browser: BrowserManager
```

#### Task 1.2: Create Handler Base Class
**File:** `src/xray/handlers/base.py`

```python
from abc import ABC, abstractmethod
from mcp.types import Tool, TextContent, ImageContent
from ..context import XRayContext

class BaseHandler(ABC):
    def __init__(self, ctx: XRayContext):
        self.ctx = ctx
        self.browser = ctx.browser

    @abstractmethod
    def get_tools(self) -> list[Tool]:
        """Return tool definitions."""
        pass

    @abstractmethod
    async def handle(self, name: str, args: dict) -> list[TextContent | ImageContent]:
        """Handle a tool call. Return None if not handled."""
        pass
```

#### Task 1.3: Create Handler Registry
**File:** `src/xray/handlers/__init__.py`

```python
from .base import BaseHandler
from .browser import BrowserHandler
from .navigation import NavigationHandler
from .interaction import InteractionHandler
from .capture import CaptureHandler
from .selection import SelectionHandler

ALL_HANDLERS = [
    BrowserHandler,
    NavigationHandler,
    InteractionHandler,
    CaptureHandler,
    SelectionHandler,
]
```

### Phase 2: Create Toolbar Module

#### Task 2.1: Extract CSS
**File:** `src/xray/toolbar/assets/styles.css`

Extract existing toolbar CSS from `browser.py:wait_for_selection()`.

#### Task 2.2: Extract JavaScript
**File:** `src/xray/toolbar/assets/selection.js`

Extract selection mode JS from `browser.py:wait_for_selection()`.

#### Task 2.3: Create Toolbar Manager
**File:** `src/xray/toolbar/manager.py`

```python
import importlib.resources
from playwright.async_api import Page

class ToolbarManager:
    def __init__(self, page: Page):
        self.page = page

    def _load_asset(self, filename: str) -> str:
        """Load asset file content."""
        assets = importlib.resources.files("xray.toolbar.assets")
        return (assets / filename).read_text()

    async def show_selection_toolbar(self, prompt: str) -> dict:
        """Inject selection toolbar and wait for user action."""
        css = self._load_asset("styles.css")
        js = self._load_asset("selection.js")
        # Inject and execute...

    async def clear(self) -> None:
        """Remove all toolbar elements."""
        ...
```

### Phase 3: Create Handler Modules

#### Task 3.1: Browser Handler (5 tools)
**File:** `src/xray/handlers/browser.py`
- `browser_start`
- `browser_connect`
- `browser_stop`
- `list_pages`
- `select_page`

#### Task 3.2: Navigation Handler (2 tools)
**File:** `src/xray/handlers/navigation.py`
- `goto`
- `page_info`

#### Task 3.3: Interaction Handler (7 tools)
**File:** `src/xray/handlers/interaction.py`
- `click`
- `fill`
- `get_text`
- `get_html`
- `wait_for`
- `execute_js`
- `inject_css`

#### Task 3.4: Capture Handler (1 tool)
**File:** `src/xray/handlers/capture.py`
- `screenshot`

#### Task 3.5: Selection Handler (2 tools)
**File:** `src/xray/handlers/selection.py`
- `wait_for_selection`
- `clear_highlights`

### Phase 4: Refactor Server

#### Task 4.1: Update server.py
**File:** `src/xray/server.py`

```python
from mcp.server import Server
from .context import XRayContext
from .browser import BrowserManager
from .handlers import ALL_HANDLERS

def create_server() -> Server:
    server = Server("xray")
    ctx = XRayContext(browser=BrowserManager())
    handlers = [H(ctx) for H in ALL_HANDLERS]

    @server.list_tools()
    async def list_tools():
        tools = []
        for handler in handlers:
            tools.extend(handler.get_tools())
        return tools

    @server.call_tool()
    async def call_tool(name: str, arguments: dict):
        for handler in handlers:
            result = await handler.handle(name, arguments)
            if result is not None:
                return result
        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    return server
```

#### Task 4.2: Clean up browser.py
**File:** `src/xray/browser.py`

Remove `wait_for_selection()` and `clear_highlights()` methods - moved to toolbar module.

### Phase 5: Verification

#### Task 5.1: Test MCP Connection
```bash
/mcp  # Reconnect to xray
```

#### Task 5.2: Test All Tools
- `browser_connect` - Connect to Arc
- `screenshot` - Take screenshot
- `wait_for_selection` - Test toolbar appears
- Other tools as needed

---

## Files Summary

### Files to Create (14)
| File | Description |
|------|-------------|
| `src/xray/context.py` | DI context dataclass |
| `src/xray/handlers/__init__.py` | Handler registry |
| `src/xray/handlers/base.py` | Base handler class |
| `src/xray/handlers/browser.py` | Browser lifecycle handlers |
| `src/xray/handlers/navigation.py` | Navigation handlers |
| `src/xray/handlers/interaction.py` | DOM interaction handlers |
| `src/xray/handlers/capture.py` | Screenshot handler |
| `src/xray/handlers/selection.py` | Selection toolbar handlers |
| `src/xray/toolbar/__init__.py` | Toolbar module init |
| `src/xray/toolbar/manager.py` | Toolbar manager class |
| `src/xray/toolbar/assets/styles.css` | Toolbar CSS |
| `src/xray/toolbar/assets/selection.js` | Selection mode JS |
| `src/xray/tools/__init__.py` | Tools module init |
| `src/xray/tools/definitions.py` | Tool schema definitions |

### Files to Modify (2)
| File | Changes |
|------|---------|
| `src/xray/server.py` | Simplify to handler wiring |
| `src/xray/browser.py` | Remove toolbar code |

---

## Future Considerations

This architecture enables future enhancements:

1. **Drawing Tools**: Add `toolbar/assets/drawing.js` and `DrawingHandler`
2. **Annotations**: Add annotation mode to toolbar manager
3. **Multi-page Support**: Handlers already receive context with browser access
4. **Custom Themes**: CSS variables in `styles.css` for theming

---

## Acceptance Criteria

- [x] All 17 existing tools work after refactoring
- [x] Toolbar appears and works for element selection
- [x] JS/CSS load correctly from external files
- [x] No regressions in CDP connection to Arc
- [x] Code passes any linting/type checks

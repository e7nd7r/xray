# XRay

Browser automation MCP server — control browsers from AI agents via [Model Context Protocol](https://modelcontextprotocol.io/).

XRay gives AI agents (Claude Code, Cursor, etc.) the ability to start browsers, navigate pages, take screenshots, interact with the DOM, and annotate pages through an interactive toolbar.

## Features

- **Browser lifecycle** — Start/stop Chromium, connect to existing browsers via CDP
- **Navigation & interaction** — Navigate URLs, click elements, fill forms, execute JS, inject CSS
- **Screenshots** — Full-page and viewport captures returned as images
- **Interactive toolbar** — Drawing annotations, element selection, snapshots (injected into pages)
- **Page inspection** — Get text, HTML, DOM structure, page info
- **Multi-page** — List and switch between browser tabs

## Installation

```bash
# Clone and install
git clone https://github.com/e7nd7r/xray.git
cd xray
uv sync
uv run playwright install chromium
```

## Usage

### Claude Code / Cursor

Add to your MCP configuration (`.mcp.json`):

```json
{
  "mcpServers": {
    "xray": {
      "command": "uv",
      "args": ["--directory", "/path/to/xray", "run", "xray"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `browser_start` | Start a browser instance |
| `browser_connect` | Connect to an existing browser via CDP |
| `browser_stop` | Stop the browser |
| `list_pages` | List open browser tabs |
| `select_page` | Switch to a specific tab |
| `goto` | Navigate to a URL |
| `page_info` | Get current URL and title |
| `click` | Click an element by selector |
| `fill` | Fill an input field |
| `get_text` | Get element text content |
| `get_html` | Get page or element HTML |
| `get_page_structure` | Get DOM skeleton with computed styles |
| `wait_for` | Wait for an element to appear |
| `execute_js` | Run JavaScript in the page |
| `inject_css` | Inject CSS styles |
| `screenshot` | Capture a screenshot |
| `show_toolbar` | Show the interactive annotation toolbar |
| `wait_for_selection` | Wait for user to select elements |
| `get_toolbar_state` | Get current toolbar state |
| `clear_highlights` | Clear all highlights and annotations |
| `get_snapshot` | Get a page snapshot |
| `save_snapshot` | Save a snapshot to disk |

### Example Session

```
> browser_start
Browser started (headless=true)

> goto https://example.com
Navigated to: https://example.com
Title: Example Domain

> screenshot
[Returns screenshot image]

> get_text h1
Example Domain

> execute_js document.querySelectorAll('a').length
Result: 1

> browser_stop
Browser stopped
```

## Architecture

XRay has two layers:

- **Python MCP server** — Handles the MCP protocol, manages browser lifecycle via Playwright, and dispatches tool calls to modular handlers
- **TypeScript toolbar** — Injected into browser pages for interactive annotations, element selection, and drawing tools

The TypeScript bundle is compiled during the Python wheel build via a Hatch build hook.

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.

## Development

```bash
# Install dependencies
uv sync
cd webtools && npm install && cd ..

# Run the server directly
uv run xray

# Build the toolbar separately
cd webtools && npm run build

# Run toolbar tests
cd webtools && npm test

# Type check
cd webtools && npm run typecheck
```

## License

[MIT](LICENSE)

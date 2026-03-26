"""XRay MCP Server - Browser automation tools."""

import asyncio

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent

from .context import XRayContext
from .browser import BrowserManager
from .handlers import ALL_HANDLERS, BaseHandler

# Server instructions for AI-assisted theming workflows
SERVER_INSTRUCTIONS = """
XRay MCP Server - Browser annotation and theming tools.

## AI-Assisted Theming Workflow

When helping users apply color palettes to pages, follow this workflow:

### Step 1: Understand the Page
Call `get_page_structure` to get:
- DOM skeleton with semantic elements (header, nav, main, footer)
- Computed colors (data-bg, data-fg) showing current styling
- Accessibility flags (data-a11y) - MUST respect contrast-sensitive areas

### Step 2: Get Available Colors
Call `get_palette_variables` to see CSS variables from the palette:
- Position-based: --color-1, --color-2, etc.
- Role-based: --primary, --accent, etc. (if roles are assigned)

### Step 3: Ask the User BEFORE Writing Any Files
Before creating any files or applying styles, discuss with the user:
- **Design motivation**: What theme or mood? (minimal, aurora borealis, corporate)
- **Content tone**: Does vibrant or subdued fit the page type?
- **Constraints**: Warn about contrast-sensitive areas from data-a11y flags
- **Approach**: Propose your styling strategy and get approval

### Step 4: Create Theme Files
After user approves the approach, create files in the project to track injected code:

**CSS file** (e.g., .xray/theme.css):
```css
/* === VARIABLES === */
/* === HEADER/NAV === */
/* === MAIN CONTENT === */
/* === FOOTER === */
```

**JS file** (e.g., .xray/theme.js) - only if needed for:
- Complex animations or interactions
- Dynamic behaviors CSS can't handle
- DOM manipulations for enhanced effects

IMPORTANT: Create files in the project directory (not /tmp) so the Edit tool can track diffs properly.

### Step 5: Iterate with Feedback
- Apply CSS using inject_css with the full file content
- Apply JS using execute_js if needed
- Ask for feedback (0-10 score helps calibrate)
- If elements break, STOP and fix before continuing
- Edit specific sections in the theme files, then re-inject
- Propose next steps rather than making autonomous changes

### Post-Iteration Checklist
After each change, verify:
- [ ] Header/nav readable?
- [ ] Tables intact?
- [ ] Links visible and styled?
- [ ] No broken layouts?
"""


def create_server() -> Server:
    """Create and configure the MCP server."""
    server = Server("xray", instructions=SERVER_INSTRUCTIONS)

    # Create DI context with initial browser manager
    ctx = XRayContext(browser=BrowserManager())

    # Instantiate all handlers with the shared context
    handlers: list[BaseHandler] = [Handler(ctx) for Handler in ALL_HANDLERS]

    @server.list_tools()
    async def list_tools():
        """List all available tools from all handlers."""
        tools = []
        for handler in handlers:
            tools.extend(handler.get_tools())
        return tools

    @server.call_tool()
    async def call_tool(name: str, arguments: dict):
        """Route tool calls to appropriate handler."""
        for handler in handlers:
            result = await handler.handle(name, arguments)
            if result is not None:
                return result

        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    return server


async def _async_main():
    """Run the MCP server."""
    server = create_server()

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main():
    """Entry point for the xray command."""
    asyncio.run(_async_main())


if __name__ == "__main__":
    main()

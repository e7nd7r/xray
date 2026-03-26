"""Browser lifecycle handlers."""

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler
from ..browser import BrowserManager


class BrowserHandler(BaseHandler):
    """Handles browser lifecycle tools: start, connect, stop, list_pages, select_page."""

    # Tool names this handler manages
    TOOLS = ["browser_start", "browser_connect", "browser_stop", "list_pages", "select_page"]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for browser lifecycle."""
        return [
            Tool(
                name="browser_start",
                description="Start the browser. Must be called before other browser tools.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "headless": {
                            "type": "boolean",
                            "description": "Run in headless mode (default: true)",
                            "default": True,
                        },
                        "base_url": {
                            "type": "string",
                            "description": "Base URL for the application (default: http://localhost:3001)",
                            "default": "http://localhost:3001",
                        },
                        "viewport_width": {
                            "type": "integer",
                            "description": "Viewport width in pixels. If not set, uses full window size.",
                        },
                        "viewport_height": {
                            "type": "integer",
                            "description": "Viewport height in pixels. If not set, uses full window size.",
                        },
                    },
                },
            ),
            Tool(
                name="browser_connect",
                description="Connect to an existing browser (Arc, Chrome, etc.) via CDP. The browser must be launched with --remote-debugging-port=9222. This allows sharing the same browser session with the user.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "cdp_url": {
                            "type": "string",
                            "description": "CDP endpoint URL (default: http://localhost:9222)",
                            "default": "http://localhost:9222",
                        },
                        "base_url": {
                            "type": "string",
                            "description": "Base URL for relative navigation (default: http://localhost:3001)",
                            "default": "http://localhost:3001",
                        },
                    },
                },
            ),
            Tool(
                name="list_pages",
                description="List all open pages/tabs in the connected browser.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="select_page",
                description="Select a specific page/tab by index to interact with.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "index": {
                            "type": "integer",
                            "description": "Page index (from list_pages)",
                        },
                    },
                    "required": ["index"],
                },
            ),
            Tool(
                name="browser_stop",
                description="Stop the browser and clean up resources.",
                inputSchema={"type": "object", "properties": {}},
            ),
        ]

    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle browser lifecycle tool calls."""
        if name not in self.TOOLS:
            return None

        if name == "browser_start":
            return await self._handle_start(arguments)
        elif name == "browser_connect":
            return await self._handle_connect(arguments)
        elif name == "browser_stop":
            return await self._handle_stop()
        elif name == "list_pages":
            return await self._handle_list_pages()
        elif name == "select_page":
            return await self._handle_select_page(arguments)

        return None

    async def _handle_start(self, arguments: dict) -> list[TextContent]:
        """Handle browser_start tool."""
        headless = arguments.get("headless", True)
        base_url = arguments.get("base_url", "http://localhost:3001")
        viewport_width = arguments.get("viewport_width")
        viewport_height = arguments.get("viewport_height")

        # Create new browser manager and update context
        new_browser = BrowserManager(base_url=base_url)
        await new_browser.start(
            headless=headless,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
        )
        self.ctx.set_browser(new_browser)

        return self._text(f"Browser started (headless={headless}, base_url={base_url})")

    async def _handle_connect(self, arguments: dict) -> list[TextContent]:
        """Handle browser_connect tool."""
        cdp_url = arguments.get("cdp_url", "http://localhost:9222")
        base_url = arguments.get("base_url", "http://localhost:3001")

        # Create new browser manager and update context
        new_browser = BrowserManager(base_url=base_url)
        self.ctx.set_browser(new_browser)

        try:
            pages_info = await new_browser.connect(cdp_url)
            pages_list = "\n".join(
                f"  [{p['index']}] {p['title']} - {p['url']}" + (" (current)" if p['is_current'] else "")
                for p in pages_info['pages']
            )
            return self._text(f"Connected to browser at {cdp_url}\n\nOpen tabs:\n{pages_list}")
        except Exception as e:
            return self._text(f"Failed to connect: {e}\n\nMake sure Arc/Chrome is running with:\n  --remote-debugging-port=9222")

    async def _handle_stop(self) -> list[TextContent]:
        """Handle browser_stop tool."""
        if self.browser:
            await self.browser.stop()
        return self._text("Browser stopped")

    async def _handle_list_pages(self) -> list[TextContent]:
        """Handle list_pages tool."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not connected. Call browser_connect or browser_start first.")

        pages_info = await self.browser.list_pages()
        pages_list = "\n".join(
            f"  [{p['index']}] {p['title']} - {p['url']}" + (" (current)" if p['is_current'] else "")
            for p in pages_info['pages']
        )
        return self._text(f"Open tabs:\n{pages_list}")

    async def _handle_select_page(self, arguments: dict) -> list[TextContent]:
        """Handle select_page tool."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not connected.")

        try:
            page_info = await self.browser.select_page(arguments["index"])
            return self._text(f"Selected page: {page_info['title']}\nURL: {page_info['url']}")
        except (ValueError, RuntimeError) as e:
            return self._error(str(e))

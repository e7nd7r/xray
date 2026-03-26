"""Navigation handlers."""

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler


class NavigationHandler(BaseHandler):
    """Handles navigation tools: goto, page_info."""

    TOOLS = ["goto", "page_info"]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for navigation."""
        return [
            Tool(
                name="goto",
                description="Navigate to a URL or path.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "URL or path to navigate to (e.g., '/roadmap' or 'http://example.com')",
                        },
                    },
                    "required": ["path"],
                },
            ),
            Tool(
                name="page_info",
                description="Get information about the current page (URL, title).",
                inputSchema={"type": "object", "properties": {}},
            ),
        ]

    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle navigation tool calls."""
        if name not in self.TOOLS:
            return None

        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        if name == "goto":
            return await self._handle_goto(arguments)
        elif name == "page_info":
            return await self._handle_page_info()

        return None

    async def _handle_goto(self, arguments: dict) -> list[TextContent]:
        """Handle goto tool."""
        path = arguments["path"]
        url = await self.browser.goto(path)
        info = await self.browser.get_page_info()
        return self._text(f"Navigated to: {url}\nTitle: {info['title']}")

    async def _handle_page_info(self) -> list[TextContent]:
        """Handle page_info tool."""
        info = await self.browser.get_page_info()
        return self._text(f"URL: {info['url']}\nTitle: {info['title']}")

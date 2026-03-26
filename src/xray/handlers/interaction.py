"""DOM interaction handlers."""

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler


class InteractionHandler(BaseHandler):
    """Handles DOM interaction tools: click, fill, get_text, get_html, wait_for, execute_js, inject_css."""

    TOOLS = ["click", "fill", "get_text", "get_html", "wait_for", "execute_js", "inject_css"]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for DOM interaction."""
        return [
            Tool(
                name="click",
                description="Click an element by CSS selector.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "selector": {
                            "type": "string",
                            "description": "CSS selector for the element to click",
                        },
                    },
                    "required": ["selector"],
                },
            ),
            Tool(
                name="fill",
                description="Fill an input field with text.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "selector": {
                            "type": "string",
                            "description": "CSS selector for the input field",
                        },
                        "value": {
                            "type": "string",
                            "description": "Text to fill in",
                        },
                    },
                    "required": ["selector", "value"],
                },
            ),
            Tool(
                name="get_text",
                description="Get the text content of an element.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "selector": {
                            "type": "string",
                            "description": "CSS selector for the element",
                        },
                    },
                    "required": ["selector"],
                },
            ),
            Tool(
                name="get_html",
                description="Get HTML content of the page or a specific element.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "selector": {
                            "type": "string",
                            "description": "CSS selector (optional, returns full page if not provided)",
                        },
                    },
                },
            ),
            Tool(
                name="wait_for",
                description="Wait for an element to appear on the page.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "selector": {
                            "type": "string",
                            "description": "CSS selector to wait for",
                        },
                        "timeout": {
                            "type": "integer",
                            "description": "Timeout in milliseconds (default: 5000)",
                            "default": 5000,
                        },
                    },
                    "required": ["selector"],
                },
            ),
            Tool(
                name="execute_js",
                description="Execute JavaScript code in the page context and return the result.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "script": {
                            "type": "string",
                            "description": "JavaScript code to execute",
                        },
                    },
                    "required": ["script"],
                },
            ),
            Tool(
                name="inject_css",
                description="Inject CSS styles into the page.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "css": {
                            "type": "string",
                            "description": "CSS code to inject",
                        },
                    },
                    "required": ["css"],
                },
            ),
        ]

    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle DOM interaction tool calls."""
        if name not in self.TOOLS:
            return None

        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        if name == "click":
            return await self._handle_click(arguments)
        elif name == "fill":
            return await self._handle_fill(arguments)
        elif name == "get_text":
            return await self._handle_get_text(arguments)
        elif name == "get_html":
            return await self._handle_get_html(arguments)
        elif name == "wait_for":
            return await self._handle_wait_for(arguments)
        elif name == "execute_js":
            return await self._handle_execute_js(arguments)
        elif name == "inject_css":
            return await self._handle_inject_css(arguments)

        return None

    async def _handle_click(self, arguments: dict) -> list[TextContent]:
        """Handle click tool."""
        selector = arguments["selector"]
        await self.browser.click(selector)
        return self._text(f"Clicked: {selector}")

    async def _handle_fill(self, arguments: dict) -> list[TextContent]:
        """Handle fill tool."""
        selector = arguments["selector"]
        value = arguments["value"]
        await self.browser.fill(selector, value)
        return self._text(f"Filled {selector}")

    async def _handle_get_text(self, arguments: dict) -> list[TextContent]:
        """Handle get_text tool."""
        selector = arguments["selector"]
        text = await self.browser.get_text(selector)
        return self._text(text or "(no text found)")

    async def _handle_get_html(self, arguments: dict) -> list[TextContent]:
        """Handle get_html tool."""
        selector = arguments.get("selector")
        html = await self.browser.get_html(selector)
        return self._text(html)

    async def _handle_wait_for(self, arguments: dict) -> list[TextContent]:
        """Handle wait_for tool."""
        selector = arguments["selector"]
        timeout = arguments.get("timeout", 5000)
        found = await self.browser.wait_for(selector, timeout=timeout)
        if found:
            return self._text(f"Element found: {selector}")
        return self._text(f"Timeout waiting for: {selector}")

    async def _handle_execute_js(self, arguments: dict) -> list[TextContent]:
        """Handle execute_js tool."""
        script = arguments["script"]
        result = await self.browser.execute_js(script)
        return self._text(f"Result: {result}")

    async def _handle_inject_css(self, arguments: dict) -> list[TextContent]:
        """Handle inject_css tool."""
        css = arguments["css"]
        await self.browser.inject_css(css)
        return self._text("CSS injected successfully")

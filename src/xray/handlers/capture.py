"""Capture handlers."""

import base64

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler


class CaptureHandler(BaseHandler):
    """Handles capture tools: screenshot, console_logs."""

    TOOLS = ["screenshot", "console_logs"]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for capture."""
        return [
            Tool(
                name="screenshot",
                description="Take a screenshot of the current page. Returns the image.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "full_page": {
                            "type": "boolean",
                            "description": "Capture full scrollable page (default: true)",
                            "default": True,
                        },
                        "format": {
                            "type": "string",
                            "enum": ["png", "jpeg"],
                            "description": "Image format (default: jpeg for smaller size)",
                            "default": "jpeg",
                        },
                        "quality": {
                            "type": "integer",
                            "description": "JPEG quality 0-100 (default: 80)",
                            "default": 80,
                            "minimum": 0,
                            "maximum": 100,
                        },
                    },
                },
            ),
            Tool(
                name="console_logs",
                description="Get browser console logs (errors, warnings, info). Useful for debugging JavaScript issues.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "types": {
                            "type": "array",
                            "items": {"type": "string", "enum": ["error", "warning", "log", "info", "debug"]},
                            "description": "Filter by message types. Default: ['error', 'warning'] for errors only.",
                            "default": ["error", "warning"],
                        },
                        "clear": {
                            "type": "boolean",
                            "description": "Clear logs after retrieving (default: false)",
                            "default": False,
                        },
                    },
                },
            ),
        ]

    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle capture tool calls."""
        if name not in self.TOOLS:
            return None

        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        if name == "screenshot":
            return await self._handle_screenshot(arguments)
        elif name == "console_logs":
            return self._handle_console_logs(arguments)

        return None

    async def _handle_screenshot(self, arguments: dict) -> list[ImageContent]:
        """Handle screenshot tool."""
        full_page = arguments.get("full_page", True)
        image_format = arguments.get("format", "jpeg")
        quality = arguments.get("quality", 80)

        screenshot_bytes = await self.browser.screenshot(
            full_page=full_page,
            image_type=image_format,
            quality=quality if image_format == "jpeg" else None,
        )

        mime_type = f"image/{image_format}"
        base64_data = base64.b64encode(screenshot_bytes).decode("utf-8")

        return [ImageContent(type="image", data=base64_data, mimeType=mime_type)]

    def _handle_console_logs(self, arguments: dict) -> list[TextContent]:
        """Handle console_logs tool."""
        types = arguments.get("types", ["error", "warning"])
        clear = arguments.get("clear", False)

        logs = self.browser.get_console_logs(types=types, clear=clear)

        if not logs:
            return self._text("No console messages found.")

        # Format logs for display
        lines = [f"**Console Logs ({len(logs)} messages)**\n"]
        for log in logs:
            type_emoji = {
                "error": "❌",
                "warning": "⚠️",
                "log": "📝",
                "info": "ℹ️",
                "debug": "🔍",
            }.get(log["type"], "•")

            line = f"{type_emoji} **{log['type'].upper()}**: {log['text']}"
            if log.get("url"):
                url_short = log["url"].split("/")[-1] if "/" in log["url"] else log["url"]
                line += f"\n   📍 {url_short}"
                if log.get("line_number"):
                    line += f":{log['line_number']}"
            lines.append(line)

        return self._text("\n\n".join(lines))

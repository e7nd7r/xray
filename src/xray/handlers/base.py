"""Base handler class for XRay tools."""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from mcp.types import Tool, TextContent, ImageContent

if TYPE_CHECKING:
    from ..context import XRayContext
    from ..browser import BrowserManager


class BaseHandler(ABC):
    """Base class for tool handlers with DI support."""

    def __init__(self, ctx: "XRayContext"):
        self.ctx = ctx

    @property
    def browser(self) -> "BrowserManager":
        """Get the browser manager from context."""
        return self.ctx.browser

    @abstractmethod
    def get_tools(self) -> list[Tool]:
        """Return tool definitions this handler provides."""
        pass

    @abstractmethod
    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle a tool call.

        Returns:
            List of content if this handler handles the tool, None otherwise.
        """
        pass

    def _text(self, text: str) -> list[TextContent]:
        """Helper to create text response."""
        return [TextContent(type="text", text=text)]

    def _error(self, message: str) -> list[TextContent]:
        """Helper to create error response."""
        return [TextContent(type="text", text=f"Error: {message}")]

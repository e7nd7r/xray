"""Selection and toolbar state handlers."""

import base64
from datetime import datetime
from pathlib import Path

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler
from ..toolbar import ToolbarManager


class SelectionHandler(BaseHandler):
    """Handles toolbar tools: show_toolbar, wait_for_selection, get_toolbar_state, clear_highlights, get_snapshot, save_snapshot."""

    TOOLS = ["show_toolbar", "wait_for_selection", "get_toolbar_state", "clear_highlights", "get_snapshot", "save_snapshot"]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for toolbar interaction."""
        return [
            Tool(
                name="show_toolbar",
                description="Show the XRay toolbar on the page (non-blocking). The toolbar allows users to select elements, draw annotations, add text, and take snapshots. Use get_toolbar_state to poll for changes.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="wait_for_selection",
                description="Show a toolbar and wait for the user to select an element on the page. The toolbar appears with a prompt, user hovers to highlight elements, clicks to select. Returns info about the selected element.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "Message to show the user (e.g., 'Select the element you want to modify')",
                            "default": "Select an element",
                        },
                    },
                },
            ),
            Tool(
                name="get_toolbar_state",
                description="Get current toolbar state without waiting. Returns all user annotations: selected elements, drawings, text annotations, and snapshots. Use this to poll for changes when the user says they've made updates.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="clear_highlights",
                description="Remove any xray highlights or toolbars from the page.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="get_snapshot",
                description="Get a specific snapshot image by ID. Returns the image for viewing.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "snapshot_id": {
                            "type": "string",
                            "description": "The snapshot ID (from get_toolbar_state)",
                        },
                    },
                    "required": ["snapshot_id"],
                },
            ),
            Tool(
                name="save_snapshot",
                description="Save a snapshot to a file. Supports PNG format.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "snapshot_id": {
                            "type": "string",
                            "description": "The snapshot ID (from get_toolbar_state)",
                        },
                        "path": {
                            "type": "string",
                            "description": "File path to save the snapshot (e.g., '/path/to/image.png')",
                        },
                    },
                    "required": ["snapshot_id", "path"],
                },
            ),
        ]

    async def handle(self, name: str, arguments: dict) -> list[TextContent | ImageContent] | None:
        """Handle toolbar tool calls."""
        if name not in self.TOOLS:
            return None

        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        if name == "show_toolbar":
            return await self._handle_show_toolbar()
        elif name == "wait_for_selection":
            return await self._handle_wait_for_selection(arguments)
        elif name == "get_toolbar_state":
            return await self._handle_get_toolbar_state()
        elif name == "clear_highlights":
            return await self._handle_clear_highlights()
        elif name == "get_snapshot":
            return await self._handle_get_snapshot(arguments)
        elif name == "save_snapshot":
            return await self._handle_save_snapshot(arguments)

        return None

    async def _ensure_toolbar(self) -> ToolbarManager:
        """Ensure toolbar is initialized on the current page."""
        toolbar = ToolbarManager(self.browser.page)

        # Check if toolbar already exists
        is_visible = await toolbar.is_visible()
        if not is_visible:
            # Initialize persistent toolbar
            await toolbar.init_toolbar()

        return toolbar

    async def _handle_show_toolbar(self) -> list[TextContent]:
        """Handle show_toolbar tool - non-blocking, just shows the toolbar."""
        await self._ensure_toolbar()
        return self._text("Toolbar is now visible. Use get_toolbar_state to poll for changes.")

    async def _handle_wait_for_selection(self, arguments: dict) -> list[TextContent | ImageContent]:
        """Handle wait_for_selection tool - blocking, waits for Done."""
        toolbar = await self._ensure_toolbar()
        result = await toolbar.wait_for_done()

        if result.get("cancelled"):
            return self._text("Selection cancelled by user.")

        if result.get("success") and result.get("data"):
            data = result["data"]
            return self._format_capture_result(data)

        return self._text("Selection failed: no data returned")

    async def _handle_get_toolbar_state(self) -> list[TextContent | ImageContent]:
        """Handle get_toolbar_state tool - non-blocking, returns current state."""
        toolbar = await self._ensure_toolbar()
        data = await toolbar.get_state()

        if data is None:
            return self._text("Toolbar not initialized.")

        return self._format_capture_result(data)

    def _format_capture_result(self, data: dict) -> list[TextContent | ImageContent]:
        """Format the capture result for display."""
        parts = []

        # Selected elements
        selected = data.get("selectedElements", [])
        if selected:
            parts.append("**Selected Elements:**")
            for el in selected:
                parts.append(
                    f"  - {el.get('tagName', 'unknown')}"
                    f" (selector: {el.get('selector', 'unknown')})"
                )

        # Drawings
        drawings = data.get("drawings", [])
        if drawings:
            parts.append(f"\n**Drawings:** {len(drawings)} stroke(s)")
            for d in drawings[:5]:  # Show first 5
                tool = d.get("tool", "unknown")
                points = len(d.get("points", []))
                parts.append(f"  - {tool}: {points} points")
            if len(drawings) > 5:
                parts.append(f"  ... and {len(drawings) - 5} more")

        # Annotations
        annotations = data.get("annotations", [])
        if annotations:
            parts.append(f"\n**Annotations:** {len(annotations)}")
            for a in annotations[:5]:  # Show first 5
                text = a.get("text", "")[:50]
                parts.append(f"  - \"{text}\"")
            if len(annotations) > 5:
                parts.append(f"  ... and {len(annotations) - 5} more")

        # Snapshots - only show metadata, not full images
        snapshots = data.get("snapshots", [])
        if snapshots:
            parts.append(f"\n**Snapshots:** {len(snapshots)}")
            for s in snapshots:
                snapshot_id = s.get("id", "unknown")
                timestamp = s.get("timestamp", 0)
                time_str = datetime.fromtimestamp(timestamp / 1000).strftime("%H:%M:%S") if timestamp else "unknown"
                parts.append(f"  - id: `{snapshot_id}` (taken at {time_str})")
            parts.append("\nUse `get_snapshot` to view or `save_snapshot` to save.")

        if not parts:
            parts.append("No elements selected or annotations made.")

        return [TextContent(type="text", text="\n".join(parts))]

    async def _handle_clear_highlights(self) -> list[TextContent]:
        """Handle clear_highlights tool."""
        toolbar = ToolbarManager(self.browser.page)
        await toolbar.clear()
        return self._text("Highlights cleared.")

    async def _handle_get_snapshot(self, arguments: dict) -> list[TextContent | ImageContent]:
        """Handle get_snapshot tool - returns a specific snapshot image."""
        snapshot_id = arguments.get("snapshot_id")
        if not snapshot_id:
            return self._error("snapshot_id is required")

        toolbar = await self._ensure_toolbar()
        data = await toolbar.get_state()

        if data is None:
            return self._error("Toolbar not initialized.")

        snapshots = data.get("snapshots", [])
        snapshot = next((s for s in snapshots if s.get("id") == snapshot_id), None)

        if not snapshot:
            return self._error(f"Snapshot with id '{snapshot_id}' not found.")

        data_url = snapshot.get("imageDataUrl", "")
        if not data_url.startswith("data:image/"):
            return self._error("Invalid snapshot data.")

        # Extract base64 data from data URL
        parts_split = data_url.split(",", 1)
        if len(parts_split) != 2:
            return self._error("Invalid snapshot data URL format.")

        mime_type = parts_split[0].replace("data:", "").replace(";base64", "")
        base64_data = parts_split[1]

        return [
            TextContent(type="text", text=f"Snapshot `{snapshot_id}`:"),
            ImageContent(type="image", data=base64_data, mimeType=mime_type),
        ]

    async def _handle_save_snapshot(self, arguments: dict) -> list[TextContent]:
        """Handle save_snapshot tool - saves a snapshot to a file."""
        snapshot_id = arguments.get("snapshot_id")
        file_path = arguments.get("path")

        if not snapshot_id:
            return self._error("snapshot_id is required")
        if not file_path:
            return self._error("path is required")

        toolbar = await self._ensure_toolbar()
        data = await toolbar.get_state()

        if data is None:
            return self._error("Toolbar not initialized.")

        snapshots = data.get("snapshots", [])
        snapshot = next((s for s in snapshots if s.get("id") == snapshot_id), None)

        if not snapshot:
            return self._error(f"Snapshot with id '{snapshot_id}' not found.")

        data_url = snapshot.get("imageDataUrl", "")
        if not data_url.startswith("data:image/"):
            return self._error("Invalid snapshot data.")

        # Extract base64 data from data URL
        parts_split = data_url.split(",", 1)
        if len(parts_split) != 2:
            return self._error("Invalid snapshot data URL format.")

        base64_data = parts_split[1]

        # Decode and save
        try:
            image_bytes = base64.b64decode(base64_data)
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(image_bytes)
            return self._text(f"Snapshot saved to: {file_path}")
        except Exception as e:
            return self._error(f"Failed to save snapshot: {e}")

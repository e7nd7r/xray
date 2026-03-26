"""Palette management handlers.

MCP tools for AI-assisted color generation and palette file I/O.
Part of DES-004: Color Palette Panel.
"""

import json
from pathlib import Path

from mcp.types import Tool, TextContent, ImageContent

from .base import BaseHandler
from ..templates import render_palette_report


class PaletteHandler(BaseHandler):
    """Handles palette tools: get_generation_request, set_generated_colors, load/export."""

    TOOLS = [
        "get_generation_request",
        "set_generated_colors",
        "load_palette",
        "export_palette",
        "generate_palette_sheet",
        "get_page_structure",
        "get_palette_variables",
    ]

    def get_tools(self) -> list[Tool]:
        """Return tool definitions for palette management."""
        return [
            Tool(
                name="get_generation_request",
                description=(
                    "Get the current palette state for AI color generation. "
                    "Returns locked colors (anchors to base generation on) and "
                    "unlocked slot IDs that need new colors. Use this before generating colors."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {},
                },
            ),
            Tool(
                name="set_generated_colors",
                description=(
                    "Set AI-generated colors for specific palette slots. "
                    "Colors must include the 'id' field matching an unlocked slot ID from get_generation_request. "
                    "Locked colors cannot be modified through this tool."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "colors": {
                            "type": "array",
                            "description": "Array of colors to set. Each must have 'id' matching an unlocked slot.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {
                                        "type": "string",
                                        "description": "Slot ID from get_generation_request unlocked slots",
                                    },
                                    "hex": {
                                        "type": "string",
                                        "description": "Hex color code (e.g., '#ff5733')",
                                    },
                                    "name": {
                                        "type": "string",
                                        "description": "Human-readable color name (e.g., 'Sunset Orange'). Falls back to current name if empty.",
                                    },
                                    "role": {
                                        "type": "string",
                                        "description": "Semantic role (e.g., 'primary', 'accent'). Falls back to current role if empty.",
                                    },
                                },
                                "required": ["id", "hex"],
                            },
                        },
                    },
                    "required": ["colors"],
                },
            ),
            Tool(
                name="load_palette",
                description="Load a palette from a JSON file into the browser.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the JSON file to load",
                        },
                    },
                    "required": ["path"],
                },
            ),
            Tool(
                name="export_palette",
                description="Export the current palette to a JSON file.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path where to save the JSON file",
                        },
                    },
                    "required": ["path"],
                },
            ),
            Tool(
                name="generate_palette_sheet",
                description=(
                    "Generate a palette sheet with color psychology, usage guidelines, and visual examples.\n\n"
                    "OUTPUT OPTIONS:\n"
                    "- output='browser': Display in browser (user can print to PDF from there)\n"
                    "- output='pdf': Save as PDF file (requires 'path' parameter)\n\n"
                    "BEFORE CALLING: Ask the user about their preferences:\n"
                    "- What type of project? (web app, mobile, marketing, branding)\n"
                    "- Which visual examples would help? (website mockup, UI components, cards, patterns)\n"
                    "- Any specific style preferences?\n\n"
                    "The tool fetches hex/name/role from browser state. Model provides:\n"
                    "- Color enrichments (psychology, usage recommendations)\n"
                    "- Custom layout with HTML/CSS examples demonstrating the palette\n\n"
                    "LAYOUT STRUCTURE (3 levels):\n"
                    "- Group: {title, description, rows[]} - organizes related examples\n"
                    "- Row: array of items - items in a row, widths MUST sum to 1\n"
                    "- Item: {width, title, html, css} - individual example block\n\n"
                    "CSS variables available: --c1, --c2, --c3, --c4 (palette colors in order)\n\n"
                    "Example layout:\n"
                    "[{\"title\": \"UI Components\", \"description\": \"Common interface elements\", \"rows\": [\n"
                    "  [{\"width\": \"1/2\", \"title\": \"Buttons\", \"html\": \"<button class='btn'>Click</button>\", \"css\": \".btn{background:var(--c1);color:#fff}\"},\n"
                    "   {\"width\": \"1/2\", \"title\": \"Badge\", \"html\": \"<span class='badge'>New</span>\", \"css\": \".badge{background:var(--c2)}\"}]\n"
                    "]}]"
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "output": {
                            "type": "string",
                            "enum": ["browser", "pdf"],
                            "description": "Output format: 'browser' to display in browser, 'pdf' to save as file",
                        },
                        "path": {
                            "type": "string",
                            "description": "Path where to save the PDF file (required when output='pdf')",
                        },
                        "sheet": {
                            "type": "object",
                            "description": "Sheet data with enrichments and layout",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": "Sheet title",
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Overall palette description",
                                },
                                "colors": {
                                    "type": "array",
                                    "description": "Enrichment data for each palette color",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {
                                                "type": "string",
                                                "description": "Color ID matching palette state",
                                            },
                                            "psychology": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                                "description": "Psychological associations (e.g., ['Growth', 'Trust'])",
                                            },
                                            "usage": {
                                                "type": "string",
                                                "description": "How/where this color should be used",
                                            },
                                        },
                                        "required": ["id", "psychology", "usage"],
                                    },
                                },
                                "layout": {
                                    "type": "array",
                                    "description": "Groups of visual examples. Each group has a title, description, and rows of items.",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "title": {
                                                "type": "string",
                                                "description": "Group title (e.g., 'UI Components', 'Patterns')",
                                            },
                                            "description": {
                                                "type": "string",
                                                "description": "Brief description of this group",
                                            },
                                            "rows": {
                                                "type": "array",
                                                "description": "Array of rows. Each row is an array of items whose widths must sum to 1.",
                                                "items": {
                                                    "type": "array",
                                                    "description": "A row of items",
                                                    "items": {
                                                        "type": "object",
                                                        "properties": {
                                                            "width": {
                                                                "type": "string",
                                                                "description": "Fractional width ('1/2', '1/3', '1')",
                                                            },
                                                            "title": {
                                                                "type": "string",
                                                                "description": "Item title/label",
                                                            },
                                                            "html": {
                                                                "type": "string",
                                                                "description": "HTML content",
                                                            },
                                                            "css": {
                                                                "type": "string",
                                                                "description": "CSS styles (use --c1, --c2, etc. for colors)",
                                                            },
                                                        },
                                                        "required": ["width", "title", "html", "css"],
                                                    },
                                                },
                                            },
                                        },
                                        "required": ["title", "description", "rows"],
                                    },
                                },
                                "notes": {
                                    "type": "string",
                                    "description": "Additional notes or recommendations",
                                },
                            },
                            "required": ["title", "description", "colors", "notes"],
                        },
                    },
                    "required": ["output", "sheet"],
                },
            ),
            Tool(
                name="get_page_structure",
                description=(
                    "Get a simplified DOM structure of the current page for AI to understand the layout. "
                    "Returns a skeleton with tags, IDs, classes, hierarchy, computed colors (data-bg/data-fg), "
                    "and accessibility flags (data-a11y). Use this to understand what CSS selectors to target."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "max_depth": {
                            "type": "integer",
                            "description": "Maximum depth to traverse (default: 10)",
                            "default": 10,
                        },
                    },
                },
            ),
            Tool(
                name="get_palette_variables",
                description=(
                    "Get the CSS variables available from the current palette. "
                    "Returns variable names and their hex values (e.g., --primary: #2f9e44). "
                    "Use these variables in inject_css to apply palette colors."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {},
                },
            ),
        ]

    async def handle(
        self, name: str, arguments: dict
    ) -> list[TextContent | ImageContent] | None:
        """Handle palette tool calls."""
        if name not in self.TOOLS:
            return None

        if name == "get_generation_request":
            return await self._handle_get_generation_request()
        elif name == "set_generated_colors":
            return await self._handle_set_generated_colors(arguments)
        elif name == "load_palette":
            return await self._handle_load_palette(arguments)
        elif name == "export_palette":
            return await self._handle_export_palette(arguments)
        elif name == "generate_palette_sheet":
            return await self._handle_generate_palette_sheet(arguments)
        elif name == "get_page_structure":
            return await self._handle_get_page_structure(arguments)
        elif name == "get_palette_variables":
            return await self._handle_get_palette_variables()

        return None

    async def _handle_get_generation_request(self) -> list[TextContent]:
        """Get locked colors and unlocked slot IDs for AI generation."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        try:
            palette_data = await self.browser.execute_js(
                "window.XRayToolbar?.getPaletteState?.()"
            )

            if not palette_data:
                return self._text(
                    json.dumps(
                        {
                            "lockedColors": [],
                            "unlockedSlots": [],
                            "message": "No palette data found. Add colors to the palette first.",
                        },
                        indent=2,
                    )
                )

            colors = palette_data.get("colors", [])

            # Separate locked colors and unlocked slots
            locked_colors = []
            unlocked_slots = []

            for i, color in enumerate(colors):
                if color.get("locked"):
                    locked_colors.append(
                        {
                            "id": color["id"],
                            "hex": color["hex"],
                            "name": color.get("name"),
                            "role": color.get("role"),
                            "index": i,
                        }
                    )
                else:
                    unlocked_slots.append(
                        {
                            "id": color["id"],
                            "index": i,
                        }
                    )

            return self._text(
                json.dumps(
                    {
                        "lockedColors": locked_colors,
                        "unlockedSlots": unlocked_slots,
                    },
                    indent=2,
                )
            )

        except Exception as e:
            return self._error(f"Failed to get generation request: {e}")

    async def _handle_set_generated_colors(
        self, arguments: dict
    ) -> list[TextContent]:
        """Set AI-generated colors for specific slot IDs."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        colors_to_set = arguments.get("colors", [])
        if not colors_to_set:
            return self._error("No colors provided")

        try:
            palette_data = await self.browser.execute_js(
                "window.XRayToolbar?.getPaletteState?.()"
            )

            if not palette_data:
                return self._error("No palette found. Add colors first.")

            existing_colors = palette_data.get("colors", [])

            # Create map of new colors by ID
            new_colors_by_id = {c["id"]: c for c in colors_to_set}

            # Track which IDs were updated
            updated_ids = []
            skipped_locked = []

            # Update colors
            updated_colors = []
            for existing in existing_colors:
                color_id = existing["id"]

                if existing.get("locked"):
                    # Keep locked colors unchanged
                    if color_id in new_colors_by_id:
                        skipped_locked.append(color_id)
                    updated_colors.append(existing)
                elif color_id in new_colors_by_id:
                    # Update unlocked slot with new color
                    new_color = new_colors_by_id[color_id]
                    updated_colors.append(
                        {
                            **existing,
                            "hex": new_color["hex"],
                            # Fall back to existing name/role if new values are empty
                            "name": new_color.get("name") or existing.get("name"),
                            "role": new_color.get("role") or existing.get("role"),
                            # Preserve oklch if provided, otherwise keep existing
                            "oklch": new_color.get("oklch", existing.get("oklch")),
                        }
                    )
                    updated_ids.append(color_id)
                else:
                    # Keep other unlocked colors unchanged
                    updated_colors.append(existing)

            # Update palette in browser
            palette_data["colors"] = updated_colors
            await self.browser.execute_js(
                f"window.XRayToolbar?.setPaletteState?.({json.dumps(palette_data)})"
            )

            # Build response message
            msg = f"Updated {len(updated_ids)} colors"
            if skipped_locked:
                msg += f" (skipped {len(skipped_locked)} locked)"

            return self._text(msg)

        except Exception as e:
            return self._error(f"Failed to set colors: {e}")

    async def _handle_load_palette(self, arguments: dict) -> list[TextContent]:
        """Load palette from JSON file."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        path_str = arguments.get("path")
        if not path_str:
            return self._error("No path provided")

        path = Path(path_str).expanduser()

        if not path.exists():
            return self._error(f"File not found: {path}")

        if not path.suffix.lower() == ".json":
            return self._error("Only JSON files are supported")

        try:
            with open(path) as f:
                data = json.load(f)

            # Handle both array of colors and full palette state
            if isinstance(data, list):
                # Just colors array - wrap in palette state
                palette_data = {
                    "colors": data,
                    "generationMode": "algorithm",
                    "selectedAlgorithm": "complementary",
                    "visualizerEnabled": False,
                    "visualizerSlide": "palette-grid",
                }
            elif isinstance(data, dict):
                if "colors" in data:
                    palette_data = data
                else:
                    return self._error(
                        "Invalid palette format. Expected 'colors' array."
                    )
            else:
                return self._error("Invalid palette format")

            # Load into browser
            await self.browser.execute_js(
                f"window.XRayToolbar?.setPaletteState?.({json.dumps(palette_data)})"
            )

            color_count = len(palette_data.get("colors", []))
            return self._text(f"Loaded palette with {color_count} colors from {path}")

        except json.JSONDecodeError as e:
            return self._error(f"Invalid JSON: {e}")
        except Exception as e:
            return self._error(f"Failed to load palette: {e}")

    async def _handle_export_palette(self, arguments: dict) -> list[TextContent]:
        """Export palette to JSON file."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        path_str = arguments.get("path")
        if not path_str:
            return self._error("No path provided")

        try:
            palette_data = await self.browser.execute_js(
                "window.XRayToolbar?.getPaletteState?.()"
            )

            if not palette_data or not palette_data.get("colors"):
                return self._error("No palette to export")

            path = Path(path_str).expanduser()

            # Ensure .json extension
            if path.suffix.lower() != ".json":
                path = path.with_suffix(".json")

            # Ensure parent directory exists
            path.parent.mkdir(parents=True, exist_ok=True)

            with open(path, "w") as f:
                json.dump(palette_data, f, indent=2)

            return self._text(f"Palette exported to {path}")

        except Exception as e:
            return self._error(f"Failed to export palette: {e}")

    async def _handle_generate_palette_sheet(
        self, arguments: dict
    ) -> list[TextContent]:
        """Generate palette sheet - either display in browser or save as PDF."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        output = arguments.get("output")
        if output not in ("browser", "pdf"):
            return self._error("Invalid output format. Use 'browser' or 'pdf'.")

        sheet = arguments.get("sheet")
        if not sheet:
            return self._error("No sheet data provided")

        # Validate path for PDF output
        if output == "pdf":
            path_str = arguments.get("path")
            if not path_str:
                return self._error("Path is required when output='pdf'")

        try:
            # Get palette state from browser
            palette_data = await self.browser.execute_js(
                "window.XRayToolbar?.getPaletteState?.()"
            )

            if not palette_data or not palette_data.get("colors"):
                return self._error("No palette to export")

            # Prepare template context
            context, warnings = self._prepare_sheet_context(sheet, palette_data)
            if context is None:
                # warnings contains error message
                return self._error(warnings)

            # Generate HTML using template
            html = render_palette_report(context)

            if output == "browser":
                # Display in a new browser tab
                page = await self.browser.page.context.new_page()
                await page.set_content(html, wait_until="networkidle")
                await page.bring_to_front()
                return self._text(
                    json.dumps(
                        {
                            "status": "success",
                            "output": "browser",
                            "message": "Palette sheet opened in new tab",
                            "warnings": warnings,
                        },
                        indent=2,
                    )
                )
            else:
                # Generate PDF
                path = Path(arguments["path"]).expanduser().resolve()
                if path.suffix.lower() != ".pdf":
                    path = path.with_suffix(".pdf")
                path.parent.mkdir(parents=True, exist_ok=True)

                # Generate PDF and open it in the same tab
                page = await self._generate_pdf(html, path)
                await page.goto(f"file://{path}")
                await page.bring_to_front()

                return self._text(
                    json.dumps(
                        {
                            "status": "success",
                            "output": "pdf",
                            "path": str(path),
                            "warnings": warnings,
                        },
                        indent=2,
                    )
                )

        except Exception as e:
            return self._error(f"Failed to generate palette sheet: {e}")

    def _prepare_sheet_context(
        self, sheet: dict, palette_data: dict
    ) -> tuple[dict | None, list[str] | str]:
        """Prepare template context from sheet data and palette state.

        Returns (context, warnings) on success, or (None, error_message) on failure.
        """
        palette_colors = palette_data.get("colors", [])
        sheet_colors = sheet.get("colors", [])
        sheet_colors_by_id = {c["id"]: c for c in sheet_colors}

        warnings = []
        merged_colors = []

        # Merge palette state with sheet enrichments
        for palette_color in palette_colors:
            color_id = palette_color["id"]
            if color_id not in sheet_colors_by_id:
                return None, f"Missing color '{color_id}' in sheet"

            enrichment = sheet_colors_by_id[color_id]

            # Check for empty fields
            if not enrichment.get("psychology"):
                warnings.append(f"Color '{color_id}' has empty 'psychology'")
            if not enrichment.get("usage"):
                warnings.append(f"Color '{color_id}' has empty 'usage'")

            # Calculate text color based on luminance
            hex_val = palette_color.get("hex", "#000000")
            text_color = self._get_contrast_color(hex_val)

            merged_colors.append(
                {
                    "id": color_id,
                    "hex": hex_val,
                    "name": palette_color.get("name", "Unnamed"),
                    "role": palette_color.get("role", ""),
                    "locked": palette_color.get("locked", False),
                    "psychology": enrichment.get("psychology", []),
                    "usage": enrichment.get("usage", ""),
                    "text_color": text_color,
                }
            )

        # Check sheet-level fields
        if not sheet.get("title"):
            warnings.append("Sheet 'title' is empty")
        if not sheet.get("description"):
            warnings.append("Sheet 'description' is empty")

        # Process layout - validate widths and convert to percentages
        layout = sheet.get("layout", [])
        processed_layout = []
        layout_css = ""

        if layout:
            for group_idx, group in enumerate(layout):
                group_title = group.get("title", f"Group {group_idx + 1}")
                rows = group.get("rows", [])
                processed_rows = []

                for row_idx, row in enumerate(rows):
                    total = 0.0
                    processed_items = []

                    for item in row:
                        width_str = item.get("width", "1")
                        try:
                            if "/" in width_str:
                                num, denom = width_str.split("/")
                                width_frac = float(num) / float(denom)
                            else:
                                width_frac = float(width_str)
                            total += width_frac
                            width_pct = width_frac * 100
                        except (ValueError, ZeroDivisionError):
                            return None, f"Invalid width '{width_str}' in {group_title}, row {row_idx + 1}"

                        # Collect CSS
                        item_css = item.get("css", "")
                        if item_css:
                            layout_css += item_css + "\n"

                        processed_items.append(
                            {
                                "title": item.get("title", ""),
                                "html": item.get("html", ""),
                                "width_pct": width_pct,
                            }
                        )

                    if abs(total - 1.0) > 0.01:
                        return None, f"{group_title}, row {row_idx + 1}: widths sum to {total:.2f}, must equal 1"

                    processed_rows.append(processed_items)

                processed_layout.append(
                    {
                        "title": group_title,
                        "description": group.get("description", ""),
                        "rows": processed_rows,
                    }
                )

        return {
            "title": sheet.get("title", "Color Palette"),
            "description": sheet.get("description", ""),
            "colors": merged_colors,
            "notes": sheet.get("notes", ""),
            "layout": processed_layout,
            "layout_css": layout_css,
        }, warnings

    def _get_contrast_color(self, hex_color: str) -> str:
        """Calculate contrasting text color based on background luminance."""
        try:
            r = int(hex_color[1:3], 16) / 255
            g = int(hex_color[3:5], 16) / 255
            b = int(hex_color[5:7], 16) / 255
            luminance = 0.299 * r + 0.587 * g + 0.114 * b
            return "#ffffff" if luminance < 0.5 else "#000000"
        except (ValueError, IndexError):
            return "#000000"

    async def _generate_pdf(self, html: str, path: Path):
        """Generate PDF from HTML using the existing browser. Returns the page."""
        # Create a new page in the existing browser for PDF generation
        page = await self.browser.page.context.new_page()
        await page.set_content(html, wait_until="networkidle")
        await page.emulate_media(media="screen")
        await page.pdf(path=str(path), format="A4", print_background=True)
        return page

    async def _handle_get_page_structure(self, arguments: dict) -> list[TextContent]:
        """Get simplified DOM structure for AI understanding."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        max_depth = arguments.get("max_depth", 10)

        # JavaScript to extract simplified DOM structure
        js_code = """
        (maxDepth) => {
            const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'path', 'iframe']);
            // Tags that contain text content worth noting
            const TEXT_TAGS = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'li', 'td', 'th']);
            // Container elements where colors matter
            const COLOR_CONTAINERS = new Set(['body', 'header', 'nav', 'main', 'footer', 'aside', 'section', 'article', 'div']);

            // Convert RGB to hex
            function rgbToHex(rgb) {
                if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
                const match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
                if (!match) return null;
                const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
                return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            }

            // Check if element has accessibility-related classes
            function getA11yFlags(el) {
                const flags = [];
                const className = el.className || '';
                if (typeof className === 'string') {
                    if (className.includes('contrast-more:')) flags.push('contrast-sensitive');
                    if (className.includes('sr-only')) flags.push('screen-reader');
                    if (className.includes('dark:')) flags.push('dark-mode-aware');
                }
                if (el.getAttribute('aria-label')) flags.push('aria-labeled');
                if (el.getAttribute('role')) flags.push('role:' + el.getAttribute('role'));
                return flags;
            }

            function processElement(el, depth, indent) {
                if (depth > maxDepth) return '';
                if (el.nodeType !== Node.ELEMENT_NODE) return '';

                const tag = el.tagName.toLowerCase();
                if (SKIP_TAGS.has(tag)) return '';

                // Build attribute string
                let attrs = '';
                if (el.id) attrs += ` id="${el.id}"`;
                if (el.className && typeof el.className === 'string' && el.className.trim()) {
                    const classes = el.className.trim().split(/\\s+/).filter(c =>
                        c.length > 0 && !c.startsWith('__') && c.length < 50
                    ).slice(0, 5).join(' ');
                    if (classes) attrs += ` class="${classes}"`;
                }

                // Add computed colors for container elements
                if (COLOR_CONTAINERS.has(tag) || el.id || (el.className && el.className.includes && el.className.includes('container'))) {
                    const style = window.getComputedStyle(el);
                    const bg = rgbToHex(style.backgroundColor);
                    const fg = rgbToHex(style.color);
                    if (bg) attrs += ` data-bg="${bg}"`;
                    if (fg) attrs += ` data-fg="${fg}"`;
                }

                // Add accessibility flags
                const a11yFlags = getA11yFlags(el);
                if (a11yFlags.length > 0) {
                    attrs += ` data-a11y="${a11yFlags.join(',')}"`;
                }

                // Get children elements
                const children = Array.from(el.children);
                const childContent = children
                    .map(child => processElement(child, depth + 1, indent + '  '))
                    .filter(s => s.length > 0)
                    .join('\\n');

                // Check for text content when no visible children remain
                const hasTextContent = TEXT_TAGS.has(tag) && el.textContent &&
                    el.textContent.trim().length > 0;

                // Format output
                const spaces = indent;
                if (childContent) {
                    return `${spaces}<${tag}${attrs}>\\n${childContent}\\n${spaces}</${tag}>`;
                } else if (hasTextContent) {
                    return `${spaces}<${tag}${attrs}>...</${tag}>`;
                } else {
                    return `${spaces}<${tag}${attrs}/>`;
                }
            }

            const body = document.body;
            if (!body) return '<body/>';

            return processElement(body, 0, '');
        }
        """

        try:
            structure = await self.browser.execute_js(f"({js_code})({max_depth})")

            if not structure:
                return self._text("<body/>")

            return self._text(structure)

        except Exception as e:
            return self._error(f"Failed to get page structure: {e}")

    async def _handle_get_palette_variables(self) -> list[TextContent]:
        """Get CSS variables available from the current palette."""
        if not self.browser or not self.browser.is_running:
            return self._error("Browser not started. Call browser_start first.")

        try:
            palette_data = await self.browser.execute_js(
                "window.XRayToolbar?.getPaletteState?.()"
            )

            if not palette_data or not palette_data.get("colors"):
                return self._text(
                    json.dumps(
                        {
                            "variables": [],
                            "message": "No palette colors. Add colors to the palette first.",
                        },
                        indent=2,
                    )
                )

            colors = palette_data.get("colors", [])
            variables = []

            for i, color in enumerate(colors):
                hex_val = color.get("hex", "#000000")
                # Position-based variable (always available)
                variables.append(
                    {
                        "name": f"--color-{i + 1}",
                        "hex": hex_val,
                    }
                )
                # Role-based variable (if role is set)
                role = color.get("role")
                if role:
                    variables.append(
                        {
                            "name": f"--{role}",
                            "hex": hex_val,
                        }
                    )

            # Format as CSS-like output for easy use
            css_output = "\n".join(
                f"  {v['name']}: {v['hex']};" for v in variables
            )

            return self._text(
                f":root {{\n{css_output}\n}}\n\n"
                f"Use these variables in inject_css, e.g.: background: var(--primary);"
            )

        except Exception as e:
            return self._error(f"Failed to get palette variables: {e}")

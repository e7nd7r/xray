"""Playwright browser wrapper."""

from collections import deque
from dataclasses import dataclass
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser, Playwright, BrowserContext


@dataclass
class ConsoleMessage:
    """Captured console message."""
    type: str  # log, warning, error, info, debug
    text: str
    timestamp: datetime
    url: str | None = None
    line_number: int | None = None


class BrowserManager:
    """Manages Playwright browser lifecycle."""

    # Max number of console messages to keep
    MAX_CONSOLE_MESSAGES = 100

    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._connected_via_cdp: bool = False
        self._console_messages: deque[ConsoleMessage] = deque(maxlen=self.MAX_CONSOLE_MESSAGES)

    @property
    def page(self) -> Page:
        """Get the current page, raising if not initialized."""
        if self._page is None:
            raise RuntimeError("Browser not started. Call start() first.")
        return self._page

    @property
    def is_running(self) -> bool:
        """Check if browser is running."""
        return self._browser is not None and self._browser.is_connected()

    async def start(
        self,
        headless: bool = True,
        viewport_width: int | None = None,
        viewport_height: int | None = None,
    ) -> None:
        """Start the browser."""
        if self.is_running:
            return

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=headless)

        # Create context with viewport settings if provided
        context_options = {}
        if viewport_width and viewport_height:
            context_options["viewport"] = {"width": viewport_width, "height": viewport_height}
        else:
            # Default to no viewport restriction (use actual window size)
            context_options["no_viewport"] = True

        self._context = await self._browser.new_context(**context_options)
        self._page = await self._context.new_page()
        self._connected_via_cdp = False
        self._setup_console_listener(self._page)

    async def connect(self, cdp_url: str = "http://localhost:9222") -> dict:
        """Connect to an existing browser via CDP (Chrome DevTools Protocol).

        This allows connecting to Arc, Chrome, or any Chromium-based browser
        that was launched with --remote-debugging-port=9222
        """
        if self.is_running:
            await self.stop()

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.connect_over_cdp(cdp_url)
        self._connected_via_cdp = True

        # Get existing contexts and pages
        contexts = self._browser.contexts
        if contexts:
            self._context = contexts[0]
            pages = self._context.pages
            if pages:
                self._page = pages[0]  # Default to first tab
            else:
                self._page = await self._context.new_page()
        else:
            self._context = await self._browser.new_context()
            self._page = await self._context.new_page()

        # Set up console listener on the current page
        self._setup_console_listener(self._page)

        # Return info about available pages
        return await self.list_pages()

    async def list_pages(self) -> dict:
        """List all open pages/tabs."""
        if not self._context:
            return {"pages": [], "current": None}

        pages = []
        current_url = self._page.url if self._page else None

        for i, page in enumerate(self._context.pages):
            pages.append({
                "index": i,
                "url": page.url,
                "title": await page.title(),
                "is_current": page.url == current_url
            })

        return {"pages": pages, "current": current_url}

    async def select_page(self, index: int) -> dict:
        """Select a specific page/tab by index."""
        if not self._context:
            raise RuntimeError("Not connected to a browser")

        pages = self._context.pages
        if index < 0 or index >= len(pages):
            raise ValueError(f"Invalid page index {index}. Available: 0-{len(pages)-1}")

        self._page = pages[index]
        self._setup_console_listener(self._page)
        return {
            "url": self._page.url,
            "title": await self._page.title()
        }

    async def stop(self) -> None:
        """Stop the browser."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        self._page = None

    async def ensure_started(self, headless: bool = True) -> None:
        """Ensure browser is started."""
        if not self.is_running:
            await self.start(headless=headless)

    async def goto(self, path: str) -> str:
        """Navigate to a path. Returns the full URL."""
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        await self.page.goto(url)
        return url

    async def screenshot(
        self,
        full_page: bool = True,
        image_type: str = "png",
        quality: int | None = None,
    ) -> bytes:
        """Take a screenshot and return as bytes."""
        kwargs = {"full_page": full_page, "type": image_type}
        if image_type == "jpeg" and quality is not None:
            kwargs["quality"] = quality
        return await self.page.screenshot(**kwargs)

    async def execute_js(self, script: str) -> any:
        """Execute JavaScript in the page context."""
        return await self.page.evaluate(script)

    async def inject_css(self, css: str) -> None:
        """Inject CSS into the page."""
        await self.page.add_style_tag(content=css)

    async def inject_js(self, js: str) -> None:
        """Inject and execute JavaScript."""
        await self.page.add_script_tag(content=js)

    async def click(self, selector: str) -> None:
        """Click an element."""
        await self.page.click(selector)

    async def fill(self, selector: str, value: str) -> None:
        """Fill an input field."""
        await self.page.fill(selector, value)

    async def get_text(self, selector: str) -> str | None:
        """Get text content of an element."""
        element = await self.page.query_selector(selector)
        if element:
            return await element.text_content()
        return None

    async def wait_for(self, selector: str, timeout: int = 5000) -> bool:
        """Wait for an element to appear."""
        try:
            await self.page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception:
            return False

    async def get_page_info(self) -> dict:
        """Get current page information."""
        return {
            "url": self.page.url,
            "title": await self.page.title(),
        }

    async def get_html(self, selector: str | None = None) -> str:
        """Get HTML content of page or element."""
        if selector:
            element = await self.page.query_selector(selector)
            if element:
                return await element.inner_html()
            return ""
        return await self.page.content()

    def _setup_console_listener(self, page: Page) -> None:
        """Set up console message listener on a page."""
        def on_console(msg):
            location = msg.location
            self._console_messages.append(ConsoleMessage(
                type=msg.type,
                text=msg.text,
                timestamp=datetime.now(),
                url=location.get("url") if location else None,
                line_number=location.get("lineNumber") if location else None,
            ))

        page.on("console", on_console)

    def get_console_logs(
        self,
        types: list[str] | None = None,
        clear: bool = False
    ) -> list[dict]:
        """Get captured console logs.

        Args:
            types: Filter by message types (e.g., ["error", "warning"])
            clear: Clear logs after retrieving

        Returns:
            List of console messages as dicts
        """
        messages = list(self._console_messages)

        if types:
            messages = [m for m in messages if m.type in types]

        result = [
            {
                "type": m.type,
                "text": m.text,
                "timestamp": m.timestamp.isoformat(),
                "url": m.url,
                "line_number": m.line_number,
            }
            for m in messages
        ]

        if clear:
            self._console_messages.clear()

        return result

    def clear_console_logs(self) -> None:
        """Clear all captured console logs."""
        self._console_messages.clear()

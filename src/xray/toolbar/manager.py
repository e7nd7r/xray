"""Toolbar manager for XRay user interactions."""

import importlib.resources
from playwright.async_api import Page
from typing import TypedDict, Literal


class ElementSelection(TypedDict):
    """Element selection result."""

    selector: str
    tagName: str
    id: str | None
    className: str | None
    text: str | None
    bounds: dict


class CaptureState(TypedDict):
    """Complete capture state from toolbar."""

    selectedElements: list[ElementSelection]
    drawings: list[dict]
    annotations: list[dict]
    snapshots: list[dict]
    viewport: dict
    timestamp: int


class SuccessResult(TypedDict):
    """Successful toolbar result."""

    success: Literal[True]
    data: CaptureState


class CancelledResult(TypedDict):
    """Cancelled toolbar result."""

    success: Literal[False]
    cancelled: Literal[True]


ToolbarResult = SuccessResult | CancelledResult


class ToolbarManager:
    """Manages toolbar injection and user interactions.

    Supports two modes:
    1. Persistent mode: Toolbar auto-injected, stays visible, state can be polled
    2. Blocking mode: Show toolbar, wait for Done/Cancel
    """

    def __init__(self, page: Page):
        self.page = page
        self._bundle_injected = False

    def _load_dist_asset(self, filename: str) -> str:
        """Load asset from the webtools dist directory (npm build output)."""
        dist = importlib.resources.files("xray.webtools_dist")
        return (dist / filename).read_text()

    async def _inject_bundle(self) -> None:
        """Inject the bundled JS and CSS into the page."""
        if self._bundle_injected:
            return

        # Load bundled assets
        js_bundle = self._load_dist_asset("xray-toolbar.js")
        css_bundle = self._load_dist_asset("xray-toolbar.css")

        # Inject CSS
        await self.page.evaluate(
            """(css) => {
                document.getElementById('xray-styles')?.remove();
                const style = document.createElement('style');
                style.id = 'xray-styles';
                style.textContent = css;
                document.head.appendChild(style);
            }""",
            css_bundle,
        )

        # Inject JS (IIFE that creates window.XRayToolbar)
        await self.page.evaluate(
            """(js) => {
                if (window.XRayToolbar) return;
                const script = document.createElement('script');
                script.id = 'xray-script';
                script.textContent = js;
                document.head.appendChild(script);
            }""",
            js_bundle,
        )

        self._bundle_injected = True

    async def init_toolbar(self, prompt: str = "Annotate the page") -> None:
        """Initialize the persistent toolbar (auto-called on browser connect).

        The toolbar stays visible and state can be polled at any time.

        Args:
            prompt: Message to show the user.
        """
        await self._inject_bundle()

        await self.page.evaluate(
            """(config) => {
                window.XRayToolbar.initToolbar(config);
            }""",
            {"prompt": prompt},
        )

    async def show_toolbar(self, prompt: str = "Annotate the page") -> ToolbarResult:
        """Show the toolbar and wait for user to click Done/Cancel.

        If persistent toolbar is active, this waits for Done.
        Otherwise creates a new non-persistent toolbar.

        Args:
            prompt: Message to show the user.

        Returns:
            ToolbarResult with capture state or cancellation.
        """
        await self._inject_bundle()

        result = await self.page.evaluate(
            """(config) => {
                return window.XRayToolbar.showToolbar(config);
            }""",
            {"prompt": prompt},
        )

        return result

    async def wait_for_done(self) -> ToolbarResult:
        """Wait for user to click Done (blocking).

        Use with persistent toolbar when model needs user input.

        Returns:
            ToolbarResult with capture state or cancellation.
        """
        await self._inject_bundle()

        result = await self.page.evaluate(
            """() => {
                return window.XRayToolbar.waitForDone();
            }"""
        )

        return result

    async def get_state(self) -> CaptureState | None:
        """Get current toolbar state without waiting (non-blocking).

        Returns current selections, drawings, annotations, snapshots.
        Returns None if toolbar is not initialized.
        """
        # Check if toolbar exists in DOM (handles fresh manager instance)
        result = await self.page.evaluate(
            """() => {
                if (window.XRayToolbar && window.XRayToolbar.getState) {
                    return window.XRayToolbar.getState();
                }
                return null;
            }"""
        )

        return result

    async def is_visible(self) -> bool:
        """Check if toolbar is currently visible."""
        return await self.page.evaluate(
            """() => {
                if (window.XRayToolbar && window.XRayToolbar.isVisible) {
                    return window.XRayToolbar.isVisible();
                }
                return false;
            }"""
        )

    async def clear(self) -> None:
        """Remove all toolbar elements and highlights from the page."""
        await self.page.evaluate(
            """
            () => {
                if (window.XRayToolbar) {
                    window.XRayToolbar.clearToolbar();
                } else {
                    // Fallback cleanup
                    document.getElementById('xray-toolbar')?.remove();
                    document.getElementById('xray-canvas')?.remove();
                    document.getElementById('xray-annotations')?.remove();
                    document.getElementById('xray-styles')?.remove();
                    document.getElementById('xray-script')?.remove();
                    document.querySelectorAll('.xray-selected, .xray-hover-highlight').forEach(el => {
                        el.classList.remove('xray-selected', 'xray-hover-highlight');
                    });
                }
            }
        """
        )
        self._bundle_injected = False

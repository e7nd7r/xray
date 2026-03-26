"""XRay tool handlers."""

from .base import BaseHandler
from .browser import BrowserHandler
from .navigation import NavigationHandler
from .interaction import InteractionHandler
from .capture import CaptureHandler
from .selection import SelectionHandler
from .palette import PaletteHandler

ALL_HANDLERS: list[type[BaseHandler]] = [
    BrowserHandler,
    NavigationHandler,
    InteractionHandler,
    CaptureHandler,
    SelectionHandler,
    PaletteHandler,
]

__all__ = [
    "BaseHandler",
    "BrowserHandler",
    "NavigationHandler",
    "InteractionHandler",
    "CaptureHandler",
    "SelectionHandler",
    "PaletteHandler",
    "ALL_HANDLERS",
]

"""XRay dependency injection context."""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, TypedDict

if TYPE_CHECKING:
    from .browser import BrowserManager


# =============================================================================
# Palette Types (matches webtools/src/palette/types.ts)
# =============================================================================


class OklchDict(TypedDict):
    """OKLCH color space values."""

    l: float  # Lightness (0-1)
    c: float  # Chroma (0-0.4+)
    h: float  # Hue (0-360)


@dataclass
class PaletteColor:
    """A color in the palette."""

    id: str
    hex: str
    oklch: OklchDict
    role: str | None = None
    name: str | None = None
    locked: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "hex": self.hex,
            "oklch": self.oklch,
            "role": self.role,
            "name": self.name,
            "locked": self.locked,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PaletteColor":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            hex=data["hex"],
            oklch=data.get("oklch", {"l": 0.5, "c": 0.1, "h": 0}),
            role=data.get("role"),
            name=data.get("name"),
            locked=data.get("locked", False),
        )


Algorithm = Literal[
    "complementary",
    "analogous",
    "triadic",
    "split-complementary",
    "tetradic",
    "monochromatic",
]


@dataclass
class PaletteState:
    """Palette panel state (matches webtools/src/palette/types.ts)."""

    colors: list[PaletteColor] = field(default_factory=list)
    generation_mode: Literal["algorithm", "ai"] = "algorithm"
    selected_algorithm: Algorithm = "complementary"
    visualizer_enabled: bool = False
    visualizer_slide: str = "palette-grid"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization (camelCase for JS)."""
        return {
            "colors": [c.to_dict() for c in self.colors],
            "generationMode": self.generation_mode,
            "selectedAlgorithm": self.selected_algorithm,
            "visualizerEnabled": self.visualizer_enabled,
            "visualizerSlide": self.visualizer_slide,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PaletteState":
        """Create from dictionary (handles camelCase from JS)."""
        return cls(
            colors=[PaletteColor.from_dict(c) for c in data.get("colors", [])],
            generation_mode=data.get("generationMode", "algorithm"),
            selected_algorithm=data.get("selectedAlgorithm", "complementary"),
            visualizer_enabled=data.get("visualizerEnabled", False),
            visualizer_slide=data.get("visualizerSlide", "palette-grid"),
        )


# =============================================================================
# XRay Context
# =============================================================================


@dataclass
class XRayContext:
    """Simple DI context holding shared dependencies."""

    browser: "BrowserManager" = field(default=None)  # type: ignore
    palette: PaletteState = field(default_factory=PaletteState)

    def set_browser(self, browser: "BrowserManager") -> None:
        """Set the browser manager instance."""
        self.browser = browser

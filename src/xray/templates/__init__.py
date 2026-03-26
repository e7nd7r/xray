"""Template rendering for XRay reports."""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Create Jinja2 environment
_template_dir = Path(__file__).parent
_env = Environment(
    loader=FileSystemLoader(_template_dir),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_palette_report(context: dict) -> str:
    """Render the palette report template with the given context."""
    template = _env.get_template("palette_report.html")
    return template.render(**context)

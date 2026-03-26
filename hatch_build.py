"""Hatch build hook for xray package.

Builds the webtools frontend bundle before creating the Python wheel.
"""

import subprocess
import shutil
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class WebtoolsBuildHook(BuildHookInterface):
    """Build hook that compiles webtools (npm) before building the wheel."""

    PLUGIN_NAME = "webtools"

    def initialize(self, version: str, build_data: dict) -> None:
        """Run npm build in webtools directory before wheel creation."""
        webtools_dir = Path(self.root) / "webtools"
        dist_dir = Path(self.root) / "src" / "xray" / "webtools_dist"

        if not webtools_dir.exists():
            raise RuntimeError(f"webtools directory not found: {webtools_dir}")

        # Check if npm is available
        if not shutil.which("npm"):
            raise RuntimeError("npm is required to build webtools but was not found")

        # Install dependencies if node_modules doesn't exist
        node_modules = webtools_dir / "node_modules"
        if not node_modules.exists():
            self._run_npm(["install"], webtools_dir)

        # Build the bundle (outputs to src/xray/webtools_dist/)
        self._run_npm(["run", "build"], webtools_dir)

        # Verify dist was created
        if not dist_dir.exists():
            raise RuntimeError(f"webtools build did not produce dist: {dist_dir}")

        # Verify required files exist
        required_files = ["xray-toolbar.js", "xray-toolbar.css", "__init__.py"]
        for filename in required_files:
            if not (dist_dir / filename).exists():
                raise RuntimeError(f"Missing required file: {dist_dir / filename}")

    def _run_npm(self, args: list[str], cwd: Path) -> None:
        """Run npm command in the specified directory."""
        cmd = ["npm", *args]
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"npm {' '.join(args)} failed:\n"
                f"stdout: {result.stdout}\n"
                f"stderr: {result.stderr}"
            )

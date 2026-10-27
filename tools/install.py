#!/usr/bin/env python3
"""
One-command installer and status checker for opencode-goal-pipeline.
Installs auto-continue-harness.js into ~/.config/opencode/plugins and ensures
deprecated opencode-goal is removed from ~/.config/opencode.
"""
import argparse
import json
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OPENCODE_DIR = Path.home() / ".config" / "opencode"


def check_status(opencode_dir: Path) -> None:
    plugin_dir = opencode_dir / "plugins" / "opencode-goal"
    harness_file = opencode_dir / "plugins" / "auto-continue-harness.js"
    cfg_file = opencode_dir / "opencode.json"
    print(f"[status] opencode_dir: {opencode_dir}")
    print(f"  - plugins/opencode-goal (deprecated): {'REMOVED' if not plugin_dir.exists() else 'STILL PRESENT'}")
    print(f"  - plugins/auto-continue-harness.js: {'INSTALLED' if harness_file.exists() else 'MISSING'}")
    if cfg_file.exists():
        data = json.loads(cfg_file.read_text(encoding="utf-8"))
        plugins = data.get("plugins", [])
        print(f"  - opencode.json plugins: {plugins}")


def install(opencode_dir: Path) -> None:
    plugins_root = opencode_dir / "plugins"
    plugins_root.mkdir(parents=True, exist_ok=True)

    target_goal = plugins_root / "opencode-goal"
    if target_goal.exists():
        shutil.rmtree(target_goal)
    shutil.copy2(REPO_ROOT / "plugins" / "auto-continue-harness.js", plugins_root / "auto-continue-harness.js")

    for cfg_name in ("opencode.json", "cli.json"):
        cfg_path = opencode_dir / cfg_name
        if not cfg_path.exists():
            continue
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
        plugins = data.get("plugins", [])
        cleaned = [
            p for p in plugins
            if "opencode-goal" not in (p.get("package", "") if isinstance(p, dict) else str(p))
        ]
        data["plugins"] = cleaned
        cfg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"[installed] auto-continue-harness.js & cleaned deprecated opencode-goal -> {opencode_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage opencode-goal-pipeline installation")
    parser.add_argument("action", choices=["status", "install"], help="Action to run")
    parser.add_argument("--opencode-dir", type=Path, default=DEFAULT_OPENCODE_DIR, help="Path to ~/.config/opencode")
    args = parser.parse_args()
    if args.action == "status":
        check_status(args.opencode_dir)
    elif args.action == "install":
        install(args.opencode_dir)


if __name__ == "__main__":
    main()

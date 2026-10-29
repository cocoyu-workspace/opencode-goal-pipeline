#!/usr/bin/env python3
"""
One-command installer and status checker for opencode-goal-pipeline.
Installs auto-continue-harness.js into ~/.config/opencode/plugins and ensures
deprecated opencode-goal is removed from ~/.config/opencode. Also installs the
opencode-pipeline AGY sidecar and the `opencode` shim into ~/.gemini.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OPENCODE_DIR = Path.home() / ".config" / "opencode"
SIDECAR_NAME = "opencode-pipeline"
SIDECAR_SRC = REPO_ROOT / "sidecars" / SIDECAR_NAME
SIDECAR_DST = Path.home() / ".gemini" / "config" / "sidecars" / SIDECAR_NAME
SHIM_SRC = REPO_ROOT / "bin" / "opencode-agy-shim"
SHIM_DST = Path.home() / ".gemini" / "antigravity" / "bin" / "opencode"
SIDECAR_ACTION_ENABLE = "SIDECAR_ACTION_ENABLE"
SIDECAR_ACTION_ALL_PROJECTS = "SIDECAR_ACTION_SET_ALL_PROJECTS"
SIDECAR_ACTION_RESTART = "SIDECAR_ACTION_RESTART"


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
    print(f"  - sidecars/{SIDECAR_NAME} ({SIDECAR_DST}): {'INSTALLED' if (SIDECAR_DST / 'server.mjs').exists() else 'MISSING'}")
    print(f"  - antigravity/bin/opencode shim ({SHIM_DST}): {'INSTALLED' if SHIM_DST.exists() else 'MISSING'}")


def discover_ports() -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-c", "language_"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return []
    return list(dict.fromkeys(int(p) for p in re.findall(r"127\.0\.0\.1:(\d+)\s+\(LISTEN\)", out)))


def call_manage_sidecar(base: str, token: str | None, action: str, **fields) -> None:
    if not token:
        html = urllib.request.urlopen(f"{base}/", timeout=2).read().decode(errors="ignore")
        m = re.search(r"window\.__APP_CONFIG__\s*=\s*(.*?);", html)
        token = json.loads(m.group(1)).get("csrfToken") if m else None
    if not token:
        raise RuntimeError(f"no csrfToken at {base}")
    req = urllib.request.Request(
        f"{base}/exa.language_server_pb.LanguageServerService/ManageSidecar",
        data=json.dumps({"sidecarId": SIDECAR_NAME, "action": action, **fields}).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-codeium-csrf-token": token, "Connect-Protocol-Version": "1"},
    )
    urllib.request.urlopen(req, timeout=5).read()


def enable_sidecar() -> None:
    env_addr = os.environ.get("ANTIGRAVITY_LS_ADDRESS")
    targets = [(f"http://{env_addr}", os.environ.get("ANTIGRAVITY_CSRF_TOKEN"))] if env_addr else []
    targets += [(f"http://127.0.0.1:{p}", None) for p in discover_ports()]
    for base, token in targets:
        try:
            call_manage_sidecar(base, token, SIDECAR_ACTION_ENABLE)
            call_manage_sidecar(base, token, SIDECAR_ACTION_RESTART)
            call_manage_sidecar(base, token, SIDECAR_ACTION_ALL_PROJECTS, allProjects=True)
            print(f"[installed] ManageSidecar enabled {SIDECAR_NAME} (allProjects) via {base}")
            return
        except Exception as e:
            print(f"[warn] ManageSidecar at {base} failed: {e}")
    print(f"[warn] {SIDECAR_NAME} files installed but could not be enabled; enable it from the AGY sidecar panel")


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

    shutil.copytree(SIDECAR_SRC, SIDECAR_DST, dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.test.js"))
    print(f"[installed] sidecar {SIDECAR_NAME} -> {SIDECAR_DST}")
    SHIM_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SHIM_SRC, SHIM_DST)
    SHIM_DST.chmod(0o755)
    print(f"[installed] opencode shim -> {SHIM_DST}")
    real_opencode = Path("/opt/homebrew/bin/opencode")
    if real_opencode.exists():
        try:
            subprocess.run([str(real_opencode), "service", "restart"], check=False, timeout=15)
            print("[installed] restarted opencode background service")
        except Exception as e:
            print(f"[warn] opencode service restart failed: {e}")
    enable_sidecar()


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

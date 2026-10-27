#!/usr/bin/env python3
"""Sync Magpie custom models from ~/.gemini/antigravity-cli/settings.json into Antigravity.app GUI state."""

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def discover_ports() -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-c", "language_"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return []
    ports = []
    for m in re.findall(r"127\.0\.0\.1:(\d+)\s+\(LISTEN\)", out):
        p = int(m)
        if p not in ports:
            ports.append(p)
    return ports


ALLOWED_MODELS = {
    "magpie/codex/gpt-6-astra",
    "magpie/codex/gpt-6-astra-fast",
    "magpie/codex/gpt-6-astra-ultrafast",
    "magpie/codex/gpt-6.1-sol",
    "magpie/codex/gpt-6.1-sol-fast",
    "magpie/codex/gpt-6.1-sol-ultrafast",
    "magpie/codex-all/gpt-6.1-sol-codex",
    "magpie/codex-all/gpt-6.1-sol-standard",
    "magpie/word-claude/word/claude-opus-5-5",
    "magpie/word-claude/word/claude-sonnet-5-5",
    "magpie/word-sol/word/gpt-6.1-sol",
    "magpie/perplexity/perplexity/fable-5.1",
    "magpie/perplexity/perplexity/gpt-6.1-sol",
    "magpie/perplexity/perplexity/opus-5.5",
    "magpie/perplexity/perplexity/sonnet-5.5",
}


def build_gui_models() -> dict:
    settings_path = Path.home() / ".gemini/antigravity-cli/settings.json"
    if not settings_path.exists():
        return {}
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    cli_models = settings.get("customModelsConfig", {}).get("customModels", {})
    gui_models = {}
    for k, v in cli_models.items():
        if k not in ALLOWED_MODELS:
            continue
        entry = dict(v)
        entry["modelId"] = "MODEL_GOOGLE_GEMINI_INTERNAL_BYOM"
        raw_name = entry.get("modelName", "")
        if raw_name.startswith("gemini-api://"):
            raw_name = raw_name[len("gemini-api://") :]
        if raw_name.startswith("magpie/"):
            raw_name = raw_name[len("magpie/") :]
        entry["modelName"] = "gemini-api://" + raw_name
        entry["chatModelName"] = k
        entry["apiProvider"] = "API_PROVIDER_GOOGLE_GEMINI"
        gui_models[k] = entry
    return gui_models


def sync_to_port(port: int, gui_models: dict) -> bool:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    base = f"http://127.0.0.1:{port}"
    try:
        html = opener.open(f"{base}/", timeout=3).read().decode(errors="ignore")
    except Exception:
        return False
    m = re.search(r"window\.__APP_CONFIG__\s*=\s*(.*?);", html)
    if not m:
        return False
    cfg = json.loads(m.group(1))
    token = cfg.get("csrfToken")
    if not token:
        return False
    body = json.dumps(
        {
            "appState": {
                "customModelsConfig": {
                    "customModels": gui_models,
                }
            }
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/exa.language_server_pb.LanguageServerService/JetboxWriteState",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-codeium-csrf-token": token,
            "Connect-Protocol-Version": "1",
        },
    )
    with opener.open(req, timeout=5) as resp:
        resp.read()
    return True


def main() -> int:
    if "--wait" in sys.argv:
        time.sleep(6.0)
    gui_models = build_gui_models()
    if not gui_models:
        return 0
    synced = 0
    for port in discover_ports():
        try:
            if sync_to_port(port, gui_models):
                synced += 1
        except Exception:
            pass
    if "--quiet" not in sys.argv:
        print(f"Synced {len(gui_models)} Magpie custom models to {synced} Antigravity GUI instance(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

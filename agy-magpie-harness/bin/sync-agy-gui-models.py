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


# GUI 下拉框显示名（Redux 里 label 即 map key）。key 为 settings.json 里的原始 ID，
# 请求用的真实模型名仍取自原始 ID，改显示名不影响路由。
GUI_LABELS = {
    "magpie/codex/gpt-6-astra": "GPT-6 Astra",
    "magpie/codex/gpt-6-astra-fast": "GPT-6 Astra Fast",
    "magpie/codex/gpt-6-astra-ultrafast": "GPT-6 Astra Ultra Fast",
    "magpie/codex/gpt-6.1-sol": "GPT-6.1 Sol",
    "magpie/codex/gpt-6.1-sol-fast": "GPT-6.1 Sol Fast",
    "magpie/codex/gpt-6.1-sol-ultrafast": "GPT-6.1 Sol Ultra Fast",
    "magpie/codex-all/gpt-6.1-sol-codex": "GPT-6.1 Sol (Codex Source)",
    "magpie/codex-all/gpt-6.1-sol-standard": "GPT-6.1 Sol (Standard Source)",
}


def build_gui_models() -> dict:
    settings_path = Path.home() / ".gemini/antigravity-cli/settings.json"
    if not settings_path.exists():
        return {}
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    cli_models = settings.get("customModelsConfig", {}).get("customModels", {})
    gui_models = {}
    for k, v in cli_models.items():
        if k not in GUI_LABELS:
            continue
        entry = dict(v)
        entry["modelId"] = "MODEL_GOOGLE_GEMINI_INTERNAL_BYOM"
        raw_name = entry.get("modelName", "")
        if raw_name.startswith("gemini-api://"):
            raw_name = raw_name[len("gemini-api://") :]
        if raw_name.startswith("magpie/"):
            raw_name = raw_name[len("magpie/") :]
        entry["modelName"] = "gemini-api://" + raw_name
        label = GUI_LABELS[k]
        entry["chatModelName"] = label
        entry["apiProvider"] = "API_PROVIDER_GOOGLE_GEMINI"
        gui_models[label] = entry
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

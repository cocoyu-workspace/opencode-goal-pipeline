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


# GUI 下拉框基础显示名（每个基础模型自动生成 (Medium) / (High) / (Max) 三个推理档位，
# 前端 G4 + kac 会将同 base 的三个档位折叠为单行并展示二级 Effort 下拉菜单：默认 Medium，可选 High / Max）。
BASE_GUI_MODELS = {
    "magpie/codex/gpt-6-astra": "GPT-6 Astra",
    "magpie/codex/gpt-6-astra-fast": "GPT-6 Astra Fast",
    "magpie/codex/gpt-6-astra-ultrafast": "GPT-6 Astra Ultra Fast",
    "magpie/codex/gpt-6.1-sol": "GPT-6.1 Sol",
    "magpie/codex/gpt-6.1-sol-fast": "GPT-6.1 Sol Fast",
    "magpie/codex/gpt-6.1-sol-ultrafast": "GPT-6.1 Sol Ultra Fast",
    "magpie/word-claude/word/claude-opus-5-5": "Claude Opus 5.5 (Word)",
    "magpie/word-claude/word/claude-sonnet-5-5": "Claude Sonnet 5.5 (Word)",
}

EFFORT_TIERS = [
    ("Medium", ""),
    ("High", "-high"),
    ("Max", "-max"),
]


def build_gui_models() -> dict:
    settings_path = Path.home() / ".gemini/antigravity-cli/settings.json"
    if not settings_path.exists():
        return {}
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    cli_models = settings.get("customModelsConfig", {}).get("customModels", {})
    gui_models = {}
    for k, base_label in BASE_GUI_MODELS.items():
        v = cli_models.get(k)
        if v is None:
            continue
        raw_name = str(v.get("modelName", ""))
        if raw_name.startswith("gemini-api://"):
            raw_name = raw_name[len("gemini-api://") :]
        if raw_name.startswith("magpie/"):
            raw_name = raw_name[len("magpie/") :]
        for effort_label, suffix in EFFORT_TIERS:
            label = f"{base_label} ({effort_label})"
            entry = dict(v)
            if "word/claude-opus-5-5" in raw_name:
                entry["maxTokens"] = 200000
            features = dict(entry.get("modelFeatures") or {})
            features["supportsThinking"] = True
            entry["modelFeatures"] = features
            entry["modelId"] = "MODEL_GOOGLE_GEMINI_INTERNAL_BYOM"
            entry["modelName"] = f"gemini-api://{raw_name}{suffix}"
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

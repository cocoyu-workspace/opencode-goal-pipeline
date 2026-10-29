#!/usr/bin/env python3
"""Sync Magpie custom models into Antigravity.app GUI state (and ~/.gemini/antigravity-cli/settings.json)."""

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


# GPT 模型基础行（每行自动生成 Medium / High / xhigh 三个推理档位，前端折叠为单行并展示二级 Effort 菜单）
GPT_BASE_MODELS = [
    ("codex/gpt-6.1-sol", "GPT-6.1 Sol", 500000),
    ("codex/gpt-6.1-sol-fast", "GPT-6.1 Sol Fast", 500000),
    ("codex/gpt-6.1-sol-ultrafast", "GPT-6.1 Sol Ultra Fast", 500000),
    ("codex/gpt-6-astra", "GPT-6 Astra", 272000),
    ("codex/gpt-6-astra-fast", "GPT-6 Astra Fast", 272000),
    ("codex/gpt-6-astra-ultrafast", "GPT-6 Astra Ultra Fast", 272000),
]

GPT_EFFORT_TIERS = [
    ("Medium", "-medium"),
    ("High", "-high"),
    ("xhigh", "-xhigh"),
]

# Word 模型（云端 Word Claude Opus 5.5 与 Sonnet 5.5）
SINGLE_FIXED_MODELS = [
    ("word-claude/word/claude-opus-5-5-max", "Claude Opus 5.5 (Word) (Max)", 500000),
    ("word-claude/word/claude-sonnet-5-5-max", "Claude Sonnet 5.5 (Word) (Max)", 500000),
]

# Kiro 云端 Claude 三模型（Opus 5.5 / Sonnet 5.5 / Haiku 5.5）
# GUI 通过 gemini-api://kiro/<model> 交给云端 Magpie 的 kiro provider。
KIRO_REASONING_MODELS = [
    ("claude-opus-5.5", "Kiro Claude Opus 5.5"),
    ("claude-sonnet-5.5", "Kiro Claude Sonnet 5.5"),
    ("claude-haiku-5.5", "Kiro Claude Haiku 5.5"),
]
KIRO_SINGLE_MODELS = []

KIRO_EFFORT_TIERS = [
    ("Medium", "-medium"),
    ("High", "-high"),
    ("xhigh", "-xhigh"),
    ("Max", "-max"),
]


def make_model_entry(raw_name: str, label: str, max_tokens: int, for_gui: bool) -> dict:
    entry = {
        "apiProvider": "API_PROVIDER_GOOGLE_GEMINI",
        "maxOutputTokens": 128000,
        "maxTokens": max_tokens,
        "modelFeatures": {
            "supportsContextTokens": True,
            "supportsCumulativeContext": True,
            "supportsImages": True,
            "supportsThinking": True,
            "supportsToolCalls": True,
        },
        "modelName": f"gemini-api://{raw_name}" if for_gui else raw_name,
        "supportsContext": True,
    }
    if for_gui:
        entry["modelId"] = "MODEL_GOOGLE_GEMINI_INTERNAL_BYOM"
        entry["chatModelName"] = label
    return entry


def build_gui_models() -> dict:
    gui_models = {}
    cli_models = {}

    for raw_base, base_label, max_tokens in GPT_BASE_MODELS:
        cli_models[f"magpie/{raw_base}"] = make_model_entry(raw_base, base_label, max_tokens, for_gui=False)
        for effort_label, suffix in GPT_EFFORT_TIERS:
            raw_name = f"{raw_base}{suffix}"
            label = f"{base_label} ({effort_label})"
            gui_models[label] = make_model_entry(raw_name, label, max_tokens, for_gui=True)
            cli_models[f"magpie/{raw_name}"] = make_model_entry(raw_name, label, max_tokens, for_gui=False)

    for raw_name, label, max_tokens in SINGLE_FIXED_MODELS:
        gui_models[label] = make_model_entry(raw_name, label, max_tokens, for_gui=True)
        cli_models[f"magpie/{raw_name}"] = make_model_entry(raw_name, label, max_tokens, for_gui=False)
        if raw_name.endswith("-max"):
            base_raw = raw_name[:-4]
            cli_models[f"magpie/{base_raw}"] = make_model_entry(raw_name, label, max_tokens, for_gui=False)

    for raw_name, base_label in KIRO_REASONING_MODELS:
        base_model_name = f"kiro/{raw_name}"
        cli_models[f"magpie/{base_model_name}"] = make_model_entry(base_model_name, base_label, 1_000_000, for_gui=False)
        for effort_label, suffix in KIRO_EFFORT_TIERS:
            model_name = f"kiro/{raw_name}{suffix}"
            label = f"{base_label} ({effort_label})"
            gui_models[label] = make_model_entry(model_name, label, 1_000_000, for_gui=True)
            cli_models[f"magpie/{model_name}"] = make_model_entry(model_name, label, 1_000_000, for_gui=False)

    for raw_name, label in KIRO_SINGLE_MODELS:
        model_name = f"kiro/{raw_name}"
        gui_models[label] = make_model_entry(model_name, label, 1_000_000, for_gui=True)
        cli_models[f"magpie/{model_name}"] = make_model_entry(model_name, label, 1_000_000, for_gui=False)

    settings_path = Path.home() / ".gemini/antigravity-cli/settings.json"
    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8")) if settings_path.exists() else {}
        settings.setdefault("customModelsConfig", {})["customModels"] = cli_models
        settings.setdefault("modelProvider", "gemini")
        settings.setdefault("model", "magpie/codex/gpt-6.1-sol")
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass

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
    # Self-heal if Antigravity.app auto-update overwrote language_server wrapper
    patch_script = Path(__file__).parent / "patch-agy-web-bundle.py"
    real_bin = Path("/Applications/Antigravity.app/Contents/Resources/bin/language_server.real")
    if patch_script.exists() and not real_bin.exists():
        try:
            subprocess.run(["python3", str(patch_script)], check=False)
        except Exception:
            pass
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

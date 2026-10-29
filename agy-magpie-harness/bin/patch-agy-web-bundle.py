#!/usr/bin/env python3
"""Extract embedded web bundle from Antigravity.app language_server and patch Custom Models + Effort Submenu + Tabbit Link Click."""

import io
import shutil
import struct
import sys
import zipfile
from pathlib import Path

APP_BIN_DIR = Path("/Applications/Antigravity.app/Contents/Resources/bin")
WRAPPER_BIN = Path("/Users/mac/dev/opencode-goal-pipeline/agy-magpie-harness/bin/language_server_wrapper")
OUT_ZIP = Path.home() / ".gemini/antigravity/web_bundle_custom.zip"


def resolve_real_binary() -> Path:
    real_bin = APP_BIN_DIR / "language_server.real"
    ls_bin = APP_BIN_DIR / "language_server"
    if ls_bin.exists() and ls_bin.stat().st_size > 50_000_000:
        # Antigravity.app was just updated and overwrote language_server wrapper
        shutil.copy2(ls_bin, real_bin)
        shutil.copy2(WRAPPER_BIN, ls_bin)
        ls_bin.chmod(0o755)
        print(f"[installed] Moved updated language_server ({real_bin.stat().st_size} bytes) -> language_server.real and restored wrapper.")
    return real_bin if real_bin.exists() else ls_bin


def patch_main_js(js: str) -> str:
    replacements = [
        # 1. Enable customModelsFeature in external Hub appVariant
        (
            'return{appType:"external",features:{addWorkspaceFeatures:',
            'return{appType:"external",features:{customModelsFeature:{customModelsProvider:f.customModelsProvider},addWorkspaceFeatures:',
        ),
        # 2. Enable showCustomModelHeader in Qjc
        (
            "supportsCustomModels:l,showCustomModelHeader:R,",
            "supportsCustomModels:l,showCustomModelHeader:!0,",
        ),
        # 3. Allow isCustom models in A6 effort parser and show xhigh as "xhigh"
        (
            'var ojc=["low","medium","high","xhigh","max"],z6={low:"Low",medium:"Medium",high:"High",xhigh:"Extra",max:"Max"};const pjc=new Map,qjc=/^(.*?)\\s*\\((low|medium|high|xhigh|max)(?:\\s+thinking)?\\)\\s*$/i;\nvar A6=a=>{if(!a.isCustom){var b;(b=pjc.get(a.value))!=null?a=b:a=(a=qjc.exec(a.label))?{base:a[1].trim(),effort:a[2].toLowerCase()}:void 0;return a}}',
            'var ojc=["low","medium","high","xhigh","max"],z6={low:"Low",medium:"Medium",high:"High",xhigh:"xhigh",max:"Max"};const pjc=new Map,qjc=/^(.*?)\\s*\\((low|medium|high|xhigh|max)(?:\\s+thinking)?\\)\\s*$/i;\nvar A6=a=>{var b;return!a.isCustom&&(b=pjc.get(a.value))!=null?b:(a=qjc.exec(a.label))?{base:a[1].trim(),effort:a[2].toLowerCase()}:void 0}',
        ),
        # 4. Include a.customModels in effortIndex in zjc
        (
            "h=(0,A.useMemo)(()=>{var l=a.modelOptions,m=new Map;for(let n of l){l=A6(n);if(!l)continue;let q=m.get(l.base);q||(q=new Map,m.set(l.base,q));q.has(l.effort)||\nq.set(l.effort,n)}return m},[a.modelOptions])",
            "h=(0,A.useMemo)(()=>{var l=[...a.modelOptions,...(a.customModels??[])],m=new Map;for(let n of l){l=A6(n);if(!l)continue;let q=m.get(l.base);q||(q=new Map,m.set(l.base,q));q.has(l.effort)||\nq.set(l.effort,n)}return m},[a.modelOptions,a.customModels])",
        ),
        # 5. Fold multi-effort customModels in Cjc into Hjc (with effort submenu), while keeping single-effort customModels (like Word Opus Max) on Bjc
        (
            'var Cjc=({customModels:a,onAddCustomModel:b,onEditCustomModel:c})=>{var {supportsCustomModels:d}=B6(),f=(0,A.useId)(),g=(0,A.useId)();return a.length!==0||b?A.createElement("div",null,A.createElement("div",{className:Hi("group flex select-none items-center justify-between gap-1 p-1 pl-2 text-xs font-medium",b&&!d?"cursor-not-allowed":"")},A.createElement("span",{className:"opacity-50"},"Custom"),b&&(d?A.createElement(A.Fragment,null,A.createElement("button",{onClick:b,tabIndex:-1,"data-testid":"model-selector-add-custom-model",\nclassName:"cursor-pointer rounded-md p-1 opacity-50 hover:bg-secondary hover:opacity-100","data-tooltip-id":f},A.createElement(Z,{name:"add",size:12})),A.createElement(iA,{id:f},"Add Model")):A.createElement(A.Fragment,null,A.createElement("div",{"data-tooltip-id":g,className:"hidden group-hover:block"},A.createElement(Z,{name:"warning",size:12,className:"shrink-0 fill-yellow-200 stroke-yellow-800"})),A.createElement(iA,{id:g,className:"max-w-[250px] whitespace-normal"},"Custom models are only supported on Linux machines.")))),\nA.createElement("div",{className:"flex flex-col gap-px"},a.map(h=>A.createElement(Bjc,{key:h.label,model:h,onEdit:c})))):null};',
            'var Cjc=({customModels:a,onAddCustomModel:b,onEditCustomModel:c})=>{var {supportsCustomModels:d,effortIndex:k,bestOfNConfig:l}=B6(),f=(0,A.useId)(),g=(0,A.useId)(),m=(0,A.useMemo)(()=>{if(l?.isBestOfNEnabled)return a;var n=new Set,p=[];for(let r of a){let t=sjc(r,k);t?n.has(t.base)||(n.add(t.base),p.push(t.byEffort.get("medium")??r)):p.push(r)}return p},[a,k,l?.isBestOfNEnabled]);return a.length!==0||b?A.createElement("div",null,A.createElement("div",{className:Hi("group flex select-none items-center justify-between gap-1 p-1 pl-2 text-xs font-medium",b&&!d?"cursor-not-allowed":"")},A.createElement("span",{className:"opacity-50"},"Custom"),b&&(d?A.createElement(A.Fragment,null,A.createElement("button",{onClick:b,tabIndex:-1,"data-testid":"model-selector-add-custom-model",\nclassName:"cursor-pointer rounded-md p-1 opacity-50 hover:bg-secondary hover:opacity-100","data-tooltip-id":f},A.createElement(Z,{name:"add",size:12})),A.createElement(iA,{id:f},"Add Model")):A.createElement(A.Fragment,null,A.createElement("div",{"data-tooltip-id":g,className:"hidden group-hover:block"},A.createElement(Z,{name:"warning",size:12,className:"shrink-0 fill-yellow-200 stroke-yellow-800"})),A.createElement(iA,{id:g,className:"max-w-[250px] whitespace-normal"},"Custom models are only supported on Linux machines.")))),\nA.createElement("div",{className:"flex flex-col gap-px"},m.map(h=>sjc(h,k)&&!l?.isBestOfNEnabled?A.createElement(Hjc,{key:h.label,model:h}):A.createElement(Bjc,{key:h.label,model:h,onEdit:c})))):null};',
        ),
        # 6. Zs + customModels lookup fallback for (Medium)
        (
            "if(a=(d?.customLabel?b.find(g=>g.label===d.customLabel):void 0)??b.at(0))return a",
            'if(a=(d?.customLabel?b.find(g=>g.label===d.customLabel||g.label===d.customLabel+" (Medium)"):void 0)??b.at(0))return a',
        ),
        (
            "var x=l?.customModels?l.customModels[q]:void 0;return x",
            'var x=l?.customModels?l.customModels[q]??l.customModels[q+" (Medium)"]:void 0;return x',
        ),
        # 7. External link left-click opens in Tabbit (external browser) instead of built-in preview
        (
            'G&&K&&L==="preview"&&hC(M,K,I)&&dC(N)',
            "!1",
        ),
        (
            'G&&G&&K&&L==="preview"&&hC(a,K,I)&&dC(M)&&G(a)!==!1?(M.preventDefault(),M.stopPropagation()):(M.preventDefault(),b(a,M))',
            "(M.preventDefault(),b(a,M))",
        ),
    ]
    for idx, (old, new) in enumerate(replacements, 1):
        cnt = js.count(old)
        if cnt != 1:
            raise RuntimeError(f"Patch #{idx} target count={cnt} (expected 1)")
        js = js.replace(old, new, 1)
    return js


def main() -> int:
    real_bin = resolve_real_binary()
    data = real_bin.read_bytes()
    eocd = data.rfind(b"PK\x05\x06")
    if eocd < 0:
        raise RuntimeError(f"No ZIP EOCD found in {real_bin}")
    cd_size, cd_offset = struct.unpack("<II", data[eocd + 12 : eocd + 20])
    zip_start = (eocd - cd_size) - cd_offset

    src_zf = zipfile.ZipFile(io.BytesIO(data[zip_start : eocd + 22]))
    OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    tmp_zip = OUT_ZIP.with_suffix(".zip.tmp")

    with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED) as dst_zf:
        for info in src_zf.infolist():
            raw = src_zf.read(info.filename)
            if info.filename == "main.js":
                patched = patch_main_js(raw.decode("utf-8")).encode("utf-8")
                dst_zf.writestr(info, patched)
            else:
                dst_zf.writestr(info, raw)

    tmp_zip.replace(OUT_ZIP)
    print(f"[patched] Wrote {OUT_ZIP} ({OUT_ZIP.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

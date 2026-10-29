# `agy + magpie + OpenCode` Harness Adapter (`agy-magpie-harness`)

> 2026-10-28 维护入口：[AGY + Magpie 接入记录与更新检查](docs/agy-magpie-recovery.md)，跟踪 [Issue #20](https://github.com/cocoyu-workspace/opencode-goal-pipeline/issues/20)。当前本机结果为 19 条桌面配置、25 条 CLI 配置，Word 仅 Opus 5.5 Max。真实对话验收待补。
>
> 下文第 1–3、5–6 节保留早期适配历史，其中 Perplexity、Sonnet、上下文、耗时与路由说明不作为当前配置依据。AGY 主会话使用 Magpie，OpenCode 子任务直接走 `opencode run`，不接入 Magpie。桌面接入以第 4 节链接为准。

本目录归档了将 **Antigravity CLI（`agy`）** 与 **Magpie 本地网关（`127.0.0.1:3425`）+ OpenCode 多厂商模型池（Codex GPT-6.1-Sol / GPT-6-Astra、Word Claude Opus/Sonnet 5.5、ZCode GLM 5.3 / Flash Max）** 深度打通的源码补丁、启动器与实测验证记录（对应 Issue `#7`）。

---

## 1. 核心架构：单窗口 `agy + GPT-6.1-sol` 聊需求 $\rightarrow$ 原生 `/goal` 闭环

```
用户在单个终端运行 agy-gpt（底层：agy --model 'magpie/codex/gpt-6.1-sol'）
  │
  ├─ 阶段 1（交互式聊需求 + 异构双审 → 产出收敛版 issue.md）：
  │    ├─ 主会话模型：magpie/codex/gpt-6.1-sol（medium 推理强度，500K 上下文窗口）
  │    ├─ 工具调用：通过 run_command 调用 OpenCode 子 Agent（opencode run --agent reviewer）
  │    │           执行 Fable-5.1 / Claude Opus 5.5 异构独立方案双审
  │    └─ 落盘产物：将收敛后的 6 节契约写入目标工作目录 issue.md
  │
  └─ 阶段 2（同一会话直接输入 `/goal` 原生自主长任务闭环）：
       ├─ 利用 agy 原生 /goal（零 token 轮询、支持会话接续 --continue、原生上下文压缩）
       ├─ 按 issue.md 实施代码改动 + 跑通红绿单测 + 调度三合一独立代码终审
       └─ 满足全部完成判据后输出 <!-- GOAL_COMPLETE --> 收口
```

---

## 2. 已修复的 4 项 `agy + magpie` 适配缺口

| 编号 | 适配项 | 根因定位（`magpie` 源码 `file:line`） | 修复内容 |
| :--- | :--- | :--- | :--- |
| **1** | **`agy` 内置辅助模型 `gemini-3.1-flash-lite-preview` 404** | `agy` 每次启动固定并发发送 3 个裸模型请求 `/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent`（无 `magpie/` 前缀）；`internal/agent/claude.go:2574` 的 `StandIn` 仅支持 `claude` 与 `codex` | 在 `internal/agent/agy.go` 新增 `agyStandIn`，并在 `StandIn` 中接入 `agent == "agy"`，自动将未服务的裸模型名回退到 `agy` 当前配置的模型（自动剥离 `-fast`/`-ultrafast` 后缀以免后台标题生成消耗加速额度） |
| **2** | **`Fast`（`priority`）与 `Ultra Fast`（`ultrafast`）在 `provider.Gemini` 协议下丢失** | `internal/gateway/groupfast.go:30` 未处理 `provider.Gemini`；`internal/gateway/gemini.go:53,215` 未解析 `speed`/`serviceTier`；`internal/gateway/gateway.go:2764,2827` 的 `ultra` 账号优选与 `withUltra` 仅判断 `from == provider.Anthropic` | 打通 `provider.Gemini` 的 `Fast`/`Ultra Fast` 全链路，并在 `gateway.go:1845` 与 `agy.go:130` 支持 `-fast`（`service_tier: "priority"`）与 `-ultrafast`（Pro 账号发 `ultrafast`，Plus/Team 自动降级 `priority`）后缀模型变体 |
| **3** | **`customModelsConfig.customModels` 缺失上下文窗口与 `modelFeatures`** | `internal/agent/agy.go:79` 仅写入 `apiProvider` 与 `modelName`，导致 `.exa.codeium_common_pb.ModelInfo` 的 `maxTokens`、`maxOutputTokens` 为 0，影响 `agy` 上下文进度条与 `CompactionConfig` | 新增 `agyModelEntry`，自动注入 `maxTokens`（如 500K/1M）、`maxOutputTokens`（128K）、`supportsContext: true` 与 `modelFeatures`（`supportsImages`、`supportsThinking`、`supportsToolCalls`、`supportsCumulativeContext`、`supportsContextTokens`） |
| **4** | **OpenCode 的 `word-claude` 与 `perplexity` 号池未暴露给 `agy`** | `~/.config/magpie/providers.json` 未挂载 OpenCode 的 Anthropic 兼容节点 | 将 `word-claude`（`word/claude-opus-5-5`、`word/claude-sonnet-5-5`）与 `perplexity`（`perplexity/fable-5.1`、`perplexity/opus-5.5`、`perplexity/sonnet-5.5`、`perplexity/gpt-6.1-sol`）同步进 Magpie，供 `agy` 直接调用 |

---

## 3. 可用模型清单与快捷启动方式

已安装快捷命令 `~/.local/bin/agy-gpt`（源码位于 `bin/agy-gpt`）：

| 启动命令 | 实际对应的 Magpie 模型 ID | 加速档位 (`service_tier`) | 上下文窗口 (`maxTokens`) |
| :--- | :--- | :--- | :--- |
| `agy-gpt` | `magpie/codex/gpt-6.1-sol` | `default`（标准速度，`medium` 推理） | `500,000` |
| `agy-gpt --fast` | `magpie/codex/gpt-6.1-sol-fast` | `priority`（Fast 1.5x 加速） | `500,000` |
| `agy-gpt --ultrafast` | `magpie/codex/gpt-6.1-sol-ultrafast` | `ultrafast`（Pro 极速 / Plus 自动回退 `priority`） | `500,000` |
| `agy-gpt --astra` | `magpie/codex/gpt-6-astra` | `default` | `272,000` |
| `agy-gpt --astra-fast` | `magpie/codex/gpt-6-astra-fast` | `priority` | `272,000` |
| `agy-gpt --astra-ultrafast` | `magpie/codex/gpt-6-astra-ultrafast` | `ultrafast` | `272,000` |
| `agy-gpt --model 'magpie/word-claude/word/claude-opus-5-5'` | `magpie/word-claude/word/claude-opus-5-5` | Word Claude 云端池 | `500,000` |
| `agy-gpt --model 'magpie/word-claude/word/claude-sonnet-5-5'` | `magpie/word-claude/word/claude-sonnet-5-5` | Word Claude 云端池 | `500,000` |
| `agy-gpt --model 'magpie/perplexity/perplexity/fable-5.1'` | `magpie/perplexity/perplexity/fable-5.1` | Perplexity 云端池 | `1,000,000` |

### 会话接续（Session Resumption）
- 接续最近一次会话：`agy-gpt --continue`（或 `agy-gpt -c`）
- 接续指定会话 ID：`agy-gpt --conversation <conversation-id>`（或 `agy-gpt -r <conversation-id>`）

---

## 4. 桌面端接入与更新检查

当前方法与边界统一维护在 [AGY + Magpie 接入记录与更新检查](docs/agy-magpie-recovery.md)，关联 [Issue #20](https://github.com/cocoyu-workspace/opencode-goal-pipeline/issues/20)。

该文记录更新覆盖入口的现象、历史包装器职责、模型矩阵、官方设置入口、回退与真实验收清单。旧界面补丁改变平台支持判断，不再作为默认恢复步骤。前序本机运行时改动未包含在本次文档交付中。

---

## 5. 架构决策记录（ADR）：为什么主会话在 `agy` 用 GPT，而子任务通过 `opencode run` 调 Word / Perplexity

经 `agy-gpt --astra`（会话 `190fef7e-61da-475b-bbde-00714058fa5c`）与 `opencode run -m openai/gpt-6-astra` 同题盲测对比，正式拍板采用 **路线 A（`agy` 跑 GPT 主会话与原生 `/goal`，通过 `run_command` 调 `opencode run --agent coder/reviewer` 消费 Word / Perplexity）**，不在 `agy` 内重复适配 Word / Perplexity：

1. **为什么 `agy` 里用 `GPT-6 Astra` / `GPT-6.1 Sol` 聊需求不需要额外适配**：
   - OpenCode 之所以需要 `auto-continue-harness.js` 补丁，是因为 OpenCode V2 二进制对非 GPT-4 的 `gpt-*` 模型硬编码剥离了 `edit/write` 工具并注入了保守的 `# Autonomy: Do not infer authorization` 限制。
   - `agy` 原生底座对 `GPT-6 Astra` / `GPT-6.1 Sol` 无此类限制，完整开放 `read_file`、`edit_file`、`write_file`、`run_command`、`ask_question` 与 `/goal`，实测单轮内自动并发调用 `read_file` 并命中 47K 缓存（`cache_read_tokens: 47872`），直接可用。
2. **为什么 Word / Perplexity 留在 OpenCode 通过 `opencode run` 调度**：
   - `agy` 原生 `invoke_subagent` 的 `Model` 参数仅支持预设枚举（`inherit / flash_lite / flash / pro`），无法按角色动态传入自定义模型 ID。
   - OpenCode 已在 `opencode.json` 与 `auto-continue-harness.js` 中配齐了 `coder`（`word-claude/claude-opus-5-5#medium`）和 `reviewer`（`perplexity/fable-5.1#high`）的专属系统提示词、`question: deny` 防卡死权限与渠道流式/思考块兼容。
   - 顶层直接执行 `opencode run --agent reviewer --auto` 或 `opencode run --agent coder --auto` 耗时仅约 30 秒（免去 `agy` 桌面端 50+ 内置 Skill 的加载开销），若遇单渠道偶发限流，在重跑时保留 `--agent` 角色并显式覆写模型（如 `opencode run --agent reviewer -m perplexity/sonnet-5.5#high --auto`）即可兜底。

---

## 6. 补丁重放方法

当上游 `/Users/mac/开源工具/magpie` 拉取新版本后，可执行以下命令一键重放本目录补丁并重编译：

```bash
cd /Users/mac/开源工具/magpie
git apply /Users/mac/dev/opencode-goal-pipeline/agy-magpie-harness/patches/magpie-agy-opencode-adapter.patch
go test ./internal/agent ./internal/gateway -run "TestAgy|TestCodexFast|TestUltra|TestTier|TestStandIn" -count=1
go build -o magpie .
```

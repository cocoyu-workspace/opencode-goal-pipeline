# `agy + magpie + OpenCode` Harness Adapter (`agy-magpie-harness`)

本目录归档了将 **Antigravity CLI（`agy`）** 与 **Magpie 本地网关（`127.0.0.1:3425`）+ OpenCode 多厂商模型池（Codex GPT-6.1-Sol / GPT-6-Astra、Word Claude Opus/Sonnet 5.5、Perplexity Fable 5.1）** 深度打通的源码补丁、启动器与实测验证记录（对应 Issue `#7`）。

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

## 4. 补丁重放方法

当上游 `/Users/mac/开源工具/magpie` 拉取新版本后，可执行以下命令一键重放本目录补丁并重编译：

```bash
cd /Users/mac/开源工具/magpie
git apply /Users/mac/dev/opencode-goal-pipeline/agy-magpie-harness/patches/magpie-agy-opencode-adapter.patch
go test ./internal/agent ./internal/gateway -run "TestAgy|TestCodexFast|TestUltra|TestTier|TestStandIn" -count=1
go build -o magpie .
```

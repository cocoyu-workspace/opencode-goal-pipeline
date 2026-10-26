---
name: team-dual-goal
description: "[弹性原子积木Goal调度] OpenCode 自维护 opencode-goal 插件下的 7 个原子 Skill 积木（B1~B7）动态拼接、双模式（受控双阶段 / 单 Goal 全自动闭环）、主会话任意自定义模型与子 Agent 一二三优先级选模规程。当用户在 OpenCode 启动 /goal、要求动态调整评审/调研/实施顺序、指定第一优先级评审模型、或在一个 /goal 内自动走完需求->方案->评审->编码验证全流程时使用。"
---

# 弹性原子积木 Goal 调度规程（`opencode-goal` 自维护插件 + `B1`~`B7` 动态拼接）

## 一、核心原则：搭积木式动态拼接 + 老板指令永远第一顺位

1. **拒绝死板固定模板**：每个需求或 Bug 的复杂度、清晰度不同，严禁把所有任务强行塞进同一条固定死板流水线。
2. **老板显式指令永远为第一优先级（Priority 1）**：
   - 老板说「先做某某评审」「把某某指定为第一位」→ 立即将该原子积木排到当前计划第 1 位（或通过 `update_goal_plan` 的 `reorder_tasks` / `insert_task(position="first")` 置顶）。
   - 老板说「不用审方案直接写」「跳过调研」→ 立即通过 `remove_task` 裁剪对应未开始节点，直奔实施节点。
   - 老板说「在 OpenCode 里一个 `/goal` 自动走完流程」→ 直接拼接包含 `B7: impl-verify` 的全自动闭环积木链，无需在 `B6: gate-brief` 停机等待。

---

## 二、标准原子 Skill 积木节点（支持 `N1`~`N7` 与 `B1`~`B7` 双标识，并兼容 `s1_1`~`s1_5`）

无论顶层走的是「单端一条龙（OpenCode 一个 `/goal` 走完）」还是「双阶段跨端交接（阶段 1 出方案 + 阶段 2 派 `agy`）」，底层均由以下原子 Skill 节点按需像乐高一样动态插拔（前置或穿插 `B1: issue-track` 建档）：

| 积木节点 | 核心机制来源 / 绑定 Skill | 运行属性 | 什么时候插上 | 什么时候拔掉（跳过） |
| :--- | :--- | :--- | :--- | :--- |
| **`B1` · Issue 建档 (`issue-track`)** | GitHub Issue (`gh-atg`) / 仓内 `TeamIssue` | `AFK`（全自动） | 新需求、Bug 修复或排查需要留痕追踪时插上 | 纯随手问答或已在当前 Issue 内跟进时跳过重复建卡 |
| **`N1` / `B2` · 需求澄清 (`Grill`)** | Matt Pocock `grill-with-docs` (`#1193`) + `team-grilling` + `reviewer` | `HITL`（问完以 `waiting_user_clarification` 挂起等老板） | 想法模糊、需求边界摇摆时插上。提问自带推荐，老板回「可以 / yes」即采纳 | 需求目标已经很明确时直接拔掉，不浪费时间 |
| **`N2` / `B3` · 现状取证 (`Research`)** | 我们的三轨灵活取证（`team-diagnosing-bugs` + `explore` + `research` 查 `memex`） | `AFK`（全自动） | Bug 排障查日志做复现，或新需求需核实当前代码与外部成熟方案时插上 | 老板已给结论或内部几行代码的小改动直接拔掉 |
| **`N3` / `B4` · 规格合成 (`Spec`)** | Matt Pocock `to-spec` + `team-codebase-design`（深模块 + 复用四问梯） | `AFK`（全自动） | 涉及多文件协议或架构调整时插上，直接合成 Spec 并标明复用落点与最高层测试接缝 | 小修小补直接跳过，不做大方案 |
| **`N4` / `B5` · 异构互辩 (`Review`)** | 我们的异构双模型互辩（`team-review-governance` + `reviewer`） | `AFK`（全自动） | 重大方案需要防自嗨、对抗挑刺时插上（模型走一二三优先级） | 老板说「不用审方案」或紧急小修时直接拔掉 |
| **`N5` · 任务图拆解 (`Tickets`)** | Matt Pocock `to-tickets`（带阻塞边的 DAG 垂直切片） | `AFK`（全自动） | 涉及大 Spec 且需要拆解为多个独立可验证的垂直切片（Vertical Slices DAG）时插上 | 单点改动或中小任务无需拆图，直接进入实施 |
| **`N6` / `B6` · 决策门禁 (`Gate`)** | 人工拍板门禁卡（`wait_reason="approval"` + Handoff 简报） | `HITL`（等老板确认） | **受控还是连贯的插拔开关**：需要老板把关或走双阶段跨端交接时插上 | **走单端一条龙（一个 `/goal` 自动跑完）时拔掉**，直接顺滑进入编码实施 |
| **`N7` / `B7` · 编码与审查 (`Impl`)** | 变异 TDD（防假红）+ 先红后绿自愈 + 三合一独立 Review | `AFK`（全自动闭环） | 所有需要写代码的场景插上：强制先红后绿 + 精简复用代码 + 收尾跑「需求还原轴 `Spec` + 规范坏味道轴 `Standards` + 代码复用精简轴 `Reuse & Simplify`」三合一审查 | 纯调研或纯方案咨询任务直接拔掉 |

---

## 三、常见场景积木拼法与动态重排（`plan_ops`）

### 1. 四种典型拼法

1. **模糊需求（先澄清再出方案）**：`B1 -> B2 (HITL 挂起等澄清) -> B3 -> B4 -> B5 -> B6`
2. **清晰需求/Bug（受控双阶段模式，老板拍板后再写代码）**：`B1 -> B3 -> B4 -> B5 -> B6`（老板拍板后执行 `B7` 或派 Stage 2 `agy /goal`）
3. **单 `/goal` 全自动端到端闭环（老板要求在 OpenCode 内一个 `/goal` 自动走完）**：`B1 -> B3 -> B4 -> B5 -> B7`（无模糊阻断项时不挂起，自动走完调研、方案、独立评审、编码精简与测试验收）
4. **老板钦定首步（如「把方案/代码评审放第一位」）**：`B5 -> B4 -> B7`（老板点名的节点直接排第 1 位）

### 2. 运行中动态插拔与重排（`update_goal_plan` 的 `plan_ops`）

自维护插件 `/Users/mac/.config/opencode/plugins/opencode-goal` 原生支持在任意轮次动态调整积木：
- **置顶或插入积木（`insert_task`）**：
  ```json
  { "op": "insert_task", "phase_id": "phase_1", "task_id": "B2", "description": "req-grill: 需求澄清与预审", "position": "first" }
  ```
- **重排积木顺序（`reorder_tasks`）**：
  ```json
  { "op": "reorder_tasks", "phase_id": "phase_1", "task_ids": ["B1", "B5", "B3", "B4", "B7"] }
  ```
- **裁剪未开始积木（`remove_task`）**：
  ```json
  { "op": "remove_task", "phase_id": "phase_1", "task_id": "B6" }
  ```

### 3. `HITL` 挂起与老板回复自动唤醒

- 当处于 `B2: req-grill`（向老板提问澄清）或 `B6: gate-brief`（等待老板拍板）时，主会话调用：
  ```json
  {
    "status": "paused",
    "wait_reason": "clarification",
    "prompt_summary": "等待老板确认（直接回复『可以 / 按推荐的来』即可继续）"
  }
  ```
- 老板在对话框直接回复答案后，自维护 `opencode-goal` 插件自动识别人类回复并将 Goal 状态从 `paused` 恢复为 `active`，主会话无需让老板手动输入 `/goal resume`。

---

## 四、模型路由：主会话任意自定义 + 子 Agent 一二三优先级

### 1. 主会话模型：100% 尊重老板自定义
老板在 OpenCode 顶栏或 `-m` 参数选择的任何主会话模型（`GPT-6 Astra`、`GPT-6 Sol`、`GPT-6.1 Sol`、`Perplexity Fable 5.1`、`Claude Opus 5.5` 等）直接作为主控统筹模型，绝不写死单一主模型。

### 2. 子 Agent 选模：严格执行一、二、三优先级

| 优先级 | 触发条件 | 动作与生效方式 |
| :--- | :--- | :--- |
| **第一优先级（老板当轮点名，最高优先）** | 老板说「这次用 Opus 审」「用 GPT-6 Astra 跑」「指定某某模型第一位」 | 主会话调用 `subagent` 时**显式传入 `model="<provider>/<model>#<effort>"`**（例如 `model="word-claude/claude-opus-5-5#high"`），直接覆盖角色默认配置 |
| **第二优先级（角色与积木默认配置）** | 老板未特别点名模型 | 主会话调用 `subagent` 时**不传 `model` 参数**，自动读取 `opencode.json` 角色默认模型：<br>• `reviewer`：`perplexity/fable-5-1#high`<br>• `research`：`perplexity/fable-5-1#medium`<br>• `coder` / `explore`：`word-claude/claude-opus-5-5#medium` |
| **第三优先级（插件自动三级故障兜底）** | 第一或第二优先级模型遇到限流、超时或渠道报错 | `auto-continue-harness.js` 自动在同会话按顺序切换备选模型（如 `reviewer`: `word-claude/claude-opus-5-5#high` -> `perplexity/opus-5.5#medium` -> `openai/gpt-6.1-sol#high`），并在返回结果末尾追加 `[Fallback Executed: requested=... -> actual=...]` 供主会话与老板审计 |

---

## 五、`B3: fact-research` 三轨取证分流（拒绝无脑查日志）

进入 `B3: fact-research` 时，先按任务类型分流，严禁做无关动作：
- **轨 A · Bug 故障排查**：先核对复现步骤与错误日志 → 在 Issue 记录现象 → 定位本仓 `file:line` 根因（必过必要性与不改判据门禁）→ 派 `research` 子 Agent 检索外部实践与开源同类修法。
- **轨 B · 新需求 / 架构改造**：**直接跳过日志排查** → 核查本仓现有职责边界与可复用模块 `file:line` → 派 `research` 子 Agent 检索 `memex` 与高星开源成熟方案（带四级证据标签）→ 写入 Issue。
- **轨 C · 人工已预处理（老板已给全日志/根因）**：直接复用已有证据，不重复跑同类取证命令。

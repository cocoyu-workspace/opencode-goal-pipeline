---
name: team-dual-goal
description: "[弹性原子积木Goal调度] OpenCode 自维护 opencode-goal 插件下的 7 个原子 Skill 积木（N1~N7 / B1~B7）动态拼接、单文件精简主卡契约（issue.md 六节单写者）、双模式（受控双阶段 / 单 Goal 全自动闭环）、主会话自定义模型与子 Agent 一二三优先级选模规程。当用户在 OpenCode 启动 /goal、要求动态调整评审/调研/实施顺序、指定第一优先级评审模型、或在一个 /goal 内自动走完需求->方案->评审->编码验证全流程时使用。"
---

# 弹性原子积木 Goal 调度与单文件精简契约规程（`opencode-goal` + `N1`~`N7` / `B1`~`B7`）

## 一、核心原则：搭积木式动态拼接 + 老板指令第一顺位 + 单主卡精简契约

1. **拒绝死板固定模板与散装文档臃肿**：
   - 每个需求或 Bug 按清晰度与复杂度动态插拔原子积木。
   - **主卡单写者（Single-Writer）与单点编辑（One-Place Edit）原则**：所有节点的产出统一收束进单张权威主卡 `issue.md`（或 GitHub Issue 正文），**由主会话唯一执笔更新**（对齐 Matt Pocock `writing-for-agents` 共址定律、Anthropic `<200 行` 单文件 `SPEC.md` 规范与 `BMAD-METHOD` v7 PR #3100 *"The ticket is the spec"*，根治 60% 编码期返工导致的多文件失步投毒）；`explore`、`research`、`coder`、`reviewer` 子代理只返回结构化结论、diff 与证据，严禁子代理并发直接覆写 `issue.md` 或私自新建 `investigation.md`、`preflight.md` 等散装过程文件（>2,000 tokens 临时大日志统一放 `.scratch/`，不入 Git）。
   - **3 条法定外拆物理边界**：90%+ 任务保持单文件闭环；仅当命中 ① 跨多会话长跑（>4 个独立切片，需隐藏后续步骤防止诱发 Agent 抢跑 Premature Completion）、② 多 worktree / 跨仓并行认领（防并发写覆盖）、③ 大体积原始抓包日志或分支参考材料时，才外拆 `tickets/01-slug.md` 或独立附件。
2. **需求完整性（`R1..Rn` 零删减）优先于行数预算**：
   - `issue.md` 默认阅读预算为 **`~120 行`**（指导值），**严禁为了凑行数或凑「5 条上限」而删减老板明确提出的任何需求**。
   - 必须用稳定需求编号 `R1..Rn` 完整覆盖所有需求并 100% 映射到切片与验收；超预算时优先砍掉重复背景叙述、过程流水账与大段代码，其次按独立交付边界拆卡。
3. **老板显式指令永远为第一优先级（Priority 1）**：
   - 老板说「先做某某评审」「把某某指定为第一位」→ 立即通过 `update_goal_plan` 的 `reorder_tasks` / `insert_task(position="first")` 置顶。
   - 老板说「不用审方案直接写」「跳过调研」→ 立即通过 `remove_task` 裁剪对应未开始节点。
   - 老板说「在 OpenCode 里一个 `/goal` 自动走完流程」→ 拔掉 `N6/B6` 门禁，直接拼入 `N7/B7` 跑完全自动闭环。

---

## 二、7 个标准原子 Skill 积木与单文件 `issue.md` 六节契约映射

无论顶层走「单端一条龙」还是「双阶段受控交接」，均按以下原子积木动态插拔（**注意顺序：当启用拆图时，先完成 `N3 (Spec)` + `N5 (Tickets)`，再由 `N4 (Review)` 一并审查 Spec、测试接缝与垂直切片依赖图**）：

| 执行顺序与积木节点 | 融合机制（Matt Pocock `v1.3.1-47` × 本土精简纪律） | 运行属性 | 在主卡 `issue.md` 中的唯一对应章节 | 何时插上 / 何时拔掉 |
| :--- | :--- | :--- | :--- | :--- |
| **`B1` · Issue 建档 (`issue-track`)** | GitHub Issue (`gh-atg`) / 仓内 `TeamIssue` | `AFK` | 创建或绑定权威主卡 `issue.md` | 新任务留痕时插上；已在当前卡内跟进时跳过 |
| **`N1` / `B2` · 需求澄清 (`Grill`)** | Matt `grill-with-docs` (`#1193` 正向推荐) + `domain-modeling` | `HITL` (`wait_reason="clarification"`) | **§1 需求与不改边界（`R1..Rn` + `Out of Scope`）**：用稳定编号 `R1..Rn` 列出全部明确需求（零删减）与禁止越界范围；长期术语/ADR 更新至仓内文档并引用 | 想法模糊时插上（提问带推荐，回「可以」即采纳）；需求明确直接拔掉 |
| **`N2` / `B3` · 现状取证 (`Research`)** | 三轨灵活取证（`diagnosing-bugs` `#1209` / `explore` 查本仓 / `research` 查 `memex` 与开源） | `AFK` | **§2 根因与代码复用锚点**：记录基线 Commit SHA、**`相对路径 + 符号名 + 参考行号`**（抗行号漂移）的根因与本仓可复用函数、必要性与不改判据门禁 | 需查日志复现或查本仓/外部方案时插上；内部几行机械小改直接拔掉 |
| **`N3` / `B4` · 规格合成 (`Spec`)** | Matt `to-spec` + `team-codebase-design` + 复用四问梯 | `AFK` | **§3 精简 Spec 与测试接缝（Seams）**：<br>• 模块深接口变更与复用四问结论（禁贴 >15 行实现代码）；<br>• 锁定最高层公共测试接缝（Seam），写明每个 Seam「能捕获什么、不能捕获什么、对应哪条 `R#`」 | 涉及多文件协议或架构调整时插上；小修小补直接跳过（仅保留 §1+§2） |
| **`N5` · 任务图拆解 (`Tickets`)** | Matt `to-tickets`（Tracer-Bullet 垂直切片 + `depends_on` 阻塞边 + 宽重构 Expand-Contract） | `AFK` | **§4 垂直切片任务图（Vertical Slices）**：<br>• 每片必须切穿端到端可独立验证行为（禁水平分层），格式：`- [ ] [S1] 交付行为 (Covers: R1 \| depends_on: [])`；<br>• 仅当需多 worktree 并行认领、跨仓发布或单片超出上下文窗口时，才外拆 `tickets/01-slug.md` | 涉及多步或大 Spec 时插上；单点改动无需拆图 |
| **`N4` / `B5` · 异构互辩 (`Review`)** | 双模型对抗挑刺（`team-review-governance` + `reviewer`） | `AFK` | **§5 Review & Decision Log**：一并审查 §1~§4（含 Spec、Seam 与垂直切片图），记录审查模型、契约版本、阻断项处理结果与关键取舍 | 重大方案防自嗨时插上；老板说「不用审方案」或紧急小修直接拔掉 |
| **`N6` / `B6` · 决策门禁 (`Gate`)** | `HITL` 拍板门禁（`wait_reason="approval"` + ≤10 行简报） | `HITL` | **受控/连贯插拔开关**：受控模式在此停机等拍板（普通追问如「先别做，解释一下」保持 `paused` 仅回复解释，明确批准才恢复 `active` 进入 `N7`） | 受控双阶段模式插上；**单端一条龙模式直接拔掉** |
| **`N7` / `B7` · 编码与审查 (`Impl`)** | Matt `implement-spec`（指针交接）+ `tdd`（Seam 先红后绿）+ 三合一独立 Review | `AFK` | **§6 交付与持久验收证据**：主会话传「最小完整交接包」派发 `coder`，按切片依序跑先红后绿 TDD，收尾跑三合一审查，回填 Commit/PR 与持久验证输出摘要 | 所有写代码场景必插；纯调研/咨询任务拔掉 |

---

## 三、子代理「最小完整交接包（Minimal Context Pointer Pack）」与 4 道准入检查

### 1. 派发 `coder` / `reviewer` 的最小完整交接包（禁复制长文，禁丢 §1/§2 边界）
因为主卡 `issue.md` 已精简在百行左右（约 1.5k tokens），主会话派发 `coder` 时**严禁只传半截章节导致丢失 `§1 Out of Scope` 与 `§2 复用锚点`**，统一传递以下 5 项指针参数：
1. **权威主卡路径与契约版本**：`<path/to/issue.md>`（要求子代理先全文读取 `§1`~`§5`；跨端交接给外部 `agy /goal` 时，`issue.md` 的单写者权限随之移交 `agy` 主会话）。
2. **当前执行切片与覆盖需求**：`Slice S#`（对应 `R#`，插件级 `depends_on` 前置依赖必须已 `completed`）。
3. **代码复用锚点与测试接缝（Seam）**：指向 `§2` 的 `相对路径 + 符号名 + 参考行号` 与 `§3` 的公共测试边界。
4. **允许写入的文件范围与工作目录**：明确 worktree / 分支与禁止触碰的 `Out of Scope` 文件。
5. **验证命令与返回格式**：要求返回「改动文件清单 + 先红后绿测试命令与输出摘要」（子代理不直接改 `issue.md`）。

### 2. 防退化 4 道准入检查（Gates）
1. **派发前准入（Pre-Dispatch Gate）**：校验 `issue.md` 已含 `§1`~`§4`（跳过 Spec 的小修需含 `§1`+`§2`）、`R1..Rn` 无删减、插件 `depends_on` 无环且前置切片已 `completed`、受控模式下已获明确批准。
2. **切片回写准入（Slice Verification Gate）**：核对红绿测试输出（Bug 修复优先用真实故障复现红灯，不把环境报错当红灯；仅在验证测试敏感度时使用隔离变异并强制还原），检查工作区无未登记的散装过程 `.md`。**同一切片针对同一故障的修复验证连续失败 3 次（TDD 初始预期红灯不计入失败次数，换模型或恢复会话不重置计数）立即停机保留现场并写回 `issue.md` 报 Blocker，严禁篡改或弱化测试断言凑绿、严禁叠兼容垫片。**
3. **三合一审查准入（Review Gate）**：`reviewer` 逐条核对 `R1..Rn` 兑现度（`Spec` 轴）、Fowler 12 坏味道（`Standards` 轴）与复用四问梯子 + 反过度防御 + 删腐烂注释（`Reuse & Simplify` 轴）。
4. **关闭目标准入（Close Gate）**：所有 `R1..Rn` 与切片 `S1..Sn` 均已绑定持久验证证据，才允许调用 `update_goal(status="complete")`。

---

## 四、动态操作算子（`plan_ops`）与模型一二三优先级路由

### 1. 运行中动态插拔、重排与依赖声明（`update_goal_plan`）
- **声明垂直切片依赖（`depends_on`）**：
  ```json
  { "id": "S2", "description": "接入导出接口 (Covers: R2)", "status": "pending", "depends_on": ["S1"] }
  ```
- **置顶或插入积木（`insert_task`）**：
  ```json
  { "op": "insert_task", "phase_id": "phase_1", "task_id": "N1", "description": "Grill: 需求澄清", "position": "first" }
  ```
- **重排积木顺序（`reorder_tasks`）**：
  ```json
  { "op": "reorder_tasks", "phase_id": "phase_1", "task_ids": ["B1", "N4", "N2", "N3", "N7"] }
  ```
- **裁剪未开始积木（`remove_task`）**：
  ```json
  { "op": "remove_task", "phase_id": "phase_1", "task_id": "N6" }
  ```

### 2. 主会话自定义模型 + 子 Agent 一二三优先级
- **主会话模型**：100% 尊重老板在 OpenCode 选择的任意主模型（`GPT-6 Astra`、`GPT-6 Sol`、`GPT-6.1 Sol`、`Fable 5.1`、`Opus 5.5` 等）。
- **子 Agent 一二三优先级**：
  - **第一优先级（老板当轮点名，最高优先）**：显式传入 `subagent(..., model="<provider>/<model>#<effort>")`。
  - **第二优先级（角色默认配置）**：不传 `model` 参数，读取 `opencode.json` 默认配置。
  - **按任务复杂度分级选模**：主干/复杂编码（含 `N3: Spec` / `N5: Tickets` 的多文件改动、并发与状态机修复）默认保持 `word-claude/claude-opus-5-5#medium`；跳过 `N3: Spec` 的小修小补（单文件机械小改、改配置/文案、几行补丁）或轻量 `explore` 检索，由主会话显式传 `model="word-claude/claude-sonnet-5-5#medium"`，不挂 `#high`（Word 通道含 `NormalizeSonnet55DisabledThinking:True`，`#high` 无效）。
  - **第三优先级（`auto-continue-harness.js` 三级自动降级）**：渠道异常时同会话自动按三级备选链降级并追加 `[Fallback Executed: requested=... -> actual=...]` 审计标记。

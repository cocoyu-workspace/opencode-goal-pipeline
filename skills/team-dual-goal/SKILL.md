---
name: team-dual-goal
description: "[弹性原子积木Goal调度] Antigravity (agy) 主会话用 GPT (GPT-6 Astra / GPT-6.1 Sol) 负责深度需求澄清、原生 /goal 长任务主控、多模态/GUI 真机验收与最终交付，并按场景灵活调度 OpenCode 全能后台（explore/research/coder/reviewer/general 或 CLI 测试）的 7 个原子积木（N1~N7 / B1~B7）与单文件精简主卡契约规程。"
---

# 弹性原子积木 Goal 调度与场景化灵活协同规程（`agy /goal` × `opencode run` · `N1`~`N7` / `B1`~`B7`）

## 一、核心原则：搭积木式动态拼接 + 老板指令第一顺位 + 单主卡精简契约

1. **拒绝死板固定模板与散装文档臃肿**：
   - 每个需求或 Bug 按清晰度与复杂度动态插拔原子积木，按场景优势灵活选执行方，不把后台能力写死在某两个角色上。
   - **主卡单写者（Single-Writer）与单点编辑（One-Place Edit）原则**：所有节点的产出统一收束进单张权威主卡 `issue.md`（或 GitHub Issue 正文），**由 `agy` 主会话唯一执笔更新**（对齐 Matt Pocock `writing-for-agents` 共址定律、Anthropic `<200 行` 单文件 `SPEC.md` 规范与 `BMAD-METHOD` v7 PR #3100 *"The ticket is the spec"*，根治 60% 编码期返工导致的多文件失步投毒）；通过 `opencode run` 调度的各类后台子任务只返回结构化结论、diff 与验证证据，严禁子代理并发直接覆写 `issue.md` 或私自新建 `investigation.md`、`preflight.md` 等散装过程文件（>2,000 tokens 临时大日志统一放 `.scratch/`，不入 Git）。
   - **3 条法定外拆物理边界**：90%+ 任务保持单文件闭环；仅当命中 ① 跨多会话长跑（>4 个独立切片，需隐藏后续步骤防止诱发 Agent 抢跑 Premature Completion）、② 多 worktree / 跨仓并行认领（防并发写覆盖）、③ 大体积原始抓包日志或分支参考材料时，才外拆 `tickets/01-slug.md` 或独立附件。
2. **需求完整性（`R1..Rn` 零删减）优先于行数预算**：
   - `issue.md` 默认阅读预算为 **`~120 行`**（指导值），**严禁为了凑行数或凑「5 条上限」而删减老板明确提出的任何需求**。
   - 必须用稳定需求编号 `R1..Rn` 完整覆盖所有需求并 100% 映射到切片与验收；超预算时优先砍掉重复背景叙述、过程流水账与大段代码，其次按独立交付边界拆卡。
3. **老板显式指令永远为第一优先级（Priority 1）**：
   - 老板说「先做某某评审」「把某某指定为第一位」→ 立即将该节点置顶执行。
   - 老板说「不用审方案直接写」「跳过调研」→ 立即裁剪对应未开始节点。
   - 老板说「一个 `/goal` 自动走完流程」→ 拔掉 `N6/B6` 门禁，直接拼入 `N7/B7` 跑完全自动闭环。

---

## 二、7 个标准原子 Skill 积木与单文件 `issue.md` 六节契约映射

由 `agy` 主会话（`GPT-6 Astra` / `GPT-6.1 Sol`）统筹编排，按以下原子积木动态插拔（**注意顺序：当启用拆图时，先完成 `N3 (Spec)` + `N5 (Tickets)`，再由 `N4 (Review)` 一并审查 Spec、测试接缝与垂直切片依赖图**）：

| 执行顺序与积木节点 | 推荐执行方与调度方式（详见 §五判据表） | 运行属性 | 在主卡 `issue.md` 中的唯一对应章节 | 何时插上 / 何时拔掉 |
| :--- | :--- | :--- | :--- | :--- |
| **`B1` · Issue 建档 (`issue-track`)** | `agy` 主会话（`gh-atg` 或仓内 `TeamIssue`） | `AFK` | 创建或绑定权威主卡 `issue.md` | 新任务留痕时插上；已在当前卡内跟进时跳过 |
| **`N1` / `B2` · 需求理解与评审 (`Grill / Req-Review`)** | **按需弹性触发，不固定必跑**：<br>• 需对齐意图：`agy` 主会话直接聊<br>• 拿不准需求真伪或老板点名审需求：调 `opencode run --agent reviewer --auto` | `HITL` / `AFK` | **§1 需求与不改边界（`R1..Rn` + `Out of Scope`）**：用稳定编号 `R1..Rn` 列出全部明确需求（零删减）与禁止越界范围；长期术语/ADR 更新至仓内文档并引用 | 想法模糊需对齐、或需审视需求本身时按需启用；**需求已清楚时直接跳过，不搞固定仪式** |
| **`N2` / `B3` · 现状取证 (`Research`)** | `agy` 就地取证，或灵活调 `opencode run --agent explore/research --auto`（亦可用 `agy` 原生 `scout`/`research`） | `AFK` | **§2 根因与代码复用锚点**：记录基线 Commit SHA、**`相对路径 + 符号名 + 参考行号`**（抗行号漂移）的根因与本仓可复用函数、必要性与不改判据门禁 | 需查日志复现或查本仓/外部方案时插上；内部几行机械小改直接拔掉 |
| **`N3` / `B4` · 规格合成 (`Spec`)** | `agy` 主会话（`team-codebase-design` + 复用四问梯） | `AFK` | **§3 精简 Spec 与测试接缝（Seams）**：<br>• 模块深接口变更与复用四问结论（禁贴 >15 行实现代码）；<br>• 锁定最高层公共测试接缝（Seam），写明每个 Seam「能捕获什么、不能捕获什么、对应哪条 `R#`」 | 涉及多文件协议或架构调整时插上；小修小补直接跳过（仅保留 §1+§2） |
| **`N5` · 任务图拆解 (`Tickets`)** | `agy` 主会话（Tracer-Bullet 垂直切片 + `depends_on` 阻塞边） | `AFK` | **§4 垂直切片任务图（Vertical Slices）**：<br>• 每片必须切穿端到端可独立验证行为（禁水平分层），格式：`- [ ] [S1] 交付行为 (Covers: R1 \| depends_on: [])`；<br>• 仅当需多 worktree 并行认领、跨仓发布或单片超出上下文窗口时，才外拆 `tickets/01-slug.md` | 涉及多步或大 Spec 时插上；单点改动无需拆图 |
| **`N4` / `B5` · 异构互辩 (`Review`)** | `opencode run --agent reviewer --auto`（可单审或 Astra + Fable 双审） | `AFK` | **§5 Review & Decision Log**：一并审查 §1~§4（含 Spec、Seam 与垂直切片图），记录审查模型、契约版本、阻断项处理结果与关键取舍 | 重大方案防自嗨时插上；老板说「不用审方案」或紧急小修直接拔掉 |
| **`N6` / `B6` · 决策门禁 (`Gate`)** | `agy` 主会话（`HITL` 拍板门禁 + ≤10 行简报） | `HITL` | **受控/连贯插拔开关**：受控模式在此停机等拍板（明确批准后进入 `N7`） | 受控双阶段模式插上；**单 `/goal` 全自动模式直接拔掉** |
| **`N7` / `B7` · 实施、审查与真机验收 (`Impl & Verify`)** | • 编码/脚本/CLI 测试：按场景调 `opencode run`（`coder`/`general`/CLI 测试）<br>• 代码冷审：`opencode run --agent reviewer --auto`<br>• 多模态/浏览器/Computer Use 真机验收：**`agy` 原生多模态 + MCP + `tester` 长控执行** | `AFK` | **§6 交付与持久验收证据**：主会话传「最小完整交接包」调度实施与 CLI 测试，涉及 UI/浏览器/桌面交互时由 `agy` 原生完成真机验收并留截图/日志证据，统一回填 Commit/PR 与验收结果 | 所有写代码或验证场景必插；纯咨询任务拔掉 |

---

## 三、子任务「最小完整交接包（Minimal Context Pointer Pack）」与 4 道准入检查

### 1. 派发后台子任务的最小完整交接包（通用五项指针，禁复制长文）
主会话通过 `opencode run` 或内置子 Agent 派单时**严禁只传半截章节导致丢失 `§1 Out of Scope` 与 `§2 复用锚点`**，统一传递以下 5 项指针参数：
1. **权威主卡路径与契约版本**：`<path/to/issue.md>`（要求子代理先读取相关章节，单写者权限归 `agy` 主会话，子代理不直接覆写 `issue.md`）。
2. **当前任务目标与覆盖范围**：明确对应的切片 `Slice S#`（`Covers: R#`）或具体调研/评审/测试问题。
3. **证据入口与代码复用锚点**：指向 `§2` 的 `相对路径 + 符号名 + 参考行号` 与 `§3` 的公共测试接缝（Seam）。
4. **工作目录与权限边界**：明确 worktree / 分支、只读约束或允许写入的文件范围（以及禁止触碰的 `Out of Scope` 文件）。
5. **验证方式与返回格式**：代码/脚本任务返回「改动文件 + 先红后绿或定向测试输出摘要」；只读探路/调研/评审任务返回「带 `file:line` 或实测输出的结论与风险」。

### 2. 防退化 4 道准入检查（Gates）
1. **派发前准入（Pre-Dispatch Gate）**：校验 `issue.md` 已含必要上下文、`R1..Rn` 无删减、`depends_on` 前置切片已完成、受控模式下已获明确批准。
2. **切片回写准入（Slice Verification Gate）**：核对测试与真机验证输出（Bug 修复优先用真实故障复现红灯，不把环境报错当红灯；CLI 测试通过不等于 GUI/多模态真机验收通过），检查工作区无未登记的散装过程 `.md`。**同一切片针对同一故障的修复验证连续失败 3 次（TDD 初始预期红灯不计入失败次数，换模型或恢复会话不重置计数）立即停机保留现场并写回 `issue.md` 报 Blocker，严禁篡改或弱化测试断言凑绿、严禁叠兼容垫片。**
3. **三合一审查准入（Review Gate）**：`opencode run --agent reviewer --auto` 逐条核对 `R1..Rn` 兑现度（`Spec` 轴）、Fowler 12 坏味道（`Standards` 轴）与复用四问梯子 + 反过度防御 + 删腐烂注释（`Reuse & Simplify` 轴）。
4. **关闭目标准入（Close Gate）**：所有 `R1..Rn` 与切片 `S1..Sn` 均已绑定持久验证证据（含必要的 GUI/多模态真机验收证据），并回填至 `issue.md` 的 `§6` 后完成收尾。

---

## 四、模型一二三优先级路由

- **主会话模型（`agy`）**：在 `Antigravity`（`Antigravity.app` GUI 或 `agy-gpt` CLI）中自由选择 `GPT-6 Astra`、`GPT-6.1 Sol`（深度思考用默认 `High`/`Max`，快速交互切 `Fast` / `Ultra Fast` 档位）负责主会话需求澄清、原生 `/goal` 长控与最终交付。
- **OpenCode 子 Agent 一二三优先级**：
  - **第一优先级（老板当轮点名，最高优先）**：显式传入 `opencode run --agent <role> -m "<provider>/<model>#<effort>" --auto`（或 OpenCode 内部 `subagent(..., model="...")`）。
  - **第二优先级（角色默认配置）**：不传 `-m` 参数，直接走 `~/.config/opencode/opencode.json` 五大专职角色默认配置（`coder`/`research`/`explore`/`general`: `word-claude/claude-opus-5-5#medium`；`reviewer`: `perplexity/fable-5.1#high`）。
  - **按任务复杂度分级选模**：主干/复杂编码（含 `N3: Spec` / `N5: Tickets` 的多文件改动、并发与状态机修复）默认保持 `word-claude/claude-opus-5-5#medium`；跳过 `N3: Spec` 的小修小补（单文件机械小改、改配置/文案、几行补丁）或轻量 `explore` 检索，可由 `agy` 主会话直接动手，或传 `-m word-claude/claude-sonnet-5-5#medium`（Word 通道含 `NormalizeSonnet55DisabledThinking:True`，不挂 `#high`）。
  - **第三优先级（`auto-continue-harness.js` 三级自动降级与异构防自审）**：OpenCode 内部派发子代理遇渠道异常时，自动按三级备选链降级并追加 `[Fallback Executed: requested=... -> actual=...]` 审计标记；`agy` 外层调 `opencode run --agent reviewer --auto` 遇限流时，按被审对象作者模型异构选备（评审 GPT 写的 `N4/B5` 方案时改传 `-m perplexity/sonnet-5.5#high` 或 `-m word-claude/claude-opus-5-5#high`；评审 `coder` Opus 写的 `N7/B7` 代码时改传 `-m perplexity/sonnet-5.5#high` 或 `-m openai/gpt-6.1-sol#high`，严禁让 Opus 审 Opus 自己的代码）。

---

## 五、`agy` × `opencode` 场景化灵活调度判据（唯一正文，其余文件只写指针）

> **一句总判据**：要跟老板对齐意图（深度思考 + 快速澄清）、要全程 `/goal` 长任务主控与主卡单写、要看屏幕/图片/音视频做多模态或浏览器/Computer Use 真机验收的归 **`agy`**；能在后台独立跑完并回传文本/diff/日志证据的（探路、调研、编码、冷审、脚本产物、CLI 测试套件）由 `agy` 按场景灵活调度全能 **`opencode run`**，不写死单一角色。

| 场景阶段与任务特征 | 优先执行方 | 调用入口与优势说明 |
| :--- | :--- | :--- |
| **需求理解、澄清追问（Grill）与按需需求评审** | **`agy` 主会话（GPT-6 Astra / 6.1 Sol）** + 按需调 **`opencode reviewer`** | **按需触发不写死**：主会话用 GPT 深度思考（`High`/`Max`）与快速交互（`Fast`/`Ultra Fast`）对齐意图；仅当需求本身存疑或老板要求时，才调 `opencode run --agent reviewer --auto` 审需求 |
| **长任务主控、`/goal` 编排、`issue.md` 单写与最终交付** | **`agy` 主会话（原生 `/goal`）** | 原生 `/goal` + 后台异步任务唤醒（`run_command` + `manage_task`），唯一执笔主卡与 GitHub 交付不乱账 |
| **多模态理解（图片/PDF/音视频）与浏览器/桌面 GUI 真机验收** | **`agy` 原生多模态 + `tabbit-cli` / MCP + 内置 `tester`** | 直接使用 `agy` 原生多模态 `read_file`、**`tabbit` CLI（`~/.local/bin/tabbit-cli` 控制 Tabbit 浏览器）**、`chrome-devtools` MCP、`cua-driver` / `computer-use` 与起服务长控能力完成视觉和真机链路验收 |
| **<20 行单点小改或快速只读核查** | **`agy` 主会话直接动手** | 免除跨进程派单开销，秒级办完 |
| **未知代码位置快速探路与调用链定位** | **OpenCode `explore`**（或 `agy` 原生 `scout`） | `opencode run --agent explore --auto "<prompt>"`（强制只读，并行定位 `file:line`） |
| **`memex` 知识库、`OV` 文档与高星开源方案深度调研** | **OpenCode `research`**（或 `agy` 原生 `research`） | `opencode run --agent research --auto "<prompt>"`（复用 OpenCode 已配齐的 `openviking`/`zread`/`exa` MCP 与三级降级） |
| **跨文件业务编码、重构、修 Bug、补单测与局部验证** | **OpenCode `coder`** | `opencode run --agent coder --auto "<prompt>"`（默认复用已深度适配的 `word-claude/claude-opus-5-5#medium`） |
| **需求预审、方案/代码独立冷审、双模型互辩、疑难破局** | **OpenCode `reviewer`** | `opencode run --agent reviewer --auto "<prompt>"`（默认 `perplexity/fable-5.1#high`，亦可并行调 `-m openai/gpt-6-astra` 双审） |
| **批量资料整理、数据转换、独立报告与任务内一次性脚本** | **OpenCode `general`** | `opencode run --agent general --auto "<prompt>"`（同批混合产物与校验一次包办） |
| **纯命令行测试套件、构建检查或全能后台批处理** | **`agy` 就地运行** 或 **OpenCode 后台** | 就地 `run_command`，或调 `opencode run --auto "<任务>"` 在后台跑完并回传退出码与关键日志 |

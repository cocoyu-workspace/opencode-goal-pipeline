---
name: team-dual-goal
description: "[弹性原子积木Goal调度] Antigravity (agy) 主会话（Gemini / GPT-6 Astra / GPT-6.1 Sol）负责深度需求澄清、原生 /goal 长任务主控、多模态/GUI 真机验收与最终交付，并按场景灵活调度 OpenCode 全能后台（explore/research/coder/reviewer/general 或 CLI 测试）的四大阶段 12 块标准积木（B1~B12）、4 问自检与 6 套选块配方及单文件精简主卡契约规程。"
---

# 四大阶段 12 块标准积木与场景化灵活协同规程（`agy` $\times$ `opencode run` · `B1`~`B12`）

## 一、三档触发方式 + 选块 4 问自检 + 6 套标准拼装配方

### 1. 平时在 `Antigravity (agy)` 使用 Gemini / GPT 的三档触发方式

1. **日常零口令直接说（默认推荐）**：
   - 无需背任何固定口令，直接描述需求、Bug 或问题即可。
   - 主会话在首轮先跑下方「选块 4 问自检」，挑出本次所需的最小积木链，并在首轮顶部用一行简报所选节点、交付终点与必要停机条件（例如：`本次走 [配方 2 · Bug 修复]：B1 -> B4 -> B10 -> B12`），随后立即开工。
2. **长任务一键跑到底（输入 `/goal <你的目标>`）**：
   - 当任务希望 Agent 全自动连续跑完（不中途停下汇报常规方案）时，用 `/goal` 开头。
   - 自动拔掉常规方案审批门禁 **`B9 (approval-gate)`**，但**四道硬停机红线在 `/goal` 下不可拔除**：① 存在查代码也无法确定的用户可感知需求分叉、② 缺凭证/权限或触及未获授权的外部/不可逆写操作（`git push`、提 PR、删数据、生产库/部署）、③ 同一故障修复验证连续失败 3 次、④ 老板显式声明「只出方案 / 先不改代码」。
3. **老板手动点菜 / 插拔（第一优先级 Priority 1）**：
   - 老板说「先做需求评审」「让 Astra 和 Fable 双审方案」「跳过调研直接改」→ 立即按指令置顶或裁剪对应积木节点。

### 2. 自动选块「4 问自检」算法（全流程唯一选块判据）

```text
收到任务后，主会话在脑中按顺序只判断四件事（不在回复里展开自检过程）：
Q1（交付与授权终点）：本次是只读排查/咨询、只出方案、写代码验证，还是已获授权对外交付（push / PR / 关单）？
Q2（需求清晰度与真伪）：是否存在查代码也无法确定的用户可感知分叉（是 → 插 B2: req-grill）？需求本身是否与现码/既有规则冲突或疑似伪命题（是 → 插 B3: req-review）？
Q3（事实与根因是否已证实）：是否是异常/Bug（是 → 先插 B4a: bug-locate 调 explore 快模型 Sonnet 秒级定位报错时间线与 file:line；若根因仍未 100% 坐实或需构造红灯复现，再进 B4b: bug-repro 用 Opus 深挖）？非 Bug 任务是否涉及未知调用链或需查 memex / 500 星开源成熟方案（是 → 插 B5: explore & research）？
Q4（变更范围、风险面与切片粒度）：是否跨文件改接口/状态机或需设计取舍（是 → 插 B6: spec-draft + B8: spec-review；多步端到端改动再依赖 B6 插 B7: slice-tickets）？是否触及鉴权、并发、迁移、计费等高风险面或跨模块逻辑（是 → 必插 B11: code-review，严禁按行数豁免）？
```

### 3. 6 套标准拼装配方与 4 条动态覆盖规则

| 配方名称 | 典型适用场景 | 自动选中的积木链 |
| :--- | :--- | :--- |
| **配方 1 · 低风险随手小改** | 需求明确、单文件 `<20 行`、不触及高风险面的改文案/调配置/微补丁 | **`[B1] -> B10 -> B12a`**（一口气秒改秒验，`B1` 按目标仓留痕规则挂接） |
| **配方 2 · 常规 Bug 修复** | 报错明确或可本地复现的故障修复 | **`B1 -> B4a (浅层秒级定位) -> [B4b 深度复现查根] -> B10 (先红后绿修复) -> [按风险挂 B11] -> B12`** |
| **配方 3 · 中等明确需求 / 高风险小改** | 需求清楚但跨文件改逻辑（需出技术方案并审方案），或虽仅几行但触及鉴权/并发/迁移/计费等高风险面 | **`B1 -> B5 -> B6 -> B8 -> B10 -> B11 -> B12`**（高风险几行小改可省 `B5/B6/B8`，走 `B1 -> B10 -> B11 -> B12`） |
| **配方 4 · 模糊想法或复杂架构大需求** | 需求待磨清、涉及多模块重构或需分片实施 | **`B1 -> B2 -> [B3] -> B5 -> B6 -> B7 -> B8 -> [B9] -> B10 -> B11 -> B12`** |
| **配方 5 · 纯调研 / 排障定位 / 架构咨询（只读）** | 只要求查清原因、调研开源方案或输出设计评估，不改业务代码 | **`[B1] -> B4/B5 -> [B6 -> B8] -> B12a（输出结论报告）`**（严禁自动滑入 `B10`） |
| **配方 6 · 独立专项评审（只审不改）** | 老板已有现成需求、方案或代码 diff，点名做专项审查 | 单独运行 **`B3 (req-review)`**、**`B8 (spec-review)`** 或 **`B11 (code-review)`** |

- **4 条动态覆盖规则**：
  1. **只读任务先过滤**：凡属只读排查、咨询或未获改码授权的任务，终点锁定在 `B8` 或 `B12a` 结论汇报，不得因选中 Bug 配方而自动进入 `B10`。
  2. **高风险优先于少行数**：凡触及鉴权、权限边界、并发状态机、数据迁移、计费或外部协议的修改，即使只有几行也必须走 `B11 (code-review)`，不得套用配方 1。
  3. **Bug 诊断发现架构变更时动态升级**：跑完 `B4 (bug-repro)` 若发现根因涉及跨模块协议或状态机重构，立即动态补入 `B6 (spec-draft) -> B8 (spec-review)`。
  4. **无切片不造空壳门禁**：未启用 `B7 (slice-tickets)` 时，`R1..Rn` 直接关联 `§6` 验收证据，不伪造空 `S1` 或依赖图。

---

## 二、四大阶段 12 块全量标准积木菜单（`B1`~`B12`）与单文件 `issue.md` 六节契约映射

> **核心不变量**：**积木是可选动作，不是必填章节、独立文件或必派子 Agent。** 一个动作可复用已有证据，多个动作可更新同一章节，**跳过某个动作不等于删除该动作负责的不变量**（例如需求已明确跳过 `B2` 时，仍由 `B1` 在 `§1` 初始化 `R1..Rn`；跳过 `B4/B5` 独立取证时，改代码前的最小源码核对仍不可省）。所有节点产出统一收束进单张权威主卡 `issue.md` 或 GitHub Issue 正文（**由 `agy` 主会话唯一执笔 Single-Writer**，默认阅读预算 `~120 行`，`R1..Rn` 需求零删减；仅跨多会话 `>4` 切片、多 worktree 并行或 `>2,000 tokens` 原始大日志入 `.scratch/` 时才外拆）。

| 阶段 | 积木代号与名称 | 解决什么问题（借鉴来源） | 默认执行方 | 对应 `issue.md` 章节 | 何时插上（适用场景） | 何时跳过（裁剪判据） |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **一、立项与需求阶段** | **`B1` · 任务建档 (`issue-track`)** | 建 GitHub Issue 或本地 `issue.md` 权威主卡并初始化已知 `R1..Rn`（BMAD *"The ticket is the spec"*） | `agy` 主会话 | 建卡并初始化 **§1** | 新需求、Bug 修复、问题排查（遵循目标仓留痕规则） | 已在当前卡内跟进，或无卡仓库的 `<20 行` 低风险微改 |
| **一、立项与需求阶段** | **`B2` · 需求理解与澄清 (`req-grill`)** | 追问对齐老板真实意图与边界，每问必带正向推荐选项（Matt `grill-me` `#1193` + `team-grilling`） | `agy` 主会话（`HITL`） | **§1 需求与不改边界 (`R1..Rn` + `Out of Scope`)** | 存在查代码也无法确定的用户可感知分叉（≥2 个未决点提议开磨，1 个直接问） | 老板需求、验收标准与边界已经表达清楚时直接跳过 |
| **一、立项与需求阶段** | **`B3` · 需求独立评审 (`req-review`)** | 跳出给定框架审视需求必要性（Why）、是否与现码/既有规则冲突或属伪命题（本土对称闭环 `#6`） | `opencode reviewer`（`AFK` 只读返回主会话） | **§1 + §5 Review & Decision Log** | 需求与现码/规则冲突、疑似伪命题、代价过高或老板点名审需求 | 常规明确需求、确定性 Bug 修复直接跳过 |
| **二、取证与定位阶段** | **`B4` · 两级渐进排障：浅层快速定位 (`B4a: bug-locate`) + 深度复现查根 (`B4b: bug-repro`)** | • **`B4a` 浅层秒级定位（默认必跑）**：调只读 `explore`（Word Claude Opus 5.5）秒级提取「报错时间线 + 异常堆栈与上下游 1~2 跳精确 `file:line` + 现有测试入口命令」（根因已一目了然的简单 Bug 直接跳过 `B4b` 进 `B10`）<br>• **`B4b` 深度复现与根因诊断（复杂/未坐实 Bug 必跑）**：遵从 `team-diagnosing-bugs`，由 `coder`（`Opus 5.5`）构造并运行最小红灯复现命令/单测，或调 `explore`（Word Claude Opus 5.5）深挖状态机与并发根因 | • `B4a`：`opencode explore`（默认 `word-claude/claude-opus-5-5#medium` 秒回，长日志推理传 `-m word-claude/claude-opus-5-5#high`）<br>• `B4b`：`opencode coder` / `explore`（`word-claude/claude-opus-5-5#medium`）或 `reviewer`（`word-claude/claude-opus-5-5#high`） | **§2 现状根因与代码复用锚点** | 线上/本地报错、行为异常、性能退化等 Bug 排障任务（先 `B4a` 快筛，按需进 `B4b` 深挖） | 新功能开发、纯文档/配置调整，或根因 `file:line` 已在输入中 100% 坐实 |
| **二、取证与定位阶段** | **`B5` · 代码探路与外部方案调研 (`explore & research`)** | 非 Bug 任务查本仓现成可复用实现（`explore`/`scout`）+ 查 `memex` 与 500 星开源成熟方案（`research`） | `opencode explore` / `opencode research`（只读） | **§2 现状根因与代码复用锚点** | 非 Bug 任务涉及未知调用链、新架构选型、跨模块改造或需对照开源方案 | Bug 任务（已由 `B4` 覆盖探路）或本仓几行代码一目了然的小改 |
| **三、方案与拆图阶段** | **`B6` · 起草技术方案与测试接缝 (`spec-draft`)** | 设计模块深接口、过复用四问梯子、锁定最高层公共测试接缝 Seam（Matt `write-a-prd` + `team-codebase-design`） | `agy` 主会话 | **§3 精简技术方案与公共测试接缝 (Seams)** | 涉及跨文件改动、接口/状态机调整、存在多种实现路线需取舍 | 单点机械小改、纯文案/配置修改（跳过时验证命令直记 `§6`） |
| **三、方案与拆图阶段** | **`B7` · 垂直切片任务图拆解 (`slice-tickets`)** | **依赖 `B6`**：按端到端可独立验证的 Tracer-Bullet 切出 `S1..Sn` 与 `depends_on` 阻塞边（Matt `prd-to-issues`） | `agy` 主会话 | **§4 垂直切片任务图 (`S1..Sn`)** | 跨 3 个以上模块、多步长链路或需多 worktree 分步交付的大任务 | 1~2 步即可改完测通的中小任务（跳过时 `R1..Rn` 直接关联 `§6`） |
| **三、方案与拆图阶段** | **`B8` · 技术方案独立评审 (`spec-review`)** | 针对 `B6`（及已启用的 `B7`）做三合一独立冷审（按需单审或 `Astra + Fable` 双审，`team-review-governance`） | `opencode reviewer`（相对 `B6` 作者模型异构，只读） | **§5 Review & Decision Log** | 凡启用了 `B6 (spec-draft)` 的中大型方案或架构改动默认必配 | 未启用 `B6` 的小改，或老板明确说「不用审方案直接写」 |
| **三、方案与拆图阶段** | **`B9` · 方案拍板门禁 (`approval-gate`)** | 改动业务代码前输出 `≤10 行` 方案与取舍简报，等待老板点头后再动代码 | `agy` 主会话（`HITL`） | **§5 Review & Decision Log** | 老板要求「先看方案再改」、或方案存在影响用户体验的重大取舍未拍板 | 老板已下令「直接改完」或开启 `/goal`（注：四道硬停机红线不可拔除） |
| **四、实施与交付阶段** | **`B10` · 垂直切片 TDD 编码 / 定向实施 (`slice-impl`)** | 代码改动锁定 `§3` Seam 跑「先红后绿」TDD，文档/配置改动执行引用与加载实现，并承接 `B11` 精简回流 | `opencode coder`（`<20 行` 低风险小改可由 `agy` 直接改） | **§6 交付与持久验收证据** | 所有需要修改代码、脚本、配置或文档的任务 | 纯只读调研、纯排障咨询或纯评审任务 |
| **四、实施与交付阶段** | **`B11` · 代码三合一独立评审 (`code-review`)** | 对照 `R1..Rn` 审漏做/越界（`Spec`）、Fowler 12 坏味道（`Standards`）与复用精简（`Reuse & Simplify`），结论回流 `B10` | `opencode reviewer`（相对 `B10` 作者模型异构，只读） | **§5 + §6** | 所有跨文件改动、核心逻辑变更，以及触及鉴权/并发/迁移/计费的几行高风险修改 | 仅限低风险且一眼可核实的单文件 `<20 行` 文案/配置/机械微改 |
| **四、实施与交付阶段** | **`B12` · 真机/多模态验收与授权交付 (`verify & deliver`)** | 内分两段：<br>• **`B12a` 真机/多模态与定向验收**：UI/浏览器/桌面用 `agy` 多模态 + `tabbit-cli` + `chrome-devtools` + `cua-driver` + `tester`，CLI/调研验命令或结论<br>• **`B12b` 归档与授权交付**：回填 `§6` 并在授权边界内执行 Commit / PR / 关单 | **`agy` 主会话主导**（可配合 `opencode` 跑 CLI 测试套件） | **§6 交付与持久验收证据** | `B12a` 所有任务必跑；`B12b` 在任务收尾及具备外部写授权时执行 | `B12a` 永不跳过；未获 `push`/PR/部署授权时停在本地验证完毕并请示 `B12b` |

---

## 三、子任务「最小完整交接包（Minimal Context Pointer Pack）」与 4 道准入检查

### 1. 派发后台子任务的最小完整交接包（通用五项指针，禁复制长文）
主会话通过 `opencode run` 或内置子 Agent 派单时**严禁只传半截章节导致丢失 `§1 Out of Scope` 与 `§2 复用锚点`**，统一传递以下 5 项参数：
1. **权威主卡指针（或无卡微改内联目标）**：传入本地 `<path/to/issue.md>` 或 GitHub Issue URL（单写者权限归 `agy` 主会话，子代理严禁直接覆写 `issue.md`）；若属无卡仓库的 `<20 行` 低风险微改，直接内联写明目标与 `Out of Scope` 边界，不创建空主卡。
2. **当前任务目标与覆盖范围**：明确对应的需求 `R#`、切片 `Slice S#`（仅启用 `B7` 时）或具体调研/评审/测试问题。
3. **证据入口与代码复用锚点**：指向 `§2` 的 `相对路径 + 符号名 + 参考行号` 与 `§3` 的公共测试接缝（Seam）。
4. **工作目录与权限边界**：明确 worktree / 分支、只读约束（`explore`/`research`/`reviewer` 严格只读）或允许写入的文件范围（以及禁止触碰的 `Out of Scope` 文件）。
5. **验证方式与返回格式**：代码/脚本任务返回「改动文件 + 先红后绿或定向测试输出摘要」；只读探路/调研/评审任务返回「带 `file:line` 或实测输出的结论与风险」；末尾固定报「有没有踩坑，没有写没有」。派单同时要求回报实际观察到的执行报错：失败动作、脱敏原始错误或错误码、处理动作、是否恢复、任务影响和证据位置，重试成功也不得隐藏。相同错误可合并，次数须有证据，不猜测未观察到的故障。预期测试红灯、搜索无匹配和主动取消按实际含义报告，不自动归为执行环境故障。

### 主会话收单与报错告知

- 子任务结束或失败唤醒后，主会话检查实际可获得的 stdout/stderr、退出码、最终总结与验证证据，不能仅凭退出码为 0、账本标记成功或子 Agent 自述完成认定成功。输出截断时回读后台任务日志，仍缺证据则明确报告未知，不要求老板自行打开调度详情。
- 实际观察到的执行异常必须在当前对话告知老板。已恢复的合并进该任务结果，未恢复且阻塞的在收到错误后及时说明失败动作、脱敏原始错误或错误码、处理、影响与证据位置。相同错误可合并，次数仅按证据填写。
- 分别报告“发生异常但已恢复”“未恢复并阻塞任务”“结果不完整、状态未知”。非零退出、无最终总结或验证缺失须结合实际含义判读，不得宣称正常完成。主动取消单独报告，预期测试红灯与搜索无匹配不自动算调度故障。
- `[Fallback Executed: ...]` 仅能证明发生模型切换，不能单凭它判断任务失败或具体错误原因。保留实际结果，原始原因不可见时说明“原因未获证实”。子 Agent 未能总结时仍由主会话报告已有失败证据，不假设子 Agent 知道模型侧之外的超时、断流或重试。

### 2. 防退化 4 道准入检查（Gates）
1. **派发前准入（Pre-Dispatch Gate）**：校验已知需求 `R1..Rn` 无删减、启用 `B7` 时前置 `depends_on` 切片已完成、启用 `B9` 时已获明确批准。
2. **实施验证准入（Implementation Verification Gate）**：核对测试与真机验证输出（Bug 修复优先用真实故障复现红灯，不把环境报错当红灯；CLI 测试通过不等于 GUI/多模态真机验收通过），检查工作区无未登记的散装过程 `.md`。**针对同一故障的修复验证连续失败 3 次（TDD 初始预期红灯不计入失败次数，换模型或恢复会话不重置计数）立即停机保留现场并报 Blocker，严禁篡改或弱化测试断言凑绿、严禁叠兼容垫片。**
3. **三合一审查准入（Review Gate，当启用 `B8` 或 `B11` 时）**：`opencode run --agent reviewer --auto`（只读）逐条核对 `R1..Rn` 兑现度（`Spec` 轴）、Fowler 12 坏味道（`Standards` 轴）与复用四问梯子 + 反过度防御 + 删腐烂注释（`Reuse & Simplify` 轴）；需修改项回流给 `agy`（改 `B6` 方案）或 `coder`（改 `B10` 代码并重跑验证）。
4. **验收交付准入（Close Gate，`B12a` + `B12b`）**：所有 `R1..Rn`（及已启用的 `S1..Sn`）均已绑定持久验证证据（含必要的 GUI/多模态真机验收证据）并回填至 `§6`；涉及 `git push`、PR 创建、线上部署或关单时核对当前授权边界。

---

## 四、模型一二三优先级路由与异构审查基准

- **主会话模型（`agy`）与「按需双棒（各司其职）」主控规程**：
  - 在 `Antigravity`（`Antigravity.app` GUI 或 `agy-gpt` CLI）中自由选用 `Gemini 4 Argon`、`GPT-6 Astra`、`GPT-6.1 Sol`（Magpie `agentEfforts.agy` 默认配 `"high"`；**Ultra Fast 档位严禁私开**，仅在老板当轮口头明确指定时允许开启；**Fast 偶尔可用**，由 Agent 视场景风险权衡决定）。
  - **主控通用铁律（对所有主控模型均生效）**：① **严禁主控直接手写跨文件业务代码**（仅限单文件、不触及鉴权/并发/迁移/计费/外部协议等高风险面的 `<20 行` 极低风险微改可由主会话直接改，其余业务编码一律在独立 `worktree` 派 `opencode run --agent coder` 执行）；② **严禁轮询后台任务**（异步命令转后台后直接停手等系统通知唤醒，禁止循环调用 `manage_task(status)`）。
  - **按场景复杂度可选「双棒主控（前 GPT 认知定稿 + 后 Gemini 实施交付）」**：
    1. **常规明确需求 / 常规确定性 Bug（默认单棒）**：直接由 **`Gemini 4 Argon`** 主控一杆到底（配合 `opencode` 子 Agent 完成探路、编码、异构冷审与验收），免除中途切模型与 20 万 token Prompt Cache 重建开销。
    2. **模糊大需求（需 `B2` 交互澄清）或跨端疑难日志排障（需 `B4` 交叉对账）——按需双棒模式**：
       - **第一棒（认知、取证与方案定稿：`GPT-6.1 Sol` / `GPT-6 Astra #high`，不开 Fast）**：
         * **新需求场景（`B1 -> B2 -> B5 -> B6 -> B8 -> B9`）**：主会话用 `GPT-6.1 Sol / Astra (#high)` 与老板澄清边界（`B2`），派 `opencode` 的 `Word Claude Opus 5.5` 探路并起草方案选项与草稿（`B5`），由主会话汇总定稿写入 GitHub Issue 正文（`B6`），完成独立冷审（`B8`）后在 **`B9` 切棒门显式停机**（即使开启 `/goal`，双棒模式下写完 Issue 也停一次请老板切 `Gemini`）。
         * **查日志与疑难排障场景（`B1 -> B4a/B4b -> [B6 -> B8] -> B9`）**：主会话用 `GPT-6.1 Sol / Astra (#high)` 派 `opencode explore` 抓日志时间线与 `file:line`（`B4a`），按需派 `B4b` 在诊断 worktree 构造最小复现（严禁修改产品实现代码），完成跨端证据对账与「真故障 vs 架构权衡」门禁甄别（若涉跨模块状态机/协议变更则补 `B6 -> B8`），将根因 `file:line`、最小修复方案与验证命令写入 GitHub Issue 后停机交棒。
       - **第二棒（工程实施、调度与真机交付：切换 `Gemini 4 Argon` 接管 `B10 -> B11 -> B12`）**：
         * **无损交接契约（复用 §三.1 五项交接包）**：`Gemini 4 Argon` 接手第一步**只读 GitHub Issue 正文与当前 `git status / worktree` 状态**（不依赖前序长聊天历史），严格创建独立 `git worktree`（`codex/issue-*`），派 `opencode coder`（`word-claude/claude-opus-5-5#medium`）执行先红后绿 TDD 编码（`B10`），派异构 `reviewer`（`openai/gpt-6-astra#high` 或 `gpt-6.1-sol#high`）执行代码三合一冷审（`B11`，实现层问题在第二棒内回流 `coder`，仅架构级变更才停机退回第一棒，且换模型不重置连续失败 3 次计数），最后完成真机验收与 PR 交付（`B12`）。
- **OpenCode 子 Agent 一二三优先级（Magpie 搭积木网关 + GLM 5.3 Max 兜底）**：
  - **职责解耦（Magpie 仅归 `AGY` GUI 使用，OpenCode 100% 直连 + 原生降级路由）**：
    - `Magpie`（`127.0.0.1:3425`）带有独立的重试、并发排队与上下文改写机制，**仅作为 `Antigravity.app` GUI 的本地自定义模型入口**（供 GUI 下拉框选 `Gemini 4 Argon`、`Claude Opus 5.5`、`GPT-6.1 Sol`、`GLM-5.3` 等，已彻底移除 `Perplexity`）。
    - **`OpenCode`（`opencode run`）不接入 `Magpie`**：直接通过 `word-claude`（直连 `https://newapi.resumegenkk.xyz/v1`）与 `openai`（原生直连 Codex）发请求，由 OpenCode 自身的 `auto-continue-harness.js` 承担降级路由，避免 Magpie 与 OpenCode 双重重试、并发排队叠加和上下文改写冲突。
  - **第一优先级（老板当轮点名，最高优先）**：显式传入 `opencode run --agent <role> -m "<provider>/<model>#<effort>" --auto`。
  - **第二优先级（角色默认配置）**：不传 `-m` 参数，直接走 `~/.config/opencode/opencode.json` 五大专职角色默认配置（`explore`: `word-claude/claude-opus-5-5#medium` 秒级快筛；`coder`/`research`/`general`: `word-claude/claude-opus-5-5#medium`；`reviewer`: `word-claude/claude-opus-5-5#high`）。
    - **按任务复杂度与排障阶段分级选模**：
      * **`B4a (bug-locate)` 浅层快速定位与日常 `explore` 探路（由 `agy` 主会话全自动判别，无需老板指定）**：老板只需丢出故障现象，由 `agy` 主会话（Gemini / Astra / 6.1 Sol）按输入特征自动选路——常规查代码/搜报错栈自动走 `explore` 默认的 `word-claude/claude-opus-5-5#medium`（无长思考预热延迟，秒级回传 `file:line`）；遇跨服务大日志或复杂时间线推理时，由 `agy` 自动加传 `-m word-claude/claude-opus-5-5#high`。
      * **`B4b (bug-repro)` 深度复现查根与主干/复杂编码（由 `agy` 根据 `B4a` 结果自动裁决是否升格）**：`B4a` 返回后，`agy` 主会话自动判断——若根因已 100% 一目了然（拼写、漏参、明显空指针）则自动跳过 `B4b` 直接进 `B10`；若原因未 100% 坐实或涉及状态机/并发/时序，`agy` 自动升格进入 `B4b`，派 `coder`（默认 `word-claude/claude-opus-5-5#medium`）跑最小红灯复现并查根（纯只读深挖复杂状态机则由 `agy` 自动传 `explore -m word-claude/claude-opus-5-5#medium`）。跳过 `B6` 的低风险小修小补可由 `agy` 直接动手或给 `coder` 传 `-m word-claude/claude-opus-5-5#medium`。
  - **第三优先级（`auto-continue-harness.js` 原生多级降级路由与按实际作者模型异构防自审）**：
    - `opencode run` 与内部 `subagent` 遇限流/配额耗尽/超时/渠道异常（403 权限拒绝除外）时，由 `auto-continue-harness.js` 通过 `SessionHooks.retry` 与 `prompt` 预检自动按备选链同会话降级续跑（`coder`/`research`/`general` 备选链：`word-claude/claude-opus-5-5#medium` $\rightarrow$ `word-claude/claude-sonnet-5-5#medium` $\rightarrow$ `openai/gpt-6.1-sol#high`；`explore` 备选链：`word-claude/claude-opus-5-5#medium` $\rightarrow$ `word-claude/claude-sonnet-5-5#medium` $\rightarrow$ `openai/gpt-6.1-sol#medium`；`reviewer` 备选链：`word-claude/claude-opus-5-5#high` $\rightarrow$ `openai/gpt-6-astra#high` $\rightarrow$ `openai/gpt-6.1-sol#high`），并输出 `[Fallback Executed: requested=... -> actual=...]`。
    - **异构冷审基准（`B3` / `B8` / `B11`）与思考强度铁律**：
      * **Ultra Fast 严禁私开（铁律）**：除老板当轮口头明确指定外，严禁在派发评审（`B3`/`B8`/`B11`）或后台任务中使用任何 `Ultra Fast` 档位（如 `openai/gpt-6-astra-ultrafast`、`openai/gpt-6.1-sol-ultrafast`、`--ultrafast` 等）。
      * **Fast 偶尔可用（由 Agent 自行决定）**：极轻量、低风险、一眼可判的微改（如纯文案修正、纯格式微调）做快速复核时，Agent 可自行决定偶尔选用 `Fast` 档位（如 `openai/gpt-6-astra-fast`）；常规核心方案与代码评审必须使用标准深度思考档位（`#high`，如 `word-claude/claude-opus-5-5#high`、`openai/gpt-6-astra#high`、`openai/gpt-6.1-sol#high`）。
      * **严格以「被审产物的实际作者模型」判定是否异构**（严禁同源模型自写自审）：
        - 若 `B6 (spec-draft)` 由 `agy` 使用 `GPT-6 Astra / 6.1 Sol` 正式定稿写入 Issue，则 `B8 (spec-review)` 必须使用非 GPT 模型（传 `-m word-claude/claude-opus-5-5#high`）才算异构；若 `B6` 主要由 `Word Claude Opus 5.5` 起草，则 `B8` 传 `-m openai/gpt-6-astra#high`（或高风险方案并行跑 `Astra + Opus` 双审）。
        - 若 `B10 (slice-impl)` 由 `coder` 使用 `word-claude/claude-opus-5-5` 编写，则 `B11 (code-review)` **必须显式传 `-m openai/gpt-6-astra#high`（或 `openai/gpt-6.1-sol#high`）使用非 Opus 模型**，严禁不传 `-m` 让默认 Opus reviewer 审 Opus 自己写的代码。

---

## 五、`agy` $\times$ `opencode` 场景化灵活调度判据与子 Agent 锁死规程（唯一正文，其余文件只写指针）

> **一句总判据**：**前台操作 100% 汇聚在 `Antigravity.app`**（已注入主力模型与 Word Claude Opus 路由）。主会话自身负责日常对话、需求澄清（`B2`）、原生 `/goal` 长控、主卡单写、多模态/浏览器/GUI 真机验收（`B12a`）与 `<20 行` 单点直接小改（配方 1）；**一旦需要派发任何子 Agent（探路、调研、编码、冷审、批处理），默认 100% 锁死走 `opencode run --agent <role> --auto`，严禁默认调用 `agy` 自己的内置 `invoke_subagent`（除非老板当轮明确口令指定）**。

### 1. 子 Agent 通道铁律：默认 100% 锁死 `opencode run`，仅老板显式点名才切 `agy` 子 Agent

| 子 Agent 通道名称 | 底层调用方式 | 模型与容灾特征 | 默认策略（老板未指定通道时） | 老板显式口令指派（说哪条走哪条，最高优先） |
| :--- | :--- | :--- | :--- | :--- |
| **通道 ① · `opencode run` 子 Agent（默认 100% 锁死）** | 调 `run_command` 执行 `opencode run --agent <explore\|research\|coder\|reviewer\|general> [-m <provider/model#effort>] --auto` | 支持按积木精准指定任意异构模型与档位，自带 `auto-continue-harness.js` **三层跨渠道自动降级**（401/429/5xx 同轮无缝切备选）；**评审与后台严禁私开 Ultra Fast，Fast 偶尔可由 Agent 酌情决定，常规核心评审必用 #high** | **所有子 Agent 任务默认唯一通道**：`B4a` 快筛、`B4b/B10` 深度复现与编码、`B5` 探路调研、`B3/B8/B11` 评审统一使用 Word Claude Opus 5.5 | 默认即走此通道；也可显式说 **「派给 opencode」** / **「用 opencode run 子 Agent」** |
| **通道 ② · `agy` 原生内置子 Agent (`invoke_subagent`)** | 调 `agy` 内置工具 `invoke_subagent`（`scout` / `research` / `coder` / `tester` / `general-purpose` / `self`，`Model: "inherit"`） | 强制继承当前 `Antigravity.app` 主会话选中的模型（二进制 `ParseModelTier` 锁死），无跨模型路由与三层降级 | **默认禁用（严禁自动触发）** | 仅当老板当轮明确说：<br>**「用 agy 原生子 Agent」**<br>**「用内置子 Agent / 派 agy subagent」** |
| **通道 ③ · `agy-gpt` CLI 命令行子进程** | 调 `run_command` 执行 `~/.local/bin/agy-gpt --model <model-id> -p "<prompt>"` | 通过 `agy` CLI + 本地 Magpie（`127.0.0.1:3425`）直连 11 个模型 × 3 档强度（无 OpenCode 三层自动降级插件） | **默认禁用（严禁自动触发）** | 仅当老板当轮明确说：<br>**「用 agy cli 子 Agent」**<br>**「用 agy-gpt 跑」** |

> **GUI 直接选模型的写码安全提示**：在 `Antigravity.app` 下拉框直接选模型写/改代码时，优先选 **`Claude Opus 5.5 (Word)`** 或 **`GPT-6 Astra / 6.1 Sol`**。

### 2. 场景阶段与默认执行方对照表

| 场景阶段与任务特征 | 优先执行方 | 调用入口与优势说明 |
| :--- | :--- | :--- |
| **需求澄清追问（`B2: req-grill`）与按需需求评审（`B3: req-review`）** | **`agy` 主会话（Gemini / GPT-6 Astra / 6.1 Sol）** + 按需调 **`opencode reviewer`** | **按需触发不写死**：主会话对齐意图；仅当需求与现码/规则冲突、疑似伪命题或老板点名时，才调 `opencode run --agent reviewer --auto` 审需求（`B3`） |
| **长任务主控、`/goal` 编排、`issue.md` 单写与最终交付（`B1` / `B6` / `B7` / `B9` / `B12b`）** | **`agy` 主会话（原生 `/goal`）** | 原生 `/goal` + 后台异步任务唤醒（`run_command` + `manage_task`），唯一执笔主卡与 GitHub 交付不乱账 |
| **多模态理解（图片/PDF/音视频）与浏览器/桌面 GUI 真机验收（`B12a`）** | **`agy` 主会话原生多模态 + `tabbit-cli` / MCP** | 主会话直接使用原生多模态 `read_file`、**`tabbit` CLI（`~/.local/bin/tabbit-cli` 控制 Tabbit 浏览器）**、`chrome-devtools` MCP、`cua-driver` / `computer-use` 完成视觉和真机链路验收 |
| **`<20 行` 低风险单点小改或快速只读核查（配方 1）** | **`agy` 主会话直接动手** | 免除跨进程派单开销，秒级办完 |
| **Bug 浅层秒级定位（`B4a: bug-locate`）与未知代码位置快速探路（`B5`）** | **OpenCode `explore`（默认 Word Claude Opus 5.5）** | `opencode run --agent explore --auto "<prompt>"`（强制只读，默认 `word-claude/claude-opus-5-5#medium` 秒级定位报错时间线、堆栈与 `file:line`；需高思考分析长日志时传 `-m word-claude/claude-opus-5-5#high`） |
| **Bug 深度根因诊断与最小红灯复现（`B4b: bug-repro`）** | **OpenCode `coder` / `explore` / `reviewer`（Word Claude Opus 5.5）** | 原因未 100% 坐实或需构造最小红灯复现脚本时，调 `opencode run --agent coder --auto`（`Opus 5.5`）写/跑变红复现环并查根；纯只读深挖跨模块状态机或破局调 `explore -m word-claude/claude-opus-5-5#medium` 或 `reviewer` |
| **`memex` 知识库、`OV` 文档与高星开源方案深度调研（`B5`）** | **OpenCode `research`** | `opencode run --agent research --auto "<prompt>"`（只读，复用 OpenCode 已配齐的 `openviking`/`zread`/`exa` MCP 与三级降级） |
| **跨文件业务编码、重构、修 Bug、补单测与精简落盘（`B10`）** | **OpenCode `coder`** | `opencode run --agent coder --auto "<prompt>"`（默认复用已深度适配的 `word-claude/claude-opus-5-5#medium`） |
| **需求评审（`B3`）、方案独立冷审（`B8`）、代码三合一评审（`B11`）** | **OpenCode `reviewer`** | `opencode run --agent reviewer [-m <异构模型#high>] --auto "<prompt>"`（严格只读，按被审产物实际作者模型保持异构：审 GPT 方案用 `word-claude/claude-opus-5-5#high`，审 Opus 代码必传 `-m openai/gpt-6-astra#high` 或 `gpt-6.1-sol#high`，高风险方案支持 `Astra + Opus` 双审） |
| **批量资料整理、数据转换、独立报告与任务内一次性脚本** | **OpenCode `general`** | `opencode run --agent general --auto "<prompt>"`（同批混合产物与校验一次包办） |
| **纯命令行测试套件、构建检查或全能后台批处理** | **`agy` 就地运行** 或 **OpenCode 后台** | 就地 `run_command`，或调 `opencode run --auto "<任务>"` 在后台跑完并回传退出码与关键日志 |

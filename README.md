# opencode-goal-pipeline

**`agy`（GPT-6 Astra / GPT-6.1 Sol 深度需求澄清 + 原生 `/goal` 长任务主控 + 多模态/GUI 真机验收交付）$\times$ `opencode run`（全能后台异构执行底座：按场景灵活调度 `explore` / `research` / `coder` / `reviewer` / `general` 与 CLI 测试）协同流水线**。

---

## 〇、现行主力工作流：`agy` 抓两头（需求澄清 + `/goal` 长控 + 多模态真机验收交付）$\times$ 灵活调度全能 `opencode run`（[`agy-magpie-harness/`](agy-magpie-harness/README.md)）

由于 OpenCode 旧 `opencode-goal` 插件采用定时器轮询续跑，在长任务下容易出现轮询空转与状态卡死，现已**彻底移除 `opencode-goal` 插件**，确立 **「按场景优势互补、灵活调度不写死」** 的双端协同架构：

```
用户在 Antigravity.app 桌面端（下拉选 GPT-6 Astra / GPT-6.1 Sol）或终端运行 agy-gpt
  │
  ├─ 1. 前段：需求理解与澄清（agy 主会话 + GPT-6 Astra / GPT-6.1 Sol）：
  │     ├─ 深度思考（High/Max）配合快速交互（Fast/Ultra Fast）与原生提问弹窗迅速对齐意图
  │     ├─ 按需调 OpenCode 探路/调研/预审：opencode run --agent explore|research|reviewer --auto
  │     └─ 落盘单文件精简契约 issue.md（agy 主会话唯一单写者，~120 行）
  │
  ├─ 2. 中段：原生 /goal 长任务主控 + 按场景灵活调度全能 OpenCode：
  │     ├─ 依托 agy 原生 /goal + 后台异步任务唤醒（run_command + manage_task）统筹全局进度
  │     ├─ 异构冷审/双审：opencode run --agent reviewer --auto（Fable 5.1 High / Astra 双审）
  │     ├─ 跨文件编码与补单测：opencode run --agent coder --auto（Word Claude Opus 5.5 / Sonnet 5.5）
  │     └─ 脚本/产物/CLI 测试：opencode run --agent general --auto 或 opencode run --auto 跑命令行测试
  │
  └─ 3. 后段：原生多模态 + 浏览器/桌面 GUI 真机验收与最终交付（agy 主导）：
        ├─ 涉及读图/PDF/音视频、tabbit-cli / chrome-devtools 浏览器交互、cua-driver 桌面点击与长链路起服务验收时，由 agy 原生多模态 + 内置 tester 直接执行
        └─ 汇总 CLI 测试与 GUI 截图证据回填 issue.md §6，满足全部判据后输出 <!-- GOAL_COMPLETE --> 收尾
```

### 日常排障与维护边界（以后出 Bug 改哪里？）

| 问题所属层 | 维护位置 | 是否需要动 `agy`？ |
| :--- | :--- | :--- |
| **Word / Perplexity 渠道兼容、流式超时、思考块过滤、子 Agent 提示词或降级策略** | 只改 OpenCode 配置（`~/.config/opencode/opencode.json` 与 `~/.config/opencode/plugins/auto-continue-harness.js`） | **完全不用动 `agy`**（`agy` 仅通过 `opencode run` 消费结果） |
| **`Antigravity.app` 桌面端下拉框的 8 个大写 GPT 模型列表** | `agy-magpie-harness/bin/sync-agy-gui-models.py` | 运行一次该脚本即实时同步至桌面端 |
| **`agy` 主会话 GPT 模型的 Fast / Ultra Fast 加速档位或 Gemini $\leftrightarrow$ Responses 协议转换** | `/Users/mac/开源工具/magpie`（补丁归档于 `agy-magpie-harness/patches/`） | 不改 `agy`，仅更新本地 `magpie` 网关 |

---

## 一、核心调度理念（唯一判据表见 [`skills/team-dual-goal/SKILL.md`](skills/team-dual-goal/SKILL.md) §五）

1. **按场景选执行方，不把分工写死在某两个角色上**：
   - **`agy` 主抓两头**：前段需求深度思考与快速澄清（Grill）、全程原生 `/goal` 长任务控制与 `issue.md` 单写者记账、后段多模态理解与浏览器/Computer Use 真机测试及最终交付。
   - **`opencode run` 全能后台底座**：充分发挥 OpenCode 对 Word（Claude）与 Perplexity（Fable）渠道的深度兼容与 `auto-continue-harness.js`（`v6`）三级自动故障降级优势，按需调度 `explore`、`research`、`coder`、`reviewer`、`general` 或直接执行 CLI 测试套件。
2. **老板显式指令永远排第一顺位（Priority 1）**：
   - 用户说「先做某某评审」「让 Astra 和 Fable 双审」「跳过某步」→ 立即按指令动态调整积木顺序并透传指定模型，绝不机械套用固定模板。
3. **「单 `/goal` 全自动闭环」与「双阶段受控交接」自由切换**：
   - 插上 **`N6 / B6: 决策门禁 (Gate)`** → 方案与互辩完成后停机等待人工拍板（受控双阶段）。
   - 拔掉 **`N6 / B6: 决策门禁 (Gate)`** 并拼入 **`N7 / B7: 编码与审查 (Impl)`** → 在 OpenCode 里一个 `/goal` 自动跑完从取证、方案、评审到 TDD 编码与三合一代码审查的全闭环。

---

## 二、7 个标准原子积木节点与单文件精简 `issue.md` 契约（`N1`~`N7` / `B1`~`B7`）

无论顶层走的是「单端一条龙」还是「双阶段跨端交接」，中间的 Skills 节点均可像乐高一样按需插拔，并且**所有节点的产出统一收束进单张权威主卡 `issue.md`（主会话单写者 Single-Writer，默认阅读预算 `~120 行`，严禁新建 `investigation.md` 等散装过程文件）**：

> **为什么坚持「单文件百行 `issue.md`」而非多文件瀑布流？（业界实证与外拆边界）**
> - **单点编辑（One-Place Edit）根治返工失步**：业界实测表明 60% 的需求在编码期会发生 Spec 级调整，多文件（`spec.md` + `design.md` + `tasks.md`）逆向同步耗时是直接改代码的 3~4 倍，导致 61% 的变更未回写并演化为误导 Agent 的过期毒药（Context Poisoning）。`BMAD-METHOD` v7（PR #3100）亦因此废弃分离的 `bmad-spec` 与 `bmad-ticket`，合流为 *"The ticket is the spec"*。
> - **注意力甜点区与代码指针**：Anthropic 官方指南与大厂实测确认 Agent 常驻契约在 **100~150 行**（`< 200 行` 一页纸内）遵循率最高；用 `相对路径 + 符号名 + 参考行号` 指针替代抄写代码结构，消除双倍审查负担（Double Code Review）。
> - **3 条法定外拆物理边界**：仅当命中 ① **跨多会话长跑（>4 个独立切片，防后续步骤诱发 Agent 抢跑 Premature Completion）**、② **多 worktree 并行派工（防并发写冲突）**、③ **>2,000 tokens 原始抓包日志或分支专属参考资料（入 `.scratch/` 或按需引用）** 时，才外拆 `tickets/01-slug.md` 或附件。

| 执行顺序与积木节点 | 核心机制来源 | 运行属性 | 在主卡 `issue.md` 中的唯一对应章节 | 什么时候插上 / 什么时候拔掉 |
| :--- | :--- | :--- | :--- | :--- |
| **`N1` / `B2` · 需求澄清 (`Grill`)** | Matt Pocock `grill-with-docs` (`#1193`) + `team-grilling` | `HITL`（问完等确认） | **§1 需求与不改边界（`R1..Rn` + `Out of Scope`）**：用稳定编号 `R1..Rn` 列出全部明确需求（零删减），明确禁止越界范围 | 想法模糊时插上（提问自带推荐，回复「可以」即采纳）；需求明确直接拔掉 |
| **`N2` / `B3` · 现状取证 (`Research`)** | 三轨灵活取证（日志复现 / `explore` 源码 / `research` 查 `memex` 与开源） | `AFK`（全自动） | **§2 根因与代码复用锚点**：记录 `相对路径 + 符号名 + 参考行号` 根因与本仓可复用现成函数、必要性与不改判据门禁（大日志放 `.scratch/`） | 需查日志复现或核实本仓/外部方案时插上；已给明确结论或几行小改直接拔掉 |
| **`N3` / `B4` · 规格合成 (`Spec`)** | Matt Pocock `to-spec` + `team-codebase-design`（深模块 + 复用四问梯） | `AFK`（全自动） | **§3 精简 Spec 与测试接缝（Seams）**：写明接口变更与复用四问结论（禁贴 >15 行代码），锁定最高层公共测试接缝（Seam） | 涉及多文件协议或架构调整时插上；小修小补直接跳过（仅需 §1+§2） |
| **`N5` · 任务图拆解 (`Tickets`)** | Matt Pocock `to-tickets`（带 `depends_on` 阻塞边的 DAG 垂直切片） | `AFK`（全自动） | **§4 垂直切片任务图（Vertical Slices）**：每片切穿端到端可独立验证行为（`- [ ] [S1] 交付行为 (Covers: R1 \| depends_on: [])`）；插件原生校验 `depends_on` 无环且前置完成后才可启动下一片 | 涉及多步或大 Spec 时插上（先拆图再进 `N4` 一并评审）；单点改动无需拆图 |
| **`N4` / `B5` · 异构互辩 (`Review`)** | 异构双模型对抗挑刺（`team-review-governance` + `reviewer`） | `AFK`（全自动） | **§5 Review & Decision Log**：一并审查 §1~§4（含 Spec、Seam 与垂直切片依赖图），记录审查模型、版本号与关键取舍 | 重大方案防自嗨时插上；用户说「不用审方案」或紧急小修直接拔掉 |
| **`N6` / `B6` · 决策门禁 (`Gate`)** | 人工拍板门禁卡（`wait_reason="approval"` + Handoff 简报） | `HITL`（等确认） | **受控/连贯插拔开关**：受控模式在此停机（若用户回复「先别做，解释一下」保持 `paused` 仅解释，明确批准才恢复 `active` 进入 `N7`） | **走双阶段受控模式时插上**；**走单端一条龙时拔掉** |
| **`N7` / `B7` · 编码与审查 (`Impl`)** | Matt `implement-spec`（最小完整交接包指针）+ `tdd` + 三合一独立 Review | `AFK`（全自动闭环） | **§6 交付与持久验收证据**：主会话传「最小完整交接包」派发 `coder`，按切片依序跑先红后绿 TDD，收尾跑三合一审查并回填持久验证输出 | 所有需要写代码的场景插上；纯调研或咨询任务直接拔掉 |

---

## 三、什么情况使用？如何使用？（4 类典型场景速查）

### 场景 1：想法还比较模糊，想先磨清楚需求再出方案
- **适用情况**：只有一个初步想法，还不确定边界或交互细节。
- **动态积木链**：`B1 -> N1 (Grill 挂起等澄清) -> N2 (Research) -> N3 (Spec) -> N4 (Review) -> N6 (Gate)`
- **怎么用（在 OpenCode 输入）**：
  ```text
  /goal 我想给列表页加一个批量导出功能，具体规则还没定，先帮我做需求澄清和评审，磨清后再出方案
  ```
- **交互体验**：Agent 先查现有代码事实，再抛出 ≤3 个带推荐选项的澄清问题并自动挂起；你直接回复「按推荐的来」，它会自动唤醒继续跑完取证、Spec 与评审。

### 场景 2：需求明确，希望在 OpenCode 里一个 `/goal` 全自动走完（写完代码+测通+审完）
- **适用情况**：常规功能开发或 Bug 修复，不需要中途停下来人工审批方案，希望 Agent 一气呵成把代码改好、测试跑通并做完代码精简审查。
- **动态积木链**：`B1 -> N2 (Research) -> N3 (Spec) -> N4 (Review) -> N7 (Impl)`（自动拔掉 `N6` 门禁）
- **怎么用（在 OpenCode 输入）**：
  ```text
  /goal 一个 goal 自动走完：修复导出空数组时的崩溃问题，跑通单测并完成三合一代码审查
  ```

### 场景 3：重大架构改造，走「双阶段受控模式」（阶段 1 先拍板方案，阶段 2 再实施）
- **适用情况**：涉及多模块协议、数据库或高风险重构，写代码前必须先看一眼方案。
- **动态积木链**：`B1 -> N2 (Research) -> N3 (Spec) -> N4 (Review) -> N5 (Tickets) -> N6 (Gate 停机等拍板)`
- **怎么用（在 OpenCode 输入）**：
  ```text
  /goal 梳理并设计多租户权限隔离方案，完成异构互辩后停下来等我拍板
  ```
- **交互体验**：跑完方案互辩后自动停在 `N6 (Gate)` 并输出 ≤15 行决策简报；你回复「通过，开始实施」即可在当前会话继续跑 `N7`，或一键复制看板生成的阶段 2 命令交由后台执行。

### 场景 4：钦定某个动作排第一位，或钦定特定模型（如 Opus / Astra / Fable）去评审
- **适用情况**：你已经有现成方案或刚改完代码，只想立刻让指定模型做审查，或者要求把某项评审排在第一位。
- **动态积木链**：`N4 (Review 置顶第 1 位) -> N3 (Spec) -> N7 (Impl)`
- **怎么用（在 OpenCode 输入）**：
  ```text
  /goal 把方案评审放在第一位，并且指定用 Opus 5.5 high 去审当前方案，审完直接按结论改代码
  ```

---

## 四、模型路由：主会话自由切换 + 子 Agent 一二三优先级

1. **主会话模型完全自定义**：可在 OpenCode 顶栏或 `-m` 自由切换 `GPT-6 Astra`、`GPT-6 Sol`、`GPT-6.1 Sol`、`Fable 5.1`、`Claude Opus 5.5` 等任意模型。
2. **子 Agent 选模严格按一、二、三优先级执行**：
   - **第一优先级（用户当轮点名，最高优先）**：当用户点名「用 Opus 审」「用 Astra 跑」时，主会话调用 `subagent` 显式传入 `model="<provider>/<model>#<effort>"` 强制覆盖。
   - **第二优先级（角色默认配置）**：未点名时使用 `opencode.json` 默认模型（`reviewer` 默认 `perplexity/fable-5.1#high`，`research` / `coder` / `explore` 默认 `word-claude/claude-opus-5-5#medium`）。
    - **按任务复杂度分级启用**：`word-claude/claude-opus-5-5#medium` 用于复杂主干编码（含 `N3: Spec` / `N5: Tickets` 的多文件改动、并发与状态机修复）；`word-claude/claude-sonnet-5-5#medium` 用于跳过 `N3: Spec` 的小修小补（单文件机械小改、改配置/文案、几行补丁）与轻量 `explore` 检索，由主会话显式传入，不挂 `#high`（Word 通道含 `NormalizeSonnet55DisabledThinking:True`）。
   - **第三优先级（`auto-continue-harness.js` 三级自动降级）**：上游限流或报错时自动按三级备选链同会话降级续跑，并在结果末尾追加 `[Fallback Executed: requested=... -> actual=...]` 审计标记。

---

## 五、三合一精简 Review 体系（`skills/team-review-governance/SKILL.md`）

将 Matt Pocock `v1.3.1` 工程技能与代码复用精简纪律合流为单次三轴审查：
1. **轴 1 · 针对需求的 `Spec` 忠实度审查**：逐条核对是否兑现需求、有无越界添头（Scope Creep）。
2. **轴 2 · 通用代码质量 `Standards` 审查**：排查 Fowler 12 种代码坏味道（重复代码、投机性通用、过度耦合、霰弹式修改等）与浅层透传模块。
3. **轴 3 · 代码复用与极致精简 `Reuse & Simplify` 审查**：
   - **复用四问梯子**：需要存在吗 → 本仓已有同款吗 → 标准库/已装依赖能解吗 → 能一行吗。
   - **反过度防御编码**：只在信任边界校验一次，禁止对内部定型数据层层判空或套 `try/catch` 吞错；只调用一次的短逻辑直接内联。
   - **五类腐烂注释净化**：清理卡号、PR 号、日期戳、轮次代号、跨文件裸行号。

---

## 六、仓库结构与一键安装

| 目录 / 文件 | 说明 |
| :--- | :--- |
| `agy-magpie-harness/` | `Antigravity.app` 桌面端 GUI 8 个大写 GPT 模型注入、透明包装器 `ls-wrapper`、`agy-gpt` 启动器与 Magpie 适配补丁 |
| `plugins/auto-continue-harness.js` | OpenCode 自动续跑与子 Agent 三级模型故障回退护栏插件（`v6`，已移除废弃的 `opencode-goal`） |
| `plugins/harness.test.js` | `auto-continue-harness.js` 子 Agent 三级回退与后台强制同步单测 |
| `config/opencode.agents.json` | OpenCode 五大专职子 Agent（`coder`、`reviewer`、`research`、`explore`、`general`）模型与只读权限配置 |
| `skills/team-dual-goal/SKILL.md` | `agy` 原生 `/goal` + `opencode run` 7 大原子积木（`N1`~`N7` / `B1`~`B7`）动态装配与模型三级路由规程 |
| `skills/team-review-governance/SKILL.md` | 需求 + 方案 + 代码三合一精简 Review 规程 |
| `skills/team-grilling/SKILL.md` | 融合 Matt `#1193` 的正向推荐需求澄清规程 |
| `tools/install.py` | 一键状态检查与安装脚本（安装 `auto-continue-harness.js` 并清理旧 `opencode-goal`） |

```bash
# 查看当前安装状态
python3 tools/install.py status

# 一键安装护栏到 ~/.config/opencode 并清理废弃 opencode-goal
python3 tools/install.py install

# 运行护栏单测
bun test plugins/harness.test.js
```

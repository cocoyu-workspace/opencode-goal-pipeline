# opencode-goal-pipeline

Self-maintained zero-dependency **`opencode-goal` plugin** + **Atomic Lego Skill Pipeline (`N1`~`N7` / `B1`~`B7`)** + **3-Tier Subagent Model Routing** + **3-in-1 Streamlined Review (`Spec` + `Standards` + `Reuse & Simplify`)** for OpenCode (`v2.1.2+`).

---

## 一、核心设计理念（为什么不用死板线性流水线）

1. **零外部 npm 依赖的自维护 `/goal` 插件（`plugins/opencode-goal/`）**：
   - 将 Effect 3 与 Zod 内联打包进 `dist/server.js`，彻底摆脱外部 `@prevalentware/opencode-goal-plugin` npm 缓存覆盖与写死提示词的限制。
   - 原生新增 **`plan_ops` 动态积木重排算子**（`insert_task`、`remove_task`、`reorder_tasks`、`insert_phase`），支持在运行期随时根据用户指令置顶、插入、裁剪或重排节点。
   - 原生支持 **`HITL`（Human-in-the-Loop）挂起与普通回复自动唤醒**：当处于需求澄清（`wait_reason="clarification"`）或方案拍板门禁（`wait_reason="approval"`）时自动暂停 watchdog，用户在对话框直接回复一句「可以 / 按推荐的来」即自动恢复 `active`，无需手敲 `/goal resume`。
2. **老板显式指令永远排第一顺位（Priority 1）**：
   - 用户说「先做某某评审」「用 Opus 审」「把某某放第一位」→ 立即将该原子节点置顶并透传指定模型，绝不机械套用固定模板。
3. **「单端一条龙」与「双阶段受控交接」自由切换**：
   - 插上 **`N6 / B6: 决策门禁 (Gate)`** → 方案与互辩完成后停机等待人工拍板（受控双阶段）。
   - 拔掉 **`N6 / B6: 决策门禁 (Gate)`** 并拼入 **`N7 / B7: 编码与审查 (Impl)`** → 在 OpenCode 里一个 `/goal` 自动跑完从取证、方案、评审到 TDD 编码与三合一代码审查的全闭环。

---

## 二、7 个标准原子积木节点与动态插拔表（`N1`~`N7` / `B1`~`B7`）

无论顶层走的是「单端一条龙」还是「双阶段跨端交接」，中间的 Skills 节点均可像乐高一样按需插拔（可前置 `B1: issue-track` 建卡留痕）：

| 积木节点 | 核心机制来源 | 运行属性 | 什么时候插上 | 什么时候拔掉（跳过） |
| :--- | :--- | :--- | :--- | :--- |
| **`N1` / `B2` · 需求澄清 (`Grill`)** | Matt Pocock `grill-with-docs` (`#1193`) + `team-grilling` | `HITL`（问完等确认） | 想法模糊、需求边界摇摆时插上。提问自带推荐，回复「可以 / yes」即采纳 | 需求目标已经很明确时直接拔掉，不浪费时间 |
| **`N2` / `B3` · 现状取证 (`Research`)** | 三轨灵活取证（日志复现 / `explore` 源码 / `research` 查 `memex` 与开源） | `AFK`（全自动） | Bug 排障查日志做复现，或新需求需核实当前代码与外部成熟方案时插上 | 已给明确结论或内部几行代码的小改动直接拔掉 |
| **`N3` / `B4` · 规格合成 (`Spec`)** | Matt Pocock `to-spec` + `team-codebase-design`（深模块 + 复用四问梯） | `AFK`（全自动） | 涉及多文件协议或架构调整时插上，标明代码复用落点与最高层测试接缝 | 小修小补直接跳过，不做大方案 |
| **`N4` / `B5` · 异构互辩 (`Review`)** | 异构双模型对抗挑刺（`team-review-governance` + `reviewer`） | `AFK`（全自动） | 重大方案需要防自嗨、对抗审查时插上 | 用户说「不用审方案」或紧急小修时直接拔掉 |
| **`N5` · 任务图拆解 (`Tickets`)** | Matt Pocock `to-tickets`（带阻塞边的 DAG 垂直切片） | `AFK`（全自动） | 涉及大 Spec 且需要切片实施时插上 | 单点改动无需拆图，直接实施 |
| **`N6` / `B6` · 决策门禁 (`Gate`)** | 人工拍板门禁卡（`wait_reason="approval"` + Handoff 简报） | `HITL`（等确认） | **走双阶段受控模式时插上**，产出审批简报与交接命令 | **走单端一条龙时拔掉**，直接顺滑进入编码实施 |
| **`N7` / `B7` · 编码与审查 (`Impl`)** | 变异 TDD + 先红后绿自愈 + 三合一独立 Review | `AFK`（全自动闭环） | 所有需要写代码的场景插上：精简复用编码 + 三合一代码审查 | 纯调研或纯方案咨询任务直接拔掉 |

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
   - **第二优先级（角色默认配置）**：未点名时使用 `opencode.json` 默认模型（`reviewer` 默认 `perplexity/fable-5-1#high`，`coder` / `explore` 默认 `word-claude/claude-opus-5-5#medium`）。
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
| `plugins/opencode-goal/` | 零外部依赖的自维护 OpenCode `/goal` 插件源码（`src/`）、内联产物（`dist/server.js`）与单测（`test/goal.test.js`） |
| `plugins/auto-continue-harness.js` | 自动续跑与子 Agent 三级模型故障回退护栏插件（`v5`） |
| `skills/team-dual-goal/SKILL.md` | 7 大原子积木（`N1`~`N7` / `B1`~`B7`）动态装配与模型三级路由规程 |
| `skills/team-review-governance/SKILL.md` | 需求 + 方案 + 代码三合一精简 Review 规程 |
| `skills/team-grilling/SKILL.md` | 融合 Matt `#1193` 的正向推荐需求澄清规程（配合 `HITL` 自动挂起唤醒） |
| `desktop-pipeline/` | OpenCode Desktop 流水线看板动态积木推导与单测（`status.ts` / `status.test.ts`） |
| `tools/install.py` | 一键状态检查与安装脚本 |

```bash
# 查看当前安装状态
python3 tools/install.py status

# 一键安装插件与护栏到 ~/.config/opencode
python3 tools/install.py install

# 运行插件单测
bun test plugins/opencode-goal/test/goal.test.js
```

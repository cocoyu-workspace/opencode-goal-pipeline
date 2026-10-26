---
name: team-review-governance
description: "[三合一评审] 融合需求忠实度评审（Spec Axis）、通用质量与 Fowler 12 类代码坏味道评审（Standards Axis）、以及代码复用与极致精简评审（Reuse & Simplify Axis）。覆盖需求预审（B2）、技术方案冷审（B5）与代码改动评审（B7 / PR Review），支持按一二三优先级动态指定评审模型。"
---

# 三合一评审规程（需求忠实度 `Spec` + 通用质量 `Standards` + 代码复用与精简 `Reuse & Simplify`）

> 本技能统一承接团队「需求评审（`B2`）→ 方案/Spec 评审（`B5`）→ 代码 Diff 评审（`B7` / PR Review）」，融合 Matt Pocock `v1.3.1` 双轴审查（`Spec` + `Standards` 12 类坏味道）与团队独有的「代码复用与极致精简（`Reuse & Simplify`）」门禁。原独立 `mattpocock-code-review` 已并入本技能并退役。

---

## 一、评审触发与模型一二三优先级

1. **何时触发**：
   - 老板要求「审一下需求 / 审一下方案 / 审一下代码 / review since X」；
   - OpenCode `/goal` 流水线运行至 `B2: req-grill`（需求预审）、`B5: spec-review`（方案冷审）或 `B7: impl-verify`（编码后三合一自审）。
   - 老板指定「把某某评审放在第一位」时，直接将本技能对应评审节点排在 Goal 计划第 1 位执行。
2. **评审模型一二三优先级**：
   - **第一优先级（老板当轮点名，最高优先）**：老板说「这次用 Opus 审」「用 GPT-6 Astra 审」时，派发 `reviewer` 子 Agent 显式传入 `model="<provider>/<model>#<effort>"`（如 `model="word-claude/claude-opus-5-5#high"`）。
   - **第二优先级（角色默认异构评审）**：老板未点名时，默认由异构 `reviewer` 子 Agent（`perplexity/fable-5-1#high`，Claude 主会话下传 GPT 模型）执行独立冷审，避免同源模型自写自夸。
   - **第三优先级（自动三级故障兜底）**：首选模型遇限流或渠道异常时，由 `auto-continue-harness.js` 自动切换备选模型并在报告末尾标注 `[Fallback Executed: ...]`。

---

## 二、三合一评审核心坐标（Three-Axis Review Matrix）

无论是审方案还是审代码，统一按以下三根轴逐项核查并给出 `file:line` 证据：

### 轴 1 · 需求评审与忠实度轴（`Spec Axis` —— 对齐需求与边界）

- **方案阶段（`B2` / `B5` 需求与方案审查）**：
  1. **必要性与真伪命题**：问题是否真实存在？现状是否已经满足？不做会怎样？（排查类修改建议必过三问门禁：① 真故障还是架构权衡、② 不改的实际损失、③ 改了会破坏哪条现有机制或测试不变量）。
  2. **已拍板约束对齐**：核对当前 Issue 的 `Decision Log` 与老板已定边界，严禁推翻已拍板前提或对已定事实重复提问（No re-interviewing）。
  3. **最高层测试接缝（Highest-Level Testing Seam）**：验证计划是否優先落在真实接口/CLI/端到端契约层，而非复制被测逻辑写自嗨 mock 单测。
- **代码阶段（`B7` / Diff 审查）**：
  1. **漏做检查（Missing from code）**：逐条对照 Issue / Spec 的要求与验收项，检查是否有需求未实现、只写了空壳（stub/TODO）或漏了边界分支。
  2. **越界偷加（Unsolicited scope creep）**：检查 diff 中是否混入了需求未要求、且非本次修复所必需的顺手格式化、无关重构或投机性配置。

### 轴 2 · 通用质量与 12 类代码坏味道轴（`Standards Axis` —— 架构与代码健康度）

核对仓库 `AGENTS.md` / `CLAUDE.md` 成文规范、并发/超时/错误恢复边界，并重点扫描 **Martin Fowler 12 类高频代码坏味道**：
1. **Mysterious Name（含糊命名）**：函数、变量或类型名看不出真实职责或隐藏副作用。
2. **Duplicate Code（重复代码）**：同文件或跨模块出现结构雷同的分支、解析或校验逻辑。
3. **Long Function（过长函数）**：单个函数混杂多层抽象、职责过载，主干（Happy Path）被淹没。
4. **Long Parameter List（过长参数列表）**：函数传参过多，未复用已有上下文结构或定型配置对象。
5. **Global / Mutable State（失控可变状态）**：不必要的 `let` 重赋值、未隔离的模块级可变状态或并发竞态风险。
6. **Feature Envy（依恋他处职责）**：一段逻辑频繁掏另一个模块的内部状态计算，职责放错了层（对照 `team-codebase-design` 深模块原则移回拥有该状态的层）。
7. **Data Clumps（数据泥团）**：多处总是成群结队出现的散装字段，缺乏统一值对象或结构定义。
8. **Primitive Obsession（基本类型偏执）**：用裸字符串拼接、魔法数字代替明确的枚举或定型结构。
9. **Loops Instead of Pipelines（冗长循环）**：用多层嵌套命令式循环和临时数组代替清晰的过滤/映射变换。
10. **Lazy Element / Speculative Generality（冗余薄包装与投机性通用）**：只调用一次的薄包装小函数、为「以后好扩展」预留但当前无消费方的抽象层/钩子/配置项（YAGNI）。
11. **Temporary Field（临时字段）**：对象上仅在特定分支或阶段有值、其余时候为空的易错字段。
12. **Comments Explaining Bad Code（掩盖烂代码的注释）**：用长篇注释解释一段本该通过重命名或提取清晰边界来读懂的绕弯代码。

### 轴 3 · 代码复用与极致精简轴（`Reuse & Simplify Axis` —— 吸纳复用、砍掉冗余）

每次审方案（`B4`/`B5`）与审代码（`B7`）必须强制执行以下三项复用与精简检查，并在编码阶段将精简后的代码直接落地：
1. **四步复用核查（Reuse Ladder）**：
   - **本仓已有必复用**：先用 `grep` / `glob` / `codegraph_explore` 查同仓是否已有现成 helper、util、状态机或同类模式（必须报出复用的 `file:line`）。在相隔几个文件的地方重新手搓一套同类逻辑直接判 `Blocker`。
   - **标准库与平台原生优先**：语言标准库、运行时内建能力或数据库/CSS 原生约束能解决的，禁止手写复杂应用层轮子。
   - **已装依赖优先**：几行代码或现有依赖能解决的，严禁引入新外部依赖。
   - **合理提炼公共单元**：当本次改动与仓内已有 1~2 处逻辑实质相同时，直接抽离或合并到最小公共函数，消除双份维护。
2. **反过度防御与就地精简（Anti-Overdefensive & In-Place Simplification）**：
   - **只在信任边界校验一次**：未知外部输入（HTTP 请求、CLI 参数、外部文件/API 返回）在边界入口校验并转为定型值后，内部调用链严禁层层重复判空（`if (!x) ...`）或套 `try/catch` 吞错兜底。
   - **单次短逻辑直接内联**：只在一个地方调用的几行短函数与只用一次的中间变量直接内联，用 `const` + 早返回（Early Return）拉直主干。
   - **B7 节点当场精简落盘**：在 `B7: impl-verify` 中，发现可复用或可精简的代码，直接由 `coder` 将精简后的最短可运行 diff 写回仓库并跑绿测试，不停留在口头建议。
3. **注释卫生门禁（Comment Hygiene）**：
   - 代码能表达的一律不写注释；卡号（`MUL-xxx`）、PR/Issue 号、日期戳、跨文件裸行号严禁进代码注释。
   - 仅三类允许保留（一行封顶）：魔数的来源、调用顺序假设、外部 bug 绕行与并发时序前提。

---

## 三、评审输出格式（简洁高信噪比，每条必带 `file:line`）

评审结果按以下结构输出，没问题的轴一行「已核 `<file:line>` 无问题」带过，不凑字数：

1. **评审结论**：`Pass` / `Pass with Minor Fixes` / `Blocked`（附实际执行的评审模型标识）。
2. **轴 1 · 需求与 Spec 忠实度（`Spec`）**：漏做项 / 越界偷加项 / 必要性与测试接缝核查（附 `file:line`）。
3. **轴 2 · 通用质量与坏味道（`Standards`）**：命中的坏味道类别、`file:line`、故障风险与修复方式。
4. **轴 3 · 代码复用与精简清单（`Reuse & Simplify`）**：
   - **已复用 / 应复用项**：复用本仓哪处 `file:line` 替代哪段重复实现；
   - **可精简删除项**：哪处 `file:line` 的冗余判空、薄包装函数、投机抽象或违规注释可直接删减/内联。
5. **修复与收敛记录（Decision Log）**：采纳了哪些精简与修复、驳回了哪些误报及证据。

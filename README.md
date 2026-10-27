# opencode-goal-pipeline

**`agy`（Gemini / GPT-6 Astra / GPT-6.1 Sol 深度需求澄清 + 原生 `/goal` 长任务主控 + 多模态/GUI 真机验收交付）$\times$ `opencode run`（全能后台异构执行底座：按场景灵活调度 `explore` / `research` / `coder` / `reviewer` / `general` 与 CLI 测试）四大阶段 12 块标准积木（`B1`~`B12`）协同流水线**。

---

## 〇、现行主力工作流：`agy` 抓两头（需求澄清 + `/goal` 长控 + 多模态真机验收交付）$\times$ 灵活调度全能 `opencode run`（[`agy-magpie-harness/`](agy-magpie-harness/README.md)）

由于旧 `opencode-goal` 插件采用定时器轮询续跑，在长任务下容易出现轮询空转与状态卡死，现已**彻底移除 `opencode-goal` 插件**，确立 **「四大阶段 12 块标准积木（`B1`~`B12`）+ 选块 4 问自检 + 6 套标准配方」** 的双端协同架构（唯一权威正文见 [`skills/team-dual-goal/SKILL.md`](skills/team-dual-goal/SKILL.md)）：

```
用户在 Antigravity.app 桌面端（自由选用 Gemini / GPT-6 Astra / GPT-6.1 Sol）或终端运行 agy-gpt
  │
  ├─ 1. 立项与需求阶段（B1 ~ B3）：
  │     ├─ B1 (issue-track)：建 GitHub Issue 或本地 issue.md 权威主卡并初始化已知需求 R1..Rn（agy 单写者）
  │     ├─ B2 (req-grill)：需求有模糊分叉时，agy 主会话带正向推荐追问对齐 What
  │     └─ B3 (req-review)：需求与现码/规则冲突或疑似伪命题时，调 opencode reviewer 只读挑刺 Why
  │
  ├─ 2. 取证与定位阶段（B4 ~ B5）：
  │     ├─ B4 (bug-repro)：Bug 任务调 explore 定位 file:line 并由 agy/coder 构造最小红灯复现
  │     └─ B5 (explore & research)：非 Bug 任务查本仓可复用实现 + 调 opencode research 查 memex 与 500 星开源方案
  │
  ├─ 3. 方案与拆图阶段（B6 ~ B9，对称闭环）：
  │     ├─ B6 (spec-draft)：agy 主会话设计深接口、过复用四问梯子、锁定最高层公共测试接缝 Seam（§3）
  │     ├─ B7 (slice-tickets)：依赖 B6，多模块长链路按 Tracer-Bullet 切出垂直切片 S1..Sn（§4）
  │     ├─ B8 (spec-review)：调异构 opencode reviewer 对 B6/B7 做三合一独立冷审（按需 Astra + Fable 双审）
  │     └─ B9 (approval-gate)：受控模式下输出 ≤10 行方案简报等老板拍板（/goal 模式自动跳过常规确认，四道硬停机红线除外）
  │
  └─ 4. 实施与交付阶段（B10 ~ B12）：
        ├─ B10 (slice-impl)：调 opencode coder（或 agy 直接改 <20 行小修）跑先红后绿 TDD，并承接 B11 精简回流
        ├─ B11 (code-review)：调异构 opencode reviewer 做代码 Diff 三合一独立评审（Spec + Standards + Reuse & Simplify）
        └─ B12 (verify & deliver)：B12a 由 agy 原生多模态 + tabbit-cli + chrome-devtools + cua-driver + tester 真机验收；B12b 回填 §6 并在授权边界内完成 Commit / PR / 关单
```

### 日常排障与维护边界（以后出 Bug 改哪里？）

| 问题所属层 | 维护位置 | 是否需要动 `agy`？ |
| :--- | :--- | :--- |
| **Word / Perplexity 渠道兼容、流式超时、思考块过滤、子 Agent 提示词或降级策略** | 只改 OpenCode 配置（`~/.config/opencode/opencode.json` 与 `~/.config/opencode/plugins/auto-continue-harness.js`） | **完全不用动 `agy`**（`agy` 仅通过 `opencode run` 消费结果） |
| **`Antigravity.app` 桌面端下拉框的 8 个大写 GPT 模型列表** | `agy-magpie-harness/bin/sync-agy-gui-models.py` | 运行一次该脚本即实时同步至桌面端 |
| **`agy` 主会话 GPT 模型的 Fast / Ultra Fast 加速档位或 Gemini $\leftrightarrow$ Responses 协议转换** | `/Users/mac/开源工具/magpie`（补丁归档于 `agy-magpie-harness/patches/`） | 不改 `agy`，仅更新本地 `magpie` 网关 |

---

## 一、平时在 `agy` 使用 Gemini / GPT 的三档触发与 6 套标准配方

完整 12 块积木职责表、「4 问自检」算法与 4 条动态覆盖规则见 [`skills/team-dual-goal/SKILL.md`](skills/team-dual-goal/SKILL.md) §一、§二，日常使用只需记住以下三档触发方式：

1. **日常零口令直接说（默认推荐）**：
   - 直接说需求或贴报错，主会话自动跑「4 问自检」并在首轮顶部一行宣告本次选中的积木链（如 `本次走 [配方 2 · Bug 修复]：B1 -> B4 -> B10 -> B12`），随即开工。
2. **长任务一键跑到底（在 `agy` 输入 `/goal <目标>`）**：
   - 自动拔掉常规方案拍板门禁 `B9 (approval-gate)`，从取证、方案、冷审、TDD 实施到真机验收一气呵成跑完（遇到需求分叉、缺权限/未授权外部写操作、同故障连续 3 次验证失败或明确要求只出方案时仍安全停机）。
3. **手动点菜 / 插拔（第一优先级 Priority 1）**：
   - 随时说「先跑 `B3` 审一下这个需求」「让 Astra 和 Fable 双审 `B8` 方案」「跳过调研直接改」，Agent 立即按指令重排或裁剪积木。

### 6 套标准配方速查

| 配方 | 适用场景 | 自动拼装的积木链 |
| :--- | :--- | :--- |
| **配方 1 · 低风险随手小改** | 明确的单文件 `<20 行` 低风险改文案/调配置/微补丁 | `[B1] -> B10 -> B12a` |
| **配方 2 · 常规 Bug 修复** | 报错明确或可本地复现的故障修复（若遇协议/状态机改动动态补 `B6 -> B8`） | `B1 -> B4 -> B10 -> [按风险挂 B11] -> B12` |
| **配方 3 · 中等明确需求 / 高风险小改** | 需求清楚但跨文件改逻辑，或触及鉴权/并发/迁移/计费等高风险面 | `B1 -> B5 -> B6 -> B8 -> B10 -> B11 -> B12` |
| **配方 4 · 模糊想法或复杂架构大需求** | 需求待磨清、涉及多模块重构或分片交付 | `B1 -> B2 -> [B3] -> B5 -> B6 -> B7 -> B8 -> [B9] -> B10 -> B11 -> B12` |
| **配方 5 · 纯调研 / 排障定位 / 架构咨询（只读）** | 只查根因、调研开源方案或出设计评估，不改业务代码 | `[B1] -> B4/B5 -> [B6 -> B8] -> B12a` |
| **配方 6 · 独立专项评审（只审不改）** | 对已有需求、方案或代码 diff 做独立冷审 | 单独运行 `B3`、`B8` 或 `B11` |

---

## 二、常见输入示例（在 `Antigravity` 对话框中直接输入）

```text
# 示例 1：想法还比较模糊，先磨需求并审视需求真伪（配方 4 前段：B1 -> B2 -> B3 -> B5 -> B6 -> B8 -> B9）
我想给列表页加一个批量导出功能，具体规则还没定，先帮我做需求澄清和需求评审，磨清后再出技术方案等我拍板

# 示例 2：常规 Bug 一键跑到底（配方 2 + /goal：B1 -> B4 -> B10 -> B11 -> B12）
/goal 修复导出空数组时的崩溃问题，跑通复现红灯与修复绿灯并完成代码三合一审查

# 示例 3：复杂需求先出方案并通过 Astra + Fable 双审（B1 -> B5 -> B6 -> B7 -> B8 双审 -> B9）
梳理并设计多租户权限隔离方案，起草技术方案后让 Astra 和 Fable 双审，停下来等我拍板

# 示例 4：钦定专项评审排第一位（配方 6：B8 -> B10 -> B12）
把技术方案评审放在第一位，指定用 Opus 5.5 high 去审当前方案，审完直接按结论改代码
```

---

## 三、模型路由：主会话自由切换 + 子 Agent 一二三优先级

1. **主会话模型自由切换**：在 `Antigravity` 中自由选用 `Gemini`、`GPT-6 Astra`、`GPT-6.1 Sol` 等模型，在 OpenCode 独立会话中也可自由切换任意模型。
2. **子 Agent 选模严格按一、二、三优先级执行**（详见 [`skills/team-dual-goal/SKILL.md`](skills/team-dual-goal/SKILL.md) §四）：
   - **第一优先级（用户当轮点名，最高优先）**：当用户点名「用 Opus 审」「用 Astra 跑」时，显式传入 `-m "<provider>/<model>#<effort>"`（或 `subagent(..., model="...")`）强制覆盖。
   - **第二优先级（角色默认配置與复杂度分级）**：未点名时走 `opencode.json` 默认模型（`reviewer` 默认 `perplexity/fable-5.1#high`，`research` / `coder` / `explore` / `general` 默认 `word-claude/claude-opus-5-5#medium`）。复杂主干编码（含 `B6: spec-draft` / `B7: slice-tickets`）保持 `word-claude/claude-opus-5-5#medium`；跳过 `B6: spec-draft` 的低风险小修小补与轻量 `explore` 检索可由 `agy` 直接改或显式传 `word-claude/claude-sonnet-5-5#medium`（不挂 `#high`）。
   - **第三优先级（`auto-continue-harness.js` 三级自动降级与按实际作者模型异构防自审）**：`opencode run` 与子 Agent 遇限流或渠道异常（403 除外）时自动按三级备选链同会话降级续跑并追加 `[Fallback Executed: requested=... -> actual=...]`；`B3` / `B8` / `B11` 评审严格对比被审产物的实际作者模型保持异构。

---

## 四、三合一精简 Review 体系（[`skills/team-review-governance/SKILL.md`](skills/team-review-governance/SKILL.md)）

覆盖 **`B3 (req-review)`**、**`B8 (spec-review)`** 与 **`B11 (code-review)`** 三个独立评审积木：
1. **轴 1 · 针对需求的 `Spec` 忠实度审查**：核对需求必要性、测试接缝 Seam、是否兑现 `R1..Rn` 及有无越界添头（Scope Creep）。
2. **轴 2 · 通用代码质量 `Standards` 审查**：排查 Fowler 12 种代码坏味道与浅层透传模块。
3. **轴 3 · 代码复用与极致精简 `Reuse & Simplify` 审查**：过复用四问梯子、反过度防御编码、清理腐烂注释，`B11` 精简结论回流 `B10` 落盘。

---

## 五、仓库结构与一键安装

| 目录 / 文件 | 说明 |
| :--- | :--- |
| `agy-magpie-harness/` | `Antigravity.app` 桌面端 GUI 8 个大写 GPT 模型注入、透明包装器 `ls-wrapper`、`agy-gpt` 启动器与 Magpie 适配补丁 |
| `plugins/auto-continue-harness.js` | OpenCode 自动续跑与 `opencode run` / `subagent` 三级模型故障回退护栏插件（`v6`） |
| `plugins/harness.test.js` | `auto-continue-harness.js` 三级回退与后台强制同步单测 |
| `config/opencode.agents.json` | OpenCode 五大专职子 Agent（`coder`、`reviewer`、`research`、`explore`、`general`）模型与只读权限配置 |
| `skills/team-dual-goal/SKILL.md` | 四大阶段 12 块标准积木（`B1`~`B12`）、4 问自检与 6 套选块配方及三级模型路由唯一权威规程 |
| `skills/team-review-governance/SKILL.md` | 需求（`B3`）+ 方案（`B8`）+ 代码（`B11`）三合一精简 Review 规程 |
| `skills/team-grilling/SKILL.md` | 融合 Matt `#1193` 的 `B2: req-grill` 正向推荐需求澄清规程 |
| `tools/install.py` | 一键状态检查与安装脚本（安装 `auto-continue-harness.js` 并清理旧 `opencode-goal`） |

```bash
# 查看当前安装状态
python3 tools/install.py status

# 一键安装护栏到 ~/.config/opencode 并清理废弃 opencode-goal
python3 tools/install.py install

# 运行护栏单测
bun test plugins/harness.test.js
```

# AGY + Magpie 接入记录与更新检查

记录日期：2026-10-28。记录版本：Antigravity.app 2.28.0。关联历史 [Issue #7](https://github.com/cocoyu-workspace/opencode-goal-pipeline/issues/7)、[Issue #8](https://github.com/cocoyu-workspace/opencode-goal-pipeline/issues/8)。本次跟踪 [Issue #20](https://github.com/cocoyu-workspace/opencode-goal-pipeline/issues/20)。

本文记录本次本机接入的实际机制、模型配置与证据，下次更新先按检查顺序判断适用范围。它不保证跨版本恢复，也不把未公开接口或平台支持判断补丁作为默认接入办法。

## 1. 两条独立链路

历史桌面接入链路：

```text
Antigravity.app 选择自定义模型
↓
本机 language_server 包装器与自定义界面资源
↓
Gemini API 客户端
↓
Magpie，127.0.0.1:3425
↓
Codex 或 Word 上游
```

子任务链路：

```text
AGY 主会话
↓
opencode run --agent <role>
↓
OpenCode 自己配置的模型提供方
```

OpenCode 不接入 Magpie。重试与模型回退应区分 OpenCode 自身能力和本仓 `auto-continue-harness.js` 插件行为，不称后者为官方内置功能。

## 2. 本次更新为什么影响入口

本会话观察到更新后的应用入口是上游 `language_server`，此前安装的包装器被覆盖。持久化模型状态仍有旧条目，所以“模型入口消失”不能等同于“模型配置被删除”。这属于本机接入对应用文件生命周期的依赖，不据此判定上游更新有缺陷。

此前恢复动作从新版二进制提取界面资源并写出本机 ZIP，再同步模型状态。这套实验也改变了界面中的平台/功能可用性判断。相关历史实现不应成为下次自动重放步骤。先核对当前版本官方支持范围，不能通过替换平台判断、权限判断或调用未公开本地服务来强行恢复。

## 3. 文件职责与副作用

| 文件 | 职责与影响 |
|---|---|
| [`cmd/ls-wrapper/main.go`](../cmd/ls-wrapper/main.go) | 第 37–57 行调用同目录 `language_server.real`，仅 Hub 分支添加资源路径与网关环境，并启动后台同步。环境变量已有值时不覆盖。源码包含本机固定路径。 |
| [`bin/sync-agy-gui-models.py`](../bin/sync-agy-gui-models.py) | 本机前序恢复留下的工作区版本生成下节矩阵。会整体替换 CLI `customModelsConfig.customModels`，并调用未公开桌面状态接口。本次文档 PR 不发布或执行该工作区改动。仓库已有版本与本次矩阵可能不同。 |
| 本机未提交的 `bin/patch-agy-web-bundle.py` | 前序恢复实验。依赖 2.28.0 的混淆代码目标，9 个替换目标各要求恰好命中 1 次。验证目标前可能已替换应用入口，因此失败也不代表应用未变。未纳入本次文档 PR，不作为安装器。 |
| [`bin/agy-gpt`](../bin/agy-gpt) | 现有 CLI 启动器。设置本地网关环境并选择模型，可能改写 CLI `modelProvider`。其旧 `--max` 参数不等同于本次 GPT 的 `-xhigh`，不可混用。 |

本机状态位置：

- `~/.gemini/antigravity-cli/settings.json`：CLI 设置。
- `~/.gemini/antigravity/antigravity_state.pbtxt`：桌面持久化状态，作为历史证据，不直接修改。
- `~/.gemini/antigravity/web_bundle_custom.zip`：历史自定义资源包。
- `/Applications/Antigravity.app/Contents/Resources/bin/`：应用入口及历史 `.real` 备份位置。
- `~/.config/magpie/providers.json`：提供方配置，含凭证，禁止整份打印或提交。

不要将编译二进制、自定义 ZIP、个人配置、原始日志、令牌或账户标识提交到 Git。二进制大小启发式不能证明来源或版本，`.real` 也不能仅凭名字当作有效回退文件。

## 4. 本次配置矩阵

这是本次本机写入结果，不代表官方模型能力或已测得的上下文上限。

| 系列 | 速度变体 | 推理档位 | GUI 条目数 | 配置上下文 |
|---|---|---|---|---|
| GPT-6.1 Sol | 标准、Fast、Ultra Fast | Medium、High、xhigh | 9 | 500000 |
| GPT-6 Astra | 标准、Fast、Ultra Fast | Medium、High、xhigh | 9 | 272000 |
| Word Claude Opus 5.5 | 单一变体 | Max | 1 | 200000 |

共同配置 `maxOutputTokens=128000`。Word 不再保留 Sonnet。速度和推理强度是两个独立维度。

- GUI 共 **19 条配置**。历史分组补丁预期折叠为 **7 行**，尚无本次 GUI 截图验证。
- CLI 共 **25 条配置**，由 18 个 GPT 档位、6 个 GPT 基础别名和 1 个 Word 条目组成。
- GPT 原始模型名示例为 `codex/gpt-6.1-sol-ultrafast-xhigh`。Word 为 `word-claude/word/claude-opus-5-5-max`。
- 历史 GUI 的 `modelName` 使用 `gemini-api://` 加原始模型名。CLI 工作区脚本使用不带该前缀的模型名，字典键使用 `magpie/` 前缀。这是历史本机格式，不可照搬为官方配置格式。

**命名未决**：用户说的“GPT Ultra”尚未确认是否指 Astra。当前实际生成的是 GPT-6 Astra，不能记录为已确认的同义名称。

## 5. 下次接入或更新后的执行顺序

### 第一步：保存可回退状态

记录应用版本、仓库提交与提供方版本。通过系统文件管理器保存应用和个人设置的独立副本，备份放在仓库之外并限制访问。保留原始文件来源与版本，不能把凭证或个人状态放入 Issue。

先确定当前正在运行的应用路径。不要在会话处理中替换可执行文件，也不要为了排查终止当前会话。需要重装或重启时选择无活动任务的窗口。

### 第二步：先确认官方入口与格式

核对当前版本的官方设置页面：

- [CLI 参考](https://antigravity.google/docs/cli/reference)。
- [设置与自定义模型](https://antigravity.google/docs/settings?tab=cli#custommodelsconfig-and-gcp)。
- [桌面设置](https://antigravity.google/docs/settings)。

2026-10-28 读取的官方说明指出：CLI 的 `customModelsConfig` 仅在 `modelProvider="gemini"` 且设置 `GEMINI_API_KEY` 时读取。使用 Google Account 登录时忽略这份配置。自定义条目的 `modelName` 格式为 `gemini-api://<base_url>/models/<model>`。

这与历史脚本格式不同。下次必须按所用版本的正式文档配置，使用自己的合法凭证，只合并本次目标条目。不要整份覆盖已有模型表。本文尚未验证该正式入口与本机 Magpie 的实际兼容性，不提供虚构的一键安装命令。

桌面端若正式入口允许添加自定义模型，就从该入口配置。若平台不支持或入口缺失，记录版本与限制，保留已有可用入口。不要修改功能支持判断或探测内部状态服务。

### 第三步：区分配置检查与真实执行

配置检查时核对所选提供方、模型 ID、速度后缀、推理后缀以及已有环境变量是否指向预期网关。仅使用受支持设置入口和正常管理界面，不输出认证值。

真实验收按下节逐项执行。若使用同一批未变的代码、配置、环境与判据，可以引用仍有效的旧证据。发生变化的部分需要补验。

### 第四步：失败回退

停止本轮配置变更并记录失败层级。通过官方安装包恢复原版应用，或恢复经过来源与版本核对的完整应用备份。通过正常设置入口恢复此前设置，个人状态按备份恢复，不删除整个配置目录。

若失败发生在历史实验步骤之后，应用入口可能已经改变。不能把“脚本报错”当作“没有副作用”。本次没有执行回退，也没有验证跨版本回退。

## 6. 已有证据与剩余验收

本会话前序恢复命令记录：

```text
[patched] Wrote …/web_bundle_custom.zip (4144313 bytes)
Synced 19 Magpie custom models to 1 Antigravity GUI instance(s).
```

前序安全回读确认桌面持久化状态有 19 个模型标签，CLI 有 25 个相关条目。本文整理阶段未再次运行应用补丁或状态同步。同步脚本会吞掉部分异常且最终返回 0，所以退出码不能单独证明成功。

仍需记录的真实验收：

1. 桌面模型列表可见，并能选择预期的 7 个分组行与推理档位。保存不含私人会话的截图。
2. Sol、当前实际配置的 Astra 和 Word Opus Max 各获得真实回复。记录选择的标签及脱敏结果。
3. GPT 的各速度与推理组合在正常请求日志中呈现预期参数。Word 确认 Max。没有上游证据时不宣称加速或推理生效。
4. 在授权测试目录完成一次真实工具写入与读取，检查文件结果。HTTP 成功或模型声称写完均不能替代工具执行证据。
5. 原有官方模型与独立 `opencode run` 链路保持可用，补记重启后是否保留配置。

上述真实验收尚未完成。Issue 保持开放，本次文档 PR 使用 `Refs` 关联，不自动关单。

## 7. 维护约定

本文件是唯一正文。仓库根 README、harness README 和 `cocoyuworkspace` 只保留入口。本次只归档方法和边界，不发布前序未提交运行时脚本，不更改正在运行的应用。

下一次更新先补记版本、正式支持范围、配置差异和真实验收证据，再决定是否需要代码变更。不能默认沿用本次资源包或混淆代码标识。

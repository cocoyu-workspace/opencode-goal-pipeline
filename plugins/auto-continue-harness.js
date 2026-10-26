// OpenCode V2 strips edit/write for non-gpt-4 gpt-* models, routing edits through patch
const CODE_MUTATION_TOOLS = new Set(["patch", "edit", "write"]);
const VERIFICATION_TOOLS = new Set(["shell", "subagent"]);
const DOC_ONLY_PATH_RE = /\.(?:md|txt|rst)$/i;

const CONSERVATIVE_GPT_AUTONOMY_RE =
  /# Autonomy\s+Do not infer authorization for work beyond the user's request\.[^\n]*/i;

// Official gpt-astra autonomy & codebase verification guidance from OpenCode V2 binary
const GPT_ASTRA_AUTONOMY_SECTION = `## Autonomy

Infer the user's intent and your task scope from their instructions and the prior conversation context. You should bias towards action and carry out the user's intended task until it is completed. If the intent is unclear, progress towards the goal using the available information and ask for clarification while continuing independent work when possible.

When the user's prompt indicates a request for action, such as "can you...", "I want to...", "help me..." and similar expressions, treat these as instructions to take action. Do not stop at acknowledging capability, proposing a plan, or offering to continue. Do not settle for a partial or "helpful enough" solution to save time, effort, or tokens. Continue until the user's intended goal is fulfilled, even when it requires sustained work.

- Run tests appropriate to the change and complete required checks. Once those pass, broaden or repeat testing only when new changes, failures, or unresolved concerns justify it; otherwise, continue toward completing the task.`;

const HARNESS_BOUNDARY_MARKER = "<!-- opencode-autonomy-boundary:v5 -->";
const LEGACY_BOUNDARY_BLOCK_RE =
  /\n*<!-- opencode-autonomy-boundary:v\d+ -->\s*<system-reminder>[\s\S]*?<\/system-reminder>/gi;

const HARNESS_BOUNDARY_REMINDER = `${HARNESS_BOUNDARY_MARKER}
<system-reminder>
# Execution vs Confirmation Boundary & Elastic Atomic Goal Pipeline
1. Read-Only Investigation Never Asks Permission (Single-Turn Exhaustive Fact-Finding): All read-only checks (reading code/configs, inspecting local or non-prod logs, correlating account/error states, running non-destructive diagnostic probes; excluding production DB per Team Rules) are inherently pre-authorized. Whether the user asks a question, sends a screenshot, or refutes a prior hypothesis (e.g. "没有模型选择"), you MUST invoke read-only tools immediately in the current turn and keep calling tools until the root cause and exact mappings are verified. NEVER end a turn with 0 tool calls or stop mid-investigation to ask permission for a read-only check.
2. Self-Check Gate on "要做什么" (Forbid Self-Assigned Read-Only Next Steps): Before writing "要做什么", inspect item #1. If its executor is you or a subagent (e.g. "由我只读检查", "由我执行", "由我继续核对", "先确认 X 再决定怎么修") and the action is a read-only check or already-authorized work, DO NOT output it in "要做什么" and DO NOT end the turn — delete the draft summary and invoke the tool right now in this turn. "要做什么" is strictly reserved for decisions/approvals that only the user can provide.
3. Architecture & Fix Confirmation Gate (Stop ONLY Before Mutating Code/Config): After completing all read-only checks and proving the root cause, if the user only asked for diagnosis or if multiple fix/architectural directions exist with user-visible trade-offs, STOP BEFORE mutating code or config (\`patch\`, \`edit\`, \`write\`, state-changing \`shell\`). Present the verified root cause and recommended options (or call the \`question\` tool with your recommended option first), and wait for the user's decision.
4. Elastic Atomic Skill Blocks (\`B1\`~\`B7\`) & 3-Tier Model Routing (\`team-dual-goal\`):
   - Primary Session Model: 100% customizable by the user (\`GPT-6 Astra\`, \`GPT-6 Sol\`, \`GPT-6.1 Sol\`, \`Fable 5.1\`, \`Claude Opus 5.5\`, etc.).
   - Subagent 3-Tier Model Priority:
     * Priority 1 (User's Explicit Override — Highest): When the user specifies a model or reviewer (e.g. "这次用 Opus 审", "派某模型做某事"), pass \`model="..."\` explicitly in the \`subagent\` call.
     * Priority 2 (Role Default): When unspecified, omit \`model\` so the subagent uses its role default (\`reviewer\`=\`perplexity/fable-5.1#high\`, \`research\`/\`coder\`/\`explore\`=\`word-claude/claude-opus-5-5#medium\`).
     * Priority 3 (Automatic 3-Tier Fallback): On rate-limit/timeout/channel error, the harness automatically retries backup tiers and appends \`[Fallback Executed: ...]\`. Fallback-protected subagents run in blocking mode (\`background: false\`).
   - 7 Composable Atomic Blocks for \`/goal\`: \`B1: issue-track\`, \`B2: req-grill\` (\`team-grilling\` + \`reviewer\` requirement pre-review), \`B3: fact-research\` (local \`file:line\` + \`research\` subagent), \`B4: spec-draft\` (spec + reuse design), \`B5: spec-review\` (\`team-review-governance\` 3-in-1 independent review), \`B6: gate-brief\` (approval gate), \`B7: impl-verify\` (\`coder\` implementation & simplification + \`reviewer\` 3-in-1 code review + tests inside OpenCode).
   - User's Explicit Flow Override ALWAYS Takes Priority 1: If the user says "先做某某评审", "把某某指定为第一位", "跳过某步", or "一个 \`/goal\` 自动走完（包含 \`B7: impl-verify\`）", dynamically assemble or reorder the blocks via \`update_goal_plan\` (\`plan_ops\`: \`insert_task\`, \`remove_task\`, \`reorder_tasks\`, \`insert_phase\`).
   - HITL Yield & Auto-Resume: When pausing to ask the user a question (\`B2\`) or waiting for gate approval (\`B6\`), call \`update_goal_status({ status: "paused", wait_reason: "clarification" | "approval", prompt_summary: "..." })\`. The local \`opencode-goal\` plugin automatically resumes the goal to \`active\` when the user replies.
</system-reminder>`;

const ROLE_DEFAULT_MODELS = {
  explore: "word-claude/claude-opus-5-5#medium",
  research: "word-claude/claude-opus-5-5#medium",
  coder: "word-claude/claude-opus-5-5#medium",
  reviewer: "perplexity/fable-5.1#high",
};

const SUBAGENT_FALLBACK_TIERS = {
  explore: ["perplexity/sonnet-5.5#medium", "openai/gpt-6.1-sol#medium"],
  research: ["word-claude/claude-opus-5-5#medium", "perplexity/sonnet-5.5#high", "openai/gpt-6.1-sol#high"],
  general: ["perplexity/sonnet-5.5#high", "openai/gpt-6.1-sol#high"],
  coder: ["perplexity/sonnet-5.5#high", "openai/gpt-6.1-sol#high"],
  reviewer: ["word-claude/claude-opus-5-5#high", "perplexity/opus-5.5#medium", "openai/gpt-6.1-sol#high"],
};

export function resolveSubagentFallbackTiers(agentId, initialModel) {
  const tiers = SUBAGENT_FALLBACK_TIERS[agentId];
  if (!tiers) return [];
  const effectiveInitial = initialModel ? String(initialModel).trim() : ROLE_DEFAULT_MODELS[agentId] || "";
  return tiers.filter((tier) => tier !== effectiveInitial);
}

function appendSubagentAuditNote(res, note) {
  if (!note || !res || typeof res !== "object") return res;
  if (res.output && typeof res.output === "object" && res.output.status === "running") return res;
  if (typeof res.content === "string") {
    return { ...res, content: `${res.content}${note}` };
  }
  if (typeof res.output === "string") {
    return { ...res, output: `${res.output}${note}` };
  }
  return res;
}

export function wrapSubagentExecute(origExecute) {
  return async (input, callCtx) => {
    const fallbackTiers = resolveSubagentFallbackTiers(input?.agent, input?.model);
    const coerceBg = input?.background === true && fallbackTiers.length > 0 && input?.allow_unprotected_background !== true;
    const effectiveInput = coerceBg ? { ...input, background: false } : input;
    const coercedNote = coerceBg ? "\n\n[Background Coerced: fallback-protected role]" : "";

    try {
      const res = await origExecute(effectiveInput, callCtx);
      return appendSubagentAuditNote(res, coercedNote);
    } catch (firstErr) {
      const firstMsg = String(firstErr?.message || firstErr || "");
      if (/Subagent cancelled/i.test(firstMsg) || callCtx?.signal?.aborted) throw firstErr;
      const match = firstMsg.match(/sessionID:\s*(ses_[A-Za-z0-9]+)/i);
      const isPreSessionErr =
        /Model ".*" is not available|Variant ".*" is not available|Invalid model|Failed to prompt subagent|Failed to switch subagent/i.test(
          firstMsg,
        );
      if ((!match && !isPreSessionErr) || fallbackTiers.length === 0) throw firstErr;

      let currentSessionID = match?.[1] || input?.sessionID;
      let lastErr = firstErr;
      for (const fallbackModel of fallbackTiers) {
        try {
          const retryPayload = currentSessionID
            ? {
                ...effectiveInput,
                sessionID: currentSessionID,
                model: fallbackModel,
                prompt: "前序模型渠道异常中断，请在同一子会话中直接继续完成上述任务。",
              }
            : {
                ...effectiveInput,
                model: fallbackModel,
              };
          const retryRes = await origExecute(retryPayload, callCtx);
          const fallbackNote = `${coercedNote}\n\n[Fallback Executed: requested=${input?.model || `${input?.agent || "subagent"}:default`} -> actual=${fallbackModel}]`;
          return appendSubagentAuditNote(retryRes, fallbackNote);
        } catch (retryErr) {
          lastErr = retryErr;
          const retryMsg = String(retryErr?.message || retryErr || "");
          if (/Subagent cancelled/i.test(retryMsg) || callCtx?.signal?.aborted) throw retryErr;
          const nextMatch = retryMsg.match(/sessionID:\s*(ses_[A-Za-z0-9]+)/i);
          if (nextMatch?.[1]) currentSessionID = nextMatch[1];
        }
      }
      throw lastErr;
    }
  };
}

export function transformSystemPromptForAutonomy(hookInput) {
  if (!hookInput || hookInput.agent !== "build") return false;
  const sys = hookInput.system;
  if (!Array.isArray(sys) || !sys[0] || typeof sys[0].text !== "string") return false;

  let text = sys[0].text;
  let changed = false;

  if (CONSERVATIVE_GPT_AUTONOMY_RE.test(text)) {
    text = text.replace(CONSERVATIVE_GPT_AUTONOMY_RE, GPT_ASTRA_AUTONOMY_SECTION);
    changed = true;
  }

  if (!text.includes(HARNESS_BOUNDARY_MARKER)) {
    text = text.replace(LEGACY_BOUNDARY_BLOCK_RE, "");
    text = `${text}\n\n${HARNESS_BOUNDARY_REMINDER}`;
    changed = true;
  }

  if (changed) {
    sys[0] = { ...sys[0], text };
  }
  return changed;
}

// OpenCode V2 instantiates plugins once per location; deduplicate shared events across instances
function claimHarnessEvent(eventId) {
  if (!eventId) return true;
  const key = Symbol.for("opencode.auto-continue-harness.v3.claimed");
  const claimed = globalThis[key] || (globalThis[key] = new Map());
  if (claimed.has(eventId)) return false;
  claimed.set(eventId, true);
  if (claimed.size > 2000) claimed.delete(claimed.keys().next().value);
  return true;
}

export default {
  id: "auto-continue-harness",
  setup: async (ctx) => {
    const noop = async () => {};
    if (!ctx) return noop;

    const stateKey = Symbol.for("opencode.auto-continue-harness.v3.state");
    const shared = globalThis[stateKey] || (globalThis[stateKey] = {
      sessions: new Map(),
      toolNamesByCall: new Map(),
    });
    const { sessions, toolNamesByCall } = shared;

    function getSession(id) {
      if (!sessions.has(id)) {
        sessions.set(id, {
          todos: [],
          codeEditsSinceVerify: 0,
        });
      }
      return sessions.get(id);
    }

    const disposables = [];

    // 1. Upgrade conservative gpt-* system prompt to gpt-astra autonomy + explicit confirmation boundary
    if (typeof ctx.session?.hook === "function") {
      for (const hookName of ["context", "compaction", "generate"]) {
        try {
          const reg = await ctx.session.hook(hookName, (input) => {
            transformSystemPromptForAutonomy(input);
          });
          if (reg?.dispose) disposables.push(reg);
        } catch {}
      }
    }

    function buildTodowriteHarnessSuffix(items, s) {
      const allDone =
        items.length > 0 && items.every((t) => t.status === "completed" || t.status === "cancelled");
      s.todos = allDone ? [] : items;

      const openItems = items.filter((t) => t.status === "in_progress" || t.status === "pending");
      if (openItems.length > 0) {
        const next = openItems.find((t) => t.status === "in_progress") || openItems[0];
        return `\n\n[Harness Continuation] ${openItems.length} item(s) remain open (next: [${next.status}] "${next.content}"). If this step is a read-only check/investigation or an authorized implementation action, invoke the next tool immediately in this turn. Only stop to ask the user AFTER all read-only checks are complete and BEFORE mutating code/config, or when blocked by missing credentials/permissions.`;
      }
      if (
        items.length >= 2 &&
        s.codeEditsSinceVerify > 0 &&
        !items.some((t) => /verif|test|验证|测试|check/i.test(t.content))
      ) {
        return `\n\n[Harness Verification Nudge] You closed out all ${items.length} tasks after modifying code, but no verification command has been run since the last edit. Run the local verification/test command before writing your final summary.`;
      }
      if (allDone) {
        return `\n\n[Harness Final-Answer Gate] All ${items.length} todo item(s) are marked completed. Before writing "要做什么", check item #1: if its executor is you or a subagent (e.g. "由我只读检查", "由我执行", "由我继续核对", "先确认 X 再决定怎么修") and it is a read-only check or already-authorized action, DO NOT end the turn — invoke the read/shell tool right now in this turn to finish it first, then report the final result.`;
      }
      return "";
    }

    // 2. Wrap native OpenCode 2.1+ subagent (3-tier Word -> Perplexity -> GPT fallback) & todowrite tool
    if (typeof ctx.tool?.transform === "function") {
      try {
        const toolTransformReg = await ctx.tool.transform((registry) => {
          if (typeof registry.get === "function" && typeof registry.update === "function" && registry.get("subagent")) {
            registry.update("subagent", (tool) => {
              tool.execute = wrapSubagentExecute(tool.execute);
            });
          }

          if (typeof registry.get === "function" && typeof registry.update === "function" && registry.get("todowrite")) {
            registry.update("todowrite", (tool) => {
              const origExecute = tool.execute;
              tool.execute = async (input, callCtx) => {
                const baseResult = await origExecute(input, callCtx);
                const items = Array.isArray(input?.todos) ? input.todos : [];
                const suffix = buildTodowriteHarnessSuffix(items, getSession(callCtx.sessionID));
                if (!suffix) return baseResult;
                const baseContent =
                  typeof baseResult?.content === "string"
                    ? baseResult.content
                    : Array.isArray(baseResult?.content)
                      ? baseResult.content.map((c) => c?.text || "").join("\n")
                      : `Todos updated (${items.filter((t) => t.status === "completed").length}/${items.length} completed).`;
                return {
                  ...baseResult,
                  content: `${baseContent}${suffix}`,
                };
              };
            });
          }
        });
        if (toolTransformReg?.dispose) disposables.push(toolTransformReg);
      } catch {}
    }

    // 3. Track in-turn code edits vs verification commands for todowrite's inline verification reminder
    const controller = new AbortController();
    if (typeof ctx.event?.subscribe === "function") {
      (async () => {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
            if (!claimHarnessEvent(event?.id)) continue;
            const t = event?.type;
            const d = event?.data || {};
            const sessionID = d.sessionID;
            if (!sessionID) continue;
            const s = getSession(sessionID);

            switch (t) {
              case "session.inbox.enqueued":
                if (d.item?.type === "user") {
                  s.codeEditsSinceVerify = 0;
                }
                break;

              case "session.tool.input.started":
                if (d.id && d.name) {
                  toolNamesByCall.set(`${sessionID}:${d.id}`, String(d.name));
                  if (toolNamesByCall.size > 1000) {
                    toolNamesByCall.delete(toolNamesByCall.keys().next().value);
                  }
                }
                break;

              case "session.tool.called": {
                const toolName = toolNamesByCall.get(`${sessionID}:${d.id}`) || String(d.name || "");
                const input = d.input || {};
                if (CODE_MUTATION_TOOLS.has(toolName)) {
                  const targetPath = String(input.path || input.filePath || input.patchText || "");
                  const isDocOnly =
                    toolName !== "patch"
                      ? DOC_ONLY_PATH_RE.test(targetPath)
                      : !/\*\*\* (?:Update|Add) File: [^\n]+\.(?!md|txt|rst)[a-zA-Z0-9]+/i.test(targetPath) &&
                        /\*\*\* (?:Update|Add) File: [^\n]+\.(?:md|txt|rst)/i.test(targetPath);
                  if (!isDocOnly) {
                    s.codeEditsSinceVerify += 1;
                  }
                } else if (VERIFICATION_TOOLS.has(toolName)) {
                  s.codeEditsSinceVerify = 0;
                }
                break;
              }

              case "session.deleted":
                sessions.delete(sessionID);
                break;
            }
          }
        } catch {}
      })();
    }

    return async () => {
      controller.abort();
      for (const d of disposables) {
        try {
          await d.dispose();
        } catch {}
      }
    };
  },
};

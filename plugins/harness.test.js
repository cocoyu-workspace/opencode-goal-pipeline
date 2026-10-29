import { describe, expect, test } from "bun:test";
import plugin, { ROLE_DEFAULT_MODELS, parseModelSpec, resolveSubagentFallbackTiers, wrapSubagentExecute } from "./auto-continue-harness.js";

describe("auto-continue-harness subagent fallback & background coercion (Issue #3 & #22)", () => {
  test("resolveSubagentFallbackTiers deduplicates ROLE_DEFAULT_MODELS when initialModel is omitted", () => {
    // research default is word-claude/claude-opus-5-5#medium, so Tier 1 should skip it
    expect(resolveSubagentFallbackTiers("research", undefined)).toEqual([
      "word-claude/claude-sonnet-5-5#medium",
      "openai/gpt-6.1-sol#high",
    ]);

    // reviewer default is word-claude/claude-opus-5-5#high
    expect(resolveSubagentFallbackTiers("reviewer", undefined)).toEqual([
      "openai/gpt-6-astra#high",
      "openai/gpt-6.1-sol#high",
    ]);

    // explicit override deduplicates the overridden model (e.g. when user specifies openai/gpt-6-astra#high)
    expect(resolveSubagentFallbackTiers("reviewer", "openai/gpt-6-astra#high")).toEqual([
      "word-claude/claude-opus-5-5#high",
      "openai/gpt-6.1-sol#high",
    ]);
  });

  test("resolveSubagentFallbackTiers never touches build (interactive session) and keeps coder on 0-Kiro Word Cloud", () => {
    expect(ROLE_DEFAULT_MODELS.build).toBeUndefined();
    expect(resolveSubagentFallbackTiers("build", undefined)).toEqual([]);

    expect(ROLE_DEFAULT_MODELS.explore).toBe("kiro-claude/claude-sonnet-5-5#medium");
    expect(resolveSubagentFallbackTiers("explore", undefined)).toEqual([
      "word-claude/claude-opus-5-5#medium",
      "word-claude/claude-sonnet-5-5#medium",
      "openai/gpt-6.1-sol#medium",
    ]);

    // coder strictly stays on Word Cloud -> OpenAI (0 Kiro credits)
    expect(ROLE_DEFAULT_MODELS.coder).toBe("word-claude/claude-opus-5-5#medium");
    expect(resolveSubagentFallbackTiers("coder", undefined)).toEqual([
      "word-claude/claude-sonnet-5-5#medium",
      "openai/gpt-6.1-sol#high",
    ]);
    expect(resolveSubagentFallbackTiers("coder", undefined).some((m) => m.startsWith("kiro-claude/"))).toBe(false);

    expect(resolveSubagentFallbackTiers("coder", "word-claude/claude-sonnet-5-5#medium")).toEqual([
      "word-claude/claude-opus-5-5#medium",
      "openai/gpt-6.1-sol#high",
    ]);
  });

  test("wrapSubagentExecute coerces background:true to false for fallback-protected roles and appends audit tag", async () => {
    const calls = [];
    const wrapped = wrapSubagentExecute(async (input) => {
      calls.push(input);
      return { content: "Review completed: PASS" };
    });

    const res = await wrapped(
      { agent: "reviewer", background: true, prompt: "Review spec" },
      { sessionID: "ses_parent" }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].background).toBe(false);
    expect(res.content).toContain("Review completed: PASS");
    expect(res.content).toContain("[Background Coerced: fallback-protected role]");
  });

  test("runtime failures are handled by the session hook, never retried by the tool wrapper", async () => {
    let calls = 0;
    const wrapped = wrapSubagentExecute(async () => {
      calls++;
      throw new Error("Upstream HTTP 502 Bad Gateway (sessionID: ses_sub123)");
    });
    await expect(wrapped({ agent: "reviewer", prompt: "Review" }, {})).rejects.toThrow("502");
    expect(calls).toBe(1);
  });

  test("wrapSubagentExecute retries pre-session Model is not available error without sessionID", async () => {
    const calls = [];
    const wrapped = wrapSubagentExecute(async (input) => {
      calls.push(input);
      if (calls.length === 1) {
        throw new Error('Model "perplexity/fable-5-1" is not available');
      }
      return { output: "Recovered from typo model" };
    });

    const res = await wrapped(
      { agent: "reviewer", model: "perplexity/fable-5-1#high", prompt: "Review spec" },
      { sessionID: "ses_parent" }
    );

    expect(calls).toHaveLength(2);
    expect(calls[1].sessionID).toBeUndefined();
    expect(calls[1].model).toBe("word-claude/claude-opus-5-5#high");
    expect(res.output).toContain(
      "[Fallback Executed: requested=perplexity/fable-5-1#high -> actual=word-claude/claude-opus-5-5#high]"
    );
  });

  test("wrapSubagentExecute preserves structured running output when user backgrounds a foreground task", async () => {
    const wrapped = wrapSubagentExecute(async () => ({
      output: { status: "running", id: "job_1", sessionID: "ses_bg1" },
    }));

    const res = await wrapped(
      { agent: "coder", background: true, prompt: "Run slice" },
      { sessionID: "ses_parent" }
    );

    expect(res).toEqual({
      output: { status: "running", id: "job_1", sessionID: "ses_bg1" },
    });
  });
});

async function setupFallback(availableOverride, sessionOverride) {
  const events = [];
  let wake;
  const storage = new Map();
  const hooks = new Map();
  const switches = [];
  const dispose = await plugin.setup({ model: { list: async () => ({ data: availableOverride ?? [
    {providerID:"word-claude",id:"claude-sonnet-5-5",variants:[{id:"medium"}]},
    {providerID:"openai",id:"gpt-6.1-sol",variants:[{id:"high"},{id:"medium"}]},
  ] }) }, storage: { set: async (key,value) => storage.set(key,value) }, event: { subscribe: async function* ({signal}) {
    while (!signal.aborted) {
      if (events.length) yield events.shift();
      else await new Promise(resolve => { wake = resolve; signal.addEventListener("abort",resolve,{once:true}); });
    }
  } }, session: {
    hook: async (name, callback) => { hooks.set(name, callback); return { dispose() {} }; },
    get: async () => (sessionOverride ?? {parentID:"parent",agent:"coder",model:{providerID:"word-claude",id:"claude-opus-5-5",variant:"medium"}}),
    switchModel: async (input) => { switches.push(input); },
  } });
  return { prepare: hooks.get("prompt"), retry: hooks.get("retry"), switches, dispose, storage,
    async emit(type, extraData = {}) { events.push({id:crypto.randomUUID(),type,data:{sessionID:"ses_test", ...extraData}}); wake?.(); await new Promise(resolve=>setTimeout(resolve,0)); }
  };
}
function failure(type = "provider.auth", status = 401, model = { providerID: "word-claude", id: "claude-opus-5-5", variant: "medium" }) {
  return { sessionID: "ses_test", agent: "coder", model, error: { type, status, message: "fault" }, attempt: 2, decision: { retry: false } };
}
describe("native session retry registration", () => {
  test.each([["provider.auth",401],["provider.rate-limit",429],["provider.internal",503],["provider.transport",undefined],["provider.timeout",undefined]])("recovers %s", async (type,status) => {
    const h = await setupFallback();
    const input = failure(type,status);
    await h.retry(input);
    expect(h.switches[0].model.id).toBe("claude-sonnet-5-5");
    expect(input.decision).toEqual({ retry: true, delay: 0 });
    await h.dispose();
  });
  test.each([["aborted",undefined],["permission.rejected",403],["provider.invalid-request",400],["provider.auth",403],["provider.content-filter",400]])("does not recover %s", async (type,status) => {
    const h = await setupFallback();
    const input = failure(type,status);
    input.decision = {retry:true,delay:5000};
    await h.retry(input);
    expect(h.switches).toHaveLength(0);
    expect(input.decision).toEqual({ retry: true, delay:5000 });
    await h.dispose();
  });
  test("exhausts candidates without restarting the chain", async () => {
    const h = await setupFallback();
    let input = failure();
    for (let i=0;i<2;i++) {
      await h.retry(input);
      input = failure("provider.auth",401,h.switches.at(-1).model);
    }
    await h.retry(input);
    expect(h.switches.map(x=>x.model.providerID)).toEqual(["word-claude","openai"]);
    expect(input.decision).toEqual({retry:false});
    await h.dispose();
  });
  test("explicitly selected backup is not attempted twice", async () => {
    const h = await setupFallback();
    await h.retry(failure("provider.auth",401,{providerID:"word-claude",id:"claude-sonnet-5-5",variant:"medium"}));
    expect(h.switches[0].model.providerID).toBe("openai");
    await h.dispose();
  });

  test("AGY shim sessions may fallback through metadata even without parentID", async () => {
    const h = await setupFallback(undefined, {
      metadata: { agyConversationId: "agy-conv-1", agyAgent: "coder" },
      agent: "coder",
      model: { providerID: "word-claude", id: "claude-opus-5-5", variant: "medium" },
    });
    const input = failure();
    await h.retry(input);
    expect(h.switches[0].model.id).toBe("claude-sonnet-5-5");
    expect(input.decision).toEqual({ retry: true, delay: 0 });
    await h.dispose();
  });

  test("ordinary parentless sessions without AGY metadata never fallback", async () => {
    const h = await setupFallback(undefined, {
      agent: "coder",
      model: { providerID: "word-claude", id: "claude-opus-5-5", variant: "medium" },
    });
    const input = failure();
    await h.retry(input);
    expect(h.switches).toHaveLength(0);
    expect(input.decision).toEqual({ retry: false });
    await h.dispose();
  });
});

describe("session lifecycle, Tab agent model sync, and audit", () => {
  test("settled execution resets candidates for the next turn", async () => {
    const h = await setupFallback();
    await h.retry(failure());
    expect(h.storage.get("fallback/ses_test").actual).toBe("word-claude/claude-sonnet-5-5#medium");
    await h.emit("session.execution.succeeded");
    await h.retry(failure());
    expect(h.switches.map(x=>x.model.id)).toEqual(["claude-sonnet-5-5","claude-sonnet-5-5"]);
    await h.dispose();
  });
  test("general role default is omitted from backups", () => {
    expect(resolveSubagentFallbackTiers("general")).toEqual(["word-claude/claude-sonnet-5-5#medium","openai/gpt-6.1-sol#high"]);
  });
  test("main (parentless) sessions never switch model or retry, whatever the agent or error", async () => {
    const h = await setupFallback(undefined, {
      agent: "build",
      model: { providerID: "openai", id: "gpt-6.1-sol-fast", variant: "xhigh" },
    });
    await h.prepare({ sessionID: "ses_test" });
    for (const type of ["provider.auth", "provider.quota", "provider.rate-limit", "provider.internal", "provider.transport", "provider.timeout"]) {
      const input = {
        sessionID: "ses_test",
        agent: "build",
        model: { providerID: "openai", id: "gpt-6.1-sol-fast", variant: "xhigh" },
        error: { type, message: "fault" },
        attempt: 1,
        decision: { retry: true, delay: 5000 },
      };
      await h.retry(input);
      expect(input.decision).toEqual({ retry: false });
    }
    await h.emit("session.agent.selected", { agent: "coder", previous: "build" });
    expect(h.switches).toHaveLength(0);
    await h.dispose();
  });
});

test("unavailable candidates are skipped", async () => {
  const h = await setupFallback([{providerID:"openai",id:"gpt-6.1-sol",variants:[{id:"high"}]}]);
  await h.retry(failure());
  expect(h.switches[0].model.providerID).toBe("openai");
  await h.dispose();
});


describe("startup model preflight", () => {
  test("switches an unavailable model before execution", async () => {
    const h = await setupFallback();
    await h.prepare({sessionID:"ses_test"});
    expect(h.switches[0].model.id).toBe("claude-sonnet-5-5");
    await h.retry(failure("provider.auth",401,h.switches[0].model));
    expect(h.switches[1].model.providerID).toBe("openai");
    await h.dispose();
  });
  test("keeps an available explicitly selected model", async () => {
    const h = await setupFallback(undefined,{agent:"coder",model:{providerID:"word-claude",id:"claude-sonnet-5-5",variant:"medium"}});
    await h.prepare({sessionID:"ses_test"});
    expect(h.switches).toHaveLength(0);
    await h.dispose();
  });
  test("does not replace a role without a fallback policy", async () => {
    const h = await setupFallback(undefined,{agent:"plan",model:{providerID:"missing",id:"missing"}});
    await h.prepare({sessionID:"ses_test"});
    expect(h.switches).toHaveLength(0);
    await h.dispose();
  });
  test("keeps the original error when no candidate exists", async () => {
    const h = await setupFallback([]);
    await h.prepare({sessionID:"ses_test"});
    expect(h.switches).toHaveLength(0);
    await h.dispose();
  });
});

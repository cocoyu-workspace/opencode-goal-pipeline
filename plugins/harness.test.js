import { describe, expect, test } from "bun:test";
import plugin, { resolveSubagentFallbackTiers, wrapSubagentExecute } from "./auto-continue-harness.js";

describe("auto-continue-harness subagent fallback & background coercion (Issue #3)", () => {
  test("resolveSubagentFallbackTiers deduplicates ROLE_DEFAULT_MODELS when initialModel is omitted", () => {
    // research default is word-claude/claude-opus-5-5#medium, so Tier 1 should skip it
    expect(resolveSubagentFallbackTiers("research", undefined)).toEqual([
      "perplexity/sonnet-5.5#high",
      "openai/gpt-6.1-sol#high",
    ]);

    // reviewer default is perplexity/fable-5.1#high
    expect(resolveSubagentFallbackTiers("reviewer", undefined)).toEqual([
      "word-claude/claude-opus-5-5#high",
      "perplexity/opus-5.5#medium",
      "openai/gpt-6.1-sol#high",
    ]);

    // explicit override deduplicates the overridden model
    expect(resolveSubagentFallbackTiers("reviewer", "word-claude/claude-opus-5-5#high")).toEqual([
      "perplexity/opus-5.5#medium",
      "openai/gpt-6.1-sol#high",
    ]);
  });

  test("resolveSubagentFallbackTiers puts word-claude/claude-sonnet-5-5#medium first for explore and coder and deduplicates it", () => {
    expect(resolveSubagentFallbackTiers("explore", undefined)).toEqual([
      "word-claude/claude-sonnet-5-5#medium",
      "perplexity/sonnet-5.5#medium",
      "openai/gpt-6.1-sol#medium",
    ]);
    expect(resolveSubagentFallbackTiers("coder", undefined)).toEqual([
      "word-claude/claude-sonnet-5-5#medium",
      "perplexity/sonnet-5.5#high",
      "openai/gpt-6.1-sol#high",
    ]);

    expect(resolveSubagentFallbackTiers("explore", "word-claude/claude-sonnet-5-5#medium")).toEqual([
      "perplexity/sonnet-5.5#medium",
      "openai/gpt-6.1-sol#medium",
    ]);
    expect(resolveSubagentFallbackTiers("coder", "word-claude/claude-sonnet-5-5#medium")).toEqual([
      "perplexity/sonnet-5.5#high",
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

async function setupFallback(availableOverride) {
  const events = [];
  let wake;
  const storage = new Map();
  const hooks = new Map();
  const switches = [];
  const dispose = await plugin.setup({ model: { list: async () => ({ data: availableOverride ?? [
    {providerID:"word-claude",id:"claude-sonnet-5-5",variants:[{id:"medium"}]},
    {providerID:"perplexity",id:"sonnet-5.5",variants:[{id:"high"},{id:"medium"}]},
    {providerID:"openai",id:"gpt-6.1-sol",variants:[{id:"high"},{id:"medium"}]},
  ] }) }, storage: { set: async (key,value) => storage.set(key,value) }, event: { subscribe: async function* ({signal}) {
    while (!signal.aborted) {
      if (events.length) yield events.shift();
      else await new Promise(resolve => { wake = resolve; signal.addEventListener("abort",resolve,{once:true}); });
    }
  } }, session: {
    hook: async (name, callback) => { hooks.set(name, callback); return { dispose() {} }; },
    switchModel: async (input) => { switches.push(input); },
  } });
  return { retry: hooks.get("retry"), switches, dispose, storage,
    async emit(type) { events.push({id:crypto.randomUUID(),type,data:{sessionID:"ses_test"}}); wake?.(); await new Promise(resolve=>setTimeout(resolve,0)); }
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
    for (let i=0;i<3;i++) {
      await h.retry(input);
      input = failure("provider.auth",401,h.switches.at(-1).model);
    }
    await h.retry(input);
    expect(h.switches.map(x=>x.model.providerID)).toEqual(["word-claude","perplexity","openai"]);
    expect(input.decision).toEqual({retry:false});
    await h.dispose();
  });
  test("explicitly selected backup is not attempted twice", async () => {
    const h = await setupFallback();
    await h.retry(failure("provider.auth",401,{providerID:"word-claude",id:"claude-sonnet-5-5",variant:"medium"}));
    expect(h.switches[0].model.providerID).toBe("perplexity");
    await h.dispose();
  });
});

describe("session lifecycle and audit", () => {
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
    expect(resolveSubagentFallbackTiers("general")).toEqual(["perplexity/sonnet-5.5#high","openai/gpt-6.1-sol#high"]);
  });
});

test("unavailable candidates are skipped", async () => {
  const h = await setupFallback([{providerID:"perplexity",id:"sonnet-5.5",variants:[{id:"high"}]}]);
  await h.retry(failure());
  expect(h.switches[0].model.providerID).toBe("perplexity");
  await h.dispose();
});

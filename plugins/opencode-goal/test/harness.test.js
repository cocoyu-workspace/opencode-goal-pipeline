import { describe, expect, test } from "bun:test";
import { resolveSubagentFallbackTiers, wrapSubagentExecute } from "../../auto-continue-harness.js";

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

  test("wrapSubagentExecute retries in-session HTTP/channel failure in same sessionID and appends fallback tag", async () => {
    const calls = [];
    const wrapped = wrapSubagentExecute(async (input) => {
      calls.push(input);
      if (calls.length === 1) {
        throw new Error("Upstream HTTP 502 Bad Gateway (sessionID: ses_sub123)");
      }
      return { content: "Recovered on Tier 1" };
    });

    const res = await wrapped(
      { agent: "reviewer", background: true, prompt: "Review spec" },
      { sessionID: "ses_parent" }
    );

    expect(calls).toHaveLength(2);
    expect(calls[0].background).toBe(false);
    expect(calls[1].sessionID).toBe("ses_sub123");
    expect(calls[1].model).toBe("word-claude/claude-opus-5-5#high");
    expect(res.content).toContain("[Background Coerced: fallback-protected role]");
    expect(res.content).toContain(
      "[Fallback Executed: requested=reviewer:default -> actual=word-claude/claude-opus-5-5#high]"
    );
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

import { describe, expect, test } from "bun:test"
import type {
  JsonValue,
  SessionMessageAssistantTool,
  SessionMessageInfo,
} from "@opencode/client/promise"
import {
  GOAL_TOOL_NAMES,
  STAGE1_STANDARD_STEPS,
  buildStage2Command,
  derivePipeline,
  extractGoalSnapshot,
  formatDuration,
  formatTokens,
  goalStatusTone,
  stepStatusTone,
} from "./status"

function toolPart(
  name: string,
  state: SessionMessageAssistantTool["state"],
  id = "part-1",
): SessionMessageAssistantTool {
  return {
    type: "tool",
    id,
    name,
    time: { created: 1000, completed: 2000 },
    state,
  }
}

function completedGoalTool(
  name: string,
  outputObj: Record<string, JsonValue> | null,
  metaGoal?: Record<string, JsonValue> | null,
  input: Record<string, JsonValue> = {},
): SessionMessageAssistantTool {
  const metadata: Record<string, JsonValue> = {}
  if (metaGoal !== undefined) {
    metadata.acp = {
      plan: {
        entries: [],
        _meta: {
          "opencode-goal": metaGoal,
        },
      },
    }
  }
  return toolPart(name, {
    status: "completed",
    input,
    content: [{ type: "text", text: JSON.stringify(outputObj ?? { goal: null }) }],
    metadata,
  })
}

function assistantMsg(id: string, parts: SessionMessageAssistantTool[]): SessionMessageInfo {
  return {
    id,
    type: "assistant",
    agent: "build",
    model: { id: "gpt-5.4", providerID: "openai" },
    content: parts,
    time: { created: 1000, completed: 2000 },
  }
}

describe("GOAL_TOOL_NAMES", () => {
  test("includes update_goal_plan and all lifecycle tools", () => {
    expect(GOAL_TOOL_NAMES).toContain("update_goal_plan")
    expect(GOAL_TOOL_NAMES).toContain("create_goal")
    expect(GOAL_TOOL_NAMES).toContain("clear_goal")
  })
})

describe("extractGoalSnapshot", () => {
  test("merges JSON tool output with acp.plan._meta['opencode-goal']", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("create_goal", {
          goal: {
            id: "g-1",
            sessionID: "s-1",
            objective: "Verify versions",
            status: "active",
            tokensUsed: 12500,
            tokenBudget: 100000,
            timeUsedSeconds: 42,
            autoTurns: 2,
            maxAutoTurns: 10,
            stopReason: null,
            blocker: null,
            completionEvidence: null,
            lastCheckpoint: { summary: "Started check", timestamp: 1000 },
          },
        }),
      ]),
      assistantMsg("m2", [
        completedGoalTool(
          "update_goal_plan",
          {
            goal: {
              status: "active",
              planRevision: 2,
              blocker: null,
            },
          },
          {
            id: "g-1",
            objective: "Verify versions",
            status: "active",
            blocker: null,
            completionEvidence: null,
            plan: {
              summary: "Check 3 versions",
              phases: [
                {
                  id: "versions",
                  objective: "Run commands",
                  status: "in_progress",
                  tasks: [
                    { id: "node", description: "node -v", status: "completed", evidence: "v24.16.0" },
                    { id: "bun", description: "bun -v", status: "in_progress" },
                  ],
                },
              ],
            },
          },
        ),
      ]),
    ]

    const snapshot = extractGoalSnapshot(messages)
    expect(snapshot).not.toBeNull()
    expect(snapshot?.objective).toBe("Verify versions")
    expect(snapshot?.tokensUsed).toBe(12500)
    expect(snapshot?.timeUsedSeconds).toBe(42)
    expect(snapshot?.plan?.phases).toHaveLength(1)
    expect(snapshot?.plan?.phases?.[0]?.tasks).toHaveLength(2)
  })

  test("returns null when latest goal tool is clear_goal, unless recreated later", () => {
    const cleared: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("create_goal", {
          goal: { objective: "Old goal", status: "active", tokensUsed: 100, timeUsedSeconds: 5, autoTurns: 0 },
        }),
      ]),
      assistantMsg("m2", [completedGoalTool("clear_goal", null)]),
    ]
    expect(extractGoalSnapshot(cleared)).toBeNull()

    const recreated: SessionMessageInfo[] = [
      ...cleared,
      assistantMsg("m3", [
        completedGoalTool("set_goal", {
          goal: { objective: "New goal", status: "active", tokensUsed: 50, timeUsedSeconds: 2, autoTurns: 0 },
        }),
      ]),
    ]
    expect(extractGoalSnapshot(recreated)?.objective).toBe("New goal")
  })
})

describe("derivePipeline - generic_goal mode (F4)", () => {
  test("computes dynamic completedCount and totalCount from phases and tasks without hardcoding /9 or /5", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("update_goal_plan", {
          goal: {
            objective: "按顺序只读检查 node -v、bun -v、opencode --version",
            status: "complete",
            tokensUsed: 299050,
            timeUsedSeconds: 47,
            autoTurns: 0,
            completionEvidence: "三项查询均返回版本",
            plan: {
              summary: "顺序执行三个版本查询",
              phases: [
                {
                  id: "versions",
                  objective: "依次查询三种工具版本",
                  status: "completed",
                  tasks: [
                    { id: "node", description: "运行 node -v", status: "completed", evidence: "v24.16.0" },
                    { id: "bun", description: "运行 bun -v", status: "completed", evidence: "1.3.14" },
                    { id: "opencode", description: "运行 opencode --version", status: "completed", evidence: "v2.1.2" },
                  ],
                },
              ],
            },
          },
        }),
      ]),
    ]

    const pipeline = derivePipeline(messages)
    expect(pipeline).not.toBeNull()
    expect(pipeline?.mode).toBe("generic_goal")
    expect(pipeline?.completedCount).toBe(3)
    expect(pipeline?.totalCount).toBe(3)
    expect(pipeline?.steps).toHaveLength(3)
    expect(pipeline?.steps[0]?.evidence).toBe("v24.16.0")
  })

  test("falls back to phase as step when phase has no tasks, or objective when plan has no phases", () => {
    const noTasksMsg: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("create_goal", {
          goal: {
            objective: "Single objective without plan",
            status: "active",
            tokensUsed: 100,
            timeUsedSeconds: 10,
            autoTurns: 1,
          },
        }),
      ]),
    ]
    const p1 = derivePipeline(noTasksMsg)
    expect(p1?.mode).toBe("generic_goal")
    expect(p1?.totalCount).toBe(1)
    expect(p1?.completedCount).toBe(0)
    expect(p1?.steps[0]?.title).toBe("Single objective without plan")
  })
})

describe("derivePipeline - dual_goal mode (F1, F2, F3)", () => {
  test("infers 5 Stage 1 steps, debate rounds, paths, and stage2Command from session tool trace", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        toolPart("skill", {
          status: "completed",
          input: { name: "team-dual-goal" },
          content: [{ type: "text", text: "loaded" }],
        }),
        completedGoalTool("create_goal", {
          goal: {
            objective: "【阶段 1：Spec 互辩定稿】实现 MUL-704 流水线看板并停机待拍板",
            status: "active",
            tokensUsed: 85000,
            timeUsedSeconds: 180,
            autoTurns: 1,
          },
        }),
      ]),
      assistantMsg("m2", [
        toolPart("write", {
          status: "completed",
          input: { filePath: "/Users/mac/dev/cocoyuworkspace/TeamIssue/MUL-704-pipeline/issue.md" },
          content: [{ type: "text", text: "ok" }],
        }),
        toolPart("subagent", {
          status: "completed",
          input: { agent: "explore", description: "Opus 5.5 源码取证" },
          content: [{ type: "text", text: "done" }],
        }),
        toolPart("write", {
          status: "completed",
          input: { filePath: "/Users/mac/dev/cocoyuworkspace/TeamIssue/MUL-704-pipeline/tech-proposal.md" },
          content: [{ type: "text", text: "ok" }],
        }),
        toolPart("subagent", {
          status: "completed",
          input: { agent: "reviewer", model: "perplexity/fable-5.1#high", description: "Fable 第 1 轮冷审" },
          content: [{ type: "text", text: "NEEDS_DECISION" }],
        }),
        toolPart("subagent", {
          status: "running",
          input: { agent: "reviewer", model: "perplexity/fable-5.1#high", description: "Fable 第 2 轮复审" },
          metadata: {},
        }),
      ]),
    ]

    const pipeline = derivePipeline(messages)
    expect(pipeline).not.toBeNull()
    expect(pipeline?.mode).toBe("dual_goal")
    expect(pipeline?.steps).toHaveLength(STAGE1_STANDARD_STEPS.length)
    expect(pipeline?.issueId).toBe("MUL-704")
    expect(pipeline?.issuePath).toBe("TeamIssue/MUL-704-pipeline/issue.md")
    expect(pipeline?.specPath).toBe("TeamIssue/MUL-704-pipeline/tech-proposal.md")
    expect(pipeline?.steps[0]?.status).toBe("completed")
    expect(pipeline?.steps[1]?.status).toBe("completed")
    expect(pipeline?.steps[2]?.status).toBe("completed")
    expect(pipeline?.steps[3]?.status).toBe("in_progress")
    expect(pipeline?.steps[3]?.evidence).toContain("1/2")
    expect(pipeline?.gateStatus).toBe("locked")
    expect(pipeline?.stage2Command).toBe(
      buildStage2Command("TeamIssue/MUL-704-pipeline/issue.md"),
    )
  })

  test("preserves all 5 steps as completed and unlocks waiting_approval gate when status is complete (F3)", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("update_goal", {
          goal: {
            objective: "【阶段 1】完成 MUL-704 最终 Spec 并停机待拍板",
            status: "complete",
            tokensUsed: 210000,
            timeUsedSeconds: 320,
            autoTurns: 2,
            completionEvidence:
              "已写入 TeamIssue/MUL-704-pipeline/issue.md 与 TeamIssue/MUL-704-pipeline/tech-proposal.md，Fable 2 轮 PASS",
          },
        }),
      ]),
    ]

    const pipeline = derivePipeline(messages)
    expect(pipeline?.mode).toBe("dual_goal")
    expect(pipeline?.status).toBe("complete")
    expect(pipeline?.completedCount).toBe(5)
    expect(pipeline?.totalCount).toBe(5)
    expect(pipeline?.steps.every((s) => s.status === "completed")).toBe(true)
    expect(pipeline?.gateStatus).toBe("waiting_approval")
  })

  test("renders dynamic atomic blocks (B1-B7) in custom order and unlocks gate on waiting_user_approval", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("update_goal_plan", {
          goal: {
            objective: "动态积木装配：先 B5 评审再 B4 写方案",
            status: "paused",
            stopReason: "waiting_user_approval",
            tokensUsed: 95000,
            timeUsedSeconds: 140,
            autoTurns: 2,
            plan: {
              phases: [
                {
                  id: "p1",
                  objective: "动态原子流水线",
                  status: "in_progress",
                  tasks: [
                    { id: "B1", description: "Issue 分流与建档", status: "completed", evidence: "MUL-707" },
                    { id: "B5", description: "三合一精简评审（首位）", status: "completed", evidence: "PASS" },
                    { id: "B4", description: "方案与 Spec 起草", status: "in_progress" },
                  ],
                },
              ],
            },
          },
        }),
      ]),
    ]

    const pipeline = derivePipeline(messages)
    expect(pipeline?.mode).toBe("dual_goal")
    expect(pipeline?.steps).toHaveLength(3)
    expect(pipeline?.steps.map((s) => s.id)).toEqual(["p1:B1", "p1:B5", "p1:B4"])
    expect(pipeline?.steps[1]?.title).toBe("三合一精简评审（首位）")
    expect(pipeline?.gateStatus).toBe("waiting_approval")
  })
})

describe("status and step tones (F6)", () => {
  test("maps all 7 goal statuses and blocked steps to semantic tones", () => {
    expect(goalStatusTone("active")).toBe("accent")
    expect(goalStatusTone("complete")).toBe("success")
    expect(goalStatusTone("paused")).toBe("warning")
    expect(goalStatusTone("budgetLimited")).toBe("warning")
    expect(goalStatusTone("usageLimited")).toBe("warning")
    expect(goalStatusTone("unmet")).toBe("critical")
    expect(goalStatusTone("cancelled")).toBe("muted")
    expect(goalStatusTone("active", true)).toBe("critical")

    expect(stepStatusTone("completed")).toBe("success")
    expect(stepStatusTone("in_progress")).toBe("accent")
    expect(stepStatusTone("blocked")).toBe("critical")
    expect(stepStatusTone("pending")).toBe("muted")
  })

  test("surfaces blocker and stopReason on unmet / blocked goals", () => {
    const messages: SessionMessageInfo[] = [
      assistantMsg("m1", [
        completedGoalTool("update_goal", {
          goal: {
            objective: "Run migration",
            status: "unmet",
            tokensUsed: 50000,
            timeUsedSeconds: 95,
            autoTurns: 3,
            stopReason: "blocked",
            blocker: "Database connection refused on port 5432",
            plan: {
              phases: [
                {
                  id: "p1",
                  objective: "Connect DB",
                  status: "blocked",
                  blocker: "Port 5432 unreachable",
                },
              ],
            },
          },
        }),
      ]),
    ]

    const pipeline = derivePipeline(messages)
    expect(pipeline?.tone).toBe("critical")
    expect(pipeline?.goal.blocker).toBe("Database connection refused on port 5432")
    expect(pipeline?.goal.stopReason).toBe("blocked")
    expect(pipeline?.steps[0]?.status).toBe("blocked")
    expect(pipeline?.steps[0]?.tone).toBe("critical")
    expect(pipeline?.steps[0]?.blocker).toBe("Port 5432 unreachable")
  })
})

describe("formatting helpers", () => {
  test("formats duration and tokens cleanly", () => {
    expect(formatDuration(47)).toBe("47s")
    expect(formatDuration(250)).toBe("4m 10s")
    expect(formatDuration(3725)).toBe("1h 02m 05s")
    expect(formatTokens(950)).toBe("950")
    expect(formatTokens(12500)).toBe("13k")
    expect(formatTokens(2_400_000)).toBe("2.4M")
  })
})

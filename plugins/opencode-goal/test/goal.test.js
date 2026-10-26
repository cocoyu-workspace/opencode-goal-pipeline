import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import plugin from "../server.js";

describe("self-maintained opencode-goal plugin", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "opencode-goal-test-"));
    process.env.OPENCODE_GOAL_STATE_PATH = join(tempDir, "goals.json");
  });

  afterEach(async () => {
    delete process.env.OPENCODE_GOAL_STATE_PATH;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("defaults to zh-CN locale and restricts reviewer/research/explore/plan/general agents", async () => {
    const instance = await plugin.server({ client: { session: {} } }, {});
    const sessionID = "ses_test_default";

    // Restricted agent 'reviewer' should record goal as paused
    const createdByReviewer = JSON.parse(
      await instance.tool.create_goal.execute(
        { objective: "Verify default zh-CN and restricted agents" },
        { sessionID, agent: "reviewer" }
      )
    );
    expect(createdByReviewer.goal.status).toBe("paused");
    expect(createdByReviewer.plan_mode_notice).toContain("Build 模式");

    await instance.tool.clear_goal.execute({}, { sessionID, agent: "build" });

    // Primary 'build' agent creates active goal
    const createdByBuild = JSON.parse(
      await instance.tool.create_goal.execute(
        { objective: "Verify active goal from build agent" },
        { sessionID, agent: "build" }
      )
    );
    expect(createdByBuild.goal.status).toBe("active");
    await instance.dispose();
  });

  test("supports dynamic atomic block plan_ops: insert_task, reorder_tasks, remove_task, insert_phase", async () => {
    const instance = await plugin.server({ client: { session: {} } }, {});
    const sessionID = "ses_test_plan_ops";

    const created = JSON.parse(
      await instance.tool.create_goal.execute(
        { objective: "Dynamic atomic block assembly test" },
        { sessionID, agent: "build" }
      )
    );
    const goalID = created.goal.id;

    // 1. Create initial plan with B1 -> B2 -> B4 -> B5 -> B6
    const initialPlanRes = JSON.parse(
      await instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 0,
          reason: "Initialize atomic skill blocks",
          plan: {
            summary: "Dynamic pipeline test",
            completionCriteria: ["Spec reviewed and approved"],
            phases: [
              {
                id: "phase_1",
                objective: "Dynamic workflow phase",
                status: "in_progress",
                tasks: [
                  { id: "B1", description: "issue-track", status: "completed", evidence: "Created MUL-707" },
                  { id: "B2", description: "req-grill", status: "pending" },
                  { id: "B4", description: "spec-draft", status: "pending" },
                  { id: "B5", description: "spec-review", status: "pending" },
                  { id: "B6", description: "gate-brief", status: "pending" }
                ]
              }
            ]
          }
        },
        { sessionID, agent: "build" }
      )
    );
    expect(initialPlanRes.goal.planRevision).toBe(1);

    // 2. Boss says: "把方案评审 (B5) 放第一位（紧接已完成 B1 之后），先做调研 (B3)，去掉需求拷问 (B2)，并在末尾加编码闭环 (B7)"
    const dynamicOpsRes = JSON.parse(
      await instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 1,
          reason: "Boss Priority 1 override: reorder B5 first, insert B3 & B7, remove pending B2",
          response_mode: "full",
          plan_ops: [
            { op: "remove_task", phase_id: "phase_1", task_id: "B2" },
            {
              op: "insert_task",
              phase_id: "phase_1",
              task_id: "B3",
              description: "fact-research",
              status: "pending",
              position: "before",
              target_task_id: "B4"
            },
            {
              op: "insert_task",
              phase_id: "phase_1",
              task_id: "B7",
              description: "impl-verify",
              status: "pending",
              position: "last"
            },
            {
              op: "reorder_tasks",
              phase_id: "phase_1",
              task_ids: ["B1", "B5", "B3", "B4", "B6", "B7"]
            }
          ]
        },
        { sessionID, agent: "build" }
      )
    );

    expect(dynamicOpsRes.goal.planRevision).toBe(2);
    const taskIds = dynamicOpsRes.goal.plan.phases[0].tasks.map((t) => t.id);
    expect(taskIds).toEqual(["B1", "B5", "B3", "B4", "B6", "B7"]);

    // 3. Verify removing a completed task is rejected
    await expect(
      instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 2,
          reason: "Try removing completed B1",
          plan_ops: [{ op: "remove_task", phase_id: "phase_1", task_id: "B1" }]
        },
        { sessionID, agent: "build" }
      )
    ).rejects.toThrow("cannot remove completed task");

    await instance.dispose();
  });

  test("supports HITL wait_reason (clarification / approval) and auto-resumes on human reply", async () => {
    const instance = await plugin.server({ client: { session: {} } }, {});
    const sessionID = "ses_test_hitl";

    await instance.tool.create_goal.execute(
      { objective: "Test HITL clarification and approval auto-resume" },
      { sessionID, agent: "build" }
    );

    // 1. Pause for requirement clarification (B2: req-grill)
    const pausedClarification = JSON.parse(
      await instance.tool.update_goal_status.execute(
        {
          status: "paused",
          wait_reason: "clarification",
          prompt_summary: "等待老板确认是否采用本地插件自维护方案（回复是可以即可）"
        },
        { sessionID, agent: "build" }
      )
    );
    expect(pausedClarification.goal.status).toBe("paused");
    expect(pausedClarification.goal.stopReason).toBe("waiting_user_clarification");
    expect(pausedClarification.goal.blocker).toContain("等待老板确认");

    // 2. Sending '/goal status' must NOT auto-resume the goal
    await instance["chat.message"](
      { sessionID, agent: "build" },
      { parts: [{ type: "text", text: "/goal status" }] }
    );
    const stillPaused = JSON.parse(
      await instance.tool.get_goal.execute({ view: "full" }, { sessionID })
    );
    expect(stillPaused.goal.status).toBe("paused");

    // 3. Boss replies naturally ("可以，按你推荐的继续吧") -> auto-resumes to active!
    await instance["chat.message"](
      { sessionID, agent: "build" },
      { parts: [{ type: "text", text: "可以，按你推荐的继续吧" }] }
    );
    const resumed = JSON.parse(
      await instance.tool.get_goal.execute({ view: "full" }, { sessionID })
    );
    expect(resumed.goal.status).toBe("active");
    expect(resumed.goal.stopReason).toBeNull();
    expect(resumed.goal.blocker).toBeNull();

    // 4. Pause at N6 / B6 gate for approval: replying "先别做，解释一下" keeps it paused!
    await instance.tool.update_goal_status.execute(
      {
        status: "paused",
        wait_reason: "approval",
        prompt_summary: "等待老板拍板是否进入 N7 编码实施"
      },
      { sessionID, agent: "build" }
    );
    await instance["chat.message"](
      { sessionID, agent: "build" },
      { parts: [{ type: "text", text: "先别做，解释一下为什么这么拆切片" }] }
    );
    const stillWaitingApproval = JSON.parse(
      await instance.tool.get_goal.execute({ view: "full" }, { sessionID })
    );
    expect(stillWaitingApproval.goal.status).toBe("paused");
    expect(stillWaitingApproval.goal.stopReason).toBe("waiting_user_approval");

    // 5. Boss explicitly approves -> auto-resumes to active!
    await instance["chat.message"](
      { sessionID, agent: "build" },
      { parts: [{ type: "text", text: "通过，按这个方案落地" }] }
    );
    const approvedResume = JSON.parse(
      await instance.tool.get_goal.execute({ view: "full" }, { sessionID })
    );
    expect(approvedResume.goal.status).toBe("active");

    await instance.dispose();
  });

  test("enforces vertical slice depends_on graph (rejects cycles, unmet dependencies, and selects ready frontier)", async () => {
    const instance = await plugin.server({ client: { session: {} } }, {});
    const sessionID = "ses_test_dag";

    const created = JSON.parse(
      await instance.tool.create_goal.execute(
        { objective: "Vertical slice dependency validation test" },
        { sessionID, agent: "build" }
      )
    );
    const goalID = created.goal.id;

    // 1. Rejects circular dependency S1 <-> S2
    await expect(
      instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 0,
          reason: "Test circular dependency",
          plan: {
            summary: "Cycle test",
            completionCriteria: ["All slices done"],
            phases: [
              {
                id: "p1",
                objective: "Slices",
                status: "in_progress",
                tasks: [
                  { id: "S1", description: "Slice 1", status: "pending", depends_on: ["S2"] },
                  { id: "S2", description: "Slice 2", status: "pending", depends_on: ["S1"] }
                ]
              }
            ]
          }
        },
        { sessionID, agent: "build" }
      )
    ).rejects.toThrow("circular task dependency");

    // 2. Rejects starting S2 (in_progress) while its dependency S1 is still pending
    await expect(
      instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 0,
          reason: "Test uncompleted dependency",
          plan: {
            summary: "Unmet blocker test",
            completionCriteria: ["All slices done"],
            phases: [
              {
                id: "p1",
                objective: "Slices",
                status: "in_progress",
                tasks: [
                  { id: "S1", description: "Slice 1", status: "pending" },
                  { id: "S2", description: "Slice 2", status: "in_progress", depends_on: ["S1"] }
                ]
              }
            ]
          }
        },
        { sessionID, agent: "build" }
      )
    ).rejects.toThrow("before dependency (S1) is completed");

    // 3. Valid DAG: S1 completed -> S2 can now transition to in_progress
    const validPlan = JSON.parse(
      await instance.tool.update_goal_plan.execute(
        {
          goal_id: goalID,
          expected_revision: 0,
          reason: "Create valid vertical slices",
          plan: {
            summary: "Valid vertical slices",
            completionCriteria: ["All slices done"],
            phases: [
              {
                id: "p1",
                objective: "Slices",
                status: "in_progress",
                tasks: [
                  { id: "S1", description: "Slice 1 (Covers: R1)", status: "completed", evidence: "bun test passed" },
                  { id: "S2", description: "Slice 2 (Covers: R2)", status: "in_progress", depends_on: ["S1"] }
                ]
              }
            ]
          }
        },
        { sessionID, agent: "build" }
      )
    );
    expect(validPlan.goal.planRevision).toBe(1);

    await instance.dispose();
  });
});

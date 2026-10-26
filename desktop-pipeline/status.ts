import type {
  SessionMessageAssistantTool,
  SessionMessageInfo,
} from "@opencode/client/promise"

export const GOAL_TOOL_NAMES: readonly string[] = [
  "get_goal",
  "get_goal_history",
  "create_goal",
  "set_goal",
  "update_goal",
  "update_goal_plan",
  "update_goal_objective",
  "update_goal_status",
  "stop_goal",
  "replace_goal",
  "clear_goal",
]

export type GoalStatus =
  | "active"
  | "paused"
  | "budgetLimited"
  | "usageLimited"
  | "complete"
  | "unmet"
  | "cancelled"

export type PipelineStepStatus = "completed" | "in_progress" | "pending" | "blocked"

export type PipelineTone = "accent" | "success" | "warning" | "critical" | "muted"

export type PipelineMode = "dual_goal" | "generic_goal"

export type PipelineGateStatus = "locked" | "waiting_approval" | "ready"

export interface GoalPlanTask {
  readonly id: string
  readonly description: string
  readonly status: PipelineStepStatus
  readonly evidence?: string | null
  readonly blocker?: string | null
}

export interface GoalPlanPhase {
  readonly id: string
  readonly objective: string
  readonly status: PipelineStepStatus
  readonly tasks?: GoalPlanTask[]
  readonly verification?: string | null
  readonly blocker?: string | null
  readonly evidence?: string | null
}

export interface GoalPlan {
  readonly summary?: string
  readonly completionCriteria?: string[]
  readonly phases?: GoalPlanPhase[]
  readonly revision?: number
  readonly updatedAt?: number
}

export interface RawGoalSnapshot {
  readonly id?: string
  readonly sessionID?: string
  readonly objective: string
  readonly status: GoalStatus
  readonly tokensUsed: number
  readonly tokenBudget: number | null
  readonly timeUsedSeconds: number
  readonly autoTurns: number
  readonly maxAutoTurns: number | null
  readonly stopReason: string | null
  readonly blocker: string | null
  readonly completionEvidence: string | null
  readonly lastCheckpoint: { readonly summary: string; readonly timestamp?: number } | null
  readonly plan: GoalPlan | null
  readonly createdAt?: number
  readonly updatedAt?: number
}

export interface PipelineStep {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly status: PipelineStepStatus
  readonly tone: PipelineTone
  readonly evidence?: string
  readonly blocker?: string
  readonly phaseId?: string
  readonly tasks?: GoalPlanTask[]
}

export interface DerivedPipelineState {
  readonly mode: PipelineMode
  readonly goal: RawGoalSnapshot
  readonly status: GoalStatus
  readonly tone: PipelineTone
  readonly completedCount: number
  readonly totalCount: number
  readonly steps: PipelineStep[]
  readonly issueId?: string
  readonly issuePath?: string
  readonly specPath?: string
  readonly debateRounds: number
  readonly debateRunning: boolean
  readonly gateStatus: PipelineGateStatus
  readonly stage2Command: string
}

export const STAGE1_STANDARD_STEPS: readonly { readonly id: string; readonly title: string }[] = [
  { id: "s1_1", title: "Issue 分流与需求建档" },
  { id: "s1_2", title: "三轨灵活路由取证（Opus 5.5）" },
  { id: "s1_3", title: "主会话起草初版 Spec" },
  { id: "s1_4", title: "Fable 5.1 异构双轮互辩" },
  { id: "s1_5", title: "写入最终 Spec 并停机呈交拍板" },
]

const VALID_GOAL_STATUSES = new Set<string>([
  "active",
  "paused",
  "budgetLimited",
  "usageLimited",
  "complete",
  "unmet",
  "cancelled",
])

const STAGE1_STEP_IDS = new Set<string>(STAGE1_STANDARD_STEPS.map((s) => s.id))

export const ATOMIC_BLOCK_IDS = new Set<string>([
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
  "N1",
  "N2",
  "N3",
  "N4",
  "N5",
  "N6",
  "N7",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function normalizeGoalStatus(value: unknown): GoalStatus {
  const s = typeof value === "string" ? value : ""
  return VALID_GOAL_STATUSES.has(s) ? (s as GoalStatus) : "active"
}

export function normalizeStepStatus(value: unknown): PipelineStepStatus {
  if (value === "completed" || value === "done") return "completed"
  if (value === "in_progress" || value === "running" || value === "active") return "in_progress"
  if (value === "blocked" || value === "error" || value === "failed" || value === "unmet") return "blocked"
  return "pending"
}

export function goalStatusTone(status: GoalStatus, hasBlockedStep = false): PipelineTone {
  if (status === "unmet" || hasBlockedStep) return "critical"
  if (status === "budgetLimited" || status === "usageLimited" || status === "paused") return "warning"
  if (status === "cancelled") return "muted"
  if (status === "complete") return "success"
  return "accent"
}

export function stepStatusTone(status: PipelineStepStatus): PipelineTone {
  if (status === "completed") return "success"
  if (status === "in_progress") return "accent"
  if (status === "blocked") return "critical"
  return "muted"
}

function parsePlan(raw: unknown): GoalPlan | null {
  if (!isRecord(raw)) return null
  const rawPhases = Array.isArray(raw.phases) ? raw.phases : undefined
  const phases: GoalPlanPhase[] | undefined = rawPhases?.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = asString(item.id) ?? "phase"
    const objective = asString(item.objective) ?? asString(item.title) ?? id
    const status = normalizeStepStatus(item.status)
    const rawTasks = Array.isArray(item.tasks) ? item.tasks : undefined
    const tasks: GoalPlanTask[] | undefined = rawTasks?.flatMap((t) => {
      if (!isRecord(t)) return []
      const taskId = asString(t.id) ?? "task"
      const description = asString(t.description) ?? asString(t.title) ?? taskId
      return [
        {
          id: taskId,
          description,
          status: normalizeStepStatus(t.status),
          evidence: asString(t.evidence) ?? null,
          blocker: asString(t.blocker) ?? null,
        },
      ]
    })
    return [
      {
        id,
        objective,
        status,
        tasks,
        verification: asString(item.verification) ?? null,
        blocker: asString(item.blocker) ?? null,
        evidence: asString(item.evidence) ?? null,
      },
    ]
  })

  return {
    summary: asString(raw.summary),
    completionCriteria: Array.isArray(raw.completionCriteria)
      ? raw.completionCriteria.filter((c): c is string => typeof c === "string")
      : undefined,
    phases,
    revision: asNumber(raw.revision),
    updatedAt: asNumber(raw.updatedAt),
  }
}

interface PartialGoalRecord {
  id?: string
  sessionID?: string
  objective?: string
  status?: GoalStatus
  tokensUsed?: number
  tokenBudget?: number | null
  timeUsedSeconds?: number
  autoTurns?: number
  maxAutoTurns?: number | null
  stopReason?: string | null
  blocker?: string | null
  completionEvidence?: string | null
  lastCheckpoint?: { summary: string; timestamp?: number } | null
  plan?: GoalPlan | null
  createdAt?: number
  updatedAt?: number
}

function extractFromGoalToolPart(
  part: SessionMessageAssistantTool,
): { cleared: true } | { cleared: false; record: PartialGoalRecord } | undefined {
  if (part.type !== "tool" || !GOAL_TOOL_NAMES.includes(part.name)) return undefined
  if (part.state.status !== "completed") return undefined
  if (part.name === "clear_goal") return { cleared: true }

  let parsedGoal: Record<string, unknown> | null | undefined
  const textEntry = part.state.content.find((entry) => entry.type === "text")
  if (textEntry) {
    try {
      const parsed: unknown = JSON.parse(textEntry.text)
      if (isRecord(parsed)) {
        if (parsed.goal === null) return { cleared: true }
        if (isRecord(parsed.goal)) parsedGoal = parsed.goal
      }
    } catch {
      // Ignore malformed JSON in tool output and check metadata
    }
  }

  let metaGoal: Record<string, unknown> | undefined
  const metadata = part.state.metadata
  if (isRecord(metadata) && isRecord(metadata.acp) && isRecord(metadata.acp.plan) && isRecord(metadata.acp.plan._meta)) {
    const rawMeta = metadata.acp.plan._meta["opencode-goal"]
    if (rawMeta === null && !parsedGoal) return { cleared: true }
    if (isRecord(rawMeta)) metaGoal = rawMeta
  }

  if (!parsedGoal && !metaGoal) return undefined

  const rawCheckpoint = parsedGoal?.lastCheckpoint
  const lastCheckpoint =
    isRecord(rawCheckpoint) && typeof rawCheckpoint.summary === "string"
      ? { summary: rawCheckpoint.summary, timestamp: asNumber(rawCheckpoint.timestamp) }
      : undefined

  const plan = parsePlan(metaGoal?.plan) ?? parsePlan(parsedGoal?.plan) ?? undefined

  const record: PartialGoalRecord = {
    id: asString(metaGoal?.id) ?? asString(parsedGoal?.id),
    sessionID: asString(parsedGoal?.sessionID),
    objective: asString(metaGoal?.objective) ?? asString(parsedGoal?.objective),
    status:
      metaGoal?.status !== undefined
        ? normalizeGoalStatus(metaGoal.status)
        : parsedGoal?.status !== undefined
          ? normalizeGoalStatus(parsedGoal.status)
          : undefined,
    tokensUsed: asNumber(parsedGoal?.tokensUsed),
    tokenBudget:
      parsedGoal?.tokenBudget === null ? null : asNumber(parsedGoal?.tokenBudget),
    timeUsedSeconds: asNumber(parsedGoal?.timeUsedSeconds),
    autoTurns: asNumber(parsedGoal?.autoTurns),
    maxAutoTurns:
      parsedGoal?.maxAutoTurns === null ? null : asNumber(parsedGoal?.maxAutoTurns),
    stopReason:
      parsedGoal?.stopReason === null ? null : asString(parsedGoal?.stopReason),
    blocker:
      metaGoal?.blocker === null && parsedGoal?.blocker === null
        ? null
        : asString(metaGoal?.blocker) ?? asString(parsedGoal?.blocker),
    completionEvidence:
      metaGoal?.completionEvidence === null && parsedGoal?.completionEvidence === null
        ? null
        : asString(metaGoal?.completionEvidence) ?? asString(parsedGoal?.completionEvidence),
    lastCheckpoint,
    plan,
    createdAt: asNumber(parsedGoal?.createdAt),
    updatedAt: asNumber(parsedGoal?.updatedAt),
  }

  return { cleared: false, record }
}

/**
 * Extracts and merges the latest active Goal snapshot from a session's messages.
 * Merges newer summary/plan updates with earlier full snapshots in the same goal lifecycle.
 */
export function extractGoalSnapshot(messages: readonly SessionMessageInfo[]): RawGoalSnapshot | null {
  const records: PartialGoalRecord[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message || message.type !== "assistant") continue
    const parts = message.content
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j]
      if (!part || part.type !== "tool") continue
      const extracted = extractFromGoalToolPart(part)
      if (!extracted) continue
      if (extracted.cleared) {
        if (records.length === 0) return null
        return finalizeSnapshot(records)
      }
      records.push(extracted.record)
      if (part.name === "create_goal" || part.name === "set_goal" || part.name === "replace_goal") {
        return finalizeSnapshot(records)
      }
    }
  }

  if (records.length === 0) return null
  return finalizeSnapshot(records)
}

function finalizeSnapshot(records: readonly PartialGoalRecord[]): RawGoalSnapshot | null {
  const merged: PartialGoalRecord = {}
  for (const rec of records) {
    if (merged.id === undefined && rec.id !== undefined) merged.id = rec.id
    if (merged.sessionID === undefined && rec.sessionID !== undefined) merged.sessionID = rec.sessionID
    if (merged.objective === undefined && rec.objective !== undefined) merged.objective = rec.objective
    if (merged.status === undefined && rec.status !== undefined) merged.status = rec.status
    if (merged.tokensUsed === undefined && rec.tokensUsed !== undefined) merged.tokensUsed = rec.tokensUsed
    if (merged.tokenBudget === undefined && rec.tokenBudget !== undefined) merged.tokenBudget = rec.tokenBudget
    if (merged.timeUsedSeconds === undefined && rec.timeUsedSeconds !== undefined)
      merged.timeUsedSeconds = rec.timeUsedSeconds
    if (merged.autoTurns === undefined && rec.autoTurns !== undefined) merged.autoTurns = rec.autoTurns
    if (merged.maxAutoTurns === undefined && rec.maxAutoTurns !== undefined) merged.maxAutoTurns = rec.maxAutoTurns
    if (merged.stopReason === undefined && rec.stopReason !== undefined) merged.stopReason = rec.stopReason
    if (merged.blocker === undefined && rec.blocker !== undefined) merged.blocker = rec.blocker
    if (merged.completionEvidence === undefined && rec.completionEvidence !== undefined)
      merged.completionEvidence = rec.completionEvidence
    if (merged.lastCheckpoint === undefined && rec.lastCheckpoint !== undefined)
      merged.lastCheckpoint = rec.lastCheckpoint
    if (merged.plan === undefined && rec.plan !== undefined) merged.plan = rec.plan
    if (merged.createdAt === undefined && rec.createdAt !== undefined) merged.createdAt = rec.createdAt
    if (merged.updatedAt === undefined && rec.updatedAt !== undefined) merged.updatedAt = rec.updatedAt
  }

  if (!merged.objective && !merged.status && !merged.plan) return null

  return {
    id: merged.id,
    sessionID: merged.sessionID,
    objective: merged.objective ?? "",
    status: merged.status ?? "active",
    tokensUsed: merged.tokensUsed ?? 0,
    tokenBudget: merged.tokenBudget ?? null,
    timeUsedSeconds: merged.timeUsedSeconds ?? 0,
    autoTurns: merged.autoTurns ?? 0,
    maxAutoTurns: merged.maxAutoTurns ?? null,
    stopReason: merged.stopReason ?? null,
    blocker: merged.blocker ?? null,
    completionEvidence: merged.completionEvidence ?? null,
    lastCheckpoint: merged.lastCheckpoint ?? null,
    plan: merged.plan ?? null,
    createdAt: merged.createdAt,
    updatedAt: merged.updatedAt,
  }
}

interface SessionTraceInfo {
  hasDualGoalSkill: boolean
  issueId?: string
  issuePath?: string
  specPath?: string
  wroteIssue: boolean
  wroteSpec: boolean
  exploreCompleted: boolean
  exploreRunning: boolean
  exploreDescription?: string
  debateRounds: number
  debateRunning: boolean
}

function normalizeRepoRelativePath(rawPath: string): string {
  const idx = rawPath.indexOf("TeamIssue/")
  if (idx >= 0) return rawPath.slice(idx)
  return rawPath
}

function scanTextForIssueAndPaths(text: string, trace: SessionTraceInfo) {
  const issueDirMatch = text.match(/TeamIssue\/(?:done\/)?(MUL-\d+[^/\s"'`)]*)/)
  if (issueDirMatch?.[1]) {
    const folder = issueDirMatch[1]
    const idMatch = folder.match(/^(MUL-\d+)/)
    if (idMatch?.[1] && !trace.issueId) trace.issueId = idMatch[1]
    if (!trace.issuePath) trace.issuePath = `TeamIssue/${folder}/issue.md`
  }

  const issueFileMatch = text.match(/(TeamIssue\/(?:done\/)?MUL-\d+[^/\s"'`)]*\/issue\.md)/)
  if (issueFileMatch?.[1]) {
    trace.issuePath = issueFileMatch[1]
  }

  const specFileMatch = text.match(/(TeamIssue\/(?:done\/)?MUL-\d+[^/\s"'`)]*\/(?:tech-proposal|spec)\.md)/)
  if (specFileMatch?.[1]) {
    trace.specPath = specFileMatch[1]
  }

  if (!trace.issueId) {
    const mulMatch = text.match(/\b(MUL-\d+)\b/)
    if (mulMatch?.[1]) trace.issueId = mulMatch[1]
    else {
      const ghMatch = text.match(/(?:issue\s+|#)(\d+)\b/i)
      if (ghMatch?.[1]) trace.issueId = `#${ghMatch[1]}`
    }
  }
}

function scanSessionTrace(messages: readonly SessionMessageInfo[], goal: RawGoalSnapshot): SessionTraceInfo {
  const trace: SessionTraceInfo = {
    hasDualGoalSkill: false,
    wroteIssue: false,
    wroteSpec: false,
    exploreCompleted: false,
    exploreRunning: false,
    debateRounds: 0,
    debateRunning: false,
  }

  scanTextForIssueAndPaths(goal.objective, trace)
  if (goal.completionEvidence) scanTextForIssueAndPaths(goal.completionEvidence, trace)
  if (goal.lastCheckpoint?.summary) scanTextForIssueAndPaths(goal.lastCheckpoint.summary, trace)

  for (const message of messages) {
    if (!message || message.type !== "assistant") continue
    for (const part of message.content) {
      if (!part || part.type !== "tool") continue
      const input = "input" in part.state && isRecord(part.state.input) ? part.state.input : {}

      if (part.name === "skill") {
        const skillName = asString(input.name) ?? asString(input.skill) ?? ""
        if (skillName.includes("team-dual-goal")) trace.hasDualGoalSkill = true
      }

      if (part.name === "write" || part.name === "edit" || part.name === "read") {
        const filePath = asString(input.filePath) ?? asString(input.path) ?? ""
        if (filePath) {
          scanTextForIssueAndPaths(filePath, trace)
          const rel = normalizeRepoRelativePath(filePath)
          if (rel.endsWith("/issue.md") || rel === "issue.md") {
            trace.issuePath = rel
            if (part.name === "write" || part.name === "edit") trace.wroteIssue = true
          }
          if (rel.endsWith("/tech-proposal.md") || rel.endsWith("/spec.md")) {
            trace.specPath = rel
            if (part.name === "write" || part.name === "edit") trace.wroteSpec = true
          }
        }
      }

      if (part.name === "bash" || part.name === "shell") {
        const cmd = asString(input.command) ?? ""
        if (cmd) scanTextForIssueAndPaths(cmd, trace)
      }

      if (part.name === "subagent" || part.name === "task") {
        const agent = (asString(input.agent) ?? asString(input.subagent_type) ?? "").toLowerCase()
        const model = (asString(input.model) ?? "").toLowerCase()
        const desc = asString(input.description) ?? asString(input.prompt) ?? ""
        const isReviewer =
          agent === "reviewer" ||
          model.includes("fable") ||
          model.includes("perplexity") ||
          desc.includes("Fable") ||
          desc.includes("互辩") ||
          desc.includes("冷审")
        const isExplore =
          !isReviewer &&
          (agent === "explore" ||
            agent === "general" ||
            agent === "research" ||
            desc.includes("取证") ||
            desc.includes("Opus"))

        if (isReviewer) {
          if (part.state.status === "completed") trace.debateRounds += 1
          else if (part.state.status === "running") trace.debateRunning = true
        } else if (isExplore) {
          if (desc && !trace.exploreDescription) trace.exploreDescription = desc
          if (part.state.status === "completed") trace.exploreCompleted = true
          else if (part.state.status === "running") trace.exploreRunning = true
        }
      }
    }
  }

  return trace
}

export function isDualGoalMode(goal: RawGoalSnapshot, trace: SessionTraceInfo): boolean {
  if (trace.hasDualGoalSkill) return true
  const obj = goal.objective
  if (
    obj.includes("阶段 1") ||
    obj.includes("待拍板") ||
    /team-dual-goal/i.test(obj) ||
    /dual-goal/i.test(obj)
  ) {
    return true
  }
  const phases = goal.plan?.phases ?? []
  for (const phase of phases) {
    if (STAGE1_STEP_IDS.has(phase.id) || ATOMIC_BLOCK_IDS.has(phase.id)) return true
    for (const task of phase.tasks ?? []) {
      if (STAGE1_STEP_IDS.has(task.id) || ATOMIC_BLOCK_IDS.has(task.id)) return true
    }
  }
  return false
}

export function buildStage2Command(issuePath?: string): string {
  const target = issuePath && issuePath.trim().length > 0 ? issuePath : "TeamIssue/MUL-xxx/issue.md"
  return `agy --model gemini-4-argon-high --dangerously-skip-permissions -p "/goal 读取 ${target} 已拍板方案（§1~§5），按 §4 垂直切片 depends_on 顺序实施并跑先红后绿验证（同切片修复连续失败 3 次停机报 Blocker），完成后跑三合一终审并回填 §6"`
}

function buildDualGoalSteps(goal: RawGoalSnapshot, trace: SessionTraceInfo): PipelineStep[] {
  const phases = goal.plan?.phases ?? []
  const hasDynamicBlockPlan =
    phases.length > 0 &&
    phases.some((phase) =>
      phase.tasks && phase.tasks.length > 0
        ? phase.tasks.some((task) => !STAGE1_STEP_IDS.has(task.id))
        : !STAGE1_STEP_IDS.has(phase.id),
    )
  if (hasDynamicBlockPlan) {
    return buildGenericGoalSteps(goal)
  }

  const explicitById = new Map<string, { status: PipelineStepStatus; evidence?: string; blocker?: string }>()
  for (const phase of phases) {
    if (STAGE1_STEP_IDS.has(phase.id)) {
      explicitById.set(phase.id, {
        status: phase.status,
        evidence: phase.evidence ?? phase.verification ?? undefined,
        blocker: phase.blocker ?? undefined,
      })
    }
    for (const task of phase.tasks ?? []) {
      if (STAGE1_STEP_IDS.has(task.id)) {
        explicitById.set(task.id, {
          status: task.status,
          evidence: task.evidence ?? undefined,
          blocker: task.blocker ?? phase.blocker ?? undefined,
        })
      }
    }
  }

  const inferredStatuses: Record<string, PipelineStepStatus> = {
    s1_1: "pending",
    s1_2: "pending",
    s1_3: "pending",
    s1_4: "pending",
    s1_5: "pending",
  }

  const s4Started = trace.debateRunning || trace.debateRounds > 0
  const s3Done = trace.wroteSpec || s4Started
  const s2Done = trace.exploreCompleted || s3Done
  const s1Done = trace.wroteIssue || Boolean(trace.issuePath || trace.issueId) || s2Done

  if (s1Done) inferredStatuses.s1_1 = "completed"
  else if (goal.status === "active") inferredStatuses.s1_1 = "in_progress"

  if (s2Done) inferredStatuses.s1_2 = "completed"
  else if (trace.exploreRunning || (s1Done && !s3Done && goal.status === "active")) {
    inferredStatuses.s1_2 = "in_progress"
  }

  if (s3Done) inferredStatuses.s1_3 = "completed"
  else if (s2Done && !s4Started && goal.status === "active") {
    inferredStatuses.s1_3 = "in_progress"
  }

  if (trace.debateRunning) {
    inferredStatuses.s1_4 = "in_progress"
  } else if (trace.debateRounds >= 2 || (trace.debateRounds >= 1 && goal.status === "complete")) {
    inferredStatuses.s1_4 = "completed"
  } else if (trace.debateRounds === 1) {
    inferredStatuses.s1_4 = "in_progress"
  }

  if (goal.status === "complete") {
    inferredStatuses.s1_1 = "completed"
    inferredStatuses.s1_2 = "completed"
    inferredStatuses.s1_3 = "completed"
    inferredStatuses.s1_4 = "completed"
    inferredStatuses.s1_5 = "completed"
  } else if (inferredStatuses.s1_4 === "completed" && goal.status === "active") {
    inferredStatuses.s1_5 = "in_progress"
  }

  const defaultEvidence: Record<string, string | undefined> = {
    s1_1: trace.issuePath ?? trace.issueId,
    s1_2: trace.exploreDescription,
    s1_3: trace.specPath,
    s1_4:
      trace.debateRounds >= 2
        ? `已完成 ${trace.debateRounds} 轮互辩`
        : trace.debateRounds === 1
          ? trace.debateRunning
            ? "第 1/2 轮互辩（第 2 轮运行中）"
            : "第 1/2 轮互辩"
          : trace.debateRunning
            ? "第 1/2 轮互辩运行中"
            : undefined,
    s1_5: goal.completionEvidence ?? trace.specPath ?? trace.issuePath,
  }

  return STAGE1_STANDARD_STEPS.map((def) => {
    const exp = explicitById.get(def.id)
    let status: PipelineStepStatus
    if (goal.status === "complete") {
      status = exp?.status === "blocked" ? "blocked" : "completed"
    } else if (exp && exp.status !== "pending") {
      status = exp.status
    } else {
      status = inferredStatuses[def.id] ?? "pending"
    }

    return {
      id: def.id,
      title: def.title,
      status,
      tone: stepStatusTone(status),
      evidence: exp?.evidence ?? defaultEvidence[def.id],
      blocker: exp?.blocker,
    }
  })
}

function buildGenericGoalSteps(goal: RawGoalSnapshot): PipelineStep[] {
  const phases = goal.plan?.phases ?? []
  if (phases.length === 0) {
    const status: PipelineStepStatus =
      goal.status === "complete"
        ? "completed"
        : goal.status === "unmet"
          ? "blocked"
          : goal.status === "cancelled"
            ? "pending"
            : "in_progress"
    return [
      {
        id: "objective",
        title: goal.objective || "Goal",
        status,
        tone: stepStatusTone(status),
        evidence: goal.completionEvidence ?? goal.lastCheckpoint?.summary ?? undefined,
        blocker: goal.blocker ?? undefined,
      },
    ]
  }

  const steps: PipelineStep[] = []
  for (const phase of phases) {
    const tasks = phase.tasks ?? []
    if (tasks.length === 0) {
      const status = goal.status === "complete" && phase.status !== "blocked" ? "completed" : phase.status
      steps.push({
        id: phase.id,
        title: phase.objective,
        status,
        tone: stepStatusTone(status),
        evidence: phase.evidence ?? phase.verification ?? undefined,
        blocker: phase.blocker ?? undefined,
        phaseId: phase.id,
      })
    } else {
      for (const task of tasks) {
        const status = goal.status === "complete" && task.status !== "blocked" ? "completed" : task.status
        steps.push({
          id: `${phase.id}:${task.id}`,
          title: task.description,
          subtitle: phase.objective,
          status,
          tone: stepStatusTone(status),
          evidence: task.evidence ?? phase.verification ?? undefined,
          blocker: task.blocker ?? phase.blocker ?? undefined,
          phaseId: phase.id,
        })
      }
    }
  }
  return steps
}

/**
 * Derives the full pipeline view state for a session from its message list.
 * Pure function with zero Node fs or IPC dependencies.
 */
export function derivePipeline(messages: readonly SessionMessageInfo[]): DerivedPipelineState | null {
  const goal = extractGoalSnapshot(messages)
  if (!goal) return null

  const trace = scanSessionTrace(messages, goal)
  const mode: PipelineMode = isDualGoalMode(goal, trace) ? "dual_goal" : "generic_goal"
  const steps = mode === "dual_goal" ? buildDualGoalSteps(goal, trace) : buildGenericGoalSteps(goal)
  const totalCount = steps.length
  const completedCount = steps.filter((s) => s.status === "completed").length
  const hasBlockedStep = steps.some((s) => s.status === "blocked")
  const tone = goalStatusTone(goal.status, hasBlockedStep)

  const isWaitingHumanGate =
    goal.stopReason === "waiting_user_approval" ||
    goal.stopReason === "waiting_user_clarification"
  const gateStatus: PipelineGateStatus =
    mode === "dual_goal" &&
    (goal.status === "complete" || isWaitingHumanGate || (totalCount > 0 && completedCount === totalCount))
      ? "waiting_approval"
      : "locked"

  return {
    mode,
    goal,
    status: goal.status,
    tone,
    completedCount,
    totalCount,
    steps,
    issueId: trace.issueId,
    issuePath: trace.issuePath,
    specPath: trace.specPath,
    debateRounds: trace.debateRounds,
    debateRunning: trace.debateRunning,
    gateStatus,
    stage2Command: buildStage2Command(trace.issuePath),
  }
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`
  return `${rest}s`
}

export function formatTokens(total: number): string {
  if (total < 1000) return String(total)
  if (total < 1_000_000) return `${(total / 1000).toFixed(total < 10_000 ? 1 : 0)}k`
  return `${(total / 1_000_000).toFixed(1)}M`
}

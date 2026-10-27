import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
buildOpenCodeSessionWebUrl,
matchDispatchesWithSessions,
parseTranscriptDispatches,
startServer,
} from "./server.mjs";

const CID = "54273816-ad86-4db5-bc88-5aeb8f028062";
const ORIGIN = "http://127.0.0.1:49374";
const T0 = Date.parse("2026-10-27T03:17:31Z");
const WT = "/Users/mac/Code/wt";

const step = (stepIndex, createdAt, commandLine, toolSummary) =>
JSON.stringify({
step_index: stepIndex,
created_at: createdAt,
tool_calls: [
{ name: "run_command", args: { CommandLine: JSON.stringify(commandLine), toolSummary: JSON.stringify(toolSummary) } },
],
});

const transcript = [
step(82, "2026-10-27T03:10:35Z", "opencode run --help", "Check flags"),
step(125, "2026-10-27T03:17:31Z", `cd ${WT} && opencode run --agent coder -m word-claude/claude-sonnet-5-5#medium --auto "hi"`, "Dispatch Slice S1"),
step(160, "2026-10-27T03:30:00Z", `cd "${WT}" && opencode run --agent reviewer --auto 'x'`, "Review S1"),
JSON.stringify({ step_index: 161, created_at: "2026-10-27T03:31:00Z", tool_calls: Array.of({ name: "run_command", args: { CommandLine: JSON.stringify("ls") } }) }),
].join("\n");

describe("parseTranscriptDispatches", () => {
const out = parseTranscriptDispatches(transcript, CID);

test("unwraps JSON-string-wrapped CommandLine/toolSummary and skips --help and non-opencode commands", () => {
expect(out.map((d) => d.stepIndex)).toEqual(Array.of(125, 160));
expect(out.at(0)).toMatchObject({
conversationId: CID,
createdAtMs: T0,
toolSummary: "Dispatch Slice S1",
agent: "coder",
model: "word-claude/claude-sonnet-5-5#medium",
workdir: WT,
});
expect(out.at(0).commandLine.startsWith(`cd ${WT}`)).toBe(true);
});

test("handles quoted cd directory and missing model", () => {
expect(out.at(1)).toMatchObject({ agent: "reviewer", workdir: WT });
expect(out.at(1).model).toBeUndefined();
});

test("keeps dispatches whose wrapped CommandLine is not valid JSON (raw newline inside quotes)", () => {
const wrapped = `"cd ${WT} && opencode run --agent explore --auto \\"line1\nline2\\""`;
const raw = JSON.stringify({ step_index: 200, created_at: "2026-10-27T03:40:00Z", tool_calls: [{ name: "run_command", args: { CommandLine: wrapped, toolSummary: JSON.stringify("Explore") } }] });
const got = parseTranscriptDispatches(raw, CID);
expect(got).toHaveLength(1);
expect(got.at(0)).toMatchObject({ stepIndex: 200, agent: "explore", workdir: WT, toolSummary: "Explore" });
});

test("tolerates a truncated trailing line", () => {
expect(parseTranscriptDispatches(`${transcript}\n{"step_index":170,"opencode run`, CID)).toHaveLength(2);
});

test("ignores heredoc or script commands that only mention opencode run in body", () => {
const heredoc = step(325, "2026-10-27T04:25:24Z", "cat << 'EOF' > /tmp/comment.md\nopencode run --agent coder --auto\nEOF", "Write comment");
expect(parseTranscriptDispatches(heredoc, CID)).toHaveLength(0);
});
});

describe("buildOpenCodeSessionWebUrl", () => {
test("uses base64url(origin) without padding", () => {
const b64 = Buffer.from(ORIGIN).toString("base64url");
expect(b64).not.toContain("=");
expect(buildOpenCodeSessionWebUrl(ORIGIN, "ses_abc")).toBe(`${ORIGIN}/server/${b64}/session/ses_abc`);
});
});

describe("matchDispatchesWithSessions", () => {
const dispatches = parseTranscriptDispatches(transcript, CID);
const mk = (id, over = {}) => ({
id,
title: id,
agent: "coder",
model: { providerID: "word-claude", id: "claude-sonnet-5-5", variant: "medium" },
cost: 0,
tokens: { input: 1, output: 2 },
time: { created: T0 + 2000, updated: T0 + 9000 },
location: { directory: WT },
...over,
});
const node = (nodes, stepIndex) => nodes.find((n) => n.stepIndex === stepIndex);

test("explicit metadata beats heuristics", () => {
const sessions = [
mk("ses_heur"),
mk("ses_meta", { agent: "other", time: { created: 1, updated: 2 }, metadata: { agyConversationId: CID, agyStepIndex: "125" } }),
];
const n = node(matchDispatchesWithSessions(dispatches, sessions, [], ORIGIN), 125);
expect(n.session.id).toBe("ses_meta");
expect(n.session.webUrl).toBe(buildOpenCodeSessionWebUrl(ORIGIN, "ses_meta"));
});

test("history backtrace by time window + directory + agent", () => {
const sessions = [
mk("ses_late", { time: { created: T0 + 600000, updated: T0 + 700000 } }),
mk("ses_wrongdir", { location: { directory: "/elsewhere" } }),
mk("ses_ok"),
];
const nodes = matchDispatchesWithSessions(dispatches, sessions, [], ORIGIN);
const n = node(nodes, 125);
expect(n.session.id).toBe("ses_ok");
expect(n.session).toMatchObject({ agent: "coder", model: "word-claude/claude-sonnet-5-5#medium" });
expect(node(nodes, 160).session).toBeNull();
});

test("ledger entry supplies status and merges with the dispatch of the same step or S+1 tool execution step", () => {
const ledger = Array.of({ conversationId: CID, stepIndex: 126, sessionId: "ses_ok", status: "succeeded", startedAt: T0, completedAt: T0 + 5000, agent: "coder", model: "m", cwd: WT, toolSummary: "Dispatch Slice S1" });
const nodes = matchDispatchesWithSessions(dispatches, Array.of(mk("ses_ok")), ledger, ORIGIN);
expect(nodes.filter((n) => n.stepIndex === 125)).toHaveLength(1);
expect(nodes.find((n) => n.stepIndex === 126)).toBeUndefined();
expect(node(nodes, 125)).toMatchObject({ status: "succeeded", completedAt: T0 + 5000, session: { id: "ses_ok" } });
});

test("ledger-only entries (no transcript) still appear", () => {
const ledger = Array.of({ conversationId: CID, stepIndex: 3, sessionId: "ses_x", status: "running", startedAt: 1 });
const nodes = matchDispatchesWithSessions([], Array.of(mk("ses_x")), ledger, ORIGIN);
expect(nodes).toHaveLength(1);
expect(nodes.at(0)).toMatchObject({ stepIndex: 3, status: "running", session: { id: "ses_x" } });
});

test("CLI -s resume step binds to existing session without stealing initial creation match", () => {
const stepsWithResume = [
step(167, "2026-10-27T03:17:31Z", `cd ${WT} && opencode run --agent coder --auto "init"`, "Initial run"),
step(185, "2026-10-27T03:29:44Z", `cd ${WT} && opencode run -s ses_ok --agent coder --auto "resume"`, "Resume run"),
].join("\n");
const parsed = parseTranscriptDispatches(stepsWithResume, CID);
const nodes = matchDispatchesWithSessions(parsed, Array.of(mk("ses_ok")), [], ORIGIN);
expect(node(nodes, 167).session.id).toBe("ses_ok");
expect(node(nodes, 185).session.id).toBe("ses_ok");
});
});

describe("default title lookup", () => {
test("reads the title from a real conversation_summaries.db", async () => {
const home = mkdtempSync(join(tmpdir(), "pipe-"));
const logs = join(home, "brain", CID, ".system_generated", "logs");
mkdirSync(logs, { recursive: true });
writeFileSync(join(logs, "transcript.jsonl"), transcript);
const db = new Database(join(home, "conversation_summaries.db"));
db.run("CREATE TABLE conversation_summaries (conversation_id TEXT, title TEXT)");
db.run("INSERT INTO conversation_summaries VALUES (?, ?)", [CID, "real title"]);
db.close();
const server = await startServer({
port: 0,
agyDir: home,
opencode: { origin: ORIGIN, listSessions: async () => [], getSession: async () => ({}), getMessages: async () => [] },
});
try {
const body = await (await fetch(`http://127.0.0.1:${server.address().port}/api/pipeline?conversationId=${CID}`)).json();
expect(body.title).toBe("real title");
} finally {
server.close();
}
});

test("unreadable conversation_summaries.db degrades to an empty title instead of a 500", async () => {
const home = mkdtempSync(join(tmpdir(), "pipe-"));
const logs = join(home, "brain", CID, ".system_generated", "logs");
mkdirSync(logs, { recursive: true });
writeFileSync(join(logs, "transcript.jsonl"), transcript);
const server = await startServer({
port: 0,
agyDir: home,
opencode: { origin: ORIGIN, listSessions: async () => [], getSession: async () => ({}), getMessages: async () => [] },
});
try {
const res = await fetch(`http://127.0.0.1:${server.address().port}/api/pipeline?conversationId=${CID}`);
expect(res.status).toBe(200);
const body = await res.json();
expect(body.title).toBe("");
expect(body.nodes).toHaveLength(2);
} finally {
server.close();
}
});
});

describe("HTTP routes", () => {
test("/api/conversations, /api/pipeline, /api/session-detail and / respond with the expected shape", async () => {
const home = mkdtempSync(join(tmpdir(), "pipe-"));
const logs = join(home, "brain", CID, ".system_generated", "logs");
mkdirSync(logs, { recursive: true });
writeFileSync(join(logs, "transcript.jsonl"), transcript);
const oc = { id: "ses_ok", title: "S1", agent: "coder", location: { directory: WT }, time: { created: T0 + 1000, updated: T0 + 2000 } };
const server = await startServer({
port: 0,
agyDir: home,
titleOf: async () => "AGY title",
opencode: {
origin: ORIGIN,
listSessions: async () => Array.of(oc),
getSession: async (id) => ({...oc, id }),
getMessages: async () => Array.of({ id: "msg_x", type: "assistant" }),
},
});
const base = `http://127.0.0.1:${server.address().port}`;
try {
const convs = await (await fetch(`${base}/api/conversations`)).json();
expect(convs).toHaveLength(1);
expect(convs.at(0)).toMatchObject({ conversationId: CID, title: "AGY title", dispatchCount: 2 });

const pipe = await (await fetch(`${base}/api/pipeline?conversationId=${CID}`)).json();
expect(pipe.title).toBe("AGY title");
expect(pipe.nodes.map((n) => n.stepIndex)).toEqual(Array.of(125, 160));
expect(pipe.nodes.at(0).session).toMatchObject({ id: "ses_ok", webUrl: buildOpenCodeSessionWebUrl(ORIGIN, "ses_ok") });

expect((await fetch(`${base}/api/pipeline?conversationId=bad`)).status).toBe(400);

const detail = await (await fetch(`${base}/api/session-detail?sessionId=ses_ok`)).json();
expect(detail.messages).toHaveLength(1);
expect(detail.webUrl).toBe(buildOpenCodeSessionWebUrl(ORIGIN, "ses_ok"));

const html = await (await fetch(`${base}/`)).text();
expect(html).toContain("OpenCode 流水线");
} finally {
server.close();
}
});
});

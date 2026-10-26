---
name: team-grilling
description: '[磨方案 / B2 需求澄清] Grill the user relentlessly about a plan, requirement, decision, or idea. Use when the user wants to stress-test their thinking, during B2: req-grill in /goal, or uses any ''grill'' trigger phrase in English or Chinese: grill, grill me, stress-test this, 开磨, 磨一轮, 磨一下, 拷打我, 追问我, 帮我想清楚.'
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

**Positive Question Phrasing (`#1193` Rule)**: Word every question positively so that replying **"yes" / "可以" / "按推荐的来"** unambiguously accepts your `➡️` recommended answer without double negatives or ambiguity. Never ask "Should we skip X? -> Recommended: No (do X)"; instead ask "Should we do X? -> Recommended: Yes, do X because ...".

While grilling, watch the words as well as the decisions. If the user's term
collides with one already settled in this conversation or in the team's rules,
name the collision on the spot — "you settled X to mean A; you're now using it
for B, which is it?" If a term is vague or overloaded, propose one precise
replacement rather than letting both readings ride. A design agreed in two
different vocabularies is not agreed.

The **first question of the first round is always necessity**: should this thing exist at all, is the current state already enough, what happens if it is never built. Do not treat this as a gate that blocks the rest — if it cannot be answered yet, say so, keep grilling the other branches, and revisit it once the tree is clearer. Skipping it entirely means you sharpen something that should not have been built.

Also include the **highest-level testing seam** on the frontier when grilling a feature or bug fix: where is the highest-level real boundary (CLI / HTTP endpoint / integration flow) that proves the change works without mocking the system under test?

Format a round like so. **Numbering starts at Q1, runs consecutively within the round with no gaps, and restarts at Q1 each round; every question carries exactly one recommended answer; questions are separated by `---`.**

```
❓ **Q1** - **<question title (worded positively so "yes / 可以" accepts the recommendation)>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer and 1-sentence rationale>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer and 1-sentence rationale>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, existing reusable helpers, etc.), dispatch `explore` or `reviewer` (Stage 1 requirement pre-review mode) to find it first; don't ask the user for anything you could look up in the codebase yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

**Goal Mode (`B2: req-grill`) Integration & Phase Boundaries**:
- When running inside an active OpenCode `/goal` session (`B2: req-grill`), after outputting the round of questions, call `update_goal_status({ status: "paused", wait_reason: "clarification", prompt_summary: "..." })` so the goal yields cleanly without triggering watchdog loops; when the user replies, the local `opencode-goal` plugin automatically resumes the goal to `active`.
- **Phase Boundary**: Grilling only clarifies requirements and decisions. Do not mutate business code or jump into implementation while frontier questions remain open; wait until the frontier is empty and the user confirms shared understanding (or replies "按推荐的来").

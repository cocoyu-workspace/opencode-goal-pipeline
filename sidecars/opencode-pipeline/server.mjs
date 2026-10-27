import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const DEFAULT_AGY_DIR = join(homedir(), '.gemini', 'antigravity');
const OPENCODE_BIN = existsSync('/opt/homebrew/bin/opencode') ? '/opt/homebrew/bin/opencode' : 'opencode';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID_RE = /^ses_[A-Za-z0-9]+$/;
const DISPATCH_HEAD_RE = /(?:^|&&|;)\s*(?:[A-Z0-9_]+=\S+\s+)*(?:\S+\/)?opencode\s+run\b/;
const WINDOW_BEFORE_MS = 10_000;
const WINDOW_AFTER_MS = 300_000;

// AGY 转录里外层引号包裹的值内部可能含未转义的原始换行，不是合法 JSON
const unwrap = (v) => {
  if (typeof v !== 'string' || !v.startsWith('"')) return v;
  try {
    return JSON.parse(v);
  } catch {
    return v.replace(/^"|"$/g, '').replace(/\\(["\\])/g, '$1');
  }
};

function dispatchesOfStep(step, conversationId) {
  const out = [];
  for (const call of step.tool_calls ?? []) {
    if (call.name !== 'run_command') continue;
    const commandLine = unwrap(call.args?.CommandLine);
    if (typeof commandLine !== 'string') continue;
    const head = commandLine.split('\n').at(0) ?? '';
    if (!DISPATCH_HEAD_RE.test(head) || /\s--help\b/.test(head)) continue;
    const cd = head.match(/^\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/);
    out.push({
      conversationId,
      stepIndex: step.step_index,
      createdAtMs: Date.parse(step.created_at),
      toolSummary: unwrap(call.args.toolSummary),
      commandLine,
      agent: head.match(/--agent\s+(\S+)/)?.at(1),
      model: head.match(/(?:^|\s)(?:-m|--model)\s+(\S+)/)?.at(1),
      cliSessionId: head.match(/(?:^|\s)(?:(?:-s|--session)\s+|--session=)(ses_[A-Za-z0-9_]+)/)?.at(1),
      workdir: cd?.at(1) ?? cd?.at(2) ?? cd?.at(3),
    });
  }
  return out;
}

export function parseTranscriptDispatches(jsonlText, conversationId) {
  const out = [];
  for (const line of jsonlText.split('\n')) {
    if (!line.includes('opencode run')) continue;
    // transcript.jsonl 在被 AGY 追加写入，末行可能是半截 JSON
    try {
      out.push(...dispatchesOfStep(JSON.parse(line), conversationId));
    } catch {}
  }
  return out;
}

export const buildOpenCodeSessionWebUrl = (origin, sessionId, authToken = '') =>
  `${origin}/server/${Buffer.from(origin).toString('base64url')}/session/${sessionId}${authToken ? `?auth_token=${encodeURIComponent(authToken)}` : ''}`;

// 服务端导出与 PAGE 内联共用同一份源码（toString 注入），函数必须自包含，不能引用模块作用域变量
export function renderMarkdown(text) {
  const inline = (s) => {
    const codes = [];
    return s
      .replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(((?:https?|file):\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  };
  const lines = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .split('\n');
  const FENCE = /^```(\w*)/;
  const HEAD = /^(#{1,4})\s+(.*)$/;
  const HR = /^\s*(-{3,}|\*{3,})\s*$/;
  const QUOTE = /^&gt;\s?(.*)$/;
  const UL = /^\s*[-*]\s+(.*)$/;
  const OL = /^\s*\d+\.\s+(.*)$/;
  const SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
  const isTable = (i) => lines[i].trim().startsWith('|') && (lines[i + 1] ?? '').includes('|') && SEP.test(lines[i + 1]);
  const special = (i) => [FENCE, HEAD, HR, QUOTE, UL, OL].some((re) => re.test(lines[i])) || isTable(i);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const fence = l.match(FENCE);
    if (fence) {
      const body = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) body.push(lines[i]);
      i++;
      out.push(`<pre><code${fence.at(1) ? ` class="lang-${fence.at(1)}"` : ''}>${body.join('\n')}</code></pre>`);
      continue;
    }
    if (isTable(i)) {
      const head = cells(l);
      const rows = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
      const tr = (r, t) => `<tr>${r.map((c) => `<${t}>${c}</${t}>`).join('')}</tr>`;
      out.push(`<table><thead>${tr(head, 'th')}</thead><tbody>${rows.map((r) => tr(r, 'td')).join('')}</tbody></table>`);
      continue;
    }
    const h = l.match(HEAD);
    if (h) {
      const [, hashes, title] = h;
      out.push(`<h${hashes.length}>${inline(title)}</h${hashes.length}>`);
      i++;
      continue;
    }
    if (HR.test(l)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (QUOTE.test(l)) {
      const q = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) q.push(inline(lines[i].match(QUOTE)[1]));
      out.push(`<blockquote>${q.join('<br>')}</blockquote>`);
      continue;
    }
    const list = UL.test(l) ? UL : OL.test(l) ? OL : null;
    if (list) {
      const items = [];
      for (; i < lines.length && list.test(lines[i]); i++) items.push(`<li>${inline(lines[i].match(list).at(1))}</li>`);
      const tag = list === UL ? 'ul' : 'ol';
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const p = [l];
    for (i++; i < lines.length && lines[i].trim() && !special(i); i++) p.push(lines[i]);
    out.push(`<p>${p.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

const formatModel = (m) => m && `${m.providerID}/${m.id}${m.variant && m.variant !== 'default' ? `#${m.variant}` : ''}`;

const statusOfOutcome = (outcome) => (!outcome ? 'running' : outcome === 'succeeded' ? 'succeeded' : 'failed');

const toSession = (s, origin, authToken) => ({
  id: s.id,
  title: s.title,
  agent: s.agent,
  model: formatModel(s.model),
  outcome: s.outcome,
  cost: s.cost,
  tokens: s.tokens,
  time: s.time,
  webUrl: buildOpenCodeSessionWebUrl(origin, s.id, authToken),
});

export function matchDispatchesWithSessions(dispatches, sessions, ledgerEntries, serverOrigin, authToken = '') {
  const keyOf = (cid, stepIndex) => `${cid}:${stepIndex}`;
  const nodes = new Map();
  for (const d of dispatches) {
    nodes.set(keyOf(d.conversationId, d.stepIndex), {
      conversationId: d.conversationId,
      stepIndex: d.stepIndex,
      toolSummary: d.toolSummary,
      agent: d.agent,
      model: d.model,
      cliSessionId: d.cliSessionId,
      workdir: d.workdir,
      startedAt: d.createdAtMs,
    });
  }
  for (const e of ledgerEntries) {
    let targetKey = keyOf(e.conversationId, e.stepIndex);
    if (!nodes.has(targetKey)) {
      const near = [...nodes.entries()].find(
        ([, n]) =>
          n.conversationId === e.conversationId &&
          !n.sessionId &&
          e.stepIndex >= n.stepIndex &&
          e.stepIndex <= n.stepIndex + 5 &&
          (!e.toolSummary || !n.toolSummary || n.toolSummary === e.toolSummary),
      );
      if (near) targetKey = near.at(0);
    }
    const base = nodes.get(targetKey) ?? {};
    nodes.set(targetKey, {
      conversationId: e.conversationId,
      stepIndex: base.stepIndex ?? e.stepIndex,
      ledgerStepIndex: e.stepIndex,
      toolSummary: e.toolSummary ?? base.toolSummary,
      agent: e.agent ?? base.agent,
      model: e.model ?? base.model,
      cliSessionId: base.cliSessionId,
      workdir: e.cwd ?? base.workdir,
      startedAt: e.startedAt ?? base.startedAt,
      completedAt: e.completedAt,
      status: e.status,
      sessionId: e.sessionId,
    });
  }
  const list = [...nodes.values()].sort((a, b) => a.stepIndex - b.stepIndex);

  const byId = new Map(sessions.map((s) => [s.id, s]));
  const bound = new Map();
  const claimed = new Set();
  const bind = (node, s, claim = true) => {
    bound.set(node, s);
    if (claim) claimed.add(s.id);
  };

  for (const n of list) {
    const s =
      byId.get(n.sessionId) ??
      sessions.find((x) => {
        if (claimed.has(x.id) || x.metadata?.agyConversationId !== n.conversationId) return false;
        const ms = Number(x.metadata.agyStepIndex);
        if (x.metadata.agyStepIndex === String(n.stepIndex) || x.metadata.agyStepIndex === String(n.ledgerStepIndex)) return true;
        return Number.isFinite(ms) && ms >= n.stepIndex && ms <= n.stepIndex + 5 && (!x.metadata.agyToolSummary || x.metadata.agyToolSummary === n.toolSummary);
      });
    if (s) bind(n, s);
  }
  list.forEach((n, i) => {
    if (bound.has(n) || n.cliSessionId) return;
    const from = n.startedAt - WINDOW_BEFORE_MS;
    const to = list[i + 1]?.startedAt ?? n.startedAt + WINDOW_AFTER_MS;
    const hit = sessions
      .filter(
        (s) =>
          !claimed.has(s.id) &&
          s.time.created >= from &&
          s.time.created <= to &&
          (!n.workdir || s.location?.directory === n.workdir) &&
          (!n.agent || s.agent === n.agent),
      )
      .sort((a, b) => a.time.created - b.time.created);
    if (hit.length) bind(n, hit.at(0));
  });
  for (const n of list) {
    if (!bound.has(n) && n.cliSessionId && byId.has(n.cliSessionId)) {
      bind(n, byId.get(n.cliSessionId), false);
    }
  }

  return list.map((n) => {
    const s = bound.get(n);
    return {
      ...n,
      status: n.status ?? (s ? statusOfOutcome(s.outcome) : 'unknown'),
      completedAt: n.completedAt ?? s?.time.idle,
      session: s ? toSession(s, serverOrigin, authToken) : null,
    };
  });
}

const readLedger = (agyDir) => {
  const p = join(agyDir, 'opencode-pipeline.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
};

const readTranscript = (agyDir, conversationId) => {
  const p = join(agyDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

// opencode api 的 --param 只替换路径参数，limit/cursor/order 等查询参数会被静默忽略，必须拼进 URL
const ocApi = async (path, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const args = ['api', 'GET', query ? `${path}?${query}` : path];
  const { stdout } = await run(OPENCODE_BIN, args, { cwd: tmpdir(), maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
};

// 服务端 limit 上限 200，超出返回 400；游标已编码 order，续页再传 order 也会 400，所以只有首页带 params；沿 cursor.next 翻页，按 id 去重，没有新数据即停，页数封顶防止游标不收敛
const ocPaged = async (path, params = {}) => {
  const seen = new Map();
  let cursor;
  for (let page = 0; page < 20; page++) {
    const res = await ocApi(path, cursor ? { limit: 200, cursor } : { ...params, limit: 200 });
    const before = seen.size;
    for (const item of res.data) seen.set(item.id, item);
    cursor = res.cursor?.next;
    if (seen.size === before || !cursor) break;
  }
  return [...seen.values()];
};

let authCache = { origin: '', token: '', expiresAt: 0 };

// token 格式 <expSec>.<hmac>，提前 5 分钟过期；任何失败都降级为空串，不影响轮询
const getAuthToken = async (origin) => {
  if (authCache.origin === origin && Date.now() < authCache.expiresAt) return authCache.token;
  try {
    const { stdout } = await run(OPENCODE_BIN, ['api', 'POST', '/api/pair'], { cwd: tmpdir(), timeout: 10_000 });
    const { code } = JSON.parse(stdout);
    const res = await fetch(`${origin}/auth/connect/${code}`, { headers: { Accept: 'application/json' } });
    const { token } = await res.json();
    const expSec = Number(token.split('.').at(0));
    const authToken = Buffer.from(`opencode:${token}`).toString('base64');
    authCache = { origin, token: authToken, expiresAt: Number.isFinite(expSec) ? expSec * 1000 - 300_000 : Date.now() + 3_600_000 };
    return authToken;
  } catch {
    return '';
  }
};

const defaultOpenCode = {
  getAuthToken,
  getOrigin: async () => (await ocApi('/api/info')).urls.at(0),
  listSessions: () => ocPaged('/api/session'),
  getSession: async (id) => {
    const r = await ocApi(`/api/session/${id}`);
    return r.data ?? r;
  },
  getMessages: (id) => ocPaged(`/api/session/${id}/message`, { order: 'asc' }),
};

const sqliteTitleOf = (agyDir) => async (conversationId) => {
  const sql = `SELECT title FROM conversation_summaries WHERE conversation_id='${conversationId}'`;
  // AGY 库为 WAL 模式，无 -shm 时只读打开会 CANTOPEN，此时退回 immutable 读主文件；标题仅作展示，仍失败则降级为空
  const db = join(agyDir, 'conversation_summaries.db');
  const query = (target, flags = []) => run('sqlite3', [...flags, target, sql]).then((r) => r.stdout.trim());
  return query(db, ['-readonly']).catch(() => query(`file:${db}?immutable=1`)).catch(() => '');
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

export async function startServer({
  port,
  host = '127.0.0.1',
  agyDir = DEFAULT_AGY_DIR,
  opencode = defaultOpenCode,
  titleOf = sqliteTitleOf(agyDir),
}) {
  const originOf = async () => opencode.origin ?? (await opencode.getOrigin());
  const authOf = async (origin) => opencode.authToken ?? (await opencode.getAuthToken?.(origin)) ?? '';

  const routes = {
    '/api/conversations': async () => {
      const ledger = readLedger(agyDir);
      const brain = join(agyDir, 'brain');
      const ids = new Set(
        [...ledger.map((e) => e.conversationId), ...(existsSync(brain) ? readdirSync(brain) : [])].filter((id) => UUID_RE.test(id)),
      );
      const rows = [];
      for (const id of ids) {
        const nodes = matchDispatchesWithSessions(
          parseTranscriptDispatches(readTranscript(agyDir, id), id),
          [],
          ledger.filter((e) => e.conversationId === id),
          '',
        );
        if (!nodes.length) continue;
        rows.push({
          conversationId: id,
          title: await titleOf(id),
          dispatchCount: nodes.length,
          lastUpdatedAt: Math.max(...nodes.map((n) => n.completedAt ?? n.startedAt ?? 0)),
        });
      }
      return rows.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
    },
    '/api/pipeline': async (q) => {
      const id = q.get('conversationId');
      if (!UUID_RE.test(id)) throw badRequest('conversationId required');
      const origin = await originOf();
      const nodes = matchDispatchesWithSessions(
        parseTranscriptDispatches(readTranscript(agyDir, id), id),
        await opencode.listSessions(),
        readLedger(agyDir).filter((e) => e.conversationId === id),
        origin,
        await authOf(origin),
      );
      return { conversationId: id, title: await titleOf(id), nodes };
    },
    '/api/session-detail': async (q) => {
      const id = q.get('sessionId');
      if (!SESSION_ID_RE.test(id)) throw badRequest('sessionId required');
      const [session, messages, origin] = await Promise.all([opencode.getSession(id), opencode.getMessages(id), originOf()]);
      return { session, messages, webUrl: buildOpenCodeSessionWebUrl(origin, id, await authOf(origin)) };
    },
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', PAGE);
    const route = routes[url.pathname];
    if (!route) return send(404, 'application/json', '{"error":"not found"}');
    try {
      send(200, 'application/json', JSON.stringify(await route(url.searchParams)));
    } catch (e) {
      send(e.status ?? 500, 'application/json', JSON.stringify({ error: e.message }));
    }
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  return server;
}

if (process.argv.at(1) && import.meta.url === pathToFileURL(process.argv.at(1)).href) {
  const port = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 18991);
  await startServer({ port });
  console.log(`opencode-pipeline listening on http://127.0.0.1:${port}`);
}

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenCode 流水线</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--fg:#1c1f24;--mut:#6b7280;--bd:#e5e7eb;--acc:#4f6bed;--ok:#16a34a;--run:#d97706;--bad:#dc2626}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--fg:#e6e8ec;--mut:#9aa3b2;--bd:#262b36;--acc:#7c93ff;--ok:#34d399;--run:#fbbf24;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--bd);position:sticky;top:0;background:var(--bg);z-index:2}
h1{font-size:15px;margin:0;flex:1;min-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
select,button{font:inherit;color:inherit;background:var(--card);border:1px solid var(--bd);border-radius:6px;padding:4px 10px;cursor:pointer}
button.on{border-color:var(--acc);color:var(--acc)}a{color:var(--acc)}
main{display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:12px;padding:12px 16px}
@media(max-width:860px){main{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer}
.card.sel{border-color:var(--acc)}
.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.badge{font-size:11px;padding:1px 8px;border-radius:99px;border:1px solid var(--bd);color:var(--mut)}
.succeeded{color:var(--ok);border-color:var(--ok)}.running{color:var(--run);border-color:var(--run)}.failed{color:var(--bad);border-color:var(--bad)}
.mut{color:var(--mut);font-size:12px}
#detail{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px;min-height:60vh}
pre{white-space:pre-wrap;word-break:break-word;margin:4px 0;font:12px/1.5 ui-monospace,Menlo,monospace}
details{border:1px solid var(--bd);border-radius:6px;padding:4px 8px;margin:6px 0}
iframe{width:100%;height:75vh;border:0;border-radius:6px;background:#fff;margin-top:8px}
.msg{margin:10px 0}.role{font-weight:600;color:var(--acc)}
.md{overflow-wrap:anywhere}.md>:first-child{margin-top:4px}.md>:last-child{margin-bottom:0}
.md h1,.md h2,.md h3,.md h4{margin:12px 0 6px;line-height:1.3}.md h1{font-size:18px}.md h2{font-size:16px}.md h3{font-size:15px}.md h4{font-size:14px}
.md p{margin:6px 0}.md ul,.md ol{margin:6px 0;padding-left:22px}
.md pre{background:var(--bg);border:1px solid var(--bd);border-radius:6px;padding:8px 10px;overflow-x:auto;white-space:pre}
.md code{font:12px/1.5 ui-monospace,Menlo,monospace;background:var(--bg);border-radius:4px;padding:1px 4px}.md pre code{background:none;padding:0}
.md table{border-collapse:collapse;margin:8px 0;display:block;overflow-x:auto}.md th,.md td{border:1px solid var(--bd);padding:4px 10px;text-align:left}.md th{background:var(--bg)}
.md blockquote{margin:8px 0;padding:2px 12px;border-left:3px solid var(--bd);color:var(--mut)}.md hr{border:0;border-top:1px solid var(--bd);margin:12px 0}
@media(max-width:860px){#list{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.card{min-width:210px;max-width:250px;flex:0 0 auto;margin-bottom:0}}
</style></head><body>
<header><h1 id="title">OpenCode 流水线</h1><div id="steps" class="row"></div><select id="conv"></select></header>
<main><section id="list"></section><section id="detail"></section></main>
<script>
const $=s=>document.querySelector(s);
const P=new URLSearchParams(location.search);
let cid=P.get('conversationId'),sel=P.get('session'),view=P.get('view')||'web',nodes=[],lastKey='';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
${renderMarkdown.toString()}
const md=t=>'<div class="md">'+renderMarkdown(t)+'</div>';
const j=u=>fetch(u).then(r=>r.json());
const dur=n=>{const s=n.startedAt&&((n.completedAt||Date.now())-n.startedAt);return s>0?Math.round(s/1000)+'s':'-'};
const ST={succeeded:'已完成',running:'运行中',failed:'失败'};
const part=c=>{
  if(!c)return '';
  if(c.type==='text')return md(c.text);
  if(c.type==='tool'){const st=c.state||{};return '<details><summary><b>'+esc(c.name)+'</b> · <span class="'+esc(st.status||'')+'">'+esc(st.status||'done')+'</span></summary><pre>'+esc(JSON.stringify(st.input,null,2))+'</pre>'+((st.content||c.content)||[]).map(part).join('')+'</details>'}
  return '<details><summary>'+esc(c.type||'item')+'</summary><pre>'+esc(c.text||JSON.stringify(c,null,2))+'</pre></details>';
};
const fmtM=m=>m&&m.providerID?m.providerID+'/'+m.id+(m.variant&&m.variant!=='default'?'#'+m.variant:''):'';
const renderMsg=m=>{
  if(m.type==='user')return '<div class="msg"><div class="row"><span class="role">派单指令 (User)</span></div>'+md(m.text||'')+'</div>';
  if(m.type==='assistant')return '<div class="msg"><div class="row"><span class="role">子代理回复 (Assistant)</span>'+(m.agent?'<span class="badge">'+esc(m.agent)+'</span>':'')+(fmtM(m.model)?'<span class="badge">'+esc(fmtM(m.model))+'</span>':'')+'</div>'+(Array.isArray(m.content)?m.content.map(part).join(''):md(m.text||''))+'</div>';
  if(m.type==='model-switched')return '<div class="mut">↻ 模型切换 → '+esc(fmtM(m.model))+'</div>';
  if(m.type==='agent-switched')return '<div class="mut">⚙ 子代理 → '+esc(m.agent||'')+'</div>';
  if(m.type==='idle')return '<div class="mut">✓ 回合结束 ('+esc(m.outcome||'idle')+')</div>';
  if(m.type==='system')return '<details><summary class="mut">系统提示 · '+esc(m.description||'system')+'</summary><pre>'+esc(m.text||'')+'</pre></details>';
  return '<details><summary class="mut">'+esc(m.type)+'</summary><pre>'+esc(JSON.stringify(m,null,2))+'</pre></details>';
};
async function loadConvs(){
  const cs=await j('/api/conversations');
  if(!cid&&cs.length)cid=cs[0].conversationId;
  $('#conv').innerHTML=cs.map(c=>'<option value="'+c.conversationId+'"'+(c.conversationId===cid?' selected':'')+'>'+esc(c.title||c.conversationId)+' ('+c.dispatchCount+')</option>').join('');
}
function renderList(){
  $('#steps').innerHTML=nodes.map((n,i)=>'<button data-s="'+(n.session?n.session.id:'')+'" class="'+(n.session&&n.session.id===sel?'on':'')+'">Step '+(i+1)+'</button>').join('');
  $('#list').innerHTML=nodes.map((n,i)=>{const s=n.session,sub=s?[s.title,s.id].filter(Boolean).join(' · '):'未匹配到 OpenCode 会话';return '<div class="card'+(s&&s.id===sel?' sel':'')+'" data-s="'+(s?s.id:'')+'"><div class="row"><b>#'+(i+1)+'</b><span class="badge">'+esc(n.agent||(s&&s.agent)||'-')+'</span><span class="badge">'+esc((s&&s.model)||n.model||'-')+'</span><span class="badge '+n.status+'">'+(ST[n.status]||'未知')+'</span><span class="mut">'+dur(n)+'</span></div><div>'+esc(n.toolSummary)+'</div><div class="mut">'+esc(sub)+'</div></div>'}).join('');
}
async function renderDetail(){
  const d=$('#detail');
  const s=nodes.map(n=>n.session).find(x=>x&&x.id===sel);
  if(!s){d.innerHTML='<span class="mut">点击左侧节点查看详情</span>';return}
  const tabs='<div class="row"><button data-v="web" class="'+(view==='web'?'on':'')+'">OpenCode 原生界面</button><button data-v="msgs" class="'+(view==='msgs'?'on':'')+'">消息与工具流</button><a href="'+esc(s.webUrl)+'" target="_blank" rel="noopener">新标签页打开</a></div>';
  if(view==='web'){
    const key=sel+'|web';if(key===lastKey)return;lastKey=key;
    d.innerHTML=tabs+'<iframe src="'+esc(s.webUrl)+'"></iframe>';return;
  }
  const det=await j('/api/session-detail?sessionId='+sel);
  const key=sel+'|msgs|'+JSON.stringify(det.messages);if(key===lastKey)return;lastKey=key;
  d.innerHTML=tabs+det.messages.map(renderMsg).join('');
}
async function refresh(){
  if(!cid)return;
  const p=await j('/api/pipeline?conversationId='+cid);
  nodes=p.nodes;$('#title').textContent=p.title||cid;
  if(!nodes.some(n=>n.session&&n.session.id===sel)){const f=nodes.find(n=>n.status==='running'&&n.session)||nodes.find(n=>n.status==='succeeded'&&n.session)||nodes.find(n=>n.session);sel=f?f.session.id:null}
  renderList();await renderDetail();
}
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-v]');if(v){view=v.dataset.v;lastKey='';renderDetail();return}
  const s=e.target.closest('[data-s]');
  if(s&&s.dataset.s){sel=s.dataset.s;lastKey='';history.replaceState(null,'','?conversationId='+cid+'&session='+sel);renderList();renderDetail()}
});
$('#conv').onchange=e=>{cid=e.target.value;sel=null;lastKey='';refresh()};
loadConvs().then(refresh);setInterval(refresh,3000);
</script></body></html>`;

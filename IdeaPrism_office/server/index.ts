// IDEAPRISM Office 서버 (로컬 전용, 127.0.0.1)
// 실행: npm run office -- --pc 회사
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { ConfigStore, type ConfigName } from "./config.js";
import { SessionStore, appendLog } from "./local.js";
import { LeaderRunner, type OfficeEvent } from "./leaderRunner.js";
import { gitPull, gitStatus } from "./gitApi.js";

const HOST = "127.0.0.1";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const pc = arg("pc") ?? "회사";
  const store = new ConfigStore(pc);
  await store.load();
  const checks = await store.validate();
  console.log(`\nIDEAPRISM Office · ${pc} PC · root=${store.config.root}`);
  console.table(checks.map((c) => ({ 파일: c.file, 항목: c.key, 경로: c.path, 존재: c.exists ? "O" : c.required ? "X (필수)" : "- (선택)" })));
  const missing = checks.filter((c) => c.required && !c.exists);
  if (missing.length) console.warn(`경고: 필수 경로 ${missing.length}개가 없습니다. 관리자 페이지(경로 탭)에서 고치세요.`);

  const sessions = new SessionStore(pc);
  await sessions.load();

  const wss = new WebSocketServer({ noServer: true });
  const broadcast = (e: OfficeEvent): void => {
    printEvent(store, e);
    const data = JSON.stringify(e);
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
  };

  const runners = new Map<string, LeaderRunner>();
  /** 팀장 목록 동기화: 새 id는 추가, 사라진 id는 제거(실행 중이면 끝날 때까지 둔다). 기존 러너는 유지. */
  const syncRunners = (): void => {
    const ids = new Set(store.teams.leaders.map((l) => l.id));
    for (const id of ids) if (!runners.has(id)) runners.set(id, new LeaderRunner(id, store, sessions, broadcast));
    for (const [id, r] of runners) if (!ids.has(id) && r.status !== "running") runners.delete(id);
  };
  syncRunners();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${HOST}`);
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    try {
      const m = (re: RegExp): RegExpExecArray | null => re.exec(url.pathname);
      let g: RegExpExecArray | null;

      if (req.method === "GET" && url.pathname === "/api/health") {
        return send(200, {
          pc,
          root: store.config.root,
          deadline: store.config.deadline,
          leaders: [...runners.values()].map(snapshot),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/leaders") {
        return send(200, [...runners.values()].map(snapshot));
      }
      if (req.method === "POST" && (g = m(/^\/api\/leaders\/([\w-]+)\/instruct$/))) {
        const r = runners.get(g[1]);
        if (!r) return send(404, { error: `팀장 없음: ${g[1]}` });
        const body = (await readJson(req)) as { text?: string };
        const text = (body.text ?? "").trim();
        if (!text) return send(400, { error: "text 가 비어 있습니다" });
        const job = r.instruct(text);
        return send(202, { jobId: job.id, queued: r.queued, status: r.status });
      }
      if (req.method === "POST" && (g = m(/^\/api\/leaders\/([\w-]+)\/interrupt$/))) {
        const r = runners.get(g[1]);
        if (!r) return send(404, { error: `팀장 없음: ${g[1]}` });
        return send(200, { interrupted: await r.interrupt() });
      }
      if (req.method === "POST" && (g = m(/^\/api\/leaders\/([\w-]+)\/reset-session$/))) {
        const r = runners.get(g[1]);
        if (!r) return send(404, { error: `팀장 없음: ${g[1]}` });
        await r.resetSession();
        return send(200, { ok: true });
      }
      if ((g = m(/^\/api\/config\/(config|teams|permissions)$/))) {
        const name = g[1] as ConfigName;
        if (req.method === "GET") return send(200, { file: store.filePath(name), data: store.get(name), checks: await store.validate() });
        if (req.method === "PUT") {
          const running = [...runners.values()].filter((r) => r.status === "running").map((r) => r.def.name);
          let checks;
          try {
            checks = await store.save(name, await readJson(req));
          } catch (e) {
            return send(400, { error: (e as Error).message });
          }
          if (name === "teams") syncRunners();
          await appendLog({ type: "config_saved", name });
          return send(200, {
            ok: true,
            checks,
            note: running.length ? `실행 중인 팀장(${running.join(", ")})은 다음 지시부터 반영됩니다.` : "다음 실행부터 반영됩니다.",
          });
        }
      }
      if (req.method === "GET" && url.pathname === "/api/git/status") return send(200, await gitStatus(store.config.root));
      if (req.method === "POST" && url.pathname === "/api/git/pull") {
        const r = await gitPull(store.config.root);
        await appendLog({ type: "git_pull", ok: r.ok });
        return send(r.ok ? 200 : 409, { ...r, status: await gitStatus(store.config.root) });
      }
      return send(404, { error: "없는 경로" });
    } catch (e) {
      return send(500, { error: (e as Error).message });
    }
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
      ws.send(JSON.stringify({ kind: "hello", pc, leaders: [...runners.values()].map(snapshot) }));
    });
  });

  server.listen(store.config.port, HOST, () => {
    console.log(`서버 시작: http://${HOST}:${store.config.port}  (외부 IP 바인딩 없음)\n`);
  });
}

function snapshot(r: LeaderRunner) {
  return {
    id: r.id,
    name: r.def.name,
    team: r.def.team,
    teamLabel: r.def.teamLabel,
    color: r.def.color,
    status: r.status,
    cwd: r.cwd,
    sessionId: r.sessionId ?? null,
    currentJobId: r.currentJob?.id ?? null,
    queued: r.queued,
    lastTool: r.lastTool ?? null,
    lastToolAt: r.lastToolAt ?? null,
  };
}

function printEvent(store: ConfigStore, e: OfficeEvent): void {
  const name = store.leader(e.leaderId)?.name ?? e.leaderId;
  const t = new Date(e.at).toLocaleTimeString("ko-KR", { hour12: false });
  switch (e.kind) {
    case "text":
      return console.log(`${t} [${name}] ${String(e.text).replace(/\s+/g, " ").slice(0, 160)}`);
    case "tool_use":
      return console.log(`${t} [${name}] 도구 ${e.tool} ${String(e.target).slice(0, 100)}`);
    case "result":
      return console.log(`${t} [${name}] 완료 ok=${e.ok} turns=${e.turns} cost=$${Number(e.costUsd).toFixed(3)} session=${e.sessionId}`);
    case "approval_needed":
      return console.log(`${t} [${name}] 결재 필요(M1: 자동 반려) ${e.tool} ${e.target}`);
    case "tool_result":
      return;
    default:
      return console.log(`${t} [${name}] ${e.kind} ${JSON.stringify({ ...e, leaderId: undefined, at: undefined, kind: undefined }).slice(0, 160)}`);
  }
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("본문이 JSON 이 아닙니다"));
      }
    });
    req.on("error", reject);
  });
}

main().catch((e) => {
  console.error("서버 시작 실패:", (e as Error).message);
  process.exit(1);
});

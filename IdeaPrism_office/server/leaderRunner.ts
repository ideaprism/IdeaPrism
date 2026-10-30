// LeaderRunner: 팀장 1명 = Agent SDK 세션 1개. 같은 팀장은 한 번에 1개 작업(나머지는 대기열).
// 설계 D4: leader.md 본문을 메인 세션 systemPrompt에 붙여 메인 세션 자체가 팀장이 되게 한다.
// EventMapper(PRD 7.2): SDK 메시지 → status/location 을 여기서 함께 계산해 'state' 이벤트로 방송한다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { query, type Options, type PermissionResult, type Query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ConfigStore, LeaderDef } from "./config.js";
import { SessionStore, TranscriptStore, appendLog, type TranscriptEntry } from "./local.js";
import type { ApprovalQueue } from "./approvals.js";
import type { TaskBoard } from "./tasks.js";

export type Status = "idle" | "thinking" | "research" | "typing" | "running" | "approval" | "done" | "error" | "meeting";
export type Location = "desk" | "library" | "approvalTable" | "lounge" | "meeting";

/** PRD 9.1 + 화면에 필요한 표시 정보 */
export interface LeaderState {
  id: string;
  name: string;
  role: string;
  team: string;
  teamLabel: string;
  color: string;
  character: string;
  status: Status;
  location: Location;
  bubble: string;
  currentJobId: string | null;
  currentJobTitle: string | null;
  queued: number;
  lastTool: string | null;
  lastToolAt: string | null;
  sessionId: string | null;
  statusSince: string;
}

export interface OfficeEvent {
  leaderId: string;
  at: string;
  kind: string;
  [k: string]: unknown;
}

interface Job {
  id: string;
  text: string;
  taskId: string;
}

const BUBBLES: Record<Status, string> = {
  idle: "잠시 쉬는 중",
  thinking: "생각 중…",
  research: "자료 조사 중",
  typing: "작성 중",
  running: "실행 중",
  approval: "결재 기다리는 중",
  done: "완료!",
  error: "문제가 생겼습니다",
  meeting: "회의 중",
};

/** 닫을 때까지 열려 있는 입력 스트림 (interrupt()는 스트리밍 입력 모드에서만 동작) */
class Pushable<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: ((r: IteratorResult<T>) => void)[] = [];
  private closed = false;
  push(v: T): void {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }
  close(): void {
    this.closed = true;
    for (const w of this.waiters.splice(0)) w({ value: undefined as never, done: true });
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift() as T, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((r) => this.waiters.push(r));
      },
    };
  }
}

interface AgentFile {
  body: string;
  tools: string[];
  model?: string;
}

async function readAgentFile(file: string): Promise<AgentFile> {
  const raw = await readFile(file, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) return { body: raw, tools: [] };
  const front = m[1];
  const tools = (/^tools:\s*(.+)$/m.exec(front)?.[1] ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const model = /^model:\s*(.+)$/m.exec(front)?.[1]?.trim();
  return { body: m[2].trim(), tools, model };
}

export class LeaderRunner {
  status: Status = "idle";
  location: Location = "lounge";
  statusSince = new Date().toISOString();
  currentJob?: Job;
  lastTool?: string;
  lastToolAt?: string;
  private jobs: Job[] = [];
  private active?: Query;
  private seq = 0;
  private doneTimer?: NodeJS.Timeout;
  private libraryTimer?: NodeJS.Timeout;
  private pendingWrites = new Map<string, string>();

  constructor(
    public readonly id: string,
    private readonly store: ConfigStore,
    private readonly sessions: SessionStore,
    private readonly transcripts: TranscriptStore,
    private readonly approvals: ApprovalQueue,
    private readonly board: TaskBoard,
    private readonly emit: (e: OfficeEvent) => void,
  ) {}

  /** 항상 현재 저장된 정의를 읽는다 → 관리자 페이지에서 바꾼 매칭이 다음 실행에 바로 반영된다. */
  get def(): LeaderDef {
    const d = this.store.leader(this.id);
    if (!d) throw new Error(`팀장 정의 없음: ${this.id}`);
    return d;
  }
  get cwd(): string {
    return this.store.resolve(this.def.folder);
  }
  get sessionId(): string | undefined {
    return this.sessions.get(this.id);
  }
  get queued(): number {
    return this.jobs.length;
  }

  state(): LeaderState {
    const d = this.def;
    // 결과를 받은 뒤 프로세스가 정리되는 1~2초 동안은 "진행 중"으로 보이지 않게 한다.
    const job = this.currentJob && !["done", "error", "idle"].includes(this.status) ? this.currentJob : undefined;
    return {
      id: this.id,
      name: d.name,
      role: d.role,
      team: d.team,
      teamLabel: d.teamLabel,
      color: d.color,
      character: d.character,
      status: this.status,
      location: this.location,
      bubble: BUBBLES[this.status],
      currentJobId: job?.id ?? null,
      currentJobTitle: job ? titleOf(job.text) : null,
      queued: this.jobs.length,
      lastTool: this.lastTool ?? null,
      lastToolAt: this.lastToolAt ?? null,
      sessionId: this.sessionId ?? null,
      statusSince: this.statusSince,
    };
  }

  transcript(): Promise<TranscriptEntry[]> {
    return this.transcripts.load(this.id);
  }

  /** 지시 접수. 실행 중이면 대기열에 넣는다. 업무 보드에 task(todo)를 만든다. */
  instruct(text: string, source: "chat" | "handoff" | "meeting" = "chat"): Job {
    const task = this.board.create({ title: titleOf(text), team: this.def.team, leaderId: this.id, source });
    const job: Job = { id: `${this.id}_${Date.now()}_${++this.seq}`, text, taskId: task.id };
    this.jobs.push(job);
    void appendLog({ type: "instruct", leaderId: this.id, jobId: job.id, taskId: task.id, text });
    void this.say({ role: "user", text, jobId: job.id });
    this.event("queued", { jobId: job.id, position: this.jobs.length });
    this.broadcastState();
    void this.pump();
    return job;
  }

  async interrupt(): Promise<boolean> {
    if (!this.active) return false;
    this.approvals.cancelFor(this.id);
    await this.active.interrupt();
    this.event("interrupted", { jobId: this.currentJob?.id });
    void this.say({ role: "system", text: "대표가 중단함", jobId: this.currentJob?.id });
    return true;
  }

  /** 세션을 버리고 다음 지시부터 새로 시작 */
  async resetSession(): Promise<void> {
    await this.sessions.clear(this.id);
    void this.say({ role: "system", text: "세션을 새로 시작합니다" });
    this.event("session_reset", {});
    this.broadcastState();
  }

  private async pump(): Promise<void> {
    if (this.currentJob) return;
    const job = this.jobs.shift();
    if (!job) return;
    await this.run(job);
    void this.pump();
  }

  private async run(job: Job): Promise<void> {
    this.currentJob = job;
    this.clearTimers();
    this.board.update(job.taskId, { status: "doing" });
    this.setStatus("thinking", "desk");
    this.event("start", { jobId: job.id, taskId: job.taskId, text: job.text, cwd: this.cwd, resume: this.sessionId ?? null });
    const input = new Pushable<SDKUserMessage>();
    input.push({ type: "user", message: { role: "user", content: job.text }, parent_tool_use_id: null });
    try {
      const agent = await readAgentFile(this.store.resolve(this.def.agentFile));
      const options: Options = {
        cwd: this.cwd,
        additionalDirectories: this.store.extraDirsOf(this.def),
        model: this.def.model || agent.model,
        systemPrompt: { type: "preset", preset: "claude_code", append: agent.body },
        tools: agent.tools.length ? agent.tools : undefined,
        permissionMode: "default",
        canUseTool: (tool, toolInput) => this.canUseTool(tool, toolInput),
        resume: this.sessionId,
        maxTurns: 60,
        // settingSources 생략 = CLI 기본(user·project·local). 팀 CLAUDE.md 는 'project' 로 읽힌다.
      };
      // query() 가 Claude 프로세스를 띄우는 동안 이벤트 루프가 잠깐 막히므로, 그 전에 상태 방송·HTTP 응답을 먼저 내보낸다.
      await new Promise((r) => setImmediate(r));
      const q = query({ prompt: input, options });
      this.active = q;
      for await (const msg of q) {
        await this.handle(msg, job);
        if (msg.type === "result") input.close();
      }
      if (this.status !== "done" && this.status !== "error") this.setStatus("done", "desk");
      if (this.status === "done") this.board.update(job.taskId, { status: "done" });
      else this.board.update(job.taskId, { status: "blocked" });
    } catch (e) {
      const err = e as Error;
      this.approvals.cancelFor(this.id);
      this.board.update(job.taskId, { status: "blocked" });
      this.setStatus("error", "desk");
      this.event("error", { jobId: job.id, message: err.message });
      void this.say({ role: "system", text: `오류: ${err.message}`, jobId: job.id });
      void appendLog({ type: "error", leaderId: this.id, jobId: job.id, message: err.message });
      // 재개 실패(세션 유실 등)면 세션을 비워 다음 지시는 새로 시작하게 한다.
      if (/resume|session/i.test(err.message)) await this.sessions.clear(this.id);
    } finally {
      input.close();
      this.active = undefined;
      this.currentJob = undefined;
      this.broadcastState();
      this.scheduleIdle();
    }
  }

  private async handle(msg: SDKMessage, job: Job): Promise<void> {
    switch (msg.type) {
      case "system": {
        if (msg.subtype === "init") {
          await this.sessions.set(this.id, msg.session_id);
          this.event("init", { jobId: job.id, sessionId: msg.session_id, model: msg.model, tools: msg.tools.length });
          this.broadcastState();
        }
        return;
      }
      case "assistant": {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            this.setStatus("thinking", this.location === "library" ? "library" : "desk");
            this.event("text", { jobId: job.id, text: block.text });
            void this.say({ role: "leader", text: block.text, jobId: job.id });
          } else if (block.type === "tool_use") {
            const inp = block.input as Record<string, unknown>;
            const target = String(inp.file_path ?? inp.path ?? inp.pattern ?? inp.command ?? inp.query ?? inp.url ?? "");
            this.lastTool = block.name;
            this.lastToolAt = new Date().toISOString();
            this.mapTool(block.name, target);
            if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(block.name) && target) {
              // 결과가 성공으로 돌아온 뒤에만 산출물로 기록한다 (반려·실패는 제외)
              this.pendingWrites.set(block.id, path.relative(this.store.resolve("."), path.resolve(this.cwd, target)).replace(/\\/g, "/"));
            }
            this.event("tool_use", { jobId: job.id, tool: block.name, target, toolUseId: block.id });
            void this.say({ role: "tool", tool: block.name, target, jobId: job.id });
            void appendLog({ type: "tool_use", leaderId: this.id, jobId: job.id, tool: block.name, target });
          }
        }
        return;
      }
      case "user": {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result") {
              this.event("tool_result", { jobId: job.id, toolUseId: block.tool_use_id, isError: block.is_error ?? false });
              const out = this.pendingWrites.get(block.tool_use_id);
              if (out !== undefined) {
                this.pendingWrites.delete(block.tool_use_id);
                if (!block.is_error) this.board.addOutput(job.taskId, out);
              }
            }
          }
        }
        return;
      }
      case "result": {
        const ok = msg.subtype === "success";
        await this.sessions.set(this.id, msg.session_id);
        const text = ok ? msg.result : ((msg as { errors?: string[] }).errors?.join("\n") ?? msg.subtype);
        this.setStatus(msg.is_error ? "error" : "done", "desk");
        this.event("result", {
          jobId: job.id,
          ok,
          subtype: msg.subtype,
          isError: msg.is_error,
          text,
          costUsd: msg.total_cost_usd,
          turns: msg.num_turns,
          durationMs: msg.duration_ms,
          sessionId: msg.session_id,
        });
        void this.say({ role: "result", text: ok ? "완료" : `실패: ${text}`, ok, jobId: job.id });
        // costUsd 는 SDK 추정치(세션 누적일 수 있음). usage 로 실제 토큰 규모를 남긴다.
        void appendLog({ type: "result", leaderId: this.id, jobId: job.id, ok, costUsd: msg.total_cost_usd, turns: msg.num_turns, usage: msg.usage, durationMs: msg.duration_ms });
        return;
      }
      default:
        return;
    }
  }

  /** PRD 7.2: 도구 → 상태·위치 */
  private mapTool(tool: string, target: string): void {
    if (["Read", "Glob", "Grep"].includes(tool)) {
      const wikiRoot = this.store.resolve(this.store.config.wikiKnowledge);
      const rawRoot = this.store.resolve(this.store.config.wikiRaw);
      const abs = target ? path.resolve(this.cwd, target) : "";
      const isWiki = abs !== "" && (isUnder(abs, wikiRoot) || isUnder(abs, rawRoot) || /(^|[\\/])wiki([\\/]|$)/.test(target));
      if (isWiki) {
        this.setStatus("research", "library");
        clearTimeout(this.libraryTimer);
        this.libraryTimer = setTimeout(() => {
          if (this.location === "library") {
            this.location = "desk";
            this.broadcastState();
          }
        }, this.store.config.libraryVisitSeconds * 1000);
      } else {
        this.setStatus("research", this.location === "library" ? "library" : "desk");
      }
    } else if (["WebSearch", "WebFetch"].includes(tool)) this.setStatus("research", "desk");
    else if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) this.setStatus("typing", "desk");
    else if (tool === "Bash") this.setStatus("running", "desk");
  }

  /** done → 10초 뒤 idle(탕비실). 그 사이 새 지시가 오면 취소. */
  private scheduleIdle(): void {
    clearTimeout(this.doneTimer);
    if (this.jobs.length) return;
    this.doneTimer = setTimeout(() => {
      if (!this.currentJob && (this.status === "done" || this.status === "error")) this.setStatus("idle", "lounge");
    }, 10_000);
  }

  private clearTimers(): void {
    clearTimeout(this.doneTimer);
    clearTimeout(this.libraryTimer);
  }

  private setStatus(status: Status, location: Location): void {
    if (this.status === status && this.location === location) return;
    if (this.status !== status) this.statusSince = new Date().toISOString();
    this.status = status;
    this.location = location;
    this.broadcastState();
  }

  private broadcastState(): void {
    this.emit({ leaderId: this.id, at: new Date().toISOString(), kind: "state", state: this.state() });
  }

  private async say(e: Omit<TranscriptEntry, "id" | "at" | "leaderId">): Promise<void> {
    const entry: TranscriptEntry = { id: `${Date.now()}_${++this.seq}`, at: new Date().toISOString(), leaderId: this.id, ...e };
    await this.transcripts.append(entry);
    this.emit({ leaderId: this.id, at: entry.at, kind: "transcript", entry });
  }

  /**
   * PRD 10.2 권한 기본값 + 결재 (PRD 10.2 흐름):
   * 자동 허용이 아니면 ApprovalQueue 에 넣고, 팀장은 결재 테이블로 이동해 대표의 승인/반려를 기다린다.
   */
  private async canUseTool(tool: string, input: Record<string, unknown>): Promise<PermissionResult> {
    const p = this.store.permissions;
    const allow = (): PermissionResult => ({ behavior: "allow", updatedInput: input });
    const needApproval = async (reason: string): Promise<PermissionResult> => {
      const jobId = this.currentJob?.id;
      const target = targetOf(input);
      const prev = { status: this.status, location: this.location };
      this.setStatus("approval", "approvalTable");
      const requested = this.approvals.request({ leaderId: this.id, jobId, tool, target, reason });
      const pendingId = requested.approval.id;
      void this.say({ role: "approval", approvalId: pendingId, tool, target, text: reason, jobId });
      void appendLog({ type: "approval_requested", leaderId: this.id, jobId, approvalId: pendingId, tool, target, reason });
      const decision = await requested.decision;
      void appendLog({ type: "approval_decided", leaderId: this.id, jobId, approvalId: pendingId, decision });
      void this.say({ role: "approval_result", approvalId: pendingId, ok: decision === "approve", text: decision === "approve" ? "승인" : "반려", jobId });
      this.setStatus(prev.status === "approval" ? "thinking" : prev.status, "desk");
      if (decision === "approve") return allow();
      return { behavior: "deny", message: "대표가 반려함. 대안으로 진행하거나 보고로 마무리하라." };
    };

    if (p.autoAllowTools.includes(tool)) return allow();

    if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
      const file = path.resolve(String(input.file_path ?? input.notebook_path ?? ""));
      const allowed = p.autoAllowWritePaths.map((d) => this.store.resolve(d.replace("$team", this.def.folder)));
      if (allowed.some((d) => isUnder(file, d))) return allow();
      const root = this.store.resolve(".");
      const rel = path.relative(root, file).replace(/\\/g, "/");
      return needApproval(`쓰기 대상 ${rel || file}`);
    }

    if (tool === "Bash") {
      const cmd = String(input.command ?? "").trim();
      if (p.bashAlwaysApprove.some((s) => cmd.includes(s))) return needApproval(`항상 결재 명령: ${cmd}`);
      if (p.bashAutoAllow.some((s) => cmd === s || cmd.startsWith(s + " "))) return allow();
      return needApproval(`Bash: ${cmd}`);
    }

    return needApproval(`도구 ${tool}`);
  }

  private event(kind: string, data: Record<string, unknown>): void {
    this.emit({ leaderId: this.id, at: new Date().toISOString(), kind, ...data });
  }
}

/** 업무 제목 = 지시 첫 줄 40자 (PRD 9.2) */
export function titleOf(text: string): string {
  return text.split(/\r?\n/)[0].trim().slice(0, 40);
}

function targetOf(input: Record<string, unknown>): string {
  return String(input.file_path ?? input.command ?? input.path ?? "");
}

function isUnder(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

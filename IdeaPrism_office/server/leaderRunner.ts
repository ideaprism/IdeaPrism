// LeaderRunner: 팀장 1명 = Agent SDK 세션 1개. 같은 팀장은 한 번에 1개 작업(나머지는 대기열).
// 설계 D4: leader.md 본문을 메인 세션 systemPrompt에 붙여 메인 세션 자체가 팀장이 되게 한다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { query, type Options, type PermissionResult, type Query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ConfigStore, LeaderDef } from "./config.js";
import { SessionStore, appendLog } from "./local.js";

export type LeaderStatus = "idle" | "running" | "error";

export interface OfficeEvent {
  leaderId: string;
  at: string;
  kind: string;
  [k: string]: unknown;
}

interface Job {
  id: string;
  text: string;
}

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
  status: LeaderStatus = "idle";
  currentJob?: Job;
  lastTool?: string;
  lastToolAt?: string;
  private jobs: Job[] = [];
  private active?: Query;
  private input?: Pushable<SDKUserMessage>;
  private seq = 0;

  constructor(
    public readonly id: string,
    private readonly store: ConfigStore,
    private readonly sessions: SessionStore,
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

  /** 지시 접수. 실행 중이면 대기열에 넣는다. */
  instruct(text: string): Job {
    const job = { id: `${this.id}_${Date.now()}_${++this.seq}`, text };
    this.jobs.push(job);
    void appendLog({ type: "instruct", leaderId: this.id, jobId: job.id, text });
    this.event("queued", { jobId: job.id, position: this.jobs.length });
    void this.pump();
    return job;
  }

  async interrupt(): Promise<boolean> {
    if (!this.active) return false;
    await this.active.interrupt();
    this.event("interrupted", { jobId: this.currentJob?.id });
    return true;
  }

  /** 세션을 버리고 다음 지시부터 새로 시작 */
  async resetSession(): Promise<void> {
    await this.sessions.clear(this.id);
    this.event("session_reset", {});
  }

  private async pump(): Promise<void> {
    if (this.status === "running") return;
    const job = this.jobs.shift();
    if (!job) return;
    await this.run(job);
    void this.pump();
  }

  private async run(job: Job): Promise<void> {
    this.status = "running";
    this.currentJob = job;
    this.event("start", { jobId: job.id, text: job.text, cwd: this.cwd, resume: this.sessionId ?? null });
    const input = new Pushable<SDKUserMessage>();
    this.input = input;
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
      const q = query({ prompt: input, options });
      this.active = q;
      for await (const msg of q) {
        await this.handle(msg, job);
        if (msg.type === "result") input.close();
      }
      if (this.status === "running") this.status = "idle";
    } catch (e) {
      const err = e as Error;
      this.status = "error";
      this.event("error", { jobId: job.id, message: err.message });
      void appendLog({ type: "error", leaderId: this.id, jobId: job.id, message: err.message });
      // 재개 실패(세션 유실 등)면 세션을 비워 다음 지시는 새로 시작하게 한다.
      if (/resume|session/i.test(err.message)) await this.sessions.clear(this.id);
    } finally {
      input.close();
      this.active = undefined;
      this.input = undefined;
      this.currentJob = undefined;
    }
  }

  private async handle(msg: SDKMessage, job: Job): Promise<void> {
    switch (msg.type) {
      case "system": {
        if (msg.subtype === "init") {
          await this.sessions.set(this.id, msg.session_id);
          this.event("init", { jobId: job.id, sessionId: msg.session_id, model: msg.model, tools: msg.tools.length });
        }
        return;
      }
      case "assistant": {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            this.event("text", { jobId: job.id, text: block.text });
          } else if (block.type === "tool_use") {
            this.lastTool = block.name;
            this.lastToolAt = new Date().toISOString();
            const inp = block.input as Record<string, unknown>;
            const target = String(inp.file_path ?? inp.path ?? inp.pattern ?? inp.command ?? inp.query ?? inp.url ?? "");
            this.event("tool_use", { jobId: job.id, tool: block.name, target, toolUseId: block.id });
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
            }
          }
        }
        return;
      }
      case "result": {
        const ok = msg.subtype === "success";
        this.status = msg.is_error ? "error" : "idle";
        await this.sessions.set(this.id, msg.session_id);
        this.event("result", {
          jobId: job.id,
          ok,
          subtype: msg.subtype,
          isError: msg.is_error,
          text: ok ? msg.result : (msg as { errors?: string[] }).errors?.join("\n") ?? msg.subtype,
          costUsd: msg.total_cost_usd,
          turns: msg.num_turns,
          durationMs: msg.duration_ms,
          sessionId: msg.session_id,
        });
        void appendLog({ type: "result", leaderId: this.id, jobId: job.id, ok, costUsd: msg.total_cost_usd, turns: msg.num_turns });
        return;
      }
      default:
        return;
    }
  }

  /**
   * PRD 10.2 권한 기본값. M1에서는 결재 UI가 없으므로 "결재 필요"는 반려로 처리하고 이벤트만 남긴다.
   * M3에서 ApprovalQueue 가 이 자리에 들어온다.
   */
  private async canUseTool(tool: string, input: Record<string, unknown>): Promise<PermissionResult> {
    const p = this.store.permissions;
    const allow = (): PermissionResult => ({ behavior: "allow", updatedInput: input });
    const needApproval = (reason: string): PermissionResult => {
      this.event("approval_needed", { jobId: this.currentJob?.id, tool, target: targetOf(input), reason });
      void appendLog({ type: "approval_needed", leaderId: this.id, tool, target: targetOf(input), reason, decision: "auto-deny(M1)" });
      return {
        behavior: "deny",
        message: `대표 결재가 필요한 작업이라 지금은 실행할 수 없다 (${reason}). 대안으로 진행하거나 보고로 마무리하라.`,
      };
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

function targetOf(input: Record<string, unknown>): string {
  return String(input.file_path ?? input.command ?? input.path ?? "");
}

function isUnder(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

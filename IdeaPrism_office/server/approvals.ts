// ApprovalQueue (PRD 9.3·10.2): 팀장의 도구 권한 요청을 대표가 화면에서 승인/반려할 때까지 기다린다.
// 대기열은 메모리, 기록은 .local/approvals.log (JSONL).
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { localDir } from "./local.js";

export type Decision = "approve" | "reject";

export interface Approval {
  id: string;
  leaderId: string;
  jobId?: string;
  tool: string;
  target: string;
  reason?: string;
  requestedAt: string;
  decision?: Decision;
  decidedAt?: string;
  decidedBy?: "ceo" | "system";
}

interface Pending {
  approval: Approval;
  resolve: (d: Decision) => void;
}

export class ApprovalQueue {
  private pending = new Map<string, Pending>();
  private seq = 0;

  constructor(private readonly emit: (kind: string, data: Record<string, unknown>) => void) {}

  /** 대기 중인 결재 (요청 순서) */
  list(): Approval[] {
    return [...this.pending.values()].map((p) => p.approval);
  }

  /** 결재 요청을 만들고, 결정이 날 때까지 기다리는 promise 를 함께 돌려준다. */
  request(req: Omit<Approval, "id" | "requestedAt">): { approval: Approval; decision: Promise<Decision> } {
    const approval: Approval = { ...req, id: `ap_${Date.now()}_${++this.seq}`, requestedAt: new Date().toISOString() };
    void this.log({ event: "requested", ...approval });
    const decision = new Promise<Decision>((resolve) => {
      this.pending.set(approval.id, { approval, resolve });
    });
    this.emit("approval_requested", { approval, pending: this.list() });
    return { approval, decision };
  }

  decide(id: string, decision: Decision, by: Approval["decidedBy"] = "ceo"): Approval | undefined {
    const p = this.pending.get(id);
    if (!p) return undefined;
    this.pending.delete(id);
    const a = { ...p.approval, decision, decidedAt: new Date().toISOString(), decidedBy: by };
    void this.log({ event: "decided", ...a });
    p.resolve(decision);
    this.emit("approval_decided", { approval: a, pending: this.list() });
    return a;
  }

  /** 팀장 중단·오류 시 그 팀장의 대기 결재를 전부 반려 처리 */
  cancelFor(leaderId: string): number {
    let n = 0;
    for (const a of this.list()) if (a.leaderId === leaderId) {
      this.decide(a.id, "reject", "system");
      n++;
    }
    return n;
  }

  private async log(entry: Record<string, unknown>): Promise<void> {
    await mkdir(localDir, { recursive: true });
    await appendFile(path.join(localDir, "approvals.log"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
  }
}

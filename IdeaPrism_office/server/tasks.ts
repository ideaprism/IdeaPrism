// 업무 보드 (PRD 8.5·9.2): board/tasks.json 은 서버만 기록한다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type TaskStatus = "todo" | "doing" | "done" | "blocked";

export interface Task {
  id: string;
  title: string;
  team: string;
  leaderId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  source: "chat" | "handoff" | "meeting";
  outputs: string[];
}

export class TaskBoard {
  private tasks: Task[] = [];
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly emit: (kind: string, data: Record<string, unknown>) => void,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8")) as { tasks?: Task[] };
      this.tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    } catch {
      this.tasks = [];
    }
  }

  all(): Task[] {
    return this.tasks;
  }

  create(input: { title: string; team: string; leaderId: string; source?: Task["source"] }): Task {
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const n = this.tasks.filter((t) => t.id.startsWith(`t_${day}_`)).length + 1;
    const task: Task = {
      id: `t_${day}_${String(n).padStart(3, "0")}`,
      title: input.title,
      team: input.team,
      leaderId: input.leaderId,
      status: "todo",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      source: input.source ?? "chat",
      outputs: [],
    };
    this.tasks.push(task);
    this.persist();
    return task;
  }

  update(id: string, patch: Partial<Pick<Task, "status" | "title">>): Task | undefined {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return undefined;
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
    this.persist();
    return t;
  }

  addOutput(id: string, output: string): void {
    const t = this.tasks.find((x) => x.id === id);
    if (!t || t.outputs.includes(output)) return;
    t.outputs.push(output);
    t.updatedAt = new Date().toISOString();
    this.persist();
  }

  /** 서버 시작 시: 지난 실행에서 doing 으로 남은 것은 blocked 로 정리 */
  async reconcile(): Promise<void> {
    let changed = false;
    for (const t of this.tasks) if (t.status === "doing" || t.status === "todo") {
      t.status = "blocked";
      t.updatedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) this.persist();
  }

  private persist(): void {
    const snapshot = JSON.stringify({ tasks: this.tasks }, null, 2) + "\n";
    this.writing = this.writing.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, snapshot, "utf8");
    });
    this.emit("tasks", { tasks: this.tasks });
  }
}

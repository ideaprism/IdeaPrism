// PC별 로컬 상태: 세션 ID, 대화 기록, 로그 (office/.local/, git 제외)
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { appDir } from "./config.js";

export const localDir = path.join(appDir, ".local");
const logsDir = path.join(localDir, "logs");
const transcriptsDir = path.join(localDir, "transcripts");

export class SessionStore {
  private map: Record<string, string> = {};
  private readonly file: string;

  constructor(pc: string) {
    this.file = path.join(localDir, `sessions.${pc}.json`);
  }

  async load(): Promise<void> {
    await mkdir(localDir, { recursive: true });
    try {
      this.map = JSON.parse(await readFile(this.file, "utf8"));
    } catch {
      this.map = {};
    }
  }

  get(leaderId: string): string | undefined {
    return this.map[leaderId];
  }

  async set(leaderId: string, sessionId: string): Promise<void> {
    if (this.map[leaderId] === sessionId) return;
    this.map[leaderId] = sessionId;
    await writeFile(this.file, JSON.stringify(this.map, null, 2) + "\n", "utf8");
  }

  async clear(leaderId: string): Promise<void> {
    delete this.map[leaderId];
    await writeFile(this.file, JSON.stringify(this.map, null, 2) + "\n", "utf8");
  }
}

/** 대화 패널 한 줄 */
export interface TranscriptEntry {
  id: string;
  at: string;
  leaderId: string;
  jobId?: string;
  role: "user" | "leader" | "tool" | "result" | "system";
  text?: string;
  tool?: string;
  target?: string;
  ok?: boolean;
}

/** 팀장별 대화 기록. 새로고침·재실행 후에도 이어지도록 .local/transcripts/<id>.jsonl 에 추가한다. */
export class TranscriptStore {
  private cache = new Map<string, TranscriptEntry[]>();

  async load(leaderId: string, limit = 200): Promise<TranscriptEntry[]> {
    if (this.cache.has(leaderId)) return this.cache.get(leaderId)!;
    await mkdir(transcriptsDir, { recursive: true });
    let entries: TranscriptEntry[] = [];
    try {
      const raw = await readFile(path.join(transcriptsDir, `${leaderId}.jsonl`), "utf8");
      entries = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => JSON.parse(l) as TranscriptEntry)
        .slice(-limit);
    } catch {
      entries = [];
    }
    this.cache.set(leaderId, entries);
    return entries;
  }

  async append(entry: TranscriptEntry): Promise<void> {
    const list = await this.load(entry.leaderId);
    list.push(entry);
    if (list.length > 400) list.splice(0, list.length - 400);
    await appendFile(path.join(transcriptsDir, `${entry.leaderId}.jsonl`), JSON.stringify(entry) + "\n", "utf8");
  }
}

/** .local/logs/YYYYMMDD.jsonl 에 한 줄 추가 */
export async function appendLog(entry: Record<string, unknown>): Promise<void> {
  await mkdir(logsDir, { recursive: true });
  const d = new Date();
  const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.jsonl`;
  await appendFile(path.join(logsDir, name), JSON.stringify({ at: d.toISOString(), ...entry }) + "\n", "utf8");
}

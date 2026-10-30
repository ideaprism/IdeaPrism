// PC별 로컬 상태: 세션 ID, 로그 (office/.local/, git 제외)
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { appDir } from "./config.js";

export const localDir = path.join(appDir, ".local");
const logsDir = path.join(localDir, "logs");

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

/** .local/logs/YYYYMMDD.jsonl 에 한 줄 추가 */
export async function appendLog(entry: Record<string, unknown>): Promise<void> {
  await mkdir(logsDir, { recursive: true });
  const d = new Date();
  const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.jsonl`;
  await appendFile(path.join(logsDir, name), JSON.stringify({ at: d.toISOString(), ...entry }) + "\n", "utf8");
}

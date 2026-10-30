// 설정 3파일 로더·검증·저장 (작업계획 §6-1)
//  - office.config.<PC>.json  : 경로·port·deadline (PC마다 다름)
//  - office.teams.json        : 팀장 ↔ 폴더 매칭 (두 PC 공통)
//  - office.permissions.json  : 결재 기본값 (두 PC 공통)
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface OfficeConfig {
  pc: string;
  root: string;
  wikiKnowledge: string;
  wikiRaw: string;
  codeRepo: string;
  port: number;
  deadline: { label: string; date: string };
  musicDir: string;
  libraryVisitSeconds: number;
}

export interface LeaderDef {
  id: string;
  name: string;
  role: string;
  team: string;
  teamLabel: string;
  folder: string;
  agentFile: string;
  inbox: string;
  extraDirs: string[];
  color: string;
  model: string;
  character: string;
}

export interface TeamsConfig {
  leaders: LeaderDef[];
}

export interface PermissionsConfig {
  autoAllowTools: string[];
  autoAllowWritePaths: string[];
  approvalWritePaths: string[];
  bashAutoAllow: string[];
  bashAlwaysApprove: string[];
}

export type ConfigName = "config" | "teams" | "permissions";

export interface PathCheck {
  file: ConfigName;
  key: string;
  path: string;
  exists: boolean;
  required: boolean;
}

export class ConfigStore {
  config!: OfficeConfig;
  teams!: TeamsConfig;
  permissions!: PermissionsConfig;

  constructor(public readonly pc: string) {}

  filePath(name: ConfigName): string {
    const base =
      name === "config" ? `office.config.${this.pc}.json` : name === "teams" ? "office.teams.json" : "office.permissions.json";
    return path.join(appDir, base);
  }

  async load(): Promise<void> {
    this.config = await readJson<OfficeConfig>(this.filePath("config"));
    this.teams = await readJson<TeamsConfig>(this.filePath("teams"));
    this.permissions = await readJson<PermissionsConfig>(this.filePath("permissions"));
    this.assertShape();
  }

  get(name: ConfigName): unknown {
    return name === "config" ? this.config : name === "teams" ? this.teams : this.permissions;
  }

  /** 저장 후 다시 읽는다. 형식이 틀리면 저장하지 않고 예외를 던진다. */
  async save(name: ConfigName, data: unknown): Promise<PathCheck[]> {
    const next = new ConfigStore(this.pc);
    next.config = name === "config" ? (data as OfficeConfig) : this.config;
    next.teams = name === "teams" ? (data as TeamsConfig) : this.teams;
    next.permissions = name === "permissions" ? (data as PermissionsConfig) : this.permissions;
    next.assertShape();
    await writeFile(this.filePath(name), JSON.stringify(data, null, 2) + "\n", "utf8");
    await this.load();
    return this.validate();
  }

  /** 레포 루트 기준 상대 경로 → 절대 경로. `$codeRepo` 토큰 지원. */
  resolve(p: string): string {
    if (p === "$codeRepo") return path.resolve(this.config.codeRepo);
    if (path.isAbsolute(p)) return path.resolve(p);
    return path.resolve(this.config.root, p);
  }

  leader(id: string): LeaderDef | undefined {
    return this.teams.leaders.find((l) => l.id === id);
  }

  /** 팀장이 접근하는 추가 폴더 (절대 경로) */
  extraDirsOf(leader: LeaderDef): string[] {
    return leader.extraDirs.map((d) => this.resolve(d));
  }

  /** 모든 경로의 존재 여부 */
  async validate(): Promise<PathCheck[]> {
    const rows: PathCheck[] = [];
    const push = async (file: ConfigName, key: string, p: string, required = true) => {
      const abs = this.resolve(p);
      rows.push({ file, key, path: abs, exists: await exists(abs), required });
    };
    await push("config", "root", this.config.root);
    await push("config", "wikiKnowledge", this.config.wikiKnowledge);
    await push("config", "wikiRaw", this.config.wikiRaw);
    await push("config", "codeRepo", this.config.codeRepo);
    if (this.config.musicDir) await push("config", "musicDir", this.config.musicDir, false);
    for (const l of this.teams.leaders) {
      await push("teams", `${l.id}.folder`, l.folder);
      await push("teams", `${l.id}.agentFile`, l.agentFile);
      await push("teams", `${l.id}.inbox`, l.inbox);
      for (const d of l.extraDirs) await push("teams", `${l.id}.extraDirs[${d}]`, d, false);
    }
    return rows;
  }

  private assertShape(): void {
    const c = this.config;
    if (!c || typeof c.root !== "string" || !c.root) throw new Error("config.root 가 비어 있습니다");
    if (!Number.isInteger(c.port) || c.port < 1024 || c.port > 65535) throw new Error("config.port 는 1024~65535 정수여야 합니다");
    if (!Array.isArray(this.teams?.leaders) || this.teams.leaders.length === 0) throw new Error("teams.leaders 가 비어 있습니다");
    const ids = new Set<string>();
    for (const l of this.teams.leaders) {
      for (const k of ["id", "name", "team", "folder", "agentFile", "inbox"] as const) {
        if (typeof l[k] !== "string" || !l[k]) throw new Error(`teams.leaders[${l.id ?? "?"}].${k} 가 비어 있습니다`);
      }
      if (ids.has(l.id)) throw new Error(`팀장 id 중복: ${l.id}`);
      ids.add(l.id);
      if (!Array.isArray(l.extraDirs)) l.extraDirs = [];
    }
    const p = this.permissions;
    for (const k of ["autoAllowTools", "autoAllowWritePaths", "approvalWritePaths", "bashAutoAllow", "bashAlwaysApprove"] as const) {
      if (!Array.isArray(p?.[k])) throw new Error(`permissions.${k} 는 배열이어야 합니다`);
    }
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

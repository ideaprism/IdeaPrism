// 관리자 페이지 탭1 "저장소": git status / pull (push는 하지 않는다 — PRD 10.5)
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

export interface GitStatus {
  root: string;
  branch: string;
  ahead: number;
  behind: number;
  lastCommit: string;
  modified: number;
  untracked: number;
}

export async function gitStatus(root: string): Promise<GitStatus> {
  const [branch, lastCommit, porcelain] = await Promise.all([
    git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(root, ["log", "-1", "--format=%h %ci %s"]),
    git(root, ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-b"]),
  ]);
  const lines = porcelain.split(/\r?\n/).filter(Boolean);
  const head = lines.shift() ?? "";
  const ahead = Number(/ahead (\d+)/.exec(head)?.[1] ?? 0);
  const behind = Number(/behind (\d+)/.exec(head)?.[1] ?? 0);
  const untracked = lines.filter((l) => l.startsWith("??")).length;
  return { root, branch, ahead, behind, lastCommit, modified: lines.length - untracked, untracked };
}

export async function gitPull(root: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await run("git", ["-C", root, "pull", "--ff-only"], { encoding: "utf8" });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: ((err.stdout ?? "") + (err.stderr ?? "") || err.message).trim() };
  }
}

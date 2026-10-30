// 관리자 페이지 (작업계획 §6-1): 탭1 저장소, 탭2 경로, 탭3 팀장 매칭, 탭4 권한(M3)
import { useEffect, useState } from "react";
import { api } from "../api";

type Tab = "repo" | "paths" | "teams" | "perms";

interface PathCheck {
  file: string;
  key: string;
  path: string;
  exists: boolean;
  required: boolean;
}
interface ConfigRes<T> {
  file: string;
  data: T;
  checks: PathCheck[];
}
interface SaveRes {
  ok: boolean;
  checks: PathCheck[];
  note: string;
}

export function AdminPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("repo");
  return (
    <section className="panel admin" aria-label="관리자 페이지">
      <h2>
        관리자
        <button type="button" className="btn close" onClick={onClose}>
          사무실로 돌아가기
        </button>
      </h2>
      <div className="tabs" role="tablist" style={{ padding: 0, borderBottom: "1px solid var(--line)" }}>
        {(
          [
            ["repo", "저장소"],
            ["paths", "경로"],
            ["teams", "팀장 매칭"],
            ["perms", "권한"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} style={{ ["--team" as string]: "#3E63DD" }} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="body">
        {tab === "repo" && <RepoTab />}
        {tab === "paths" && <PathsTab />}
        {tab === "teams" && <TeamsTab />}
        {tab === "perms" && <div className="note">권한 편집(자동 허용 경로·Bash 허용 명령)은 M3 결재 기능과 함께 추가됩니다. 현재 값은 office.permissions.json 에 있습니다.</div>}
      </div>
    </section>
  );
}

/* ---------------- 탭1 저장소 ---------------- */
interface GitStatus {
  root: string;
  branch: string;
  ahead: number;
  behind: number;
  lastCommit: string;
  modified: number;
  untracked: number;
}

function RepoTab() {
  const [st, setSt] = useState<GitStatus | null>(null);
  const [pc, setPc] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [s, h] = await Promise.all([api<GitStatus>("/api/git/status"), api<{ pc: string }>("/api/health")]);
    setSt(s);
    setPc(h.pc);
  };
  useEffect(() => {
    load().catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);

  async function pull() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; output: string; status: GitStatus }>("/api/git/pull", { method: "POST" });
      setSt(r.status);
      setMsg({ ok: r.ok, text: r.output || "변경 없음" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!st) return <div className="note">불러오는 중…</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="kv">
        <label>PC</label>
        <div>{pc}</div>
        <label>레포 루트</label>
        <div>{st.root}</div>
        <label>브랜치</label>
        <div>
          {st.branch}
          {st.behind > 0 && <span className="bad"> · 원격보다 {st.behind}커밋 뒤처짐</span>}
          {st.ahead > 0 && <span> · push 안 된 커밋 {st.ahead}</span>}
        </div>
        <label>마지막 커밋</label>
        <div>{st.lastCommit}</div>
        <label>변경 파일</label>
        <div>
          수정 {st.modified} · 미추적 {st.untracked}
        </div>
      </div>
      <div className="rowbtns">
        <button type="button" className="btn primary" onClick={() => void pull()} disabled={busy}>
          {busy ? "가져오는 중…" : "최신 가져오기 (git pull)"}
        </button>
        <button type="button" className="btn" onClick={() => void load()}>
          새로고침
        </button>
        <span className="note" style={{ padding: "4px 8px" }}>push 는 하지 않습니다. 커밋·push 는 터미널에서 직접.</span>
      </div>
      {msg && <div className={`note ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
    </div>
  );
}

/* ---------------- 탭2 경로 ---------------- */
interface OfficeConfig {
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

const PATH_FIELDS: [keyof OfficeConfig, string][] = [
  ["root", "레포 루트"],
  ["wikiKnowledge", "wiki knowledge 경로"],
  ["wikiRaw", "wiki raw 경로"],
  ["codeRepo", "코드 레포 (ideaprism_sdg2 클론)"],
  ["musicDir", "음악 폴더 (선택)"],
];

function PathsTab() {
  const [cfg, setCfg] = useState<OfficeConfig | null>(null);
  const [file, setFile] = useState("");
  const [checks, setChecks] = useState<PathCheck[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api<ConfigRes<OfficeConfig>>("/api/config/config")
      .then((r) => {
        setCfg(r.data);
        setFile(r.file);
        setChecks(r.checks);
      })
      .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);

  const check = (key: string) => checks.find((c) => c.file === "config" && c.key === key);

  async function save() {
    if (!cfg) return;
    setMsg(null);
    try {
      const r = await api<SaveRes>("/api/config/config", { method: "PUT", json: cfg });
      setChecks(r.checks);
      setDirty(false);
      setMsg({ ok: true, text: `저장했습니다. ${r.note}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function mkdir(key: string) {
    try {
      const r = await api<{ ok: boolean; path: string; checks: PathCheck[] }>("/api/config/mkdir", { method: "POST", json: { key } });
      setChecks(r.checks);
      setMsg({ ok: true, text: `폴더를 만들었습니다: ${r.path}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  if (!cfg) return <div className="note">불러오는 중…</div>;
  const set = <K extends keyof OfficeConfig>(k: K, v: OfficeConfig[K]) => {
    setCfg({ ...cfg, [k]: v });
    setDirty(true);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="note">파일: {file} · 상대 경로는 레포 루트 기준. 저장하면 다음 실행부터 반영됩니다.</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 220 }}>항목</th>
            <th>경로</th>
            <th style={{ width: 90 }}>존재</th>
            <th style={{ width: 110 }} />
          </tr>
        </thead>
        <tbody>
          {PATH_FIELDS.map(([k, label]) => {
            const c = check(k);
            return (
              <tr key={k}>
                <td>{label}</td>
                <td>
                  <input type="text" value={String(cfg[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} aria-label={label} />
                </td>
                <td>{c ? dirty ? <span style={{ color: "var(--muted)" }}>저장 후 확인</span> : c.exists ? <span className="ok">있음</span> : <span className="bad">없음</span> : <span style={{ color: "var(--muted)" }}>-</span>}</td>
                <td>{c && !c.exists && !dirty && <button type="button" className="btn small" onClick={() => void mkdir(k)}>폴더 만들기</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="kv">
        <label>포트</label>
        <input type="number" value={cfg.port} onChange={(e) => set("port", Number(e.target.value))} aria-label="포트" />
        <label>마감 이름</label>
        <input type="text" value={cfg.deadline.label} onChange={(e) => set("deadline", { ...cfg.deadline, label: e.target.value })} aria-label="마감 이름" />
        <label>마감일</label>
        <input type="date" value={cfg.deadline.date} onChange={(e) => set("deadline", { ...cfg.deadline, date: e.target.value })} aria-label="마감일" />
        <label>도서관 방문 초</label>
        <input type="number" step="0.1" value={cfg.libraryVisitSeconds} onChange={(e) => set("libraryVisitSeconds", Number(e.target.value))} aria-label="도서관 방문 초" />
      </div>
      <div className="rowbtns">
        <button type="button" className="btn primary" onClick={() => void save()} disabled={!dirty}>
          저장
        </button>
        {dirty && <span className="note" style={{ padding: "4px 8px" }}>저장하지 않은 변경이 있습니다.</span>}
      </div>
      {msg && <div className={`note ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
      <details>
        <summary style={{ color: "var(--muted)", cursor: "pointer" }}>전체 경로 검증 결과 ({checks.length})</summary>
        <table>
          <tbody>
            {checks.map((c) => (
              <tr key={c.file + c.key}>
                <td style={{ width: 80 }}>{c.file}</td>
                <td style={{ width: 240 }}>{c.key}</td>
                <td>{c.path}</td>
                <td style={{ width: 90 }}>{c.exists ? <span className="ok">있음</span> : <span className={c.required ? "bad" : ""}>없음</span>}</td>
                <td style={{ width: 110 }}>{!c.exists && <button type="button" className="btn small" onClick={() => void mkdir(c.key)}>폴더 만들기</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/* ---------------- 탭3 팀장 매칭 ---------------- */
interface LeaderDef {
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

const LEADER_COLS: [keyof LeaderDef, string, number][] = [
  ["id", "id", 60],
  ["name", "이름", 70],
  ["role", "역할", 90],
  ["teamLabel", "팀", 80],
  ["team", "팀 폴더명", 90],
  ["folder", "팀 폴더", 150],
  ["agentFile", "leader.md", 220],
  ["inbox", "handoff 수신함", 140],
  ["extraDirs", "추가 접근 폴더 (쉼표)", 220],
  ["color", "색", 80],
  ["model", "모델", 70],
  ["character", "캐릭터", 80],
];

function TeamsTab() {
  const [leaders, setLeaders] = useState<LeaderDef[] | null>(null);
  const [checks, setChecks] = useState<PathCheck[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api<ConfigRes<{ leaders: LeaderDef[] }>>("/api/config/teams")
      .then((r) => {
        setLeaders(r.data.leaders);
        setChecks(r.checks);
      })
      .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);

  if (!leaders) return <div className="note">불러오는 중…</div>;

  const update = (i: number, k: keyof LeaderDef, v: string) => {
    const next = leaders.map((l, j) => (j === i ? { ...l, [k]: k === "extraDirs" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v } : l));
    setLeaders(next);
    setDirty(true);
  };
  const add = () => {
    const id = `fl${leaders.length + 1}`;
    setLeaders([
      ...leaders,
      { id, name: "새 팀장", role: "", team: id, teamLabel: "", folder: `freelancers/${id}`, agentFile: `freelancers/${id}/.claude/agents/leader.md`, inbox: `handoff/${id}`, extraDirs: ["wiki", "handoff", "board", "meetings"], color: "#7C4DFF", model: "sonnet", character: "" },
    ]);
    setDirty(true);
  };
  const remove = (i: number) => {
    if (!confirm(`${leaders[i].name} 줄을 지울까요? (폴더는 지우지 않습니다)`)) return;
    setLeaders(leaders.filter((_, j) => j !== i));
    setDirty(true);
  };

  async function save() {
    setMsg(null);
    try {
      const r = await api<SaveRes>("/api/config/teams", { method: "PUT", json: { leaders } });
      setChecks(r.checks);
      setDirty(false);
      const missing = r.checks.filter((c) => c.file === "teams" && c.required && !c.exists);
      setMsg({ ok: missing.length === 0, text: `저장했습니다. ${r.note}${missing.length ? `\n없는 경로: ${missing.map((m) => m.key).join(", ")}` : ""}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  const exists = (id: string, key: string) => checks.find((c) => c.file === "teams" && c.key === `${id}.${key}`);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="note">office.teams.json (두 PC 공통, git 추적). 경로는 레포 루트 기준, `$codeRepo` 는 코드 레포로 바뀝니다. 저장하면 다음 지시부터 반영됩니다.</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 1500 }}>
          <thead>
            <tr>
              {LEADER_COLS.map(([k, label, w]) => (
                <th key={k} style={{ width: w }}>
                  {label}
                </th>
              ))}
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {leaders.map((l, i) => (
              <tr key={i}>
                {LEADER_COLS.map(([k, label]) => {
                  const c = !dirty && ["folder", "agentFile", "inbox"].includes(k) ? exists(l.id, k) : undefined;
                  return (
                    <td key={k}>
                      <input
                        type="text"
                        aria-label={`${l.name} ${label}`}
                        value={k === "extraDirs" ? l.extraDirs.join(", ") : String(l[k] ?? "")}
                        onChange={(e) => update(i, k, e.target.value)}
                        style={c && !c.exists ? { borderColor: "#e53935" } : undefined}
                        title={c ? (c.exists ? "있음" : "없음: " + c.path) : undefined}
                      />
                    </td>
                  );
                })}
                <td>
                  <button type="button" className="btn small danger" onClick={() => remove(i)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rowbtns">
        <button type="button" className="btn primary" onClick={() => void save()} disabled={!dirty}>
          저장
        </button>
        <button type="button" className="btn" onClick={add}>
          + 줄 추가
        </button>
        {dirty && <span className="note" style={{ padding: "4px 8px" }}>저장하지 않은 변경이 있습니다.</span>}
        <span className="note" style={{ padding: "4px 8px" }}>빨간 테두리 = 경로 없음</span>
      </div>
      {msg && <div className={`note ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
    </div>
  );
}

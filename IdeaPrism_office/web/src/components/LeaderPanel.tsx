import { useEffect, useRef, useState } from "react";
import { LOCATION_LABEL, STATUS_LABEL, api, expressionUrl, faceUrl, type LeaderState, type OfficeData } from "../api";

export function LeaderPanel({ office, leader, focusChat }: { office: OfficeData; leader: LeaderState; focusChat: number }) {
  const [tab, setTab] = useState<"chat" | "outputs">("chat");
  useEffect(() => setTab("chat"), [leader.id, focusChat]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const entries = office.transcripts[leader.id] ?? [];
  const working = leader.currentJobId !== null;
  const expr = expressionUrl(office.manifest, leader.character, leader.status);
  const face = faceUrl(office.manifest, leader.character);
  const exprKey = office.manifest?.characters[leader.character]?.states[leader.status] ?? office.manifest?.characters[leader.character]?.base ?? "-";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, leader.id, tab]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/leaders/${leader.id}/instruct`, { method: "POST", json: { text: t } });
      setText("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    try {
      await api(`/api/leaders/${leader.id}/interrupt`, { method: "POST" });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await api(`/api/approvals/${id}/decide`, { method: "POST", json: { decision } });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function newSession() {
    if (!confirm(`${leader.name}의 대화 세션을 새로 시작할까요? 기록은 남고, 팀장은 이전 대화를 잊습니다. (사용량 절약)`)) return;
    try {
      await api(`/api/leaders/${leader.id}/reset-session`, { method: "POST" });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const decided = new Map(entries.filter((e) => e.role === "approval_result").map((e) => [e.approvalId, e.ok]));
  const pendingIds = new Set(office.approvals.map((a) => a.id));

  return (
    <aside className="panel side" style={{ ["--team" as string]: leader.color }} aria-label={`${leader.name} 패널`}>
      <div className="expr">
        {expr && <img src={expr} alt={`${leader.name} ${STATUS_LABEL[leader.status]}`} />}
        <span className="tl">
          {STATUS_LABEL[leader.status]} · {LOCATION_LABEL[leader.location]}
        </span>
        <span className="tr">{exprKey}</span>
      </div>
      <div className="who">
        <span className="n">{leader.name}</span> <span className="r">{leader.teamLabel} · {leader.role}</span>
        <button type="button" className="btn small" style={{ float: "right" }} onClick={() => void newSession()} disabled={working} title="이전 대화를 잊고 새 세션으로 시작">
          새 세션
        </button>
        <div className="q">{leader.bubble}</div>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          대화
        </button>
        <button type="button" role="tab" aria-selected={tab === "outputs"} className={tab === "outputs" ? "on" : ""} onClick={() => setTab("outputs")}>
          산출물
        </button>
      </div>
      {tab === "chat" ? (
        <div className="chat" ref={listRef}>
          {entries.length === 0 && <div className="msg system">아직 대화가 없습니다. 아래에 지시를 입력하세요.</div>}
          {entries.map((e) => {
            switch (e.role) {
              case "user":
                return (
                  <div key={e.id} className="msg user">
                    {e.text}
                  </div>
                );
              case "leader":
                return (
                  <div key={e.id} className="msg leader">
                    {face ? <img src={face} alt="" /> : <span className="ini">{leader.name.slice(0, 1)}</span>}
                    <div>{e.text}</div>
                  </div>
                );
              case "tool":
                return (
                  <details key={e.id} className="msg tool">
                    <summary>
                      {e.tool} {shorten(e.target ?? "")}
                    </summary>
                    <div>{e.target}</div>
                  </details>
                );
              case "result":
                return (
                  <div key={e.id} className={`msg result ${e.ok ? "" : "bad"}`}>
                    {e.text} · {new Date(e.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                );
              case "approval": {
                const pending = e.approvalId ? pendingIds.has(e.approvalId) : false;
                const result = e.approvalId ? decided.get(e.approvalId) : undefined;
                return (
                  <div key={e.id} className={`msg approval ${pending ? "pending" : result ? "approved" : "rejected"}`}>
                    <div className="ttl">결재 요청 · {e.tool}</div>
                    <div className="tgt">{e.target}</div>
                    {e.text && <div className="rsn">{e.text}</div>}
                    {pending ? (
                      <div className="acts">
                        <button type="button" className="ok" onClick={() => e.approvalId && void decide(e.approvalId, "approve")}>
                          승인
                        </button>
                        <button type="button" className="no" onClick={() => e.approvalId && void decide(e.approvalId, "reject")}>
                          반려
                        </button>
                      </div>
                    ) : (
                      <div className="dec">{result === undefined ? "처리됨" : result ? "승인함" : "반려함"}</div>
                    )}
                  </div>
                );
              }
              case "approval_result":
                return null;
              default:
                return (
                  <div key={e.id} className="msg system">
                    {e.text}
                  </div>
                );
            }
          })}
          {working && (
            <div className="typing" aria-live="polite">
              <i />
              <i />
              <i />
              {leader.name} {STATUS_LABEL[leader.status]}
            </div>
          )}
        </div>
      ) : (
        <div className="outputs">산출물 탭(바뀐 파일 목록·diff·커밋)은 M5에서 구현합니다.</div>
      )}
      <form
        className="composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder={`${leader.name}에게 지시… (Enter 전송, Shift+Enter 줄바꿈)`}
          aria-label="지시 입력"
          onKeyDown={(ev) => {
            // 한글 조합 중 Enter 는 무시 (PRD 8.6)
            if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
              ev.preventDefault();
              void send();
            }
          }}
        />
        <div className="btns">
          <button type="submit" className="send" disabled={busy || !text.trim()}>
            지시{working ? " (대기열)" : ""}
          </button>
          {working && (
            <button type="button" className="stop" onClick={() => void stop()}>
              중단
            </button>
          )}
        </div>
        {err && <div className="note bad" style={{ gridColumn: "1 / -1" }}>{err}</div>}
      </form>
    </aside>
  );
}

function shorten(s: string): string {
  return s.length > 48 ? "…" + s.slice(-46) : s;
}

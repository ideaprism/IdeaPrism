import { useEffect, useState } from "react";
import type { OfficeData } from "../api";

export function TopBar({
  office,
  onAdmin,
  adminOpen,
  onApprovals,
}: {
  office: OfficeData;
  onAdmin: () => void;
  adminOpen: boolean;
  onApprovals: () => void;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dday = office.deadline ? Math.ceil((new Date(office.deadline.date).getTime() - startOfDay(now)) / 86_400_000) : null;
  const approvals = office.approvals.length;

  return (
    <header className="topbar">
      <div className="logo">
        <i aria-hidden="true" /> IDEAPRISM Office
      </div>
      <span className="chip">
        <span className={`dot ${office.connected ? "on" : ""}`} />
        {office.pc ? `${office.pc} PC` : "서버"} · {office.connected ? "Claude Code 연결됨" : "연결 끊김"}
      </span>
      <div className="spacer" />
      {office.deadline && dday !== null && (
        <span className="chip dday" title={office.deadline.date}>
          {office.deadline.label} D{dday > 0 ? `-${dday}` : dday === 0 ? "-Day" : `+${-dday}`}
        </span>
      )}
      <button className="iconbtn" type="button" aria-label={`결재함, 대기 ${approvals}건`} title="가장 오래된 결재로 이동" onClick={onApprovals}>
        결재함
        {approvals > 0 && <span className="badge">{approvals}</span>}
      </button>
      <span className="chip">{now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
      <button className="iconbtn" type="button" onClick={onAdmin} aria-pressed={adminOpen} aria-label="관리자 페이지">
        ⚙ 관리자
      </button>
    </header>
  );
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

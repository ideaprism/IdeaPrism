import { useEffect, useState } from "react";
import { LOCATION_LABEL, STATUS_COLOR, STATUS_LABEL, elapsed, faceUrl, type OfficeData } from "../api";

export function TeamCards({ office, selected, onSelect }: { office: OfficeData; selected: string; onSelect: (id: string) => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const leaders = office.order.map((id) => office.states[id]).filter(Boolean);
  return (
    <section className="cards" aria-label="팀 상태">
      {leaders.map((l) => {
        const face = faceUrl(office.manifest, l.character);
        return (
          <button
            key={l.id}
            type="button"
            className={`panel card ${selected === l.id ? "selected" : ""}`}
            style={{ ["--team" as string]: l.color }}
            onClick={() => onSelect(l.id)}
          >
            {face ? <img className="face" src={face} alt="" /> : <span className="face">{l.name.slice(0, 1)}</span>}
            <div>
              <div className="row1">
                <span className="name">{l.name}</span>
                <span className="team">{l.teamLabel}</span>
                <span className="pill" style={{ background: STATUS_COLOR[l.status] }}>
                  {STATUS_LABEL[l.status]}
                </span>
              </div>
              <div className="task">{l.currentJobTitle ?? (l.queued ? `대기 ${l.queued}건` : "대기 중인 업무 없음")}</div>
              <div className="sub">
                {LOCATION_LABEL[l.location]} · {l.lastTool ?? "도구 없음"} · {elapsed(l.statusSince)}
                {l.queued > 0 && l.currentJobTitle ? ` · 대기 ${l.queued}` : ""}
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}

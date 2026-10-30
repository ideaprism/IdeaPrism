// 인물 빌보드 (PRD 8.3 인물 표현): 얼굴 50px + 팀색 링, 캡슐 몸, 이름표, 상태 점, 말풍선
import { STATUS_COLOR, type Status } from "../../api";
import { Billboard } from "./primitives";

export interface PersonProps {
  x: number;
  y: number;
  name: string;
  tag: string;
  color: string;
  face: string | null;
  status?: Status;
  bubble?: string;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function Person({ x, y, name, tag, color, face, status, bubble, selected, dim, onClick, ariaLabel }: PersonProps) {
  const body = (
    <>
      {bubble && <span className="p-bubble">{bubble}</span>}
      <span className="p-head" style={{ ["--team" as string]: color }}>
        {face ? <img src={face} alt="" /> : <b>{name.slice(0, 1)}</b>}
        {status && <i className={`p-dot ${status === "approval" ? "pulse" : ""}`} style={{ background: STATUS_COLOR[status] }} />}
      </span>
      <span className="p-body" style={{ background: `linear-gradient(180deg, ${color}, ${color}99)` }} />
      <span className="p-tag" style={selected ? { background: color, color: "#fff", borderColor: color } : undefined}>
        {tag}
      </span>
    </>
  );
  return (
    <Billboard x={x} y={y} w={92} h={118} className={`person3 ${selected ? "selected" : ""} ${dim ? "dim" : ""}`}>
      {onClick ? (
        <button type="button" className="p-btn" onClick={onClick} aria-label={ariaLabel ?? `${name} 선택`} aria-pressed={selected}>
          {body}
        </button>
      ) : (
        <div className="p-btn">{body}</div>
      )}
    </Billboard>
  );
}

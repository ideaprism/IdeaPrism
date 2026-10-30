// M2: 2D 단순 평면도. 구역은 PRD 8.3 좌표(1200×738)를 % 로 환산. 3D 연출은 M4.
import { STATUS_COLOR, faceUrl, type Location, type OfficeData } from "../api";

const ZONES: { key: string; label: string; x: number; y: number; w: number; h: number; cls?: string }[] = [
  { key: "hash", label: "해시석", x: 0, y: 0, w: 178, h: 210, cls: "wood" },
  { key: "zino", label: "지노석", x: 282, y: 0, w: 178, h: 210, cls: "wood" },
  { key: "muse", label: "뮤즈석", x: 0, y: 263, w: 178, h: 210, cls: "wood" },
  { key: "captain", label: "캡틴석", x: 282, y: 263, w: 178, h: 210, cls: "wood" },
  { key: "fl", label: "프리랜서 공유석", x: 0, y: 527, w: 178, h: 211, cls: "wood" },
  { key: "ben", label: "벤석", x: 282, y: 527, w: 178, h: 211, cls: "wood" },
  { key: "library", label: "LLM wiki 도서관", x: 575, y: 62, w: 210, h: 34, cls: "dark" },
  { key: "meeting", label: "전 직원 회의 테이블", x: 590, y: 228, w: 190, h: 74 },
  { key: "lounge", label: "탕비실 · 라운지", x: 820, y: 0, w: 380, h: 417, cls: "wood" },
  { key: "ceo", label: "대표실", x: 550, y: 430, w: 650, h: 308, cls: "ceo" },
];

const DESK: Record<string, [number, number]> = { hash: [88, 142], zino: [370, 142], muse: [88, 405], captain: [370, 405], fl: [88, 669], ben: [370, 669] };
const LIBRARY: Record<string, [number, number]> = { captain: [612, 112], hash: [682, 112], zino: [752, 112] };
const APPROVAL: [number, number][] = [[631, 535], [757, 535], [631, 639], [757, 639]];
const LOUNGE: [number, number] = [1012, 300];
const MEETING: [number, number][] = [[620, 206], [685, 206], [750, 206], [620, 323], [685, 323], [750, 323]];
const CEO_SEAT: [number, number] = [1015, 536];

function spot(character: string, location: Location, idx: number): [number, number] {
  switch (location) {
    case "library":
      return LIBRARY[character] ?? [682, 112];
    case "approvalTable":
      return APPROVAL[idx % APPROVAL.length];
    case "lounge":
      return [LOUNGE[0] + (idx - 1) * 60, LOUNGE[1]];
    case "meeting":
      return MEETING[idx % MEETING.length];
    default:
      return DESK[character] ?? [370, 405];
  }
}

const pct = (x: number, y: number) => ({ left: `${x / 12}%`, top: `${y / 7.38}%` });

export function Office2D({ office, selected, onSelect }: { office: OfficeData; selected: string; onSelect: (id: string) => void }) {
  const leaders = office.order.map((id) => office.states[id]).filter(Boolean);
  return (
    <section className="panel office" aria-label="사무실">
      {ZONES.map((z) => (
        <div key={z.key} className={`zone ${z.cls ?? ""}`} style={{ left: `${z.x / 12}%`, top: `${z.y / 7.38}%`, width: `${z.w / 12}%`, height: `${z.h / 7.38}%` }}>
          {z.label}
        </div>
      ))}
      {(["muse", "ben"] as const).map((c) => (
        <div key={c} className="person" style={{ ...pct(...DESK[c]), ["--team" as string]: c === "ben" ? "#3E63DD" : "#E5663B", opacity: 0.75 }}>
          <Face url={faceUrl(office.manifest, c)} name={c === "ben" ? "벤" : "뮤즈"} />
          <span className="tag">{c === "ben" ? "벤 이사" : "뮤즈 실장"}</span>
        </div>
      ))}
      <div className="ceo-seat" style={pct(...CEO_SEAT)} title="대표">
        창
      </div>
      {leaders.map((l, i) => {
        const [x, y] = spot(l.character, l.location, i);
        return (
          <button
            key={l.id}
            type="button"
            className={`person ${selected === l.id ? "selected" : ""}`}
            style={{ ...pct(x, y), ["--team" as string]: l.color }}
            onClick={() => onSelect(l.id)}
            aria-label={`${l.name} 팀장 선택`}
          >
            {l.status !== "idle" && <span className="bubble">{l.bubble}</span>}
            <Face url={faceUrl(office.manifest, l.character)} name={l.name} />
            <span className={`sdot ${l.status === "approval" ? "pulse" : ""}`} style={{ background: STATUS_COLOR[l.status] }} />
            <span className="tag">{l.name} 팀장</span>
          </button>
        );
      })}
    </section>
  );
}

function Face({ url, name }: { url: string | null; name: string }) {
  return url ? <img className="face" src={url} alt={name} /> : <span className="face">{name.slice(0, 1)}</span>;
}

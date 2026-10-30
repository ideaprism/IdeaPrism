// 3D 공유오피스 씬 (PRD 8.3). 시점: 대표실 쪽(아래)에서 뒤쪽 위를 내려다봄.
// 구현: 바닥 rotateX(52deg), perspective 1700px, preserve-3d. 가구는 상자, 인물·식물은 빌보드.
import { useEffect, useRef, useState } from "react";
import { faceUrl, type OfficeData } from "../../api";
import { CEO_SEAT, DESK, FLOOR_H, FLOOR_W, spot } from "./layout";
import { CeoRoom, Floors, Library, Lounge, MeetingArea, SeatDesks } from "./Furniture";
import { Person } from "./Person";

const STAGE_W = FLOOR_W;
const STAGE_H = 600;

export function Office3D({
  office,
  selected,
  onSelect,
  onToggleView,
}: {
  office: OfficeData;
  selected: string;
  onSelect: (id: string) => void;
  onToggleView: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // 영역에 꽉 차게, 비율 유지
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.1, Math.min((r.width - 16) / STAGE_W, (r.height - 16) / STAGE_H)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const leaders = office.order.map((id) => office.states[id]).filter(Boolean);
  const meeting = leaders.some((l) => l.status === "meeting");
  const deco: Record<string, boolean> = {};
  const music = false;

  return (
    <section className="panel office3d" ref={ref} aria-label="사무실 3D">
      <div className="scene-btns">
        <button type="button" className="btn small" onClick={onToggleView} title="3D가 깨지면 2D 평면도로">
          2D 평면도
        </button>
        <button type="button" className="btn small" disabled title="M6">
          전 직원 회의 소집
        </button>
        <button type="button" className="btn small" disabled title="M6">
          음악
        </button>
        <button type="button" className="btn small" disabled title="M6">
          대표실 꾸미기
        </button>
      </div>
      <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, 0) scale(${scale})` }}>
        <div className="floor3" style={{ width: FLOOR_W, height: FLOOR_H }}>
          <Floors />
          <SeatDesks />
          <Library />
          <MeetingArea meeting={meeting} />
          <Lounge />
          <CeoRoom deco={deco} music={music} />

          {/* 팀원(표시만) */}
          <Person x={DESK.muse[0]} y={DESK.muse[1]} name="뮤즈" tag="뮤즈 실장" color="#E5663B" face={faceUrl(office.manifest, "muse")} dim />
          <Person x={DESK.ben[0]} y={DESK.ben[1]} name="벤" tag="벤 이사" color="#3E63DD" face={faceUrl(office.manifest, "ben")} dim />
          {/* 대표 */}
          <Person x={CEO_SEAT[0]} y={CEO_SEAT[1]} name="창" tag="대표" color="#7A5A3A" face={null} />

          {/* 팀장 */}
          {leaders.map((l, i) => {
            const seat = l.location === "approvalTable" ? Math.max(0, office.approvals.findIndex((a) => a.leaderId === l.id)) : i;
            const [x, y] = spot(l.character, l.location, seat);
            return (
              <Person
                key={l.id}
                x={x}
                y={y}
                name={l.name}
                tag={`${l.name} 팀장`}
                color={l.color}
                face={faceUrl(office.manifest, l.character)}
                status={l.status}
                bubble={l.status !== "idle" && !meeting ? l.bubble : undefined}
                selected={selected === l.id}
                onClick={() => onSelect(l.id)}
                ariaLabel={`${l.name} 팀장 선택`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

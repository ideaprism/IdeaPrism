// 가구·소품 (PRD 8.3): 책상·모니터·의자, 도서관 스탠딩 테이블, 회의 테이블 8석 + 대형 화면, 탕비실, 대표실
import { Billboard, Box, Flat, Wall } from "./primitives";
import { APPROVAL, DESK, MEETING, ZONES } from "./layout";

const WOOD = "#D9B68C";
const WOOD_DARK = "#B98E5E";
const CHAIR = "#6B7384";

export function Desk({ fx, fy, color }: { fx: number; fy: number; color: string }) {
  // 인물은 (fx,fy) 에 서서 시청자를 본다. 책상은 그 앞(큰 y), 의자는 뒤.
  return (
    <>
      <Box x={fx - 16} y={fy - 34} w={32} d={26} h={22} top={CHAIR} radius={8} />
      <Box x={fx - 72} y={fy + 10} w={144} d={50} h={30} top={WOOD} />
      <Box x={fx - 22} y={fy + 16} w={44} d={6} h={30} top="#2F3440" side="#1F232C" front="#3A4050" />
      <Box x={fx - 4} y={fy + 20} w={8} d={10} h={6} top="#8A8F9C" />
      <Flat x={fx + 30} y={fy + 24} w={28} h={18} style={{ background: color, opacity: 0.35, borderRadius: 3 }} />
    </>
  );
}

export function Plant({ x, y, size = 36 }: { x: number; y: number; size?: number }) {
  return (
    <Billboard x={x} y={y} w={size} h={size * 1.5} className="plant">
      <div className="leaves" />
      <div className="pot" />
    </Billboard>
  );
}

export function Floors() {
  return (
    <>
      <Flat x={0} y={0} w={1200} h={738} className="floor-base" />
      {ZONES.map((z) => (
        <Flat key={z.key} x={z.x} y={z.y} w={z.w} h={z.h} className={`zone-floor ${z.floor}`}>
          <span className="zone-label">{z.label}</span>
        </Flat>
      ))}
      {ZONES.filter((z) => z.rug).map((z) => (
        <Flat key={z.key + "-rug"} x={z.x + 18} y={z.y + 70} w={z.w - 36} h={z.h - 90} className="rug" style={{ background: z.rug }} />
      ))}
    </>
  );
}

export function SeatDesks() {
  const colors: Record<string, string> = { hash: "#E5663B", zino: "#12A26A", muse: "#E5663B", captain: "#3E63DD", fl: "#7C4DFF", ben: "#3E63DD" };
  return (
    <>
      {Object.entries(DESK).map(([k, [x, y]]) => (
        <Desk key={k} fx={x} fy={y} color={colors[k]} />
      ))}
      <Plant x={230} y={120} />
      <Plant x={230} y={380} />
      <Plant x={230} y={650} />
    </>
  );
}

export function Library() {
  return (
    <>
      <Flat x={575} y={62} w={210} h={34} className="rug dark-rug" />
      <Box x={585} y={118} w={190} d={24} h={48} top="#8A6B4E" side="#5E4634" front="#705640" radius={10} />
      <Box x={560} y={44} w={240} d={14} h={60} top="#5B4636" side="#3E2F25" front="#4A3A2E" radius={2}>
        <i className="books" />
      </Box>
      <Billboard x={680} y={56} w={120} h={22} className="sign" shadow={false}>
        LLM wiki 도서관
      </Billboard>
    </>
  );
}

export function MeetingArea({ meeting }: { meeting: boolean }) {
  return (
    <>
      <Box x={590} y={228} w={190} d={74} h={30} top={WOOD} radius={16} />
      {MEETING.map(([x, y], i) => (
        <Box key={i} x={x - 14} y={y - 12} w={28} d={24} h={20} top={CHAIR} radius={8} />
      ))}
      <Billboard x={685} y={172} w={200} h={64} className="bigscreen" shadow={false}>
        <div className="screen-face">{meeting ? "주간 업무 회의" : "IDEAPRISM Weekly"}</div>
        <div className="screen-foot" />
      </Billboard>
    </>
  );
}

export function Lounge() {
  return (
    <>
      <Box x={840} y={30} w={330} d={44} h={42} top="#EDE4D6" side="#C9BBA6" front="#DACDB8" />
      <Box x={860} y={36} w={34} d={28} h={26} top="#44484F" side="#2E3136" front="#383C43" radius={6} title="커피머신" />
      <Box x={910} y={40} w={18} d={18} h={14} top="#F0F0F0" radius={9} />
      <Box x={936} y={40} w={18} d={18} h={14} top="#F0F0F0" radius={9} />
      <Box x={1140} y={28} w={50} d={44} h={74} top="#E9EDF2" side="#B9C2CE" front="#D6DDE6" radius={6} title="냉장고" />
      <Box x={850} y={330} w={130} d={48} h={30} top="#9FB8C9" side="#6E8697" front="#86A0B2" radius={12} title="소파" />
      <Box x={1000} y={340} w={70} d={44} h={22} top={WOOD} radius={10} />
      <Plant x={1180} y={120} size={42} />
      <Plant x={835} y={400} size={34} />
      <Plant x={1180} y={400} size={34} />
    </>
  );
}

export function CeoRoom({ deco, music }: { deco: Record<string, boolean>; music: boolean }) {
  const on = (k: string) => deco[k] !== false;
  return (
    <>
      {/* 유리벽: 앞(복도 쪽 y=430) — 문 개방부 x 560~640, 옆(x=550) */}
      <Wall x={640} y={430} len={560} h={70} axis="x" />
      <Wall x={550} y={430} len={10} h={70} axis="x" />
      <Wall x={550} y={430} len={308} h={70} axis="y" />
      {/* 왼쪽: 원형 결재·응접 테이블 + 의자 4 */}
      <Box x={648} y={548} w={92} d={72} h={30} top={WOOD} radius="50%" />
      {APPROVAL.map(([x, y], i) => (
        <Box key={i} x={x - 14} y={y - 10} w={28} d={24} h={20} top={CHAIR} radius={8} />
      ))}
      {/* 가운데: 플랜터 칸막이 */}
      <Box x={845} y={460} w={18} d={250} h={28} top="#7BA37A" side="#4F6E4E" front="#5F845E" radius={4} />
      {on("plants") && (
        <>
          <Plant x={854} y={480} size={30} />
          <Plant x={854} y={560} size={30} />
          <Plant x={854} y={640} size={30} />
          <Plant x={854} y={705} size={30} />
        </>
      )}
      {/* 오른쪽: 대표석 */}
      <Box x={1100} y={442} w={90} d={26} h={56} top="#8A6B4E" side="#5E4634" front="#705640" title="레코드장">
        <i className="records" />
      </Box>
      {on("neon") && (
        <Billboard x={960} y={468} w={120} h={40} className="neon" shadow={false}>
          IDEA!
        </Billboard>
      )}
      {on("lamp") && (
        <Billboard x={1180} y={530} w={28} h={96} className="lamp" shadow={false}>
          <div className="lamp-head" />
          <div className="lamp-pole" />
        </Billboard>
      )}
      <Box x={999} y={502} w={32} d={26} h={24} top="#4B3B2F" side="#2F241C" front="#3B2E24" radius={8} />
      <Box x={940} y={560} w={150} d={56} h={32} top={WOOD_DARK} side="#8E6A42" front="#A47A4E" />
      <Box x={995} y={566} w={46} d={6} h={32} top="#2F3440" side="#1F232C" front="#3A4050" />
      {on("speakers") && (
        <>
          <Box x={905} y={566} w={22} d={22} h={40} top="#7C5B3E" side="#56402B" front="#664B33" radius={3} title="우드 스피커">
            {music && <i className="note">♪</i>}
          </Box>
          <Box x={1100} y={566} w={22} d={22} h={40} top="#7C5B3E" side="#56402B" front="#664B33" radius={3} title="우드 스피커">
            {music && <i className="note">♫</i>}
          </Box>
        </>
      )}
      {on("turntable") && (
        <Box x={1050} y={568} w={34} d={30} h={34} top="#D9D2C7" side="#A69D90" front="#BFB6A8" radius={3} title="턴테이블">
          <i className={`disc ${music ? "spin" : ""}`} />
        </Box>
      )}
      <Box x={880} y={660} w={60} d={50} h={30} top="#C96E4F" side="#8F4C35" front="#A95C41" radius={14} title="라운지 체어" />
    </>
  );
}

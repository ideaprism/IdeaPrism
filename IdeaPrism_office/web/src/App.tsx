import { useEffect, useState } from "react";
import { useOffice } from "./api";
import { TopBar } from "./components/TopBar";
import { Office2D } from "./components/Office2D";
import { Office3D } from "./components/scene/Office3D";
import { TeamCards } from "./components/TeamCards";
import { Board } from "./components/Board";
import { LeaderPanel } from "./components/LeaderPanel";
import { AdminPage } from "./components/AdminPage";

const VIEW_KEY = "office.view";

export function App() {
  const office = useOffice();
  const [selected, setSelected] = useState<string>("");
  const [admin, setAdmin] = useState(false);
  const [focusChat, setFocusChat] = useState(0);
  // 3D 가 깨지면 2D 평면도로 (PRD 15 리스크 대응). 선택은 이 브라우저에만 저장.
  const [view3d, setView3d] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) !== "2d";
    } catch {
      return true;
    }
  });
  const toggleView = () => {
    setView3d((v) => {
      try {
        localStorage.setItem(VIEW_KEY, v ? "2d" : "3d");
      } catch {
        /* 저장 못 해도 동작에는 영향 없음 */
      }
      return !v;
    });
  };

  useEffect(() => {
    if (!selected && office.order.length) setSelected(office.order[0]);
  }, [office.order, selected]);

  const current = office.states[selected];

  /** 결재함 클릭: 가장 오래된 결재의 팀장 선택 + 대화 탭 (PRD 8.2) */
  const openApprovals = () => {
    const oldest = office.approvals[0];
    if (oldest) setSelected(oldest.leaderId);
    setAdmin(false);
    setFocusChat((n) => n + 1);
  };

  return (
    <div className="app">
      <TopBar office={office} onAdmin={() => setAdmin((v) => !v)} adminOpen={admin} onApprovals={openApprovals} />
      {admin ? (
        <div className="main" style={{ gridTemplateColumns: "1fr" }}>
          <AdminPage onClose={() => setAdmin(false)} />
        </div>
      ) : (
        <div className="main">
          <div className="left">
            {view3d ? (
              <Office3D office={office} selected={selected} onSelect={setSelected} onToggleView={toggleView} />
            ) : (
              <Office2D office={office} selected={selected} onSelect={setSelected} onToggleView={toggleView} />
            )}
            <TeamCards office={office} selected={selected} onSelect={setSelected} />
            <Board office={office} />
          </div>
          {current ? <LeaderPanel office={office} leader={current} focusChat={focusChat} /> : <div className="panel side" />}
        </div>
      )}
    </div>
  );
}

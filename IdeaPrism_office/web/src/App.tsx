import { useEffect, useState } from "react";
import { useOffice } from "./api";
import { TopBar } from "./components/TopBar";
import { Office2D } from "./components/Office2D";
import { TeamCards } from "./components/TeamCards";
import { Board } from "./components/Board";
import { LeaderPanel } from "./components/LeaderPanel";
import { AdminPage } from "./components/AdminPage";

export function App() {
  const office = useOffice();
  const [selected, setSelected] = useState<string>("");
  const [admin, setAdmin] = useState(false);
  const [focusChat, setFocusChat] = useState(0);

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
            <Office2D office={office} selected={selected} onSelect={setSelected} />
            <TeamCards office={office} selected={selected} onSelect={setSelected} />
            <Board office={office} />
          </div>
          {current ? <LeaderPanel office={office} leader={current} focusChat={focusChat} /> : <div className="panel side" />}
        </div>
      )}
    </div>
  );
}

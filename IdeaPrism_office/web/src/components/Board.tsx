// M2: 보드는 현재 상태에서 계산한 임시 표시. M3에서 board/tasks.json 으로 교체.
import type { OfficeData } from "../api";

export function Board({ office }: { office: OfficeData }) {
  const leaders = office.order.map((id) => office.states[id]).filter(Boolean);
  const doing = leaders.filter((l) => l.currentJobTitle).map((l) => `${l.name} · ${l.currentJobTitle}`);
  const todo = leaders.filter((l) => l.queued > 0).map((l) => `${l.name} · 대기 ${l.queued}건`);
  const done = leaders
    .flatMap((l) =>
      (office.transcripts[l.id] ?? [])
        .filter((e) => e.role === "result" && e.ok)
        .slice(-2)
        .map((e) => ({ at: e.at, text: `${l.name} · ${titleFor(office, l.id, e.jobId)}` })),
    )
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 2)
    .map((x) => x.text);
  return (
    <section className="panel board" aria-label="업무 보드">
      <Col title="대기" items={todo} />
      <Col title="진행" items={doing} />
      <Col title="완료" items={done} />
    </section>
  );
}

function titleFor(office: OfficeData, leaderId: string, jobId?: string): string {
  const u = (office.transcripts[leaderId] ?? []).find((e) => e.role === "user" && e.jobId === jobId);
  return (u?.text ?? "").split(/\r?\n/)[0].slice(0, 40) || "업무";
}

function Col({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="col">
      <b>
        {title} {items.length ? `(${items.length})` : ""}
      </b>
      {items.length ? items.slice(0, 2).map((t, i) => <div key={i} className="item">{t}</div>) : <div className="empty">없음</div>}
    </div>
  );
}

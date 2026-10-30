// 업무 보드 (PRD 8.5): board/tasks.json 을 서버가 기록하고 여기서는 보여만 준다. 칸마다 최근 2건.
import type { OfficeData, Task } from "../api";

export function Board({ office }: { office: OfficeData }) {
  const name = (t: Task) => office.states[t.leaderId]?.name ?? t.team;
  const pick = (statuses: Task["status"][]) =>
    office.tasks
      .filter((t) => statuses.includes(t.status))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((t) => ({ id: t.id, text: `${name(t)} · ${t.title}`, bad: t.status === "blocked", outputs: t.outputs }));
  const todo = pick(["todo"]);
  const doing = pick(["doing"]);
  const done = pick(["done", "blocked"]);
  return (
    <section className="panel board" aria-label="업무 보드">
      <Col title="대기" items={todo} />
      <Col title="진행" items={doing} />
      <Col title="완료" items={done} />
    </section>
  );
}

function Col({ title, items }: { title: string; items: { id: string; text: string; bad: boolean; outputs: string[] }[] }) {
  return (
    <div className="col">
      <b>
        {title} {items.length ? `(${items.length})` : ""}
      </b>
      {items.length ? (
        items.slice(0, 2).map((t) => (
          <div key={t.id} className="item" title={t.outputs.length ? `산출물: ${t.outputs.join(", ")}` : t.id} style={t.bad ? { color: "#e53935" } : undefined}>
            {t.bad ? "⚠ " : ""}
            {t.text}
          </div>
        ))
      ) : (
        <div className="empty">없음</div>
      )}
    </div>
  );
}

// 서버 API + WebSocket 훅
import { useEffect, useRef, useState } from "react";

export type Status = "idle" | "thinking" | "research" | "typing" | "running" | "approval" | "done" | "error" | "meeting";
export type Location = "desk" | "library" | "approvalTable" | "lounge" | "meeting";

export interface LeaderState {
  id: string;
  name: string;
  role: string;
  team: string;
  teamLabel: string;
  color: string;
  character: string;
  status: Status;
  location: Location;
  bubble: string;
  currentJobId: string | null;
  currentJobTitle: string | null;
  queued: number;
  lastTool: string | null;
  lastToolAt: string | null;
  sessionId: string | null;
  statusSince: string;
}

export interface TranscriptEntry {
  id: string;
  at: string;
  leaderId: string;
  jobId?: string;
  role: "user" | "leader" | "tool" | "result" | "system";
  text?: string;
  tool?: string;
  target?: string;
  ok?: boolean;
}

export interface Manifest {
  characters: Record<string, { name: string; face: string; base: string; states: Partial<Record<Status, string>> }>;
}

export const STATUS_LABEL: Record<Status, string> = {
  idle: "휴식",
  thinking: "생각 중",
  research: "자료 조사",
  typing: "작성 중",
  running: "실행 중",
  approval: "결재 대기",
  done: "완료",
  error: "문제 발생",
  meeting: "회의 중",
};

export const STATUS_COLOR: Record<Status, string> = {
  idle: "#9AA3B2",
  thinking: "#8B5CF6",
  research: "#2F80ED",
  typing: "#F2994A",
  running: "#27AE60",
  approval: "#EB5757",
  done: "#12A26A",
  error: "#E53935",
  meeting: "#6B4EFF",
};

export const LOCATION_LABEL: Record<Location, string> = {
  desk: "자리",
  library: "도서관",
  approvalTable: "대표실",
  lounge: "탕비실",
  meeting: "회의석",
};

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export interface OfficeData {
  connected: boolean;
  pc: string;
  deadline: { label: string; date: string } | null;
  states: Record<string, LeaderState>;
  order: string[];
  transcripts: Record<string, TranscriptEntry[]>;
  manifest: Manifest | null;
}

/** WebSocket 으로 상태·대화를 받는다. 끊기면 2초마다 재접속. */
export function useOffice(): OfficeData {
  const [data, setData] = useState<OfficeData>({
    connected: false,
    pc: "",
    deadline: null,
    states: {},
    order: [],
    transcripts: {},
    manifest: null,
  });
  const retry = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetch("/assets/manifest.json")
      .then((r) => r.json())
      .then((manifest: Manifest) => setData((d) => ({ ...d, manifest })))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setData((d) => ({ ...d, connected: true }));
      ws.onclose = () => {
        setData((d) => ({ ...d, connected: false }));
        if (!closed) retry.current = window.setTimeout(connect, 2000);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown> & { kind: string };
        setData((d) => {
          if (msg.kind === "hello" || msg.kind === "config_saved") {
            const leaders = msg.leaders as LeaderState[];
            const states = Object.fromEntries(leaders.map((l) => [l.id, l]));
            const transcripts = (msg.transcripts as Record<string, TranscriptEntry[]>) ?? d.transcripts;
            return {
              ...d,
              pc: (msg.pc as string) ?? d.pc,
              deadline: (msg.deadline as OfficeData["deadline"]) ?? d.deadline,
              states,
              order: leaders.map((l) => l.id),
              transcripts,
            };
          }
          if (msg.kind === "state") {
            const s = msg.state as LeaderState;
            const order = d.order.includes(s.id) ? d.order : [...d.order, s.id];
            return { ...d, states: { ...d.states, [s.id]: s }, order };
          }
          if (msg.kind === "transcript") {
            const e = msg.entry as TranscriptEntry;
            const list = [...(d.transcripts[e.leaderId] ?? []), e].slice(-400);
            return { ...d, transcripts: { ...d.transcripts, [e.leaderId]: list } };
          }
          return d;
        });
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry.current);
      ws?.close();
    };
  }, []);

  return data;
}

export function expressionUrl(manifest: Manifest | null, character: string, status: Status): string | null {
  const c = manifest?.characters[character];
  if (!c) return null;
  const key = c.states[status] ?? c.base;
  return key ? `/assets/${character}/${key}.webp` : null;
}

export function faceUrl(manifest: Manifest | null, character: string): string | null {
  const c = manifest?.characters[character];
  return c ? `/assets/${c.face}` : null;
}

export function elapsed(since: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000));
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

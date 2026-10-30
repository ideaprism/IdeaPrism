// PRD 8.3 좌표 (평면도 1200×738)
import type { Location } from "../../api";

export const FLOOR_W = 1200;
export const FLOOR_H = 738;

export interface Zone {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: "wood" | "dark" | "beige" | "ceo";
  rug?: string;
}

export const ZONES: Zone[] = [
  { key: "hash", label: "해시석", x: 0, y: 0, w: 178, h: 210, floor: "wood", rug: "#F3C9B1" },
  { key: "zino", label: "지노석", x: 282, y: 0, w: 178, h: 210, floor: "wood", rug: "#BFE6D2" },
  { key: "muse", label: "뮤즈석", x: 0, y: 263, w: 178, h: 210, floor: "wood", rug: "#F3C9B1" },
  { key: "captain", label: "캡틴석", x: 282, y: 263, w: 178, h: 210, floor: "wood", rug: "#C7D3F5" },
  { key: "fl", label: "프리랜서 공유석", x: 0, y: 527, w: 178, h: 211, floor: "wood", rug: "#DCCBF2" },
  { key: "ben", label: "벤석", x: 282, y: 527, w: 178, h: 211, floor: "wood", rug: "#C7D3F5" },
  { key: "library", label: "LLM wiki 도서관", x: 560, y: 40, w: 240, h: 110, floor: "dark" },
  { key: "meeting", label: "전 직원 회의", x: 570, y: 180, w: 230, h: 170, floor: "beige" },
  { key: "lounge", label: "탕비실 · 라운지", x: 820, y: 0, w: 380, h: 417, floor: "wood" },
  { key: "ceo", label: "대표실", x: 550, y: 430, w: 650, h: 308, floor: "ceo" },
];

export const DESK: Record<string, [number, number]> = {
  hash: [88, 142],
  zino: [370, 142],
  muse: [88, 405],
  captain: [370, 405],
  fl: [88, 669],
  ben: [370, 669],
};
export const LIBRARY: Record<string, [number, number]> = { captain: [612, 112], hash: [682, 112], zino: [752, 112] };
export const MEETING: [number, number][] = [
  [620, 206],
  [685, 206],
  [750, 206],
  [620, 323],
  [685, 323],
  [750, 323],
  [568, 266],
  [806, 266],
];
export const APPROVAL: [number, number][] = [
  [631, 535],
  [757, 535],
  [631, 639],
  [757, 639],
];
export const LOUNGE: [number, number] = [1012, 300];
export const CEO_SEAT: [number, number] = [1015, 536];

/** 위치 → 발 좌표. idx 는 결재석(도착 순)·회의석·탕비실 나열 순서 */
export function spot(character: string, location: Location, idx: number): [number, number] {
  switch (location) {
    case "library":
      return LIBRARY[character] ?? [682, 112];
    case "approvalTable":
      return APPROVAL[idx % APPROVAL.length];
    case "lounge":
      return [LOUNGE[0] + (idx - 1) * 64, LOUNGE[1]];
    case "meeting":
      return MEETING[idx % MEETING.length];
    default:
      return DESK[character] ?? [370, 405];
  }
}

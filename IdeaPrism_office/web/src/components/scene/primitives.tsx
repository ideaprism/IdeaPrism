// CSS 3D 기본 요소 (PRD 8.3). 좌표계: 평면도 1200×738 px, 바닥은 rotateX(52deg).
// - Box: 상자형 가구 (윗면·앞면·좌우면)
// - Flat: 바닥에 붙는 면 (러그, 그림자)
// - Billboard: 카메라를 향해 서 있는 면 (인물, 식물, 간판) = rotateX(-52deg)
// - Wall: 바닥에 수직인 면 (유리벽)
import type { CSSProperties, ReactNode } from "react";

export const TILT = 52;

export interface BoxProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  top: string;
  side?: string;
  front?: string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  title?: string;
}

export function Box({ x, y, w, d, h, top, side, front, radius = 4, className = "", style, children, title }: BoxProps) {
  const sideColor = side ?? shade(top, -0.22);
  const frontColor = front ?? shade(top, -0.12);
  return (
    <div className={`b3 ${className}`} title={title} style={{ left: x, top: y, width: w, height: d, transform: `translateZ(${h}px)`, ...style }}>
      <i className="b3-top" style={{ background: top, borderRadius: radius }} />
      <i className="b3-front" style={{ height: h, background: frontColor }} />
      <i className="b3-left" style={{ width: h, background: sideColor }} />
      <i className="b3-right" style={{ width: h, background: sideColor }} />
      {children}
    </div>
  );
}

export function Flat({ x, y, w, h, className = "", style, children }: { x: number; y: number; w: number; h: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`flat ${className}`} style={{ left: x, top: y, width: w, height: h, ...style }}>
      {children}
    </div>
  );
}

/** 발 위치 (x,y) 에 서 있는 빌보드. w·h 는 화면상 크기 */
export function Billboard({ x, y, w, h, className = "", style, children, shadow = true }: { x: number; y: number; w: number; h: number; className?: string; style?: CSSProperties; children?: ReactNode; shadow?: boolean }) {
  return (
    <div className={`bb ${className}`} style={{ left: x - w / 2, top: y - h, width: w, height: h, ...style }}>
      {shadow && <i className="bb-shadow" style={{ width: w * 0.7, height: w * 0.28 }} />}
      <div className="bb-face">{children}</div>
    </div>
  );
}

/** 유리벽: axis x = 가로로 놓인 벽 (x..x+len, y 고정), axis y = 세로로 놓인 벽 (y..y+len, x 고정) */
export function Wall({ x, y, len, h, axis, className = "" }: { x: number; y: number; len: number; h: number; axis: "x" | "y"; className?: string }) {
  if (axis === "x") return <div className={`wall wall-x ${className}`} style={{ left: x, top: y - h, width: len, height: h }} />;
  return <div className={`wall wall-y ${className}`} style={{ left: x, top: y, width: h, height: len }} />;
}

/** hex 색 밝기 조절 (-1 ~ 1) */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

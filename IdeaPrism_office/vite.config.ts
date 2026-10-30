import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발: `npm run dev` (vite, 5173) → /api·/ws·/assets 는 서버(3000)로 프록시
// 배포: `npm run build` → web/dist 를 서버가 그대로 서빙
export default defineConfig({
  root: "web",
  plugins: [react()],
  // 번들은 /static/ 에 둔다 (/assets/ 는 캐릭터 이미지 경로와 겹치므로)
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "static" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/assets": "http://127.0.0.1:3000",
      "/ws": { target: "ws://127.0.0.1:3000", ws: true },
    },
  },
});

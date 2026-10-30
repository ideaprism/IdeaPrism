// 에셋 변환: team_avengers 원본(1024×1024 JPEG, 확장자 .png) → assets/<인물>/*.webp
// 사용: node scripts/build-assets.mjs [원본 images 폴더]
// manifest.json의 states/base에 적힌 키만 변환한다. 얼굴은 base 이미지의 머리 부분을 정사각으로 잘라 200px.
import sharp from "sharp";
import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(here, "..", "assets");
const srcDir =
  process.argv[2] ??
  "C:/Users/user/Documents/Playground/team_avengers_resize_work/images";

const manifest = JSON.parse(await readFile(path.join(assetsDir, "manifest.json"), "utf8"));

// 원본은 인물이 가로 가운데에 있고 머리가 위쪽에 있다 (정사각·가로 이미지 혼재).
// 짧은 변의 47%를 한 변으로 하는 정사각을 가로 중앙, 위에서 5% 지점에 잡아 얼굴로 쓴다.
async function faceCrop(file) {
  const { width, height } = await sharp(file).metadata();
  const side = Math.round(Math.min(width, height) * 0.47);
  return { left: Math.round((width - side) / 2), top: Math.round(height * 0.05), width: side, height: side };
}

const rows = [];
for (const [id, c] of Object.entries(manifest.characters)) {
  const outDir = path.join(assetsDir, id);
  await mkdir(outDir, { recursive: true });
  const keys = new Set([c.base, ...Object.values(c.states)]);
  for (const key of keys) {
    const src = path.join(srcDir, id, `${key}.png`);
    try {
      await stat(src);
    } catch {
      rows.push({ 인물: id, 키: key, 결과: "원본 없음" });
      continue;
    }
    await sharp(src)
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, `${key}.webp`));
    rows.push({ 인물: id, 키: key, 결과: "표정 720" });
  }
  const base = path.join(srcDir, id, `${c.base}.png`);
  try {
    await sharp(base).extract(await faceCrop(base)).resize(200, 200).webp({ quality: 85 }).toFile(path.join(outDir, "face.webp"));
    rows.push({ 인물: id, 키: "face", 결과: "얼굴 200" });
  } catch (e) {
    rows.push({ 인물: id, 키: "face", 결과: `실패: ${e.message}` });
  }
}
console.table(rows);

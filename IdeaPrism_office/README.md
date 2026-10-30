# IDEAPRISM Office

AI 팀장 봇(Claude Code)들이 일하는 모습을 보며 지시·결재·검토하는 **로컬 전용** 대시보드. 근거 문서: [docs/261030_오피스_PRD_v1.0.md](docs/261030_오피스_PRD_v1.0.md), 계획: [261030_오피스_작업계획_v1.md](261030_오피스_작업계획_v1.md).

## 실행

```bash
npm install
npm run office -- --pc 회사
```

집 PC는 `office.config.집.json`을 만든 뒤 `--pc 집`. 서버는 `127.0.0.1:3000`에만 열린다.

## 설정 파일

| 파일 | 내용 | git |
|---|---|---|
| `office.config.<PC>.json` | 레포 루트, wiki 경로, 코드 레포, port, 마감일 (PC마다 다름) | 추적 |
| `office.teams.json` | 팀장 ↔ 팀 폴더 ↔ leader.md ↔ 수신함 ↔ 추가 접근 폴더 | 추적 |
| `office.permissions.json` | 결재 기본값 (자동 허용 도구·경로, Bash 허용 명령) | 추적 |
| `.local/sessions.<PC>.json` | 팀장별 Claude 세션 ID (다음 지시 때 재개) | 제외 |
| `.local/logs/YYYYMMDD.jsonl` | 지시·도구·결재 기록 | 제외 |

`npm run office`는 화면(web/)을 먼저 빌드한 뒤 서버를 띄운다. 브라우저에서 `http://127.0.0.1:3000` 을 연다. 화면 개발 중에는 `npm run serve`(서버) + `npm run dev`(Vite, 5173)를 따로 띄운다.

## 화면 (M2)

| 영역 | 내용 |
|---|---|
| 상단 바 | 연결 상태, D-day, 결재함(M3), 시각, ⚙ 관리자 |
| 사무실 (2D) | PRD 8.3 구역 평면도. 팀장이 상태에 따라 자리·도서관·탕비실로 이동 (3D 연출은 M4) |
| 팀 상태 카드 | 상태 알약, 현재 업무, 위치·마지막 도구·경과 |
| 업무 보드 | 대기/진행/완료 (M3에서 board/tasks.json 으로 교체) |
| 오른쪽 패널 | 상태별 표정 이미지, 대화(사용자·팀장·도구·결과), 입력창(Enter 전송, 한글 조합 중 무시), 중단 |
| 관리자 | 저장소(git status·pull) · 경로(존재 확인·폴더 만들기) · 팀장 매칭(줄 추가·삭제) · 권한(M3) |

## API

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/health` | PC·루트·마감·팀장 상태 |
| GET | `/api/leaders` | 팀장 상태 목록 (PRD 9.1 + 표시 정보) |
| GET | `/api/leaders/:id/transcript` | 대화 기록 (`.local/transcripts/<id>.jsonl`) |
| POST | `/api/leaders/:id/instruct` | `{ "text": "..." }` 지시. 실행 중이면 대기열 |
| POST | `/api/leaders/:id/interrupt` | 실행 중단 |
| POST | `/api/leaders/:id/reset-session` | 세션 버리고 새로 시작 |
| GET / PUT | `/api/config/config` `teams` `permissions` | 설정 읽기·저장 (저장 후 경로 검증, 다음 실행부터 반영) |
| POST | `/api/config/mkdir` | `{ "key": "wikiRaw" }` 설정에 적힌 경로만 폴더 생성 |
| GET | `/api/git/status` | 브랜치·마지막 커밋·변경 수 |
| POST | `/api/git/pull` | `git pull --ff-only` (push는 하지 않음) |
| WS | `/ws` | 접속 시 `hello`(상태·대화 전체). 이후 `state`(상태·위치) `transcript`(대화 한 줄) 와 원시 이벤트 `start` `init` `text` `tool_use` `tool_result` `approval_needed` `result` `error` |

상태 매핑(PRD 7.2): Read/Glob/Grep → `research`(wiki 경로면 도서관으로 이동 후 `libraryVisitSeconds` 뒤 복귀), WebSearch/WebFetch → `research`, Write/Edit → `typing`, Bash → `running`, 결과 → `done`(10초 뒤 `idle`·탕비실), 오류 → `error`.

## 구조

```
server/
  index.ts         HTTP + WebSocket (127.0.0.1)
  config.ts        설정 3파일 로더·검증·저장
  leaderRunner.ts  팀장 1명 = Agent SDK 세션 1개 (대기열, 재개, 중단, 권한 콜백)
  local.ts         .local/ 세션·로그
  gitApi.ts        git status / pull
scripts/build-assets.mjs   team_avengers 이미지 → assets/*.webp
assets/manifest.json       상태 → 표정 이미지 키
```

팀장은 `teams/<팀>/.claude/agents/leader.md` 본문을 메인 세션의 시스템 프롬프트에 붙여 실행한다(서브에이전트가 아님). frontmatter의 `tools`가 허용 도구가 된다.

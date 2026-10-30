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
| 사무실 (3D, M4) | PRD 8.3 공유오피스. 바닥 `rotateX(52deg)` + `perspective 1700px`, 가구는 상자형(윗면·앞면·좌우면), 인물·식물은 빌보드 + 바닥 그림자. 팀장이 상태에 따라 자리·도서관·결재 테이블(도착 순)·탕비실로 1.6초 이동. 대표실: 원형 결재 테이블, 플랜터 칸막이, 대표석(책상·모니터·스피커·턴테이블·플로어 조명·네온·레코드장·라운지 체어), 유리벽(문 개방부). "2D 평면도" 버튼으로 전환 가능(브라우저에 기억) |
| 팀 상태 카드 | 상태 알약, 현재 업무, 위치·마지막 도구·경과 |
| 업무 보드 | `board/tasks.json` 의 대기/진행/완료(차단 포함). 서버만 기록: 지시 시 todo → 실행 doing → 결과 done / 오류 blocked, 성공한 Write/Edit 경로를 outputs 에 누적 |
| 오른쪽 패널 | 상태별 표정 이미지, 대화(사용자·팀장·도구·결과·**결재 카드**), 입력창(Enter 전송, 한글 조합 중 무시), 중단, 새 세션 |
| 결재 (M3) | 자동 허용이 아닌 도구 요청 → 팀장이 대표실 결재 테이블로 이동 → 결재함 배지 +1 → 대화 탭 카드에서 승인/반려 → 승인이면 실행, 반려면 팀장에게 "대표가 반려함, 대안으로 진행" 전달. 기록은 `.local/approvals.log` |
| 관리자 | 저장소(git status·pull) · 경로(존재 확인·폴더 만들기) · 팀장 매칭(줄 추가·삭제) · 권한(자동 허용 도구·경로, Bash 허용·항상 결재 명령) |

권한 기본값(PRD 10.2, `office.permissions.json`): Read·Glob·Grep·WebSearch·WebFetch 자동 허용. Write/Edit 는 자기 팀 `work/`·`wiki/raw/`만 자동, 그 밖(handoff·meetings·팀 밖)은 결재. Bash 는 `npm test` `npm run lint` `git status` `git diff` 만 자동, `git push`·삭제는 항상 결재. 팀장을 중단하면 대기 중인 결재는 반려 처리된다.

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
| GET | `/api/approvals` | 대기 중인 결재 (요청 순) |
| POST | `/api/approvals/:id/decide` | `{ "decision": "approve" \| "reject" }` |
| GET | `/api/tasks` | 업무 보드 전체 |
| GET | `/api/git/status` | 브랜치·마지막 커밋·변경 수 |
| POST | `/api/git/pull` | `git pull --ff-only` (push는 하지 않음) |
| WS | `/ws` | 접속 시 `hello`(상태·대화·결재·보드 전체). 이후 `state`(상태·위치) `transcript`(대화 한 줄) `approval_requested`/`approval_decided`(대기 목록 포함) `tasks`(보드 전체) 와 원시 이벤트 `start` `init` `text` `tool_use` `tool_result` `result` `error` |

상태 매핑(PRD 7.2): Read/Glob/Grep → `research`(wiki 경로면 도서관으로 이동 후 `libraryVisitSeconds` 뒤 복귀), WebSearch/WebFetch → `research`, Write/Edit → `typing`, Bash → `running`, 결과 → `done`(10초 뒤 `idle`·탕비실), 오류 → `error`.

## 구조

```
server/
  index.ts         HTTP + WebSocket (127.0.0.1)
  config.ts        설정 3파일 로더·검증·저장
  leaderRunner.ts  팀장 1명 = Agent SDK 세션 1개 (대기열, 재개, 중단, 상태 매핑, 권한 콜백→결재)
  approvals.ts     ApprovalQueue (결재 대기열, .local/approvals.log)
  tasks.ts         TaskBoard (board/tasks.json)
  local.ts         .local/ 세션·대화 기록·로그
  gitApi.ts        git status / pull
web/src/components/scene/
  primitives.tsx   Box(상자)·Flat(바닥면)·Billboard(빌보드)·Wall(유리벽)
  layout.ts        PRD 8.3 좌표(구역·자리·도서관·회의석·결재석·탕비실·대표석)
  Furniture.tsx    책상·도서관·회의 테이블·탕비실·대표실 소품
  Person.tsx       인물(얼굴·팀색 링·캡슐 몸·이름표·상태 점·말풍선)
  Office3D.tsx     씬 조립, 영역에 맞춰 크기 조절
scripts/build-assets.mjs   team_avengers 이미지 → assets/*.webp
assets/manifest.json       상태 → 표정 이미지 키
```

팀장은 `teams/<팀>/.claude/agents/leader.md` 본문을 메인 세션의 시스템 프롬프트에 붙여 실행한다(서브에이전트가 아님). frontmatter의 `tools`가 허용 도구가 된다.

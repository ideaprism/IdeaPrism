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

## API (M1)

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/health` | PC·루트·마감·팀장 상태 |
| GET | `/api/leaders` | 팀장 목록 (상태, cwd, 세션, 대기열) |
| POST | `/api/leaders/:id/instruct` | `{ "text": "..." }` 지시. 실행 중이면 대기열 |
| POST | `/api/leaders/:id/interrupt` | 실행 중단 |
| POST | `/api/leaders/:id/reset-session` | 세션 버리고 새로 시작 |
| GET / PUT | `/api/config/config` `teams` `permissions` | 설정 읽기·저장 (저장 후 경로 검증, 다음 실행부터 반영) |
| GET | `/api/git/status` | 브랜치·마지막 커밋·변경 수 |
| POST | `/api/git/pull` | `git pull --ff-only` (push는 하지 않음) |
| WS | `/ws` | 이벤트 스트림: `queued` `start` `init` `text` `tool_use` `tool_result` `approval_needed` `result` `error` |

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

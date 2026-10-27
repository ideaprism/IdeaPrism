# Log

2026-10-26 [회사] 셋업: 폴더 체계와 CLAUDE.md 생성
2026-10-26 [회사] 수집: 모두의창업 사이트에서 1기·2기 지원서, 1·2차 심사의견을 raw/2610/에 저장 (사이트에 멘토링 내역 메뉴 없음). 다음: 이메일 사업관리 자료 raw 투입 후 Ingest
2026-10-26 [회사] 수집: 모두의창업 재도전 멘토링 답변 3건(김*신·정지호·이후경)을 raw/2610/에 저장 (전화번호 삭제). 정정: 앞서 "사이트에 멘토링 메뉴 없음"이라고 적었으나 /online-mentoring에 있음 (심사의견 파일 비고는 수정 안 함). 만료된 4건(도현명·하진수·손종배×2)은 답변 없음
2026-10-26 [회사] 확인: 사용자가 추가한 사업안내자료 4건(안내책자 pdf, 제출매뉴얼 pdf, 1R 활동보고서·사업계획서 hwp 양식)을 raw/2610/에서 확인. 빈 양식이며 개인정보 없음. 파일명은 명명규칙과 다르나 raw는 수정하지 않음
2026-10-26 [회사] Ingest: raw/2610 전체(10건)로 wiki 8페이지 생성(모두의창업_일정, 모두의창업_1R지원규정, 모두의창업_제출양식, 지원서_변천, 멘토링_피드백, 사업모델_수치근거, 현장검증, 창업자_역량), 개발현황 갱신, index 갱신. 모순 표시: 경력 27년/26년, DB 1.4만/1.45만/1.5만, 원자료 3만5천/3만여, 가격 연 30~50만(멘토)/1,000~1,500만(2기). 다음: 10.27 서약서 제출, 외부 수치 원출처 raw 확보, 9월 이후 학교 진행상황 자료 투입
2026-10-27 [회사] 분석: ideaprism_sdg2를 ideaprism_revise/에 클론(상위 .gitignore 제외 처리), 코드·라이브 전수 확인 후 dev/261027_ideaprism_revise_개선계획_v1.md 작성. 핵심 원인: 검색 created_at 정렬+공백 AND, 특허검색식 연산자 제거 후 자유어 전송, 챗봇 로직은 레포 밖 Edge Function, ESLint 설정 깨져 실행 불가. 다음: .env.local 준비(Vercel 키), Phase 0~1 착수, D1~D6 결정
2026-10-27 [회사] 개발: ideaprism_sdg2에 Phase 0~2 브랜치 3개 푸시 (chore/phase0-tooling: ESLint 복구·배포문서·회귀스크립트 / feat/phase1-meta-legal: 메타·방침·약관·404·robots·sitemap·Vercel Analytics / fix/phase2-search-relevance: 관련도 정렬·2단어 이상 0건 버그·문장검색·필터 주입 방지·faceted count, 테스트 14건). 프로덕션 기준선: 우산 첫요청 504·1위 훌라후프, 급식 잔반 0건. GitHub 커넥터 권한 없어 PR은 수동 생성 필요(dev/261027_PR설명_phase0-2_v1.md). 다음: PR 생성, site.ts 운영자 정보 입력, Vercel Analytics 활성화, 미리보기 URL로 회귀 테스트, .env.local 준비
2026-10-27 [회사] 개발: 로컬 전용 방식으로 전환(새 브랜치 푸시 안 함). Phase 3(특허검색식: 검색식 해석→실제 질의 일치, IPC 단어 오염 제거, 실제 조회 표시, KIPRIS 실측 스크립트), Phase 4(RLS 읽기전용 점검 SQL·익명 접근 점검 스크립트) 완료, local/integration에 Phase 0~4 병합. 테스트 22건·빌드 통과. .env.local 키가 자리표시라 DB·KIPRIS 실측 못 함. 다음: 키 입력 후 회귀 테스트·KIPRIS 실측·RLS 점검, 챗봇 결정(D2)
2026-10-27 [회사] 개발: 챗봇 5-A 결정 반영. feat/phase5-hide-chat — 챗봇 화면·/api/chat 기본 꺼짐(CHAT_ENABLED=true로 켬), local/integration 병합, 테스트 22건·빌드 통과, 로컬에서 버튼 미표시·API 404 확인. 다음: .env.local 키 입력 후 실측 3종
2026-10-27 [회사] 실측: .env.local 키로 로컬 확인. 검색 회귀 상위5 관련도 개선(우산 2→5, 자전거 1→5, 의자 2→5, 분리수거 3→5, 비오는날 0건→4/5, 급식잔반 0건→2/5 DB한계). 동의어 묶음·'비 오는'→빗물·하나만 빠진 조합 조회 추가. KIPRIS가 *·+·IPC=[ ] 해석함을 실측 → 검색식 그대로 전송 기본화, Expert 0건→28건. RLS 점검 결과 access_codes·partner_organizations·bot_settings 익명 읽기 가능 → 잠금 마이그레이션 작성(SQL Editor 실행 필요). 다음: 마이그레이션 실행, 응답 슬림화, 운영자 정보
2026-10-27 [회사] 보안: 비공개 테이블 잠금 마이그레이션을 사용자가 Supabase SQL Editor에서 실행. 재점검 결과 access_codes·partner_organizations·partnership_inquiries·bot_settings 익명 접근 401 차단, 공개 테이블 정상, 프로덕션 홈·검색 정상
2026-10-27 [회사] 개발: 응답 슬림화(2-4) 완료. 검색 응답 약 75% 감소(자전거 431→100KB, 비오는날 850→176KB), 상세는 모달에서 /api/inventions/[id] 단건 조회, DB 첫 조회 시간초과 1회 자동 재시도. 브라우저에서 모달 기본·상세 탭 정상 확인. 다음: 운영자 정보·Footer 연락처, main 반영 방식 결정

# AGENTS.md — ClassQuiz AI 에이전트 인수인계 가이드

이 문서는 다른 AI 코딩 에이전트(Claude Code, Codex, Cursor, Arena 등)나 개발자가 **ClassQuiz** 프로젝트를 즉시 이어받아 일관성 있게 작업할 수 있도록 정리한 기준 문서입니다. 작업 시작 전 `README.md`, `CHANGELOG.md`와 함께 반드시 확인하세요.

---

## 1. 프로젝트 개요 및 운영 배포 환경

- **프로젝트**: 중학교 **2학년 1반 ~ 12반(학급당 정원 35명, 최대 동시 420명)** 실시간 학급별 독립 진행 인터랙티브 퀴즈 플랫폼
- **저장소**: `https://github.com/BraveKoon/Kim-Mi-Young-s-Quiz`
  - 기본(운영) 브랜치: `arena/c5bccda0-kim-mi-young-s-quiz`
  - 현재 최신 릴리즈: **`v1.5.0`** (`CHANGELOG.md` 및 GitHub Releases 참조)
- **프론트엔드 운영 배포 (Cloudflare Workers Static Assets)**
  - 주소: `https://classquiz.bravekoon.workers.dev`
  - 설정 파일: `wrangler.jsonc` (`name: "classquiz"`, `assets.directory: "./client/dist"`, `not_found_handling: "single-page-application"`)
  - 빌드/배포 명령: `npm ci && npm run build -w client` → `npx wrangler deploy`
  - 빌드 환경 변수: `VITE_API_URL=https://quiz-api-yye7.onrender.com`
- **백엔드 운영 배포 (Render Web Service)**
  - 주소: `https://quiz-api-yye7.onrender.com`
  - 헬스체크 경로: `GET /api/health` 및 `GET /` (UptimeRobot 슬립 방지 연동 가능)
  - 필수 환경 변수: `CLIENT_ORIGIN=https://classquiz.bravekoon.workers.dev`, `TRUST_PROXY=1`, `JWT_SECRET`, `DATABASE_PATH`
- **GitHub Pages 배포 관련 주의**: `.github/workflows/deploy-pages.yml`은 사용자 요청에 따라 푸시 자동 배포를 해제하고 수동(`workflow_dispatch`) 전용으로 두었습니다. 임의로 `push` 트리거를 다시 켜지 마세요.

---

## 2. 기술 스택 및 아키텍처 원칙 (임의 변경 금지)

- **모노레포 구조**: npm workspaces (`client/`, `server/`, 공용 타입·상수·소켓 이벤트 `shared/types/index.ts` → `@shared`)
- **백엔드**: Node.js 22, Express 5, TypeScript 7, Socket.io 4, `better-sqlite3`(WAL 모드), Zod 4, JWT, bcrypt, ExcelJS, tsx, esbuild
- **프론트엔드**: React 19, Vite 8, Tailwind CSS 4, Framer Motion, Recharts, lucide-react, socket.io-client, axios, React Router 7
- **절대 원칙**:
  - 기존 코드를 통째로 삭제하거나 처음부터 다시 만들지 말 것.
  - 외부 BaaS(Firebase, Supabase 등) 도입 금지. 기본 UI/안내 언어는 **한국어**.
  - 모든 점수 계산·정답 판정·타이머 마감은 **서버 기준**으로만 처리.
  - 서버는 인메모리 타이머·접속 상태를 가지므로 **단일 프로세스** 전제(클러스터 모드 금지).
  - 학교 동일 공인 IP(NAT)에서 최대 420명이 동시 접속하므로 IP 기반 Rate Limit 수치를 낮추지 말 것.

---

## 3. UI / 디자인 시스템 & 핵심 UX 규칙

1. **번지는 빛 효과 금지 ("깔끔·심플하게")**
   - 네온 글로우(neon glow), 번지는 블러 광원(blurry light blobs / glowing halos) 절대 사용 금지.
   - 선명한 테두리, 담백한 그림자, 높은 텍스트 대비 중심의 깔끔한 카드 디자인을 유지하세요.
2. **밝은 교실(Daylight Classroom) 테마 전 화면 통일**
   - 배경 톤: 파스텔 하늘빛·아이보리 도트 그리드(`#EFF7FF` → `#FCFBF6` → `#FAF6EC`)
   - 포인트 컬러: 블루(`#2563EB`), 틸(`#14B8A6`), 코랄(`#FB7185`), 레몬(`#FACC15`)
   - 공통 브랜드 요소: 말풍선 `<Logo />` (`client/src/components/common/Logo.tsx`) 및 상단 4색 스트립 `<ClassroomAccentStrip />`
   - 모바일·태블릿 터치 친화 크기 유지 및 가로 스크롤 넘침(horizontal overflow, `min-w-0` / `break-words`) 방지.
3. **반드시 유지해야 할 사용자 흐름**
   - **학생 초기 화면 (`/`, `HomePage.tsx`)**: **학년 · 반 · 번호 · 이름** 선택/입력 시 `formatStudentNickname`으로 `20101 홍길동` 형식의 닉네임을 자동 생성해 해당 학급 방으로 즉시 입장. 하단 `선생님(관리자) 로그인` 링크 유지.
   - **관리자 로그인 (`/admin`, `AdminLoginPage.tsx`)**: 하단 `홈으로`(`/` 이동) 버튼 유지. 초기 계정(`admin` / `1234`) 또는 신규 발급 보조 교사 계정은 첫 로그인 시 비밀번호 변경 강제.
   - **교실 프로젝터 (`/projector/:classId`, `ProjectorPage.tsx`)**:
     - 외부 이미지 API 없이 동작하는 자체 SVG QR 코드(`client/src/utils/qrcode.ts`, `QrCode.tsx`)로 반 참가 QR 표시 + 크게 보기 모달 + 진행 중 상단 `참가 QR` 버튼 제공.
     - 프로젝터 화면 하단 **선생님 진행 컨트롤 도크**(`퀴즈 시작`, `일시정지/재개`, `결과 발표`, `건너뛰기`, `다음 문제`/`최종 순위 발표`, `종료`, `초기화`) 및 화면 이탈 없는 인라인 **선생님 진행 모드 로그인 모달** 제공.

---

## 4. 현재 구현 완료 기능 요약 (`v1.0.0` ~ `v1.5.0`)

- **3종 문제 유형**: 4지선다(`MULTIPLE_CHOICE`), O/X(`OX`), 단답형(`SHORT_ANSWER` — 최대 5개 복수 인정 답안, NFC·공백·영문 대소문자 정규화 채점, 결과 공개 전 정답 비노출)
- **문제 일괄 등록 & 기본 프리셋**: `POST /api/questions/bulk` 단일 트랜잭션 일괄 등록 API + 중학교 2학년 고사성어·사자성어 30문항 검수 프리셋(`IDIOM_QUIZ_30`)
- **학급별 독립 실시간 제어**: `admin:start_quiz`, `admin:pause_quiz`, `admin:resume_quiz`, `admin:show_results`, `admin:next_question`, `admin:skip_question`(`QUESTION_SKIPPED` 로그 기록), `admin:finish_quiz`, `admin:reset_session`
- **관리자 대시보드 13개 탭**: 대시보드, 학급 관리, 학생 관리, 문제 관리, 문제 세트 관리, 퀴즈 진행 관리, 개인 순위, 학급 순위, 문항별 통계, 활동 로그, 대회 이력, 결과 내보내기(UTF-8 BOM CSV / XLSX), 설정(다중 관리자 계정 추가·삭제 포함)

---

## 5. 주요 경로 및 작업 시 주의사항 (실수 방지)

- **Tailwind CSS 4 문법**: `client/src/index.css`에서 `@utility` 문법을 사용합니다 (`@layer components` + `@apply` 조합은 Tailwind v4에서 오류 발생).
- **Cloudflare SPA 라우팅 충돌 주의**: `client/public/_redirects`에 `/* /index.html 200` 규칙을 넣지 마세요. `wrangler.jsonc`의 `"not_found_handling": "single-page-application"`과 충돌해 Cloudflare 배포 시 `[code: 100324]` 에러가 발생합니다.
- **정확한 파일 위치 및 테스트 연동 Export 유지**:
  - 공용 타입·이벤트: `shared/types/index.ts`
  - DB 마이그레이션: `server/src/database/migrations/{001_initial,002_short_answer,index}.ts` (`schema.ts` 파일 없음)
  - 리더보드 서비스: `server/src/services/leaderboardService.ts` (`server/src/quiz/` 하위 아님)
  - 순위 섹션 파일명: `client/src/components/dashboard/sections/RankingSections.tsx` (`IndividualRankingSection`, `ClassRankingSection`)
  - 설정 섹션(`SettingsSection.tsx`): 단위 테스트(`client/tests/adminSections.test.tsx`)가 직접 import하는 `ChangePasswordForm`, `AdminAccountsCard`, `SettingsSection` export를 유지하세요.
  - 로그 섹션(`LogsSection.tsx`): `EVENT_LABEL` export를 유지하세요 (`LOG_EVENT_TYPES` 추가 시 함께 갱신).
  - 단독 렌더링 테스트 호환: `ProjectorPage`처럼 `<AdminAuthProvider>` 밖에서 단위 테스트될 수 있는 컴포넌트에서는 `useAdminAuth()` 대신 `useOptionalAdminAuth()`를 사용하세요.
- **Git 보안 및 프로세스 관리**:
  - `.env` 및 `server/data/*.sqlite*` 파일은 절대 커밋하지 마세요 (로컬/프리뷰 테스트 시 `DATABASE_PATH=/tmp/classquiz-dev.sqlite` 권장).
  - 개발 서버 종료 시 `pkill -f "tsx src/index.ts"` 대신 반드시 **PID 기준**으로 종료하세요.

---

## 6. 검증 명령어 및 릴리즈(SemVer) 규칙

### 작업 전·후 필수 검증
```bash
npm install          # 샌드박스 등 오프라인 환경에서 native 모듈 빌드 시: npm_config_nodedir=/usr/local npm ci
npm run typecheck
npm test             # 서버 50개 + 클라이언트 24개 = 총 74개 테스트 통과 기준
npm run build
```
- 서버 동작 변경 시 `server/tests/`, 주요 프론트 동작 변경 시 `client/tests/`에 테스트를 함께 추가하세요.
- 기능 변경 시 `README.md`의 기능 설명 및 `남은 작업 / 알려진 한계` 섹션을 실제 상태에 맞게 업데이트하세요.

### 버전 관리 및 GitHub Release 규칙 (현재 최신: `v1.5.0`)
기능을 추가하거나 수정해 배포할 때마다 아래 **시맨틱 버저닝(SemVer)** 기준에 맞춰 **`CHANGELOG.md` 업데이트 + GitHub Release(`gh release create`)** 를 함께 발행합니다.

- **패치 (`x.x.n` — 예: `v1.5.1`, `v1.5.2`)**: 자잘한 기능 보완, UI/문구 다듬기, 버그 수정
- **마이너 (`x.n.0` — 예: `v1.6.0`, `v1.7.0`)**: 의미 있는 새 기능 추가, 진행 흐름·기능에 변화가 생기는 업데이트 *(끝자리 `0`으로 초기화)*
- **메이저 (`n.0.0` — 예: `v2.0.0`)**: 아키텍처·데이터 모델 개편 등 대규모 메이저 업데이트 *(하위 버전 `0.0`으로 초기화)*

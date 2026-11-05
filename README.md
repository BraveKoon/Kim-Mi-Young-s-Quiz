# ClassQuiz — 자체 서버 기반 실시간 학급 퀴즈 플랫폼

중학교 2학년 1반~12반(학급당 최대 35명, 전체 420명)이 **학급별로 독립된 퀴즈 세션**을 실시간으로 진행하는 Kahoot/퀴즈앤 스타일의 게이미피케이션 퀴즈 웹 애플리케이션입니다.

- 외부 BaaS(Firebase, Supabase 등)를 **사용하지 않습니다.** 모든 데이터·실시간 통신은 자체 Node.js 서버(Express + Socket.io)와 로컬 SQLite 파일로 처리합니다.
- 점수·정답 판정·타이머 마감은 모두 **서버 기준**으로 계산합니다. 클라이언트가 보낸 점수/정답 여부/응답 시간은 무시합니다.

---

## 목차

1. [주요 기능](#주요-기능)
2. [기술 스택](#기술-스택)
3. [폴더 구조](#폴더-구조)
4. [설치 및 실행](#설치-및-실행)
5. [데이터베이스 초기화·백업·복구](#데이터베이스-초기화백업복구)
6. [관리자 계정과 비밀번호 변경](#관리자-계정과-비밀번호-변경)
7. [환경 변수](#환경-변수)
8. [배포 (프론트엔드 / 백엔드)](#배포)
9. [서버 운영 방법](#서버-운영-방법)
10. [테스트](#테스트)
11. [부하 테스트 결과와 한계](#부하-테스트-결과와-한계)
12. [보안 주의사항](#보안-주의사항)
13. [아키텍처 상세](#아키텍처-상세)
14. [남은 작업 / 알려진 한계](#남은-작업--알려진-한계)

---

## 주요 기능

| 영역 | 내용 |
| --- | --- |
| 학급 로비 `/` | 12개 학급 카드(접속 인원, 참가/정원, 퀴즈 상태, 입장 가능 여부) — 5초마다 갱신 |
| 학생 화면 `/2-1` ~ `/2-12` | 닉네임 입장 → 대기실 → 문제/타이머/4지선다·O/X 보기(▲◆●■) 및 단답형 직접 입력 → 제출 완료 애니메이션 → 정답·해설·순위 변화 → 최종 시상대 + 폭죽. 잘못된 학급 ID는 404 |
| 2배 점수 | 문제 시작 전 2초간 `⚡ DOUBLE POINTS x2! ⚡` 네온 배너 (서버도 2초 리드인을 두어 공정하게 시작) |
| 재접속 | 새로고침·네트워크 끊김 후 현재 문제, 남은 시간, 제출 여부(단답형 입력값 포함), 누적 점수, 순위 복구. 같은 학생이 다른 창에서 접속하면 **새 연결이 기존 연결을 대체** |
| 관리자 `/admin` | 대시보드, 학급 관리, 학생 관리, 문제 관리(4지선다·O/X·단답형), 문제 세트 관리, 퀴즈 진행 관리, 개인 순위, 학급 순위, 문항별 통계, 활동 로그, 대회 이력, 결과 내보내기, 설정(관리자 계정 추가·삭제 포함) (13개 메뉴) |
| 학급별 독립 제어 | 시작 / 일시정지 / 재개 / 결과 공개 / 다음 문제 / 종료 / 초기화 — 한 학급의 조작은 다른 학급에 영향 없음 |
| 실시간 접속 현황 | 학급별 접속/정원, 전체 접속(예: 95/420), 참가·미접속·완료 인원, 평균 점수, 진행 상태 |
| 프로젝터 `/projector/2-1` | 전체 화면, 큰 글씨, 접속 주소 안내, 현재 문제·타이머·제출 인원, 보기별 선택 분포 차트, 순위, 1~3위 시상대 + 폭죽. 이름 공개 방식(전체/마스킹 `김*수`/비공개)을 서버에서 적용. 대시보드의 **프로젝터 열기**로 열면 비밀번호 없이 진행 바(시작·일시정지·결과 발표·건너뛰기·다음·종료·초기화)가 열림(학급 전용 임시 키, 키 없이 연 주소는 보기 전용) |
| 대회 발표 `/projector/competition/:id` | 학급 순위 ↔ 전교 개인 순위 자동 전환 화면 |
| 결과 `/results/:competitionId` | 대회 결과(관리자는 전체, 그 외에는 공개 설정이 적용된 상위 10명) |
| 문항별 통계 | 정답률(응답자 기준 / 전체 참가자 기준 구분), 보기별 선택 인원, 평균 응답 시간·점수, 가장 어려운/쉬운 문제, 학급별 정답률, 클릭 시 상세 분석 |
| 활동 로그 | 중복 제출, 시간 초과 제출, 종료 후 제출, 권한 없는 관리자 이벤트, 잘못된 Room 접근, 요청 과다, 접속/재접속/연결 종료, 관리자 작업, 초기화, 내보내기 — 날짜·학급·이벤트·참가자·수준 필터, CSV 다운로드, 실시간 갱신 |
| 대회 이력 | 대회별 참가 학급·문제 세트·개인/학급 순위·문항 통계 보존, 대회 간 비교(평균 점수, 참가율, 학급별 변화, 개인별 변화) |
| 공정성 표시 | 같은 대회에서 학급마다 다른 문제 세트가 사용되면 "전교 순위는 공정한 비교가 아닐 수 있음" 경고 |
| 결과 내보내기 | CSV(UTF-8 BOM, 엑셀 한글 호환, 수식 주입 방지) / XLSX(시트: 대회 정보·개인 순위·학급 순위·문항별 통계·접속 기록) 스트리밍 생성, 서버 저장 및 내보내기 기록 |

### 점수 계산 (서버)

```
elapsedSec = (서버 수신 시각 - 서버 문제 시작 시각) / 1000
정답:   Math.round(1000 * (1 - elapsedSec / (timeLimit * 2)))   → 최대 1000, 제한시간 직전 약 500
2배:    위 점수 × 2 (최대 2000)
오답/시간 초과: 0
```

답안 제출 시 서버 검증 순서: 참가자 인증 → 세션 일치 → 진행 중(PLAYING) 여부 → 현재 문제 ID → 보기 인덱스 → 시작 전 여부 → 제한시간(+ 네트워크 보정 `ANSWER_GRACE_MS`, 기본 0.5초) → 중복 제출 → 서버 채점 → **답안 저장과 점수 반영을 하나의 트랜잭션으로 처리**. `UNIQUE(participant_id, question_id)` 제약으로 네트워크 재전송 시에도 점수가 중복 반영되지 않습니다.

---

## 기술 스택

- **Frontend**: React 19, Vite 8, TypeScript, Tailwind CSS 4, Framer Motion, Lucide React, Socket.io-client, Axios, React Router 7, canvas-confetti, Recharts
- **Backend**: Node.js 22, Express 5, TypeScript, Socket.io 4, JWT(jsonwebtoken), bcrypt, Zod, helmet, express-rate-limit, ExcelJS
- **Database**: SQLite (better-sqlite3) — WAL 모드, 외래 키, 인덱스, 트랜잭션, 마이그레이션, SQL Repository 계층
- **Test / CI**: Vitest + Supertest + socket.io-client (서버), Vitest + Testing Library + jsdom (프론트엔드), Playwright (브라우저 E2E), 자체 부하 테스트 도구, GitHub Actions CI/Pages

---

## 폴더 구조

```
classquiz/
├── .github/workflows/         # GitHub Actions CI 및 GitHub Pages 배포 워크플로
├── client/                    # React 프론트엔드 (정적 호스팅 가능)
│   ├── public/
│   ├── tests/                 # 컴포넌트·훅·유틸 단위 테스트 (Vitest + Testing Library)
│   └── src/
│       ├── components/{common,quiz,leaderboard,dashboard,charts}
│       ├── pages/             # HomePage, ClassPage, AdminLoginPage, AdminDashboard,
│       │                      # ProjectorPage, ResultsPage, NotFoundPage
│       ├── hooks/             # useStudentQuiz, useCountdown, useApi ...
│       ├── contexts/          # AdminAuth, AdminSocket, Toast
│       ├── services/api.ts    # Axios
│       ├── socket/            # Socket.io-client
│       ├── types/ utils/
│       ├── App.tsx  main.tsx
├── server/                    # Node.js 백엔드
│   ├── src/
│   │   ├── config/            # 환경 변수
│   │   ├── database/
│   │   │   ├── connection.ts  # SQLite 연결 + PRAGMA
│   │   │   ├── migrations/    # 버전별 스키마
│   │   │   ├── seeds/         # 관리자·12개 학급·기본 문제(고사성어 30문항)·기본 세션
│   │   │   └── repositories/  # SQL 데이터 접근 계층 (DB 교체 시 이곳만 변경)
│   │   ├── middleware/        # auth, validation(Zod), errorHandler, rateLimit
│   │   ├── routes/ controllers/ services/
│   │   ├── socket/            # index(인증·브로드캐스트), adminHandlers, studentHandlers, roomManager
│   │   ├── quiz/              # scoring, timer, sessionManager(상태 머신)
│   │   ├── analytics/ security/ utils/
│   │   ├── app.ts server.ts index.ts
│   ├── tests/                 # 기능·보안·복구 테스트
│   ├── scripts/               # loadtest, resetDb, backupDb
│   ├── data/                  # SQLite 파일 (Git 제외)
│   └── .env.example
├── shared/types/              # 서버·클라이언트 공용 타입/상수/이벤트 이름
├── e2e/scenario.mjs           # Playwright 브라우저 시나리오
├── package.json               # npm workspaces + 통합 스크립트
└── README.md
```

---

## 설치 및 실행

요구 사항: **Node.js 20 이상**(22 권장), npm 10 이상. `better-sqlite3`, `bcrypt`는 대부분의 OS에서 미리 빌드된 바이너리가 설치됩니다.

```bash
git clone <저장소 주소> classquiz
cd classquiz
npm install
cp server/.env.example server/.env      # 필요 시 값 수정
npm run dev                              # 백엔드(3000) + 프론트엔드(5173) 동시 실행
```

- 브라우저에서 `http://localhost:5173` 접속 → 학급 선택
- 관리자: `http://localhost:5173/admin` (최초 `admin` / `1234` → 즉시 비밀번호 변경 화면)
- 개별 실행: `npm run dev:server`, `npm run dev:client`
- 개발 서버는 Vite 프록시로 `/api`, `/socket.io` 를 백엔드로 전달합니다. 같은 교실 Wi‑Fi의 학생 기기로 테스트하려면 `http://<PC의 IP>:5173` 으로 접속하세요 (`host: true` 설정).

### 운영 빌드

```bash
npm run build          # server/dist/index.js + client/dist (404.html 포함)
NODE_ENV=production JWT_SECRET=<32자 이상 임의값> npm start
```

한 대의 서버에서 프론트엔드까지 제공하려면 `SERVE_CLIENT_DIST=../client/dist` 를 지정합니다(SPA 라우팅 지원).

---

## 데이터베이스 초기화·백업·복구

서버를 처음 실행하면 자동으로 다음을 수행합니다(이미 있으면 건너뜀 — 멱등).

1. DB 파일 확인/생성 (`DATABASE_PATH`, 기본 `server/data/classquiz.sqlite`)
2. 마이그레이션 실행 (`schema_migrations` 테이블로 버전 관리)
3. 기본 관리자 계정 생성 (bcrypt 해시)
4. 2학년 1반~12반 학급 생성
5. 기본 문제 30개(중2 고사성어·사자성어: 4지선다 18 + O/X 6 + 단답형 6, 2배 점수 5문항) + 문제 세트 생성
   - 이전 버전(샘플 5문항)을 쓰던 DB는 서버 시작 시 한 번만 샘플 문제·세트를 제거하고 기본 문제로 교체하며, 대기 중인 학급 세션은 새 세트로 옮깁니다. 이미 진행한 세션의 기록은 그대로 유지됩니다.
6. "기본 대회" 및 학급별 대기(WAITING) 세션 생성

서버를 재시작해도 학생 점수, 문제, 대회 이력은 유지되며, **진행 중이던 문제는 DB의 시작/종료 시각을 기준으로 복구**됩니다(이미 시간이 지났으면 자동 마감 후 결과 상태).

| 작업 | 명령 |
| --- | --- |
| 온라인 백업 (서버 실행 중 가능) | `npm run db:backup -w server` → `server/data/backups/classquiz-<시각>.sqlite` (무결성 검사 포함) |
| 지정 경로로 백업 | `npm run db:backup -w server -- /backup/classquiz.sqlite` |
| 개발용 초기화 | `npm run db:reset -w server -- --yes` (기존 파일은 `data/backups/`로 이동, 운영 환경에서는 실행 거부) |
| 복구 | 서버 중지 → 백업 파일을 `DATABASE_PATH` 위치로 복사(기존 `-wal`, `-shm` 파일 삭제) → 서버 시작 |

정기 백업 예시(cron, 매시 정각): `0 * * * * cd /srv/classquiz && npm run db:backup -w server`

---

## 관리자 계정과 비밀번호 변경

- 최초 계정: `admin` / `1234` — **개발 및 최초 설정용**입니다.
- 기본 계정은 `must_change_password` 상태로 생성되어, 로그인 직후 비밀번호 변경 화면만 사용할 수 있습니다. 서버도 변경 전에는 관리자 API·소켓을 `403 PASSWORD_CHANGE_REQUIRED` 로 차단합니다.
- 새 비밀번호: 8자 이상, `1234`·아이디와 동일한 값 금지. 변경 시 기존 토큰은 모두 무효화되고 새 토큰이 발급됩니다.
- 이후 변경: 관리자 대시보드 → **설정** → 관리자 비밀번호 변경
- **관리자 계정 추가·삭제**: 관리자 대시보드 → **설정** → **관리자 계정 관리**에서 보조 교사 등 추가 관리자를 등록하거나 삭제할 수 있습니다. 새로 추가한 계정도 첫 로그인 시 비밀번호 변경이 강제되며, 마지막 남은 관리자 계정과 현재 로그인 중인 본인 계정은 삭제할 수 없습니다(계정 삭제 시 기존 로그인 토큰·소켓 연결은 즉시 무효화됨).
- 운영 환경에서는 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 환경 변수로 초기 계정을 지정하세요(계정이 하나도 없을 때만 적용).
- 비밀번호를 잊은 경우: 서버를 중지하고 `sqlite3 data/classquiz.sqlite "DELETE FROM admins;"` 실행 후 서버를 재시작하면 환경 변수 값으로 초기 계정이 다시 생성됩니다(다른 데이터는 유지).

---

## 환경 변수

`server/.env.example` 을 `server/.env` 로 복사해서 사용합니다.

| 변수 | 기본값 | 설명 | 운영 시 |
| --- | --- | --- | --- |
| `PORT` | `3000` | 서버 포트 | |
| `NODE_ENV` | `development` | `production` 이면 보안 검사 강화 | **필수 변경** |
| `JWT_SECRET` | (개발용) | JWT 서명 키. 운영에서 32자 미만·기본값이면 서버가 시작을 거부 | **필수 변경** (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `8h` | 관리자 토큰 만료 | |
| `DATABASE_PATH` | `./data/classquiz.sqlite` | SQLite 파일 경로 | 백업 대상 디스크 권장 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS 허용 출처(쉼표 구분) | **필수 변경** |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `1234` | 최초 관리자 | **필수 변경** |
| `ADMIN_FORCE_PASSWORD_CHANGE` | `true` | 최초 로그인 시 비밀번호 변경 강제 | `true` 유지 |
| `PARTICIPANT_TOKEN_TTL_HOURS` | `12` | 학생 재접속 토큰 유효 시간 | |
| `ANSWER_GRACE_MS` | `500` | 제한시간 이후 네트워크 지연 보정(점수는 제한시간 기준으로 계산) | |
| `TRUST_PROXY` | `0` | nginx 등 리버스 프록시 뒤라면 `1` (정확한 IP 기반 속도 제한) | 프록시 사용 시 `1` |
| `SERVE_CLIENT_DIST` | (비활성) | 프론트엔드 빌드 폴더를 같은 서버에서 제공 | |
| `API_RATE_LIMIT_PER_MINUTE` | `3000` | IP당 분당 API 요청 수 | 학교 NAT 고려 |
| `JOIN_RATE_LIMIT_PER_MINUTE` | `600` | IP당 분당 입장 요청 수 | 학교 NAT 고려 |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | `10` | IP당 분당 관리자 로그인 시도 | |

> 학교에서는 전교생이 하나의 공인 IP(NAT)를 공유하는 경우가 많습니다. IP 기준 속도 제한은 학생 수를 고려해 넉넉히 두었고, 실시간 이벤트는 **소켓 연결 단위**로 별도 제한합니다.

프론트엔드 환경 변수(`client/.env.example`):

| 변수 | 설명 |
| --- | --- |
| `VITE_API_URL` | 백엔드 주소 (예: `https://quiz-api.school.kr`). 같은 도메인에서 제공하면 비워 둠 |
| `VITE_BASE_PATH` | 하위 경로 배포 시 (예: GitHub Pages 프로젝트 페이지 `/Kim-Mi-Young-s-Quiz/`) |
| `VITE_DEV_BACKEND` | 개발 서버 프록시 대상 (기본 `http://localhost:3000`) |

---

## 배포

### 방법 A — 한 대의 서버에서 모두 제공 (권장)

```bash
npm ci && npm run build
cd server
NODE_ENV=production JWT_SECRET=... CLIENT_ORIGIN=https://quiz.school.kr \
SERVE_CLIENT_DIST=../client/dist TRUST_PROXY=1 node dist/index.js
```

nginx(HTTPS 종료 + WebSocket 프록시) 예시:

```nginx
server {
  listen 443 ssl http2;
  server_name quiz.school.kr;
  ssl_certificate     /etc/letsencrypt/live/quiz.school.kr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/quiz.school.kr/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;     # Socket.io WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
}
```

### 방법 B — 프론트엔드: 정적 호스팅(GitHub Pages 등), 백엔드: VPS

GitHub Pages는 **정적 파일만** 제공합니다. REST API와 Socket.io 서버는 반드시 별도의 Node.js 실행 환경(VPS, 학교 서버 등)에 배포해야 합니다.

- **GitHub Actions 자동 배포(`.github/workflows/deploy-pages.yml`)**:
  1. GitHub 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
  2. **Settings → Secrets and variables → Actions → Variables**에 `VITE_API_URL`(예: `https://quiz-api.school.kr`)과 필요 시 `VITE_BASE_PATH`(기본값 `/<저장소명>/`)를 등록하면 브랜치 푸시 시 자동으로 빌드·배포됩니다(`Actions` 탭에서 **`Deploy Frontend to GitHub Pages`** 워크플로 수동 실행 `workflow_dispatch`도 가능 — 이전 레거시 기록인 `pages build and deployment`를 재실행하면 루트 `README.md`가 덮어써지므로 실행하지 마세요).

```bash
# 수동 빌드 시
cd client
VITE_API_URL=https://quiz-api.school.kr VITE_BASE_PATH=/Kim-Mi-Young-s-Quiz/ npm run build
# client/dist 를 gh-pages 브랜치 등에 업로드 (404.html 이 자동 생성되어 /2-1 같은 주소도 동작)

# 백엔드 (CORS 허용 출처에 Pages 주소 추가)
CLIENT_ORIGIN=https://<계정>.github.io NODE_ENV=production JWT_SECRET=... node server/dist/index.js
```

---

## 서버 운영 방법

- **프로세스 관리**: systemd 또는 pm2로 실행하고 자동 재시작을 설정합니다. 서버는 `SIGTERM`/`SIGINT` 수신 시 연결을 정리하고 WAL 체크포인트 후 종료합니다.

  ```ini
  # /etc/systemd/system/classquiz.service
  [Service]
  WorkingDirectory=/srv/classquiz/server
  EnvironmentFile=/srv/classquiz/server/.env
  ExecStart=/usr/bin/node dist/index.js
  Restart=always
  User=classquiz
  ```

- **단일 프로세스로 실행**하세요(pm2 cluster 모드 사용 금지). 학급 타이머와 접속 현황은 프로세스 메모리에 있고, SQLite는 단일 쓰기 프로세스에 최적화되어 있습니다. 420명 규모는 단일 프로세스로 충분합니다(아래 부하 테스트 참조).
- **수업 중 서버 재시작**: 진행 중인 문제는 DB 기준으로 복구되고 학생 화면은 자동 재연결됩니다. 재시작 중 지난 시간만큼 남은 시간이 줄어듭니다.
- **헬스 체크**: `GET /api/health`
- **로그**: 비정상 상황은 관리자 대시보드 → 활동 로그. 서버 콘솔에는 warning 이상만 출력되며 비밀번호·토큰은 기록하지 않습니다.
- **새 학기/새 대회**: 대시보드 → 대회 이력 → 새 대회(문제 세트·참가 학급 선택). 이전 대회 기록은 그대로 보존됩니다.
- **운영 순서 예시**: 문제 관리(단건 또는 JSON 일괄 등록) → 문제 세트 구성 → 대회 생성(학급 배정) → 교실 프로젝터에서 `/projector/2-1` 열기 → 학생 QR 스캔·입장 → 프로젝터 하단 진행 바(또는 퀴즈 진행 관리)에서 시작/결과 발표/건너뛰기/다음 문제 → 종료 → 문항별 통계·결과 내보내기.

---

## 테스트

```bash
npm test                 # 서버(50개) + 프론트엔드(24개) 자동 테스트 (Vitest, 총 74개)
npm run typecheck        # 서버·클라이언트(테스트 포함) 타입 검사
```

| 구분 | 검증 항목 |
| --- | --- |
| 기능 | 시드(12학급·5문항·bcrypt), 관리자 로그인·계정 추가/삭제(마지막 관리자·본인 삭제 방지, 첫 로그인 비밀번호 변경 강제), 문제 생성/수정/삭제(4지선다·O/X·단답형), 문제 세트 CRUD, 학생 입장, 닉네임 중복(공백 정규화 포함), **동시 45명 입장 시 정확히 35명만 허용**, 퀴즈 시작, 답안 제출, 서버 채점(1000/500/2배·단답형 대소문자/공백 정규화), 순위 계산(동점 처리), 결과 공개, 다음 문제, 최종 순위, 통계(응답자/전체 정답률), 대회 이력, CSV(BOM)·XLSX(시트 구성) 내보내기 |
| 보안 | 학생의 관리자 API/이벤트 차단 및 로그, 위조·만료·`alg=none`·삭제된 계정 JWT 차단, 로그아웃·비밀번호 변경 후 토큰 무효화, 다른 학급 Room/참가자/순위 접근 차단, 잘못된 participantId·토큰 차단, 중복 답안 차단, 제한시간 초과 차단, **클라이언트 점수 조작 무시**, 단답형 진행 중 인정 답안 비노출, XSS 닉네임 거부, SQL Injection 형태 입력 무해화, 소켓 이벤트 속도 제한, 초기화·삭제 확인 문구 |
| 안정성 | 일시정지/재개 시 남은 시간 보존, 새로고침·중복 접속(기존 연결 교체) 후 상태 복구, 진행 중 점수 비노출, **서버 재시작 후 세션·타이머 복구**, 학급 간 이벤트 격리, 공정성 경고 |
| 프론트엔드 | `TimerBar`(시간 올림·비율·경고 색상), `AnswerButton`(도형·비활성화·선택 인원), `DoublePointsBanner`, `StatusBadge`, `Leaderboard`·`Podium`(천 단위 점수·순위 변화·본인 강조), `QuestionsSection`(4지선다·O/X·단답형 폼), `AdminAccountsCard`(관리자 추가/삭제/비활성화 규칙), `useCountdown`(서버 시계 오프셋·일시정지 보정) |

브라우저 E2E (Playwright가 설치된 환경):

```bash
npm run build
cd server && SERVE_CLIENT_DIST=../client/dist CLIENT_ORIGIN=http://localhost:3100 PORT=3100 DATABASE_PATH=./data/e2e.sqlite node dist/index.js &
cd .. && node e2e/scenario.mjs http://localhost:3100 ./e2e-screenshots
```

최초 완성 목표 시나리오(관리자 로그인 → 2학년 1반 세션 → 학생 5명 입장·대기실 표시 → 시작 → 동일 문제 실시간 표시 → 제출 → 서버 채점 → 정답·순위 공개 → 다음 문제 → 최종 순위 → 통계 → 대회 이력 → CSV/Excel 다운로드)는 서버 통합 테스트(`tests/quiz.test.ts`)와 브라우저 E2E 양쪽에서 통과했습니다.

---

## 부하 테스트 결과와 한계

```bash
# 테스트 전용 DB로 서버 실행 (입장 속도 제한 완화)
NODE_ENV=production JWT_SECRET=... JOIN_RATE_LIMIT_PER_MINUTE=100000 API_RATE_LIMIT_PER_MINUTE=100000 \
DATABASE_PATH=./data/loadtest.sqlite node server/dist/index.js
# 관리자 비밀번호를 변경한 뒤
npm run loadtest -- --url http://localhost:3000 --password <비밀번호> [--stages 5,35,105,210,420] [--questions 3] [--time-limit 10]
```

`server/scripts/loadtest.ts` 는 단계별로 실제 REST 입장 → Socket.io 연결 → 학급 동시 시작 → 학생마다 0.2~3초 무작위 지연 후 답안 제출 → 자동 마감·결과 → 다음 문제 → 종료까지 수행하고, DB에 저장된 답안 수·전교 순위 인원·다른 학급 이벤트 오배송 여부를 검증합니다. ⚠️ 테스트용 대회/세션을 생성하므로 운영 DB에서 실행하지 마세요.

**측정 결과** (2026-10-31, 운영 빌드, 3문항 × 제한시간 10초)

| 단계 | 접속 성공 | 답안 제출 p95 / max | 문제 전달 p95 | DB 저장 답안 | 실패 | 다른 학급 이벤트 수신 |
| --- | --- | --- | --- | --- | --- | --- |
| 1개 학급 × 5명 | 5/5 | 4 / 4 ms | 2 ms | 15/15 | 0 | 0 |
| 1개 학급 × 35명 | 35/35 | 4 / 5 ms | 2 ms | 105/105 | 0 | 0 |
| 3개 학급 × 35명 | 105/105 | 5 / 124 ms | 4 ms | 315/315 | 0 | 0 |
| 6개 학급 × 35명 | 210/210 | 3 / 10 ms | 9 ms | 630/630 | 0 | 0 |
| **12개 학급 × 35명** | **420/420** | **4 / 13 ms** | **27 ms** | **1260/1260** | **0** | **0** |

- 420명 단계: 동시 입장 p95 ≈ 0.6초, 소켓 연결 p95 ≈ 0.7초(420개 동시 요청 기준), 결과 전달 p95 3 ms
- 서버 자원: 최대 RSS **169 MB**, CPU 최대 1코어의 약 80%(420명 동시 접속 순간), 평균 약 13%
- 측정 환경: Intel Xeon 2.1 GHz 4 vCPU, RAM 16 GB, Linux, Node.js 22.23. **부하 생성기와 서버가 같은 머신에서 루프백(127.0.0.1)으로 통신**

**한계와 해석**

- 위 결과는 네트워크 지연이 없는 루프백 측정입니다. 실제 교실 Wi‑Fi(AP당 동시 접속 한도, 전파 간섭)와 학교 인터넷 회선이 실제 병목이 될 가능성이 더 큽니다. 실제 서버·학교망에서 학급 1개 → 전체 순서로 리허설하고 결과를 이 표에 추가 기록하는 것을 권장합니다.
- SQLite는 단일 쓰기 잠금이지만 better-sqlite3의 동기 트랜잭션은 1건당 수십 마이크로초 수준이라 420명 동시 제출에서도 병목이 관찰되지 않았습니다. 학교 수가 늘어 동시 수천 명 규모가 되면 PostgreSQL 이전과 다중 프로세스(Socket.io Redis adapter) 구성이 필요합니다. 데이터 접근은 `server/src/database/repositories/` 로 분리되어 있어 해당 계층만 교체하면 됩니다.
- 순위는 학급(최대 35명) 단위 인덱스 조회로 계산하고, 이벤트는 해당 학급 Room에만 전송합니다(오배송 0건 확인).

---

## 보안 주의사항

구현된 보호 장치:

- 비밀번호 bcrypt(cost 12) 해싱, 존재하지 않는 계정도 동일한 비교 시간
- JWT(HS256 고정, 만료, `jti` 기반 로그아웃 폐기, 비밀번호 변경 시 이전 토큰 무효화). 관리자 API는 **모든 요청에서** 검증하고, 관리자 소켓 이벤트도 **이벤트마다** 토큰을 재검증
- 학생 인증: 입장 시 발급되는 무작위 토큰(원문은 저장하지 않고 SHA‑256 해시만 저장, 만료/폐기 지원). 소켓 연결 시 참가자 ID·토큰·학급·현재 세션을 서버 DB와 대조하며, 학급 ID는 클라이언트 값이 아닌 DB 값을 사용
- 학생 소켓의 `admin:*` 이벤트는 실행되지 않고 `critical` 로그로 기록
- Zod 입력 검증, 모든 SQL은 Prepared Statement(바인딩) 사용 — SQL Injection 방지
- XSS: 닉네임은 한글/영문/숫자/공백/`_ . -` 만 허용, React가 항상 텍스트로 렌더링(`dangerouslySetInnerHTML` 미사용)
- CSV 수식 주입 방지(`=`, `+`, `-`, `@` 로 시작하는 셀 이스케이프)
- 학생 API·소켓 응답에는 결과 공개 전까지 정답·해설을 포함하지 않음, 문제 진행 중에는 현재 문제 점수도 숨김
- helmet 보안 헤더(CSP 포함), CORS 허용 목록, REST IP별 속도 제한 + 소켓 연결별 토큰 버킷
- 오류 응답에 스택/내부 메시지 미노출, 로그에서 password/token/secret 키 자동 제거
- `.env`, `server/data/*.sqlite*`, 내보내기 파일은 `.gitignore`로 Git 제외

운영 시 반드시 할 일:

1. `NODE_ENV=production`, 강력한 `JWT_SECRET`, 정확한 `CLIENT_ORIGIN` 설정
2. 기본 관리자 비밀번호 변경(시스템이 강제), 가능하면 `ADMIN_USERNAME`도 변경
3. **HTTPS 사용**(nginx + Let's Encrypt 등). HTTP에서는 관리자 토큰이 평문으로 전송됩니다. 학교 내부망 전용 HTTP 운영도 가능하도록 `upgrade-insecure-requests`는 비활성화되어 있습니다.
4. DB 파일 및 백업 폴더 접근 권한 제한(`chmod 600`), 정기 백업
5. 공용 PC에서 학생 입장 정보는 브라우저 localStorage에 남습니다(학급별 키). 수업 후 브라우저를 정리하거나 관리자가 세션을 새로 만들면 이전 토큰은 무효가 됩니다. 관리자 토큰은 sessionStorage에 저장되어 브라우저 탭을 닫으면 사라집니다.
6. 프로젝터·공개 결과 화면은 로그인 없이 볼 수 있는 **공개 화면**입니다(진행 컨트롤은 대시보드에서 발급한 학급 전용 임시 키가 있어야만 열립니다. 이 키가 들어 있는 주소(`#ck=…`)는 학생에게 공유하지 마세요). 학생 이름 공개 방식(기본: 마스킹)을 설정에서 확인하세요.

---

## 아키텍처 상세

### 세션 상태 머신 (학급마다 독립)

```
WAITING ──start──▶ PLAYING(문제 i) ──시간 종료 / 전원 제출 / 결과 공개──▶ RESULT(문제 i)
                      │  ▲                                                │
                   pause resume                                    next (i+1 < N)
                      ▼  │                                                │
                     PAUSED                                     PLAYING(문제 i+1) …
RESULT(마지막) ──next──▶ FINISHED        (어느 상태에서든 finish → FINISHED, reset → WAITING)
```

- 문제 시작 시 서버가 `question_start_time`, `question_end_time` 을 DB에 저장하고 학급별 `setTimeout` 으로 마감합니다. 브라우저 타이머는 서버 시각(`serverNow`)으로 보정한 **표시용**입니다.
- 일시정지 시 남은 시간을 저장하고, 재개 시 `end = now + 남은 시간`, `start = end - 제한시간` 으로 새 기준 시각을 설정합니다(경과 시간 연속).
- 접속 중인 학생이 모두 제출하면 0.8초 후 자동 마감합니다.
- 퀴즈 시작 시 문제 세트를 `session_questions` 에 **스냅샷**으로 저장하므로, 이후 문제를 수정·삭제해도 대회 이력과 통계가 바뀌지 않습니다.

### 데이터베이스

`admins`, `revoked_tokens`, `classes`, `questions`(question_type 포함, 소프트 삭제), `quiz_sets`, `quiz_set_questions`, `competitions`, `class_sessions`, `session_questions`, `participants`(세션별, `UNIQUE(session_id, nickname)`), `participant_tokens`, `answers`(`UNIQUE(participant_id, question_id)`), `activity_logs`, `exports`, `settings`, `schema_migrations`. 외래 키·인덱스 적용, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`.

참가자는 **세션(학급 × 대회)** 에 속합니다. 그래서 같은 학급이 다음 대회를 시작해도 이전 대회의 참가자·답안·순위가 그대로 남고, "결과 초기화"는 현재 세션에만 적용됩니다(종료된 대회는 초기화 거부).

### REST API 요약

| 메서드 | 경로 | 권한 |
| --- | --- | --- |
| POST | `/api/admin/login`, `/api/admin/logout`, `/api/admin/change-password` · GET `/api/admin/me`, `/api/admin/overview` | 관리자 |
| GET/POST/DELETE | `/api/admins[/:id]` (관리자 계정 목록·추가·삭제, 마지막 관리자/본인 삭제 차단) | 관리자 |
| GET/POST/PUT/DELETE | `/api/questions[/:id]`, `POST /api/questions/bulk`, `/api/quiz-sets[/:id]` | 관리자 |
| GET | `/api/classes`, `/api/classes/:classId/session` | 공개(인원·상태만) |
| POST | `/api/classes/:classId/join` | 공개(정원·중복 검사) |
| GET | `/api/classes/:classId/participants` | 관리자 또는 같은 학급 학생 |
| DELETE | `/api/classes/:classId/participants/:participantId` | 관리자 |
| POST | `/api/classes/:classId/session` | 관리자 |
| GET | `/api/leaderboard?scope=class&classId=` / `?scope=school&competitionId=` / `?scope=classes&competitionId=` | 학급: 관리자·같은 학급 학생 / 전교: 관리자 |
| POST | `/api/leaderboard/reset` (`confirm: "RESET"`) | 관리자 |
| GET | `/api/analytics/competition/:id`, `/api/analytics/class/:classId`, `/api/analytics/questions/:id` | 관리자 |
| GET/POST/PUT/DELETE | `/api/competitions[/:id]` (삭제 시 `?confirm=<대회명>`), `POST /:id/finish`, `GET /compare?ids=1,2` | 관리자 |
| GET | `/api/exports/:id/csv?type=individual\|class\|questions\|logs`, `/api/exports/:id/excel` · POST `/api/exports/:id` · GET `/api/exports`, `/api/exports/files/:id` | 관리자 |
| GET | `/api/logs`, `/api/logs/csv` (필터: from, to, classId, eventType, participantId, severity) | 관리자 |
| GET/PUT | `/api/settings` | 관리자 |
| GET | `/api/public/projector/:classId`, `/api/public/competitions[/:id/results]` | 공개(마스킹 적용) |

### Socket.io 이벤트

- 연결 인증(`auth`): `{ role: 'admin', token }` / `{ role: 'student', participantId, token }` / `{ role: 'projector', classId }`
- Room: `room:2-1`(학생), `projector:2-1`, `admin:2-1`(관리자 관전), `admins`, `participant:<id>` — 대상별로 다른 페이로드(학생: 정답 없음, 프로젝터: 이름 마스킹, 관리자: 정답 포함)
- 관리자 → 서버: `admin:start_quiz`, `admin:pause_quiz`, `admin:resume_quiz`, `admin:next_question`, `admin:skip_question`, `admin:show_results`, `admin:finish_quiz`, `admin:reset_class`(`confirm: "RESET"`), `admin:reset_all`(`confirm: "RESET_ALL"`), `admin:watch_class`
- 학생 → 서버: `student:join`, `student:submit_answer`, `student:request_state`
- 서버 → 클라이언트: `quiz:state`, `quiz:started`, `quiz:question`, `quiz:timer`, `quiz:paused`, `quiz:resumed`, `quiz:answer_received`, `quiz:results`, `quiz:my_result`, `quiz:finished`, `quiz:reset`, `leaderboard:updated`, `participants:updated`, `connection:status`, `admin:overview`, `admin:log`

---

## 남은 작업 / 알려진 한계

구현하지 않았거나 검증 범위가 제한된 항목입니다.

- **실제 학교 환경 부하 테스트 미실시**: 420명 테스트는 단일 머신 루프백에서 수행했습니다. 실제 서버 사양·교실 Wi‑Fi·학교 회선에서의 측정은 아직 하지 않았습니다.
- **단답형 채점 범위**: 단답형(`SHORT_ANSWER`)은 유니코드 NFC·앞뒤/연속 공백 정리·영문 대소문자 무시 후 등록된 인정 답안(최대 5개)과 일치 여부를 비교합니다. 오타 유사도나 형태소 기반 자동 부분 점수는 지원하지 않습니다.
- **수평 확장 미지원**: 타이머와 접속 현황이 프로세스 메모리에 있어 단일 Node.js 프로세스 운영을 전제로 합니다(다중 프로세스는 Redis adapter·분산 타이머 필요).
- **브라우저 E2E 시나리오 갱신 필요**: `e2e/scenario.mjs`는 v1.3.0에서 바뀐 학번 입력 방식의 로비 화면을 아직 따르지 않아 현재 로비 단계에서 멈춥니다(기본 문제 변경에 맞춘 5문항 세트 준비 단계는 반영됨).
- **브라우저 E2E CI 미포함**: GitHub Actions CI(`ci.yml`)는 타입 검사, 서버·프론트엔드 Vitest 테스트, 운영 빌드까지 자동 검증합니다. Playwright 브라우저 시나리오(`e2e/scenario.mjs`)는 별도 수동 검증 스크립트로 제공되며 저장소 기본 의존성에 포함되어 있지 않습니다.
- 헤드리스 Chromium(UTF‑8 로케일이 없는 테스트 컨테이너)에서는 한글 다운로드 파일명이 `download` 로 표시되었습니다. 서버는 `filename*=UTF-8''…` 헤더를 정상 전송하며 일반 브라우저에서는 한글 파일명이 유지됩니다.
- 웹 폰트(Google Fonts)를 사용하므로 외부 인터넷이 차단된 학교망에서는 시스템 폰트로 대체됩니다.

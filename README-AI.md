# EduFlow Deploy — AI Agent Reference

> 이 문서는 AI 에이전트(Claude, GPT 등)가 `eduflow-deploy`의 구조·API·환경을 빠르게 이해하기 위한 기술 레퍼런스입니다.
> 사람이 읽는 개요는 [README.md](./README.md)를, 개발 작업 지침은 [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md)를, 설계 원칙은 [CONSTITUTION.md](./CONSTITUTION.md)를 참조하세요.

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 이름 | 에듀플로 (EduFlow Deploy) |
| 설명 | 교사의 아이디어를 AI로 시각화하여 웹 교재까지 만드는 풀스택 플랫폼 (셀프 호스팅 가능) |
| GitHub | https://github.com/greatsong/eduflow-deploy |
| 현재 버전 | v0.5.0 (2026-03-30) |
| 배포 예시 | https://eduflow-greatsong.fly.dev/ (운영자 인스턴스) |
| 라이선스 | MIT |
| 언어 | JavaScript (ESM) |
| 모노레포 | npm workspaces (`client/`, `server/`, `shared/`) |
| 로컬 버전 | 별도 리포 `eduflow-js` (향후 `LOCAL_MODE`로 통합 예정) |

## 실행 방식 (두 모드)

이 코드베이스는 한 개이지만 `LOCAL_MODE` 플래그로 두 성격으로 갈라집니다.

| 모드 | 조건 | 인증 | API 키 | 관리자 | 프로젝트 제한 | 주 용도 |
|------|------|------|--------|--------|---------------|---------|
| **배포 모드** (기본) | `LOCAL_MODE` 미설정 | Google OAuth + JWT | 서버/사용자 겸용 | 있음 (Admin.jsx) | 사용자당 99개 | 학교·단체 셀프 호스팅 |
| **로컬 모드** | `LOCAL_MODE=true` | 없음 (mock 사용자 자동 주입) | 사용자 직접 입력 | 없음 | 제한 없음 | 개인 노트북 실행 |

- 서버: `LOCAL_MODE`가 `true`면 `requireAuth`가 mock user를 주입, `requireApproved`는 통과.
- 클라이언트: Vite `define`으로 빌드 타임에 `__LOCAL_MODE__` 플래그 주입 → EntryForm 스킵, Admin 라우트 숨김.

## 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| Frontend | React, Vite, React Router, Zustand, Tailwind CSS | 19, 6, 7, latest, 4 |
| Backend | Express, Node.js | 5, 22 |
| AI SDK | `@anthropic-ai/sdk`, `openai`, `@google/genai` (Gemini), 커스텀 Solar 클라이언트 | latest |
| 이미지 | Gemini 3.1 Flash Image (기본) / OpenAI DALL-E 3 (폴백) / SVG 플레이스홀더 | - |
| 인증 | Google Sign-In (OAuth 2.0) + JWT (7일) | - |
| GitHub 연동 | OAuth 토큰 기반 저장소 생성·푸시·Pages 배포 | - |
| Streaming | Server-Sent Events (SSE) | - |
| 빌드/배포 | Docker (Node 22 + Python + pandoc + gh CLI), Fly.io | - |

## 디렉터리 구조

```
eduflow-deploy/
├── client/                       # React 프론트엔드
│   ├── src/
│   │   ├── App.jsx                  # 라우트 + EntryForm 게이트 + 승인 상태 분기
│   │   ├── api/client.js            # apiFetch, apiSSE (JWT 자동 포함, LOCAL_MODE 시 생략)
│   │   ├── components/
│   │   │   ├── Layout.jsx           # 사이드바 + Outlet
│   │   │   ├── ProgressBar.jsx      # 6단계 진행률
│   │   │   ├── ChatInterface.jsx    # SSE 기반 범용 채팅
│   │   │   ├── EntryForm.jsx        # Google 로그인 + 지원 양식 (배포 모드 전용)
│   │   │   ├── ApiKeyModal.jsx      # 멀티 프로바이더 API 키 입력
│   │   │   ├── ModelSelector.jsx
│   │   │   ├── Logo.jsx
│   │   │   └── (라이트박스) 이미지·Mermaid 클릭 확대
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── ProjectManager.jsx   # Step 0
│   │   │   ├── Discussion.jsx       # Step 1
│   │   │   ├── TableOfContents.jsx  # Step 2
│   │   │   ├── Feedback.jsx         # Step 3
│   │   │   ├── ChapterCreation.jsx  # Step 4 (이미지 생성 포함)
│   │   │   ├── Deployment.jsx       # Step 5
│   │   │   ├── Portfolio.jsx
│   │   │   ├── ModelCompare.jsx     # 블라인드/공개/AI 자동 평가
│   │   │   ├── BetaDeploy.jsx
│   │   │   └── Admin.jsx            # 관리자 대시보드 (배포 모드 전용)
│   │   ├── hooks/useAdminCheck.js
│   │   └── stores/                  # projectStore.js, chatStore.js
│   └── vite.config.js
│
├── server/                       # Express 백엔드
│   ├── index.js                     # 엔트리: 미들웨어 체인, 라우트 등록, LOCAL_MODE 분기
│   ├── routes/
│   │   ├── auth.js                  # Google OAuth + GitHub OAuth (배포 모드)
│   │   ├── admin.js                 # 사용자/프로젝트/설정/통계/토큰 (관리자 전용)
│   │   ├── models.js                # GET /api/models (모델 목록 + 가격)
│   │   ├── projects.js              # 프로젝트 CRUD + 참고자료 + 템플릿 적용
│   │   ├── discussions.js           # 대화 CRUD + SSE 채팅 + 요약
│   │   ├── toc.js                   # 목차 SSE 생성/편집/확정/아웃라인
│   │   ├── chapters.js              # 챕터 SSE 배치·개별 생성 + 이미지 생성 + 채팅
│   │   ├── deploy.js                # MkDocs 빌드 + DOCX + GitHub Pages
│   │   ├── portfolio.js             # 포트폴리오 집계
│   │   ├── compare.js               # 멀티 모델 병렬 비교 (SSE)
│   │   └── beta.js                  # GitHub 저장소/테스터/푸시
│   ├── services/
│   │   ├── aiProvider.js            # 멀티 프로바이더 디스패치 + 토큰 사용 기록
│   │   ├── conversationManager.js
│   │   ├── tocGenerator.js
│   │   ├── chapterGenerator.js      # TokenBudgetManager 포함 (TPM 관리)
│   │   ├── imageGenerator.js        # Gemini → DALL-E 폴백, SVG 플레이스홀더
│   │   ├── progressManager.js
│   │   ├── templateManager.js       # 8종 템플릿
│   │   ├── referenceManager.js
│   │   ├── deployment.js            # MkDocs/Astro 빌드
│   │   ├── docxGenerator.js         # Pandoc 기반
│   │   ├── settings.js              # ServerSettings (apiMode, registrationMode 등)
│   │   ├── userStore.js             # 사용자별 GitHub 토큰 등
│   │   └── tokenUsageManager.js     # AI 사용량·비용 기록
│   ├── middleware/
│   │   ├── auth.js                  # requireAuth + requireApproved + signToken (LOCAL_MODE 시 mock 주입)
│   │   ├── apiKey.js                # requireApiKey (프로바이더별 우선순위 체크)
│   │   ├── errorHandler.js          # asyncHandler + 에러 핸들링
│   │   └── sanitize.js              # ID/파일명 sanitization
│   └── assets/                      # MkDocs 커스텀 CSS/JS, Mermaid 설정, 회로도
│
├── shared/constants.js              # STEPS, CHAPTER_STATUS, GENERATION_STATUS, SSE_EVENTS
├── templates/                       # 교육 템플릿 8종 JSON
│   ├── school-textbook.json
│   ├── programming-course.json
│   ├── business-education.json
│   ├── workshop-material.json
│   ├── self-directed-learning.json
│   ├── teacher-guide-4c.json
│   ├── storytelling.json
│   └── class-preview.json
├── fly.toml                         # Fly.io (app: eduflow-greatsong, region: nrt, volume: eduflow_data → /data)
├── Dockerfile                       # Node 22 + Python/MkDocs + pandoc + gh CLI
├── model_config.json                # 모델 가격/컨텍스트/TPM
└── .env                             # 로컬 환경변수 (gitignore)
```

## 설치 & 실행

```bash
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy
npm install

# 로컬 모드 (인증 없음, 가장 빠름)
echo "LOCAL_MODE=true" > .env
npm run dev

# 배포 모드 (Google OAuth 등 설정 필요)
cp .env.example .env  # 필수 변수 채우기
npm run dev
```

| 명령어 | 설명 | URL |
|--------|------|-----|
| `npm run dev` | 프론트 + 백엔드 동시 | http://localhost:7830 |
| `npm run dev:client` | 프론트만 | http://localhost:7830 |
| `npm run dev:server` | 백엔드만 | http://localhost:7829 |
| `npm run build` | 프론트엔드 프로덕션 빌드 | - |
| `npm start` | 프로덕션 서버 (서버에서 `client/dist` 정적 서빙) | - |
| `fly deploy` | Fly.io 배포 (운영자 전용) | - |

## 환경변수

### 공통
| 변수 | 필수 | 설명 |
|------|------|------|
| `LOCAL_MODE` | 선택 | `true`면 로컬 모드 (인증·관리자·승인 전부 비활성) |
| `PORT` | 선택 | 백엔드 포트 (기본 7829) |
| `CLIENT_URL` | 선택 | CORS 허용 프론트 URL |
| `PROJECTS_DIR` | 선택 | 프로젝트 저장 경로 (기본 `./projects`, Fly.io는 `/data/projects`) |
| `DATA_DIR` | 선택 | 서버 데이터 경로 (Fly.io는 `/data`) |

### AI 프로바이더 (최소 1개)
| 변수 | 프로바이더 |
|------|-----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude (기본 프로바이더) |
| `OPENAI_API_KEY` | OpenAI GPT / DALL-E |
| `GOOGLE_API_KEY` | Google Gemini (이미지 생성 기본) |
| `UPSTAGE_API_KEY` | Upstage Solar |

### 배포 모드 전용
| 변수 | 설명 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google Sign-In 클라이언트 ID |
| `GITHUB_CLIENT_ID` | GitHub OAuth 앱 클라이언트 ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth 시크릿 |
| `GITHUB_CALLBACK_URL` | OAuth 콜백 URL (배포 도메인/auth/github/callback) |
| `PORTFOLIO_GITHUB_TOKEN` | 포트폴리오 리포 푸시용 GitHub 토큰 |
| `ADMIN_EMAILS` | 관리자 이메일 목록 (쉼표 구분) |
| `JWT_SECRET` | JWT 서명 시크릿 |

> 상세 Fly.io 시크릿 설정은 [DEPLOY.md](./DEPLOY.md)에서 다룹니다.

## 인증·승인 플로우 (배포 모드)

```
[사용자 브라우저]
  ↓ Google Sign-In
[EntryForm.jsx] — 신규면 지원 정보 입력
  ↓ POST /api/auth/google
[server/routes/auth.js]
  ↓ (registrationMode가 'approval'이면 status='pending', 'open'이면 'active')
[JWT 발급] → 클라이언트 localStorage
  ↓ 이후 요청: Authorization: Bearer <JWT>
[미들웨어: requireAuth → requireApproved → 라우트]
```

| 상태 | 의미 |
|------|------|
| `active` | 정상 이용 가능 |
| `pending` | 관리자 승인 대기 (approval 모드 신규 가입) |
| `inactive` | 관리자가 비활성화 |

관리자 이메일(`ADMIN_EMAILS`)은 `requireApproved`를 항상 통과하고 Admin 라우트에 접근 가능.

## API 키 우선순위 (프로바이더별)

```
사용자 요청 헤더 (x-*-api-key) → 관리자 설정 키(settings.json) → 환경변수(.env/fly secrets)
```

`ServerSettings.apiMode`:
- `'server'` — 서버 제공 키 우선. 사용자 입력 없이도 동작.
- `'user'` — 사용자가 직접 입력해야 함.

관리자 키는 프로바이더별로 **공개(모든 사용자)** / **비공개(관리자만)** 설정 가능.

## 주요 API 엔드포인트

### 인증 (`/api/auth`) — 배포 모드
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/google` | Google ID 토큰 검증 + JWT 발급 |
| GET | `/api/auth/github` | GitHub OAuth 시작 |
| GET | `/api/auth/github/callback` | GitHub OAuth 콜백 |
| POST | `/api/auth/logout` | 로그아웃 |

### 관리자 (`/api/admin`) — 관리자 JWT 필요
| Method | Path | 설명 |
|--------|------|------|
| GET/PATCH | `/api/admin/users` | 사용자 목록·상태 변경 |
| GET | `/api/admin/projects` | 전체 프로젝트 |
| GET/PUT | `/api/admin/settings` | 운영 설정 (apiMode, registrationMode, allowedModels, adminApiKeys) |
| GET | `/api/admin/stats` | 통계 (사용자·프로젝트·챕터 수, 일별/주별) |
| GET | `/api/admin/tokens` | 토큰 사용량 |

### 프로젝트 (`/api/projects`)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/api/projects` | 목록/생성 |
| GET/PUT/DELETE | `/api/projects/:name` | 상세/수정/삭제 |
| POST/GET/DELETE | `/api/projects/:name/references[/*]` | 참고자료 업로드(multer) |
| GET/POST | `/api/projects/:name/templates[/:id/apply]` | 템플릿 조회/적용 |

### 워크플로우 (Step 1~5)
| 단계 | Path 접두 | 특이 사항 |
|------|-----------|-----------|
| Discussion | `/api/projects/:name/discussions` | SSE `/chat`, 요약 |
| TOC | `/api/projects/:name/toc` | SSE `/generate`, `/confirm`, `/outline` |
| Chapter | `/api/projects/:name/chapters` | SSE 배치·개별 생성, 이미지, 채팅 |
| Deploy | `/api/projects/:name/deploy` | MkDocs 빌드, DOCX, GitHub Pages |

### 기타
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/models` | 모델 목록 + 가격 |
| GET | `/api/portfolio/projects[/:name]` | 포트폴리오 집계 |
| POST | `/api/compare/*` | 다중 모델 병렬 비교 SSE |
| * | `/api/beta/*` | GitHub 저장소 생성/테스터/푸시 |
| GET | `/api/health` | 서버 상태 |

## SSE 프로토콜

```
data: {"type": "text", "content": "생성된 텍스트..."}\n\n
data: {"type": "progress", "message": "진행 상황"}\n\n
data: {"type": "image", "url": "...", "prompt": "...", "model": "..."}\n\n
data: {"type": "error", "message": "에러"}\n\n
data: {"type": "done", "summary": {...}}\n\n
```

## 프로젝트 데이터 구조

```
projects/<name>/
├── config.json              # 메타데이터 (name, author, description, settings, claude_model 등)
├── progress.json            # 현재 단계, 각 단계 완료 여부
├── toc.json                 # Parts > Chapters 트리
├── discussions/<id>.json    # 대화 이력
├── docs/<chapter_id>.md     # 생성된 챕터
├── docs/images/             # 생성된 이미지 (images_meta.json 포함)
├── chat_history/<chapter_id>.json  # 챕터별 인터랙티브 채팅
└── references/<filename>    # 참고자료
```

배포 모드에서는 `projects/`가 사용자별로 분리됩니다(`users/<email>/projects/...`). LOCAL_MODE는 공용 루트 사용.

## 모델 설정 (`model_config.json`)

- 기본 모델: `claude-sonnet-4-6`
- 각 모델에 `input_price` / `output_price` (USD per 1M tokens) / `context` / `output_tpm` 정의
- `default_settings`: `max_tokens`, `concurrent`
- 이미지 모델은 별도 (`gemini-*-flash-image`, `dall-e-3`)

## 배치 생성 & Rate Limit

- `chapterGenerator.js`의 `TokenBudgetManager`가 TPM 예산 관리
- Tier 1(신규): 동시 1~2, TPM 20K, Haiku 권장
- Tier 4: 동시 5~10, TPM 200~400K, Opus 사용 가능
- 429 시 자동 재시도(최대 2회)

## 외부 도구 의존성

| 도구 | 용도 | 필요 시점 |
|------|------|-----------|
| MkDocs + mkdocs-material | MkDocs 빌드 | 레거시 테마 배포 |
| Astro Starlight (npm) | 기본 테마 빌드 | Step 5 기본 배포 |
| Pandoc | DOCX 변환 | DOCX 다운로드 |
| GitHub CLI (`gh`) | GitHub Pages 배포 | beta + Step 5 GitHub 배포 |
| Git | 버전 관리 | GitHub 배포 |

Dockerfile이 Node 22 위에 Python/MkDocs/pandoc/gh를 모두 설치하므로 Fly.io 환경에서는 별도 세팅 불필요.

## 사용자 지원 시 참고사항

1. **실행 모드 먼저 확인**: `LOCAL_MODE` 여부에 따라 문제 원인 위치가 완전히 달라짐 (EntryForm/Admin 관련은 배포 모드만).
2. **pending 상태 사용자**: 관리자가 `admin.js`에서 `active`로 바꿔줘야 함. `registrationMode`를 `open`으로 바꾸면 이후 가입자는 즉시 `active`.
3. **API 키 3단계 우선순위**: 헤더 → 관리자 설정 → env. 사용자가 "키를 설정했는데 안 먹는다"면 어느 계층에서 막혔는지 확인.
4. **Google Sign-In postMessage 차단**: COOP 헤더는 `/api` 경로에만 적용되도록 분리됨 (v0.5.0).
5. **이미지 생성 실패**: Gemini → DALL-E → SVG 플레이스홀더 순으로 폴백. 키 하나만 있어도 플레이스홀더는 항상 나감.
6. **Fly.io 첫 접속 지연**: `auto_stop_machines = 'stop'`로 유휴 시 중지됨. 첫 요청이 느릴 수 있다고 안내.
7. **`eduflow-js` 로컬 리포와 혼동 주의**: 그쪽은 인증 기능이 아예 없는 별도 코드베이스. 향후 이 리포의 LOCAL_MODE로 통합 예정.

## 관련 문서

- [README.md](./README.md) — 사람용 개요
- [CONSTITUTION.md](./CONSTITUTION.md) — 12조 설계 원칙 (불변)
- [CLAUDE.md](./CLAUDE.md) — Claude Code용 작업 지침 (동기화 규칙 포함)
- [AGENTS.md](./AGENTS.md) — 기타 AI 에이전트용 지침
- [CHANGELOG.md](./CHANGELOG.md) — 버전 이력
- [DEPLOY.md](./DEPLOY.md) — 셀프 호스팅 배포 가이드 *(작성 예정)*
- [LOCAL.md](./LOCAL.md) — 로컬 모드 가이드 *(작성 예정)*
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — 관리자 초기 세팅 *(작성 예정)*
- [USER_GUIDE.md](./USER_GUIDE.md) — 교사용 사용 가이드 *(작성 예정)*

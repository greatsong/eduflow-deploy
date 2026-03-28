# EduFlow Deploy - Claude Code 프로젝트 가이드

> **필독**: 에듀플로의 설계 원칙과 불변 규칙은 [CONSTITUTION.md](./CONSTITUTION.md)를 참조하세요.
> 모든 기능 추가, 리팩토링, 의사결정은 헌법에 비추어 판단합니다.

## 프로젝트 개요

AI 기반 교육자료 생성 플랫폼 **에듀플로** 웹 배포 버전.
Google 로그인, 관리자 대시보드, 사용자 승인 시스템, 멀티 AI 프로바이더를 지원하는 풀스택 애플리케이션.

- **배포 URL**: https://eduflow-greatsong.fly.dev/
- **호스팅**: Fly.io (fly.toml 참조)
- **로컬 버전**: `../eduflow/` (교사용 로컬 버전, 인증 없음)

## 개발 전략: Deploy-First

> **⚠️ 중요**: `eduflow-deploy`가 주 개발 대상. 변경은 여기서 먼저 한 뒤, `eduflow` (로컬)에 동기화.

### 동기화 규칙
1. **Deploy 전용 기능** (동기화 불필요): Google 로그인, 사용자 승인 시스템, 관리자 대시보드(Admin.jsx), EntryForm(지원 양식), 사용자 관리, requireAuth/requireApproved 미들웨어, GitHub OAuth
2. **공통 기능** (동기화 필요): 템플릿, AI 프롬프트, 챕터 생성 로직, 모델 설정, UI 컴포넌트, 서비스 로직, MkDocs/DOCX 배포
3. **로컬 전용 기능**: API 키 직접 입력 (서버 제공 없음), 인증 없는 자유 접근

### 동기화 프로세스
```
1. eduflow-deploy에서 기능 개발/수정
2. 테스트 & 배포 (fly deploy)
3. 변경 내용 중 공통 부분을 eduflow에 반영
4. eduflow 로컬 빌드 테스트 (npm run build)
```

## 기술 스택

- **프론트엔드**: React 19, Vite 6, React Router 7, Zustand, Tailwind CSS 4
- **백엔드**: Express 5, 멀티 AI SDK (@anthropic-ai/sdk, openai, @google/genai)
- **인증**: Google Sign-In (OAuth 2.0) + JWT (7일 만료)
- **GitHub 연동**: OAuth 토큰 기반 저장소 생성/배포
- **배포**: Fly.io (Volume: /data)
- **모노레포**: npm workspaces (`client/`, `server/`, `shared/`)

## 주요 명령어

```bash
# 전체 의존성 설치
npm install

# 개발 서버 (프론트 + 백엔드 동시)
npm run dev
# 프론트: http://localhost:7830
# 백엔드: http://localhost:7829

# 빌드
npm run build

# 배포
fly deploy
```

## 사용자 인증 & 승인 시스템

### 인증 플로우
1. 사용자가 Google 로그인 (EntryForm Step 1)
2. 신규 사용자: 추가 정보 입력 (이름, 소속, 과목, 지역 + 지원 정보)
3. `registrationMode` 설정에 따라:
   - `open`: 즉시 `active` → 서비스 이용 가능
   - `approval`: `pending` → 관리자 승인 후 이용 가능
4. 기존 사용자: 즉시 로그인 완료

### 미들웨어 체인
```
requireAuth → (관리자 라우트는 여기서 분기) → requireApproved → 서비스 라우트
```

- `requireAuth`: JWT 토큰 검증. 인증 실패 시 401
- `requireApproved`: pending/inactive 사용자 차단 (403). 관리자는 항상 통과

### 관리자 기능 (Admin.jsx)
- 사용자 관리: 목록 조회, 상태 변경(active/inactive/pending), 지원 정보 상세 보기
- 프로젝트 현황: 전체 프로젝트 목록, 삭제 (에듀플로 + 포트폴리오 + GitHub 리포)
- 운영 모드 설정: API 키 관리(프로바이더별), 가입 모드(자유/승인), 허용 모델 설정
- 통계: 사용자 수, 프로젝트 수, 챕터 수, 일별/주별 추이

### 사용자 상태
| 상태 | 설명 |
|------|------|
| `active` | 정상 이용 가능 |
| `pending` | 관리자 승인 대기 중 (승인 모드에서 신규 가입 시) |
| `inactive` | 관리자가 비활성화한 계정 |

## Fly.io 배포 구조

```
Fly.io Volume (/data/)
├── projects/          # 프로젝트 데이터 (사용자별 분리)
├── users/             # UserStore (사용자별 GitHub 토큰 등)
├── users.json         # 사용자 레지스트리 (상태, 소속, 지원정보 등)
├── settings.json      # 서버 설정 (apiMode, allowedModels, registrationMode, adminApiKeys)
└── token-usage/       # 토큰 사용량 로그
```

### 환경변수 (fly secrets)
```
ANTHROPIC_API_KEY      — 서버 제공 AI API 키 (Anthropic)
OPENAI_API_KEY         — (선택) OpenAI API 키
GOOGLE_API_KEY         — (선택) Google AI API 키
UPSTAGE_API_KEY        — (선택) Upstage API 키
PROJECTS_DIR=/data/projects
DATA_DIR=/data
GOOGLE_CLIENT_ID       — Google OAuth 클라이언트 ID
GITHUB_CLIENT_ID       — GitHub OAuth 클라이언트 ID
GITHUB_CLIENT_SECRET   — GitHub OAuth 시크릿
GITHUB_CALLBACK_URL    — GitHub OAuth 콜백 URL
PORTFOLIO_GITHUB_TOKEN — 포트폴리오 GitHub 토큰
ADMIN_EMAILS           — 관리자 이메일 목록 (쉼표 구분)
JWT_SECRET             — JWT 토큰 시크릿
```

## 디렉토리 구조

```
eduflow-deploy/
├── client/
│   ├── src/
│   │   ├── App.jsx                  # 라우트 + EntryForm 게이트 + 승인 상태 체크
│   │   ├── api/client.js            # apiFetch, apiSSE (JWT 자동 포함)
│   │   ├── components/
│   │   │   ├── Layout.jsx           # 사이드바 + Outlet
│   │   │   ├── ProgressBar.jsx      # 6단계 진행률 바
│   │   │   ├── ChatInterface.jsx    # 범용 스트리밍 채팅 (SSE)
│   │   │   ├── EntryForm.jsx        # Google 로그인 + 지원 양식 (개인정보 동의 포함)
│   │   │   ├── ApiKeyModal.jsx      # API 키 관리 모달 (멀티 프로바이더)
│   │   │   ├── ModelSelector.jsx    # AI 모델 선택 컴포넌트
│   │   │   └── Logo.jsx             # 에듀플로 로고
│   │   ├── pages/
│   │   │   ├── Home.jsx             # 랜딩 페이지
│   │   │   ├── ProjectManager.jsx   # 프로젝트 관리 (생성/목록/삭제)
│   │   │   ├── Discussion.jsx       # Step 1: 방향성 논의
│   │   │   ├── TableOfContents.jsx  # Step 2: 목차 작성
│   │   │   ├── Feedback.jsx         # Step 3: 피드백 & 확정
│   │   │   ├── ChapterCreation.jsx  # Step 4: 챕터 생성 (배치/개별)
│   │   │   ├── Deployment.jsx       # Step 5: 배포 관리 (MkDocs/DOCX)
│   │   │   ├── Portfolio.jsx        # 포트폴리오 대시보드
│   │   │   ├── ModelCompare.jsx     # AI 모델 비교 (블라인드/공개/AI 자동 평가)
│   │   │   ├── BetaDeploy.jsx       # 베타 배포 기능
│   │   │   └── Admin.jsx            # 관리자 대시보드 (사용자/프로젝트/설정/통계)
│   │   ├── hooks/
│   │   │   └── useAdminCheck.js     # 관리자 여부 확인 훅
│   │   └── stores/
│   │       ├── projectStore.js      # Zustand 프로젝트 상태
│   │       └── chatStore.js         # Zustand 채팅 상태
│   └── vite.config.js
│
├── server/
│   ├── index.js                     # Express 엔트리 (미들웨어 체인, 라우트 등록)
│   ├── routes/
│   │   ├── auth.js                  # Google OAuth + GitHub OAuth
│   │   ├── admin.js                 # 관리자 API (사용자/프로젝트/설정/통계/토큰)
│   │   ├── models.js                # AI 모델 목록 + 가격 정보
│   │   ├── projects.js              # 프로젝트 CRUD + 참고자료 + 컨텍스트
│   │   ├── discussions.js           # 대화 관리 + 스트리밍 채팅 + 요약
│   │   ├── toc.js                   # 목차 생성/편집/확정/아웃라인
│   │   ├── chapters.js              # 챕터 생성(배치/개별)/편집/채팅
│   │   ├── deploy.js                # MkDocs 빌드/DOCX 생성/다운로드
│   │   ├── portfolio.js             # 포트폴리오 데이터 집계
│   │   ├── compare.js               # 멀티 모델 병렬 비교 (SSE)
│   │   └── beta.js                  # 베타 기능 (GitHub 저장소 생성)
│   ├── services/
│   │   ├── aiProvider.js            # 멀티 프로바이더 (anthropic/openai/google/upstage)
│   │   ├── conversationManager.js   # 대화 저장/로드/요약
│   │   ├── tocGenerator.js          # 목차 자동 생성/아웃라인
│   │   ├── chapterGenerator.js      # 챕터 배치/개별 생성
│   │   ├── progressManager.js       # 프로젝트 진행 상태 추적
│   │   ├── templateManager.js       # 교육 템플릿 관리 (8종)
│   │   ├── referenceManager.js      # 참고자료 업로드/검색
│   │   ├── deployment.js            # MkDocs 빌드 + 사이트 생성
│   │   ├── docxGenerator.js         # Word 문서 생성
│   │   ├── settings.js              # ServerSettings (apiMode, registrationMode 등)
│   │   ├── userStore.js             # 사용자 데이터 관리 (GitHub 토큰 등)
│   │   └── tokenUsageManager.js     # AI API 토큰 사용량/비용 기록
│   ├── middleware/
│   │   ├── auth.js                  # requireAuth + requireApproved + signToken
│   │   ├── apiKey.js                # requireApiKey (멀티 프로바이더, 우선순위)
│   │   ├── errorHandler.js          # asyncHandler + 에러 핸들링
│   │   └── sanitize.js              # ID/파일명 sanitization
│   └── assets/
│       ├── mkdocs-custom.css        # MkDocs 커스텀 스타일
│       ├── mkdocs-title-link.js     # MkDocs 제목 링크
│       ├── mermaid-config.js        # Mermaid 다이어그램 설정
│       ├── scroll-progress.js       # 스크롤 진행률 표시
│       └── circuit-diagrams.js      # 회로도 다이어그램
│
├── shared/constants.js              # STEPS, CHAPTER_STATUS, GENERATION_STATUS, SSE_EVENTS
├── templates/                       # 교육 템플릿 8종 JSON
│   ├── school-textbook.json         # 학교 교과서
│   ├── programming-course.json      # 프로그래밍 과정
│   ├── business-education.json      # 비즈니스 교육
│   ├── workshop-material.json       # 워크숍 자료
│   ├── self-directed-learning.json  # 자기주도학습
│   ├── teacher-guide-4c.json        # 교사 가이드 (4C)
│   ├── storytelling.json            # 스토리텔링 교육자료
│   └── class-preview.json           # 클래스 프리뷰
├── fly.toml                         # Fly.io 배포 설정
├── Dockerfile                       # 프로덕션 빌드 (Node 20 + Python/MkDocs + gh CLI)
└── .env                             # 로컬 환경변수
```

## API 키 & AI 모델

### API 키 우선순위
```
사용자 헤더 키 → 관리자 설정 키(settings.json) → 환경변수(.env/fly secrets)
```

### 서버 API 모드 (관리자 설정)
- `apiMode: 'server'` — 서버에서 API 키 제공
- `apiMode: 'user'` — 사용자가 직접 API 키 입력
- 관리자 API 키는 프로바이더별로 **공개(모든 사용자)** 또는 **비공개(관리자만)** 설정 가능

### 기본 모델
- **기본값**: `claude-sonnet-4-6`
- 프로젝트 생성 시 `config.json`에 `claude_model` 저장

### 지원 프로바이더
| 프로바이더 | 모델 접두사 | 환경변수 | 비고 |
|-----------|-----------|---------|------|
| Anthropic | claude- | ANTHROPIC_API_KEY | 기본 프로바이더 |
| OpenAI | gpt-, o- | OPENAI_API_KEY | o-시리즈 max_completion_tokens 사용 |
| Google | gemini- | GOOGLE_API_KEY | @google/genai SDK |
| Upstage | solar- | UPSTAGE_API_KEY | |

## 6단계 워크플로우

| 단계 | 페이지 | 설명 |
|------|--------|------|
| Step 1 | Discussion | AI와 교재 방향성 논의 (스트리밍 채팅) |
| Step 2 | TableOfContents | 목차 자동 생성/직접 입력/편집/확정 |
| Step 3 | Feedback | 피드백 & 컨펌 (마스터 컨텍스트 확정) |
| Step 4 | ChapterCreation | 챕터 배치/개별 생성 + 인터랙티브 편집 |
| Step 5 | Deployment | MkDocs 빌드 + DOCX 생성 + GitHub Pages 배포 |
| - | Portfolio | 포트폴리오 대시보드 (완성된 교재 모아보기) |

## 코딩 컨벤션

- **파일명**: camelCase (서비스/유틸), PascalCase (React 컴포넌트)
- **API**: REST + SSE 스트리밍
- **언어**: 코드는 영어, UI 텍스트와 주석은 한국어
- **모듈**: ESM (`import/export`)
- **SSE 프로토콜**: `data: {"type":"text|progress|error|done", ...}\n\n`

## 새 세션에서 시작하기

```bash
cd /Users/greatsong/greatsong-project/eduflow-deploy

# 1. 이 파일(CLAUDE.md) 읽기
# 2. 변경할 부분 파악 후 작업
# 3. npm run build → fly deploy 순으로 배포
# 4. 공통 변경사항은 ../eduflow/에도 반영
```

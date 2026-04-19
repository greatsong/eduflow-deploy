# Changelog

모든 주요 변경사항을 기록합니다.

## v0.5.1 (2026-04-20)

### 🗑️ AI 이미지 자동 생성 기능 전면 제거

Gemini/DALL-E 기반 이미지 자동 생성이 실제 수업용 교재에서 **어색하거나 부정확한 결과물을 자주 생성**했고, 그에 비해 API 비용이 누적되는 문제가 있어 기능을 전면 제거했습니다.

- **제거된 항목**
  - 백엔드: `server/services/imageGenerator.js`, `/chapters/:id/generate-images`, `/regenerate-image`, `/image-chat`, `/images/:imageId/rate`, `/toc/image-guidelines` 라우트
  - 챕터 생성 파이프라인: 이미지 플레이스홀더 처리 로직, `image_generation_enabled` 설정, 프롬프트의 `{{imageGuide}}` 가이드
  - 프론트: Admin의 "이미지 자동 생성" 토글, ProjectManager의 이미지 기능 체크박스, ChapterCreation의 "이미지 컨셉" 탭·프롬프트 검토 패널·생성 갤러리·AI 개선 채팅·재생성 버튼
  - 템플릿: `templates/features/image_generation.json`, 16개 템플릿의 `{{imageGuide}}` 플레이스홀더, `arts-practice.json`의 default feature
  - 관리자 설정 `imageGenerationEnabled`, `imageGenerationProvider`
- **유지되는 항목**
  - 기존 업로드 이미지(`docs/images/*`) 정적 서빙 및 마크다운 렌더링
  - 이미지 라이트박스 확대 보기, Mermaid/회로도 다이어그램
  - `@google/genai`·`openai` 패키지 (텍스트 생성에도 사용)
- **보존되는 데이터**: 기존 프로젝트의 `images_meta.json`, `image_guidelines.md`, `docs/images/`, `config.json`의 `image_generation_enabled` 필드는 그대로 둬서 롤백에 대비함 (무해하게 무시됨)
- **마이그레이션**: 기존 챕터 마크다운의 `<!-- IMAGE: ... -->` 주석은 렌더링 시 보이지 않지만 `scripts/cleanup-image-placeholders.js`로 일괄 제거 가능

## v0.5.0 (2026-03-30)

### 🏠 LOCAL_MODE — 로컬 간편 실행
- `LOCAL_MODE=true` 환경변수 하나로 Google 로그인 없이 즉시 사용
- 인증/승인 플로우 스킵, 프로젝트 99개 제한 해제
- 각 사용자가 자신의 API 키를 입력하여 사용 (서버 키 제공 아님)
- 서버: mock 사용자 자동 주입, 클라이언트: Vite `define` 빌드 타임 플래그
- `.env.example` 재구성: 로컬 모드 / 배포 모드 구분 명확화

### 🖼️ 이미지 생성 v2 — 멀티 프로바이더 + 메타데이터
- **멀티 프로바이더**: Google Gemini (기본) → OpenAI DALL-E 3 (폴백) 자동 전환
- **플레이스홀더 SVG**: API 키 없어도 SVG 플레이스홀더 자동 생성
- **이미지 메타데이터**: `images_meta.json`에 프롬프트, 모델, 해상도, 평가 기록
- **해상도 옵션**: standard(1K) / high(2K) 선택 가능
- **이미지 평가**: 1~5점 별점 시스템 (PATCH API)
- **챕터 일괄 이미지 생성**: SSE 스트리밍으로 진행 상황 실시간 전송
- `ImageGenerator` 클래스 전면 리팩토링 (옵션 객체 기반 생성자)

### 🔍 이미지 · Mermaid 라이트박스
- 이미지 클릭 시 오버레이로 확대 보기
- Mermaid 다이어그램 클릭 시 확대 보기
- ESC / 배경 클릭으로 닫기

### 📊 챕터 생성 분량 5배 증가
- 분당 글자 수 가이드: 60~100자 → 300~500자로 상향
- AI에게 더 풍부한 콘텐츠 생성을 유도

### 🎨 Mermaid 다이어그램 테마 개선
- CSS 변수 의존 제거 → 라이트/다크 모드별 직접 색상 지정
- `theme: 'base'`로 통일, 노드 테두리·배경 세밀 조정
- mindmap 패딩 추가, MutationObserver 간소화

### 🔧 안정성 개선
- COOP 헤더를 `/api` 경로에만 적용 (Google Sign-In postMessage 차단 해결)
- 포트폴리오 페이지 에러 상태 UI 추가 (실패 시 재시도 버튼)
- 챕터 생성 시 AI 모델명 표시 (Claude/OpenAI/Gemini/Solar)
- 이미지 재시도 로직 `_processImages()` 헬퍼로 통합 (코드 중복 제거)
- 릴리즈 노트 모달 위치 수정 (Home으로 이동)
- Dockerfile 캐시 문제 근본 수정 (`rm -rf client/dist` 후 빌드)
- 기본 footer nav 숨김 처리

### 📄 설치 가이드
- `install-guide.html` 추가: 로컬 설치부터 사용법까지 원페이지 가이드

---

## v0.4.0 (2026-03-28)

### 🎯 2축 템플릿 시스템
- 교과 영역(WHAT) 7종 × 교육 모델(HOW) 6종 조합
- 기능 옵션 7종: 코드 블록, 격식체, 수식, Mermaid, 배너·카드·Steps, 회로도, AI 이미지 생성
- 교과 세부 설정: 교과/주제, 대상 학년, 학습 목표 입력
- 템플릿 일반화: JSON 기반 프롬프트 빌더로 리팩토링

### 🖼️ AI 이미지 생성 (Gemini)
- Gemini 3.1 Flash Image로 교육용 일러스트레이션 자동 생성
- 이미지 갤러리: 챕터 편집 탭에서 생성된 이미지 확인
- 라이트박스: 이미지 클릭 시 크게 보기
- 재생성: 새 프롬프트로 이미지 교체 + 자동 저장
- 이미지 컨셉 가이드: 프로젝트별 스타일 설정
- 실패 시 플레이스홀더 유지 → 수동 생성 가능
- 병렬 생성 (3개씩 동시)

### 📝 생성 가이드라인 분리
- 내용 가이드 / 이미지 컨셉 탭 분리
- 이미지 가이드라인 → Gemini 프롬프트에 자동 반영

### 📊 평가 단계 옵션 (0~4)
- 0: 평가 없음
- 1: 자기점검 (체크리스트)
- 2: 확인 문제 (객관식+서술형, 정답 숨김) — 기본값
- 3: 형성 평가 (난이도별 + 자기점검)
- 4: 인터랙티브 (퀴즈 엔진 — 채점+피드백+재도전)

### 💬 대화 기록 서버 저장
- 챕터별 대화가 서버에 자동 저장 (chat_history.json)
- 챕터/탭 전환, 브라우저 새로고침 후에도 유지
- 디바운스 저장 (1초), 최대 50개 메시지

### 📖 MkDocs 교재 개선
- 사이드바 접기 토글 (상태 localStorage 기억)
- 챕터 네비게이션: 이전/다음 카드형 내비 (호버 애니메이션)
- 발행 정보: 발행인, 검토자, 발행일 하단 표시
- SVG 다이어그램 지원 + 다크모드 대응
- 마크다운 테이블 허용

### 🔧 분량 제어
- TOC 과다 생성 방지 (차시 수 제한)
- 챕터 잘림 방지 (안전 버퍼)
- 권(Volume) 분리 제거 → Part + Chapter 구조

### 🛠️ 버그 수정
- 배포 기록 영속화 (페이지 새로고침 후 유지)
- 생성 중단 후 UI 멈춤 수정
- 프로젝트 설정 저장 안정성 개선
- 퀴즈 엔진 버튼 중복 생성 수정
- 이미지 서빙 인증 (쿼리 토큰 지원)

## v0.3.0

- AI 모델 비교 (블라인드/공개/AI 자동 평가)
- 멀티 AI 프로바이더 (Anthropic, OpenAI, Google, Upstage)
- 관리자 대시보드 (사용자/프로젝트/설정/통계)
- Google 로그인 + 사용자 승인 시스템
- GitHub OAuth + GitHub Pages 배포
- 포트폴리오 대시보드
- 토큰 사용량 추적

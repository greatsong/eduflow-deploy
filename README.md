# 에듀플로 (EduFlow)

**선생님의 아이디어를 AI가 눈에 보이게 해드려요.**

머릿속에만 있던 수업 구상이 — 다이어그램으로, 일러스트레이션으로, 완성된 웹 교재로 하나씩 모습을 드러냅니다. 방향성 논의부터 이미지·Mermaid 시각화, 배포까지 중간에 끊기지 않고 쭉 이어져요. "보이면 이해된다"는 원칙 하나로 설계했어요.

> 이 리포(`eduflow-deploy`)는 **셀프 호스팅 가능한 풀스택 버전**입니다. 학교·단체 도메인에 올려서 여러 선생님이 함께 쓸 수도 있고, 본인 노트북에서 혼자 쓰실 수도 있어요.

- 🌐 만들어진 교재 구경: [에듀플로 포트폴리오](https://greatsong.github.io/eduflow-portfolio/)
- 📘 설계 철학: [CONSTITUTION.md](./CONSTITUTION.md)
- 🧰 개발자 가이드: [CLAUDE.md](./CLAUDE.md) · [AGENTS.md](./AGENTS.md)

---

## 뭘 할 수 있어요?

주제를 하나 던지면, 방향성 논의 → 목차 → 본문 → 배포까지 6단계로 이어집니다. 중간에 마음에 안 들면 언제든 고쳐 쓰실 수 있어요.

```
💬 방향성 논의  →  📋 목차 작성  →  ✅ 피드백·확정
                                       ↓
🚀 배포 관리    ←   ✍️ 챕터 제작   ←   (목차 확정됨)
```

| 기능 | 설명 |
|---|---|
| **교육 템플릿 8종** | 학교 교과서, 프로그래밍 과정, 워크숍, 자기주도 학습서, 비즈니스 교육, 교사 가이드(4C), 스토리텔링, 클래스 프리뷰 |
| **2축 템플릿 시스템** | 교과 영역(WHAT) × 교육 모델(HOW)로 조합 선택 |
| **멀티 AI 프로바이더** | Anthropic Claude, OpenAI, Google Gemini, Upstage Solar — 필요한 거 고르기 |
| **Mermaid & 회로도** | 다이어그램도 라이트박스로 확대 |
| **평가 단계 0~4** | 자기점검 · 확인문제 · 형성평가 · 인터랙티브 퀴즈 |
| **배포 형태 3가지** | MkDocs 웹사이트 · Word(DOCX) · GitHub Pages |
| **포트폴리오** | 완성한 교재가 자동으로 모입니다 |

---

## 어떻게 쓰죠?

두 갈래예요. 상황에 맞는 쪽으로 가시면 돼요.

| 이런 분이라면 | 이렇게 시작해요 | 다음 단계 |
|---|---|---|
| **우리 학교·단체 도메인에 올리고 싶어요** | Fly.io · Render · Railway 중에 배포 | [셀프 호스팅 가이드](./DEPLOY.md) |
| **내 노트북에서 혼자 쓰면 돼요** | `LOCAL_MODE=true`로 실행 | [로컬 실행 가이드](./LOCAL.md) |

둘 다 **같은 프로그램**이에요. 인증이나 관리자 기능을 켜고 끄는 차이입니다. 로컬 모드는 Google 로그인도 승인도 없이 바로 쓰실 수 있어요.

---

## 빠른 시작 (로컬 모드)

가장 가벼운 경로예요. 5분 안에 실행됩니다.

```bash
# 1. 클론
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy

# 2. 설치
npm install

# 3. 로컬 모드로 실행
echo "LOCAL_MODE=true" > .env
npm run dev

# 4. 브라우저에서 http://localhost:7830 접속
# 5. 좌측 사이드바 '🔑 AI API 키' 버튼에 키 입력하면 준비 끝
```

> AI API 키가 없으시면? Anthropic은 [console.anthropic.com](https://console.anthropic.com)에서, OpenAI는 [platform.openai.com](https://platform.openai.com)에서 발급하실 수 있어요. 10챕터짜리 교재 한 권에 대략 $1~5 정도 들어갑니다(모델에 따라).

학교·단체 도메인에 올리실 생각이면 [DEPLOY.md](./DEPLOY.md) 쪽으로 넘어가세요.

---

## 관련 문서 지도

사람용 문서와 AI 에이전트용 참조 문서를 나눠두었어요.

### 사람용
- [README.md](./README.md) — 지금 이 파일. 개요와 시작 방법
- [DEPLOY.md](./DEPLOY.md) — 셀프 호스팅 배포 가이드 (Fly.io / Render / Railway)
- [LOCAL.md](./LOCAL.md) — 로컬 모드 상세 가이드
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — 배포 직후 관리자 초기 세팅 (승인 모드, API 키 정책)
- [USER_GUIDE.md](./USER_GUIDE.md) — 선생님용 사용 가이드 (6단계 워크플로우)
- [CONSTITUTION.md](./CONSTITUTION.md) — 설계 철학 12조
- [CHANGELOG.md](./CHANGELOG.md) — 버전별 변경 사항

### AI 에이전트용
- [README-AI.md](./README-AI.md) — 프로젝트 구조·API·환경변수 레퍼런스
- [CLAUDE.md](./CLAUDE.md) — Claude Code 작업 지침
- [AGENTS.md](./AGENTS.md) — 다른 AI 에이전트용 지침

---

## 설계 철학 (짧게)

자세한 건 [CONSTITUTION.md](./CONSTITUTION.md)에 12조로 정리돼 있어요. 핵심만 간추리면:

1. **교사가 결정하고, AI는 도와드려요.** 모든 단계에서 수정·거부·재생성할 수 있어요.
2. **아이디어부터 학생 손에 닿는 교재까지 끊기지 않게.** 배포까지가 한 흐름입니다.
3. **특정 AI나 배포 플랫폼에 묶이지 않아요.** 갈아타기 쉬운 구조로 만들었어요.
4. **처음 쓰는 선생님도 따라오실 수 있게, 숙련된 분은 고급 기능까지.**

---

## 기술 스택

- **프론트엔드**: React 19, Vite 6, React Router 7, Zustand, Tailwind CSS 4
- **백엔드**: Express 5, Node.js 22, 멀티 AI SDK (`@anthropic-ai/sdk`, `openai`, `@google/genai`)
- **인증**: Google Sign-In (OAuth 2.0) + JWT · **로컬 모드에서는 비활성**
- **배포**: Docker 기반, Fly.io / Render / Railway 대응
- **모노레포**: npm workspaces (`client/`, `server/`, `shared/`)

---

## 로드맵

가까운 시일 내 작업할 것들이에요.

- [ ] **`eduflow-js` 리포를 LOCAL_MODE로 통합** — 지금은 로컬용이 별도 리포(`eduflow-js`)로 존재하지만, v0.5.0에서 추가된 `LOCAL_MODE=true` 방식으로 모아가려고 해요. 쓰고 계신 선생님들의 전환 비용이 크지 않도록 순차 안내 예정.
- [ ] **배포 가이드 완비** — 현재는 Fly.io 중심, Render·Railway 레시피 추가 예정.

---

## 기여 · 문의

- 이슈·제안: [GitHub Issues](https://github.com/greatsong/eduflow-deploy/issues)
- 만든 이: **석리송** — AI와 같이 교육 콘텐츠를 만듭니다.

## 라이선스

MIT License

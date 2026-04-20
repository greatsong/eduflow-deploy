# 로컬 모드 실행 가이드

본인 노트북에서 에듀플로를 쓰실 분을 위한 가이드예요.
Google 로그인도 관리자 승인도 없이, `.env` 한 줄로 바로 실행됩니다.

> 여러 명이 같이 쓰실 거면 [DEPLOY.md](./DEPLOY.md)로 가세요.

---

## 이 모드의 성격

- `LOCAL_MODE=true` 하나로 **인증·관리자·승인 시스템이 전부 꺼진** 상태가 돼요
- AI API 키는 본인이 브라우저 사이드바에서 입력 (서버 제공 키 없음)
- 데이터는 전부 본인 노트북의 `./projects/`에 저장, 용량·모델 제한 없음

---

## 필요한 것

- **Node.js 20+**
- **Git**
- **AI API 키** 1개 이상 (Anthropic·OpenAI·Google·Upstage 중)

---

## Windows — 처음부터 설치하기

컴퓨터 설치가 낯설어도 그대로 따라오시면 됩니다. 전체 10분.

### 1. Git 설치

1. https://git-scm.com/download/win 접속 — 다운로드가 자동으로 시작됩니다
2. 받은 `.exe` 파일을 더블클릭
3. 설치창이 뜨면 **Next**만 계속 누르다가, 마지막에 **Install** → **Finish**

확인: `Windows 키` → `cmd` 입력 → **명령 프롬프트**를 열고
```
git --version
```
`git version 2.xx.x` 같은 숫자가 나오면 OK.

> 오류가 나면 명령 프롬프트를 닫고 새로 열어서 다시 해보세요.

### 2. Node.js 설치

1. https://nodejs.org 접속 → 초록색 **LTS** 버튼 클릭
2. 받은 `.msi` 파일을 더블클릭 → **Next** 반복 → **Install** → **Finish**

확인: **새로 연** 명령 프롬프트에서
```
node --version
npm --version
```
둘 다 숫자가 나오면 OK.

### 3. 에듀플로 받기

명령 프롬프트에서 아래를 순서대로 입력하세요.
```
cd %USERPROFILE%\Desktop
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy
npm install
```

`npm install`은 1~3분 걸립니다. 노란색 `warn`은 무시하셔도 되고, 빨간색 `error`만 아니면 성공.

> **"지정된 경로를 찾을 수 없습니다"** 가 뜨면 OneDrive가 바탕화면을 동기화 중입니다.
> `cd %USERPROFILE%\Desktop` 대신 아래를 쓰세요:
> ```
> cd "%USERPROFILE%\OneDrive\Desktop"
> ```

### 4. 로컬 모드 활성화 + 실행

```
echo LOCAL_MODE=true > .env
npm run dev
```

아래 메시지가 나오면 성공.
```
[0] [EduFlow] 서버 실행 중: http://localhost:7829
[1]   ➜  Local:   http://localhost:7830/
```

크롬·엣지의 **주소창**(검색창 아님)에 `http://localhost:7830`을 입력하면 홈 화면이 뜹니다.

### 5. AI API 키 입력

왼쪽 사이드바 하단의 **🔑 AI API 키** 버튼을 클릭 → 프로바이더 선택 → 키를 붙여넣기(Ctrl+V) → **저장**.

최소 1개만 넣으면 시작할 수 있습니다. 키는 브라우저에 자동 저장돼서 다음에 또 넣을 필요 없어요.

### 다음 실행부터

명령 프롬프트를 열어 매번 아래 두 줄.
```
cd %USERPROFILE%\Desktop\eduflow-deploy
npm run dev
```

**바로가기 한 번 만들어두기** (선택, 더블클릭 한 번으로 시작)
1. 바탕화면 우클릭 → **새로 만들기** → **바로 가기**
2. 위치 입력란에 아래를 붙여넣기
   ```
   cmd /k "cd %USERPROFILE%\Desktop\eduflow-deploy && npm run dev"
   ```
3. 이름을 **에듀플로 실행**으로 저장

### 종료

명령 프롬프트에서 `Ctrl + C` → `Y` → Enter.

---

## Mac / Linux — 처음부터 설치하기

```bash
# Node.js (없으면)
brew install node

# 클론·설치·실행
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy
npm install
echo "LOCAL_MODE=true" > .env
npm run dev
```

브라우저에서 http://localhost:7830 접속 → 사이드바 **🔑 AI API 키** 버튼에서 키 입력.

---

## API 키

### 발급처와 비용

교재 1권(10챕터) 기준 예상 비용.

| 프로바이더 | 발급 | 예상 비용 |
|---|---|---|
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) | Haiku $0.3 / Sonnet $1.5 / Opus $5 |
| OpenAI | [platform.openai.com](https://platform.openai.com) | 모델에 따라 |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 상대적으로 저렴 |
| Upstage Solar | [console.upstage.ai](https://console.upstage.ai) | — |

### 입력 방법

**브라우저 입력(권장)** — 사이드바 🔑 버튼. localStorage에 저장되며 서버로 전송되지 않습니다. 여러 프로바이더 동시 등록 가능.

**`.env` 파일** — 아래 형식으로 추가 후 서버 재시작.
```
LOCAL_MODE=true
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...
# UPSTAGE_API_KEY=up_...
```

둘 다 설정 시 **브라우저 키가 우선**입니다.

---

## 데이터 저장 위치

```
eduflow-deploy/
├── projects/               # 내 프로젝트 데이터 (gitignore)
│   └── <프로젝트명>/
│       ├── config.json, toc.json, progress.json
│       ├── discussions/    # AI 대화 기록
│       ├── docs/           # 생성된 챕터 + 이미지
│       ├── chat_history/
│       └── references/     # 업로드한 참고자료
└── templates/              # 교육 템플릿 8종 (수정 가능)
```

**백업·이사**: `projects/` 폴더를 통째로 복사하시면 됩니다.

---

## 업데이트

```
git pull
npm install    # 새 의존성 있을 때만 필요
npm run dev
```

`projects/`는 업데이트로 건드리지 않으니 안심하셔도 돼요.

---

## 문제 해결

| 증상 | 해결 |
|---|---|
| `node 명령어를 찾을 수 없음` | Node.js 재설치 후 터미널 **새로** 열기 |
| `npm install`이 빨간 오류로 실패 | `npm cache clean --force` 후 재시도 |
| `port already in use` (Windows) | `taskkill /F /IM node.exe` 후 `npm run dev` |
| `port already in use` (Mac) | `lsof -ti:7830 \| xargs kill -9` |
| "지정된 경로를 찾을 수 없습니다" (Windows) | `cd "%USERPROFILE%\OneDrive\Desktop"` 로 대체 |
| `API 키가 필요합니다` | 사이드바 🔑 버튼에서 키 입력 |
| 로그인 화면이 나옴 | `.env` 안에 `LOCAL_MODE=true`가 있는지 확인 (따옴표 X) |
| EACCES permission denied (Mac) | `sudo chown -R $(whoami) ~/.npm` 후 재시도 |

빨간 오류가 해결되지 않으면 [GitHub Issues](https://github.com/greatsong/eduflow-deploy/issues)에 스크린샷과 함께 남겨주세요.

---

## 배포 기능 쓰려면 (선택)

Step 5의 웹 배포·DOCX 변환은 외부 도구가 필요해요. **교재 생성까지는 없어도 동작합니다.**

| 도구 | 용도 | Mac | Windows |
|---|---|---|---|
| MkDocs | 웹사이트 빌드 | `pip install mkdocs mkdocs-material` | 공식 인스톨러 |
| Pandoc | Word 변환 | `brew install pandoc` | 공식 인스톨러 |
| GitHub CLI | Pages 배포 | `brew install gh` | 공식 인스톨러 |

---

## 배포 모드와의 차이

| 항목 | 로컬 모드 | 배포 모드 |
|---|---|---|
| 실행 | 내 노트북 | Fly.io / Render 등 |
| 로그인 | 없음 | Google Sign-In |
| 관리자 | 없음 | `ADMIN_EMAILS` 계정 |
| 승인 시스템 | 없음 | 선택 (approval/open) |
| API 키 | 내가 입력 | 관리자 제공 or 사용자 입력 |
| 데이터 | `./projects/` | `/data/projects/` (볼륨) |
| 프로젝트 제한 | 없음 | 사용자당 99개 |
| 공유 | 내 컴퓨터만 | URL로 여러 명 |

---

## `eduflow-js`에서 이사 오시는 분께

- **기능**: 거의 동일해요. 일부 최신 기능(2축 템플릿, Astro Starlight 등)은 이쪽에 먼저 들어옵니다.
- **데이터 호환**: `eduflow-js/projects/<name>/`을 이 리포의 `projects/` 아래에 그대로 복사하면 열립니다.
- **API 키**: 기존 방식 동일 (브라우저 입력 또는 `.env`).
- **장기 방향**: `eduflow-js`는 이 LOCAL_MODE로 통합 예정. 급하게 옮기지 않으셔도 되고, 별도 공지가 갑니다.

---

## 관련 문서

- [README.md](./README.md) — 프로젝트 개요
- [DEPLOY.md](./DEPLOY.md) — 셀프 호스팅 배포 가이드
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — 배포 후 관리자 설정
- [USER_GUIDE.md](./USER_GUIDE.md) — 6단계 워크플로우 상세
- [README-AI.md](./README-AI.md) — AI 에이전트용 기술 레퍼런스

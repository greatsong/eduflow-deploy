# 로컬 모드 실행 가이드

본인 노트북에서 혼자, 또는 수업 중 오프라인으로 에듀플로를 쓰실 분을 위한 가이드예요. Google 로그인도 관리자 승인도 없이 바로 실행됩니다.

> 학교·단체 도메인에 올려서 여러 분이 함께 쓰실 거면 [DEPLOY.md](./DEPLOY.md)로 가세요.

---

## 이 모드의 성격

- `LOCAL_MODE=true` 환경변수 하나로 **인증·관리자·승인 시스템이 전부 꺼진** 상태가 돼요
- 각자 **자기 AI API 키**를 브라우저 사이드바에서 입력해서 사용 (서버 제공 키 없음)
- 프로젝트 개수 제한 없음, 전 모델 허용
- 데이터는 전부 본인 노트북 로컬 디스크(`./projects/`)에 저장

> 기존 `eduflow-js` 리포를 쓰고 계셨다면, 이 모드가 그 자리를 대신할 예정이에요. 기능은 동일하고, 한 코드베이스에서 관리되니 업데이트가 훨씬 빨라집니다.

---

## 필요한 것

| 항목 | 설명 | 소요 시간 |
|---|---|---|
| Node.js 20+ | 프로그램 실행 환경 | 5분 |
| Git | 코드 받기 | 2분 (없으면) |
| AI API 키 | 최소 1개 (Anthropic·OpenAI·Google·Upstage 중) | 5분 |

### Node.js 설치 (Mac)
```bash
brew install node
node --version   # v20 이상이면 OK
```

### Node.js 설치 (Windows)
1. [nodejs.org](https://nodejs.org) → **LTS 버전** 다운로드
2. 설치 마법사 기본값으로 진행
3. PowerShell에서 `node --version` 확인

---

## 5분 안에 시작하기

```bash
# 1. 클론
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy

# 2. 의존성 설치 (1~2분)
npm install

# 3. 로컬 모드 설정
echo "LOCAL_MODE=true" > .env

# 4. 실행
npm run dev
```

그러면 두 개의 서버가 같이 뜹니다.
- 프론트: **http://localhost:7830** ← 이쪽 접속
- 백엔드: http://localhost:7829 (직접 접속 X)

브라우저에서 `http://localhost:7830`을 여시면 바로 홈 화면이 나와요.

---

## API 키 입력

처음 열면 "AI API 키를 설정해주세요" 안내가 보일 거예요. 두 가지 방법이 있어요.

### 방법 A. 브라우저에서 입력 (권장)

좌측 사이드바 **🔑 AI API 키** 버튼 클릭 → 프로바이더 선택 → 키 입력 → 저장.

- 키는 **브라우저 localStorage**에 저장돼요 (서버로 전송되지 않음)
- 여러 프로바이더 키를 동시에 저장 가능
- 다음 실행 시에도 유지

### 방법 B. `.env` 파일에 넣기

```bash
# .env 파일에 추가
LOCAL_MODE=true
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...
# UPSTAGE_API_KEY=up_...
```

저장 후 서버 재시작(`Ctrl+C` → `npm run dev`).

> 두 방법을 같이 쓰면 **브라우저 입력 키가 우선**이에요.

### API 키 발급처

| 프로바이더 | 발급 | 교재 1권 예상 비용 |
|---|---|---|
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) | Haiku $0.3 / Sonnet $1.5 / Opus $5 |
| OpenAI | [platform.openai.com](https://platform.openai.com) | 모델에 따라 |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 상대적으로 저렴 |
| Upstage Solar | [console.upstage.ai](https://console.upstage.ai) | — |

---

## 데이터 저장 위치

전부 리포 내부에 저장돼요.

```
eduflow-deploy/
├── projects/               # 프로젝트별 데이터 (생성되면 gitignore됨)
│   └── <name>/
│       ├── config.json
│       ├── progress.json
│       ├── toc.json
│       ├── discussions/
│       ├── docs/           # 생성된 챕터 + 이미지
│       ├── chat_history/
│       └── references/     # 업로드한 참고자료
└── templates/              # 교육 템플릿 8종 (수정 가능)
```

**백업**: `projects/` 폴더를 통째로 복사하시면 돼요.

**다른 컴퓨터로 옮기기**: `projects/<프로젝트명>/` 디렉터리를 대상 컴퓨터의 같은 경로로 복사.

---

## 매번 실행하기

```bash
cd /path/to/eduflow-deploy
npm run dev
```

브라우저에서 http://localhost:7830 접속. 중지하려면 터미널에서 `Ctrl+C`.

---

## 업데이트

```bash
cd /path/to/eduflow-deploy
git pull
npm install    # 새 의존성 있을 때만 필요
npm run dev
```

`projects/` 폴더는 업데이트로 건드리지 않으니 안심하셔도 돼요.

---

## 배포 모드와의 차이

| 항목 | 로컬 모드 | 배포 모드 |
|---|---|---|
| 실행 | 내 노트북 | Fly.io / Render 등 |
| 로그인 | 없음 | Google Sign-In 필수 |
| 관리자 | 없음 | ADMIN_EMAILS 계정 |
| 승인 시스템 | 없음 | 선택 (approval/open) |
| API 키 | 내가 입력 | 관리자 제공 or 사용자 입력 |
| 데이터 | `./projects/` | `/data/projects/` (볼륨) |
| 프로젝트 제한 | 없음 | 사용자당 99개 |
| 공유 | 내 컴퓨터만 접근 | URL로 여러 명이 접속 |

---

## 배포 기능 쓰려면 (선택)

Step 5의 웹 배포·DOCX 변환을 쓰시려면 외부 도구가 필요해요. **교재 생성까지는 없어도 됩니다.**

| 도구 | 용도 | 설치 (Mac) |
|---|---|---|
| MkDocs | 웹사이트 빌드 (레거시 테마) | `pip install mkdocs mkdocs-material` |
| Pandoc | Word 변환 | `brew install pandoc` |
| GitHub CLI | GitHub Pages 배포 | `brew install gh` |
| Git | 버전 관리 | `brew install git` |

Windows는 각 공식 사이트의 인스톨러를 쓰시면 돼요.

---

## 문제 해결

| 증상 | 해결 |
|---|---|
| `node 명령어를 찾을 수 없어요` | Node.js 재설치, 터미널 재시작 |
| `npm install` 오류 | `npm cache clean --force` 후 재시도 |
| 포트 7830/7829가 이미 사용 중 | `lsof -ti:7830 \| xargs kill -9`, `lsof -ti:7829 \| xargs kill -9` |
| `API 키가 필요합니다` 메시지 | 사이드바 API 키 버튼에서 입력 또는 `.env`에 설정 |
| 로그인 화면이 나와요 | `.env`에 `LOCAL_MODE=true`가 있는지 확인. 값이 `"true"` 따옴표로 감싸면 안 됨 |
| EACCES permission denied (Mac) | `sudo chown -R $(whoami) ~/.npm` 후 재시도 |

---

## `eduflow-js`를 쓰고 계신 분께

기존 로컬용 리포(`eduflow-js`)와 이 모드의 관계를 짧게 안내드려요.

- **기능**: 거의 동일해요. 일부 최신 기능(2축 템플릿 등)은 이쪽이 먼저 들어와 있습니다.
- **데이터 호환**: 프로젝트 폴더 구조가 같아서 `eduflow-js/projects/<name>/`을 이 리포의 `projects/`에 복사하면 그대로 열려요.
- **API 키**: 기존 방식과 동일(브라우저 입력 or `.env`).
- **장기 방향**: `eduflow-js` 리포는 이 LOCAL_MODE로 통합 예정. 급하게 옮기지 않으셔도 되며, 안내가 따로 갈 거예요.

---

## 관련 문서

- [README.md](./README.md) — 프로젝트 개요
- [DEPLOY.md](./DEPLOY.md) — 셀프 호스팅 배포 가이드
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — 배포 후 관리자 설정
- [USER_GUIDE.md](./USER_GUIDE.md) — 6단계 워크플로우 상세 *(작성 예정)*
- [README-AI.md](./README-AI.md) — AI 에이전트용 기술 레퍼런스

# 셀프 호스팅 배포 가이드

학교·단체·개인 도메인에 에듀플로를 직접 올리고 싶으신 분을 위한 가이드입니다. **Fly.io 중심**으로 설명하고, Render 레시피는 끝에 부록으로 붙여두었어요.

> 로컬 노트북에서 혼자 쓰실 거면 이 문서 대신 [LOCAL.md](./LOCAL.md)로 가시는 게 빨라요. 배포 후 관리자 설정은 [ADMIN_SETUP.md](./ADMIN_SETUP.md)에서 이어집니다.

---

## 이 가이드의 전제

- **목표 환경**: Fly.io (Tokyo 리전 기준). 현재 `eduflow-greatsong.fly.dev`가 이 구성으로 운영 중입니다.
- **스펙**: 512MB RAM · shared CPU 1 · 영구 볼륨 `/data` 1GB. 소규모~중규모(수십~수백 사용자)에 충분합니다.
- **예상 비용**: Fly.io 무료 할당을 넘어서면 월 $2~5선. AI API 비용은 별도 (교재 한 권당 $1~5).
- **소요 시간**: 처음이면 1~2시간. 익숙하면 30분.

---

## 0. 배포 준비 체크리스트

배포 시작 전에 아래가 준비돼 있어야 해요.

### 계정
- [ ] **Fly.io 계정** — <https://fly.io/app/sign-up>
- [ ] **GitHub 계정** — OAuth 앱 발급용 + 교재를 GitHub Pages로 배포하려면 필수
- [ ] **Google Cloud Console 프로젝트** — Google Sign-In 클라이언트 ID 발급용
- [ ] **AI 프로바이더 계정 중 최소 1개** — Anthropic(권장), OpenAI, Google AI, Upstage

### CLI 도구
```bash
# flyctl (Fly.io CLI)
brew install flyctl                # Mac
# Windows/Linux는 https://fly.io/docs/hands-on/install-flyctl/

# GitHub CLI (선택, 포트폴리오/배포 편의용)
brew install gh

# 인증
fly auth login
gh auth login
```

### 리포 준비
```bash
git clone https://github.com/greatsong/eduflow-deploy.git
cd eduflow-deploy
```

---

## 1. OAuth 클라이언트 발급

배포 모드는 Google 로그인을 쓰기 때문에 OAuth 클라이언트를 먼저 만들어야 합니다. GitHub OAuth는 **사용자가 자기 리포에 교재를 푸시하는 기능**에 필요한데, 우선은 건너뛰고 나중에 추가해도 돼요.

### 1-1. Google Sign-In 클라이언트 ID

1. [Google Cloud Console](https://console.cloud.google.com/) → 새 프로젝트 생성 (또는 기존 사용)
2. **API 및 서비스 → OAuth 동의 화면**
   - 사용자 유형: **외부(External)**
   - 앱 이름, 지원 이메일 입력
   - 범위(Scopes)는 기본값 유지 (profile, email)
   - 테스트 사용자에 본인 이메일 추가 (게시 상태를 "프로덕션"으로 바꾸기 전까지)
3. **API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://<당신의-앱>.fly.dev`
   - 승인된 리디렉션 URI: 지금은 비워두기 (에듀플로는 ID 토큰 방식이라 리디렉션 불필요)
4. 발급된 **클라이언트 ID 복사** → 나중에 `GOOGLE_CLIENT_ID`로 씀

### 1-2. GitHub OAuth 앱 (선택, 나중에 추가 가능)

1. [GitHub → Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/applications/new)
2. 설정값:
   - Homepage URL: `https://<당신의-앱>.fly.dev`
   - Authorization callback URL: `https://<당신의-앱>.fly.dev/api/auth/github/callback`
3. **Client ID**, **Client Secret** 복사 → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### 1-3. 포트폴리오용 GitHub 토큰 (선택)

자동 포트폴리오 리포에 푸시하려면 Personal Access Token이 하나 필요해요.
- [GitHub → Settings → Developer settings → Personal access tokens → Fine-grained](https://github.com/settings/personal-access-tokens/new)
- 권한: 대상 포트폴리오 리포에 대해 **Contents: Read and write**
- 토큰 복사 → `PORTFOLIO_GITHUB_TOKEN`

---

## 2. Fly.io 앱 생성

기존 `fly.toml`을 그대로 쓰면 앱 이름이 `eduflow-greatsong`으로 잡혀요. 본인 앱 이름으로 바꿔서 시작하세요.

### 2-1. 앱 이름 변경
```bash
# fly.toml 첫 줄의 app 이름을 본인 것으로 수정
# 예: app = 'eduflow-myschool'
```

### 2-2. 앱 생성 (배포는 아직 안 함)
```bash
fly launch --no-deploy --copy-config
# - Would you like to tweak these settings? Yes
# - 앱 이름 확인, 리전 선택(nrt 권장), 데이터베이스는 No
```

### 2-3. 영구 볼륨 생성

프로젝트 데이터·사용자 DB·토큰 로그가 전부 `/data`에 저장돼요. 볼륨을 먼저 만들어둡니다.

```bash
fly volumes create eduflow_data --region nrt --size 1
```

> 크기는 시작은 1GB로 충분. 사용자가 늘어나면 `fly volumes extend`로 확장 가능.

---

## 3. Secrets 세팅

환경변수는 전부 `fly secrets set`으로 넣습니다. 아래를 본인 값으로 바꿔서 실행하세요.

### 3-1. 필수 시크릿
```bash
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com" \
  ADMIN_EMAILS="you@yourschool.kr" \
  PROJECTS_DIR="/data/projects" \
  DATA_DIR="/data"
```

| 변수 | 왜 필요한가 |
|------|-------------|
| `ANTHROPIC_API_KEY` | 기본 AI 프로바이더. OpenAI/Gemini/Solar만 쓸 거면 해당 키로 대체 |
| `JWT_SECRET` | 사용자 로그인 토큰 서명. 예시처럼 랜덤 32바이트 권장 |
| `GOOGLE_CLIENT_ID` | 1-1에서 발급받은 값 |
| `ADMIN_EMAILS` | 여기 적힌 Google 계정이 첫 관리자가 됨 (쉼표 구분 다수 가능) |
| `PROJECTS_DIR` · `DATA_DIR` | 볼륨 경로 고정 |

### 3-2. 선택 시크릿 (필요할 때 추가)
```bash
# 다른 AI 프로바이더도 같이 쓰는 경우
fly secrets set OPENAI_API_KEY="sk-..." GOOGLE_API_KEY="..." UPSTAGE_API_KEY="up_..."

# 사용자별 GitHub 배포 기능 쓰는 경우
fly secrets set \
  GITHUB_CLIENT_ID="..." \
  GITHUB_CLIENT_SECRET="..." \
  GITHUB_CALLBACK_URL="https://<당신의-앱>.fly.dev/api/auth/github/callback"

# 포트폴리오 자동 푸시 쓰는 경우
fly secrets set PORTFOLIO_GITHUB_TOKEN="github_pat_..."
```

### 3-3. 절대 넣지 말 것
- `LOCAL_MODE`: 배포 환경에서는 절대 `true`로 두지 마세요. Google 로그인·관리자·승인 시스템 전부 꺼지고 mock 사용자가 주입됩니다.

---

## 4. 첫 배포

```bash
fly deploy
```

처음엔 Docker 이미지 빌드 때문에 **10~15분**쯤 걸려요. Node 22 + Python + pandoc + gh + Astro Starlight 빌드가 한 번에 들어갑니다.

배포 완료 후:
```bash
fly status
fly logs           # 실시간 로그
open https://<당신의-앱>.fly.dev
```

### 배포 성공 신호
- `fly status`에서 머신이 **started** 상태
- 브라우저 접속 시 Google Sign-In 화면이 뜸
- `/api/health` 응답이 200

---

## 5. 최초 관리자 진입

1. 브라우저에서 배포 도메인 접속
2. **Google로 로그인** — 이때 쓰는 이메일이 `ADMIN_EMAILS`에 있어야 함
3. EntryForm(지원 정보) 작성 완료
4. 관리자 권한으로 Admin 페이지 접근 가능 (사이드바에 노출됨)

첫 접속 이후 해야 할 관리자 초기 세팅(가입 모드 결정, 서버 API 키 정책, 허용 모델 등)은 [ADMIN_SETUP.md](./ADMIN_SETUP.md)에서 이어집니다.

---

## 6. 업데이트 배포

코드 변경 후 재배포:
```bash
git pull               # 또는 본인 변경사항 커밋
fly deploy
```

### 빌드 캐시 관련
Dockerfile에서 `rm -rf client/dist` 후 빌드하므로, 이전 `client/dist`가 남아있어도 항상 새 빌드가 들어갑니다. 그럼에도 의심스러우면:
```bash
fly deploy --no-cache
```

---

## 7. 운영

### 로그 보기
```bash
fly logs                      # 실시간
fly logs --instance <id>      # 특정 머신
```

### 스케일링
```bash
fly scale memory 1024         # 메모리 증가
fly scale count 2             # 인스턴스 추가 (세션 공유 없음 주의)
```

> **주의**: 에듀플로 v0.5.0 기준 세션은 JWT로 무상태지만, **프로젝트 데이터는 볼륨에 저장**돼요. 멀티 인스턴스로 늘리면 같은 볼륨을 공유하도록 추가 설정이 필요합니다.

### 볼륨 접근 (백업·복구)
```bash
fly ssh console
# 컨테이너 안에서
ls /data
tar czf /tmp/backup.tar.gz /data
```

로컬로 내려받기:
```bash
fly ssh sftp get /tmp/backup.tar.gz ./backup.tar.gz
```

### Auto-stop 동작
`fly.toml`에 `auto_stop_machines = 'stop'`이 설정돼 있어 유휴 시 머신이 멈춰요. 첫 요청 시 2~5초 지연 발생. 항상 켜두려면:
```toml
# fly.toml
[http_service]
  auto_stop_machines = false
  min_machines_running = 1
```

---

## 8. 커스텀 도메인 (선택)

```bash
# 1. DNS에서 A/AAAA 또는 CNAME 레코드를 fly IP로 향하게
fly ips list

# 2. 인증서 발급
fly certs create eduflow.yourschool.kr

# 3. 상태 확인 (보통 1~5분 내 자동 발급)
fly certs show eduflow.yourschool.kr
```

Google OAuth 쪽의 **승인된 JavaScript 원본**에도 커스텀 도메인을 추가해야 로그인이 작동합니다.

---

## 9. 문제 해결

| 증상 | 원인 · 해결 |
|------|-------------|
| Google 로그인이 안 돼요 | `GOOGLE_CLIENT_ID` 누락 또는 OAuth 동의 화면에 테스트 사용자 미등록. 클라이언트 ID의 **승인된 JavaScript 원본**에 배포 도메인 추가됐는지 확인 |
| 첫 페이지가 느려요 | `auto_stop_machines` 때문. 위 7번 항목 참고 |
| Google Sign-In postMessage 차단 | v0.5.0에서 COOP 헤더가 `/api` 경로에만 걸리도록 수정됨. 그래도 안 되면 브라우저 콘솔에서 `Cross-Origin-Opener-Policy` 헤더 확인 |
| 빌드 실패 (OOM) | 기본 512MB로 부족하면 `fly scale memory 1024`로 증가 후 재배포 |
| 사용자가 "pending" 상태에서 갇힘 | `registrationMode`가 `approval`. Admin에서 승인하거나, `open`으로 바꾸면 이후 가입자 자동 active |
| AI 호출이 안 돼요 | 1) 해당 프로바이더 시크릿 누락, 2) 관리자 설정의 `apiMode`와 충돌, 3) 사용자 키 설정 우선순위. [README-AI.md](./README-AI.md) 참조 |
| 이미지 생성이 SVG로만 나와요 | `GOOGLE_API_KEY`와 `OPENAI_API_KEY` 둘 다 없어서 플레이스홀더 폴백. 키 추가 후 재시도 |
| 배포 후에도 옛날 화면 | 브라우저 캐시 또는 Vite 번들. 강제 새로고침(Cmd+Shift+R) 시도 |

---

## 부록 A. Render 배포 레시피

리포에 `render.yaml`이 포함돼 있어 [Render Blueprint](https://render.com/docs/blueprint-spec)로 바로 올릴 수 있어요. 다만 다음을 직접 설정해야 합니다.

1. [Render 대시보드 → New → Blueprint](https://dashboard.render.com/blueprints) → 리포 선택
2. 환경변수 수동 추가 — `render.yaml`엔 `NODE_ENV`, `PROJECTS_DIR`만 있어요. 나머지 시크릿(AI 키, OAuth, JWT, ADMIN_EMAILS)은 Render 대시보드의 Environment에서 추가.
3. **디스크**: `/data/projects`에 1GB 디스크가 자동 생성됩니다. Fly.io와 다르게 `DATA_DIR=/data`는 기본으로 잡아두세요.
4. OAuth 리디렉션 URL / JavaScript 원본을 Render 도메인(`<name>.onrender.com`)으로 갱신.

Render 무료 티어는 유휴 시 완전 종료(30초+ 콜드스타트)라, 실사용은 Starter 플랜 이상을 권장합니다.

---

## 부록 B. Railway 배포

*(예정)* Railway도 Dockerfile 기반으로 배포 가능한데, 레시피는 다음 업데이트에 추가할 예정이에요. 볼륨 마운트(`/data`)와 시크릿 세팅만 Fly.io와 동일하게 맞추면 큰 문제 없습니다.

---

## 체크리스트 요약

- [ ] Fly.io, Google Cloud, GitHub 계정 준비
- [ ] flyctl 설치 · 로그인
- [ ] Google OAuth 클라이언트 ID 발급 (JavaScript 원본: 배포 도메인)
- [ ] (선택) GitHub OAuth 앱 + 포트폴리오 토큰
- [ ] `fly.toml`의 `app` 이름 변경
- [ ] `fly launch --no-deploy`
- [ ] `fly volumes create eduflow_data --size 1`
- [ ] `fly secrets set` — ANTHROPIC_API_KEY, JWT_SECRET, GOOGLE_CLIENT_ID, ADMIN_EMAILS, PROJECTS_DIR, DATA_DIR
- [ ] `fly deploy`
- [ ] 브라우저에서 Google 로그인 → 관리자 진입 확인
- [ ] [ADMIN_SETUP.md](./ADMIN_SETUP.md)로 이어서 초기 설정

---

## 관련 문서

- [README.md](./README.md) — 프로젝트 개요
- [README-AI.md](./README-AI.md) — 기술 레퍼런스 (환경변수 · API · 데이터 구조)
- [LOCAL.md](./LOCAL.md) — 로컬 모드 실행 *(작성 예정)*
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — 관리자 초기 세팅 *(작성 예정)*
- [USER_GUIDE.md](./USER_GUIDE.md) — 선생님용 사용 가이드 *(작성 예정)*
- [CHANGELOG.md](./CHANGELOG.md) — 버전 이력

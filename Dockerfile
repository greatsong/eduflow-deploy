FROM node:22-slim

# 시스템 도구 설치: Python, pip, pandoc, git, gh CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    pandoc \
    git \
    curl \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# MkDocs + Material 테마 설치 (레거시 테마 지원용 — 기본 테마는 Astro Starlight)
RUN python3 -m pip install --break-system-packages mkdocs mkdocs-material

# Astro Starlight 빌드 가속: npm 캐시 디렉토리 설정
RUN mkdir -p /app/.npm-cache && npm config set cache /app/.npm-cache

WORKDIR /app

# 의존성 먼저 복사 (캐시 활용)
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

RUN npm install

# Astro Starlight 공통 node_modules 사전 설치
# Step 5 빌드마다 수행하던 `npm install`(60~120초)을 제거하기 위해 이미지에 베이킹한다.
# 런타임에는 server/services/deployment.js의 _buildStarlight이
# 프로젝트별 .starlight-build/node_modules를 이 디렉토리로 심볼릭 링크 연결해 재사용한다.
# 의존성 버전은 server/services/starlightGenerator.js의 buildPackageJson()과 반드시 일치해야 한다.
COPY server/services/starlight-cache/package.json /app/server/services/starlight-cache/package.json
RUN cd /app/server/services/starlight-cache \
    && npm install --no-audit --no-fund --prefer-offline \
    && npm cache clean --force

# 소스 복사 + 빌드
COPY . .
RUN rm -rf client/dist && npm run build

EXPOSE 7829

CMD ["npm", "start"]

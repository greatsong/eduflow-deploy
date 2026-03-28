FROM node:20-slim

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

# MkDocs + Material 테마 설치
RUN python3 -m pip install --break-system-packages mkdocs mkdocs-material

WORKDIR /app

# 의존성 먼저 복사 (캐시 활용)
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

RUN npm install

# 소스 복사 + 빌드
COPY . .
# 캐시 버스터: 2026-03-28-v2
RUN npm run build

EXPOSE 7829

CMD ["npm", "start"]

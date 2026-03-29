import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import jwt from 'jsonwebtoken';
import modelsRouter from './routes/models.js';
import projectsRouter from './routes/projects.js';
import discussionsRouter from './routes/discussions.js';
import tocRouter from './routes/toc.js';
import chaptersRouter from './routes/chapters.js';
import deployRouter from './routes/deploy.js';
import portfolioRouter from './routes/portfolio.js';
import compareRouter from './routes/compare.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { ServerSettings } from './services/settings.js';
import { existsSync } from 'fs';
import { stat as fsStat } from 'fs/promises';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireApproved } from './middleware/auth.js';
import { sanitizeId } from './middleware/sanitize.js';
import { UserStore } from './services/userStore.js';
import { TIER_CONFIG } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') }); // 루트 .env 로드

const LOCAL_MODE = process.env.LOCAL_MODE === 'true';

const app = express();
const PORT = process.env.PORT || 7829;

// UserStore 초기화 (사용자 GitHub 토큰 등 파일 기반 저장)
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '..', 'projects');
const DATA_BASE = process.env.DATA_DIR || path.join(__dirname, '..');
const userStore = new UserStore(DATA_BASE);
userStore.init().then(() => {
  console.log('[EduFlow] UserStore 초기화 완료');
}).catch((err) => {
  console.error('[EduFlow] UserStore 초기화 실패:', err.message);
});
app.locals.userStore = userStore;

// 미들웨어 — 프로덕션에서는 same-origin, 개발에서는 localhost 허용
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:7830', 'http://localhost:7829'];
app.use(cors({
  origin: (origin, cb) => {
    // same-origin (origin 없음) 또는 허용 목록
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
}));
app.use(express.json({ limit: '10mb' }));

// COOP 헤더: API 응답에만 설정 (HTML 페이지에 설정하면 Google Sign-In postMessage 차단됨)
app.use('/api', (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 운영 설정 인스턴스
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const serverSettings = new ServerSettings(path.join(DATA_DIR, 'settings.json'));

// API 키 상태 확인
if (LOCAL_MODE) {
  // LOCAL_MODE: 인증 없이 모든 기능 개방
  app.get('/api/auth/status', async (req, res) => {
    const settings = await serverSettings.get();
    const serverProviders = {};
    for (const provider of ['anthropic', 'openai', 'google', 'upstage']) {
      serverProviders[provider] = !!process.env[`${provider.toUpperCase()}_API_KEY`];
    }
    const hasEnvKey = Object.values(serverProviders).some(Boolean);
    res.json({
      hasEnvKey,
      isAdmin: true,
      apiMode: settings.apiMode || 'user',
      serverModeMessage: settings.serverModeMessage || '',
      allowedModels: settings.allowedModels || [],
      serverProviders,
      sharedProviders: serverProviders,
      tier: 'master',
      allowPremiumModels: true,
    });
  });
} else {
  // Deploy 모드: Google OAuth + JWT + 등급 시스템
  app.get('/api/auth/status', async (req, res) => {
    const JWT_SECRET = process.env.JWT_SECRET || 'eduflow-default-secret-change-me';
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

    let isAdminUser = false;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        isAdminUser = decoded?.email && ADMIN_EMAILS.includes(decoded.email);
      }
    } catch { /* 인증 실패 무시 */ }

    let userTier = 'starter';
    if (isAdminUser) {
      userTier = 'master';
    } else {
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
          const usersFile = path.join(DATA_DIR, 'users.json');
          if (existsSync(usersFile)) {
            const { readFile: rf } = await import('fs/promises');
            const usersData = JSON.parse(await rf(usersFile, 'utf-8'));
            const userRecord = usersData.find(u => u.googleId === decoded?.googleId);
            userTier = userRecord?.tier || 'starter';
          }
        }
      } catch { /* ignore */ }
    }

    const settings = await serverSettings.get();
    const adminKeys = settings.adminApiKeys || {};

    const serverProviders = {};
    const sharedProviders = {};
    for (const provider of ['anthropic', 'openai', 'google', 'upstage']) {
      const envKey = !!process.env[`${provider.toUpperCase()}_API_KEY`];
      const stored = adminKeys[provider];
      const isShared = envKey || !!(stored?.key && stored.shared);
      const isAvailable = isShared || !!(stored?.key && isAdminUser);
      serverProviders[provider] = isAvailable;
      sharedProviders[provider] = isShared;
    }

    const hasEnvKey = Object.values(serverProviders).some(Boolean);

    res.json({
      hasEnvKey,
      isAdmin: isAdminUser,
      apiMode: settings.apiMode || 'user',
      serverModeMessage: settings.serverModeMessage || '',
      allowedModels: settings.allowedModels || [],
      serverProviders,
      sharedProviders,
      tier: userTier,
      allowPremiumModels: TIER_CONFIG[userTier]?.allowPremiumModels ?? false,
    });
  });
}

// API 키 검증 (간소화: 키가 비어있지 않으면 유효로 처리)
app.post('/api/auth/verify', async (req, res) => {
  // 어떤 프로바이더든 키가 있으면 통과
  const hasAny = !!(
    req.headers['x-api-key'] ||
    req.headers['x-openai-key'] ||
    req.headers['x-google-key'] ||
    req.headers['x-upstage-key']
  );
  if (!hasAny) {
    return res.status(400).json({ valid: false, message: 'API 키가 제공되지 않았습니다.' });
  }
  res.json({ valid: true });
});

// 구글 로그인 라우트 (인증 불필요, Deploy 전용)
if (!LOCAL_MODE) {
  app.use('/api/auth', authRouter);
}

// 빌드된 사이트 미리보기 (인증 불필요 — iframe에서 접근)
const PROJECTS_DIR_RESOLVED = process.env.PROJECTS_DIR || path.join(__dirname, '..', 'projects');

app.get('/api/projects/:id/deploy/preview/{*filePath}', async (req, res) => {
  const safe = sanitizeId(req.params.id);
  if (!safe) return res.status(400).json({ message: '잘못된 프로젝트 ID' });

  const siteDir = path.join(PROJECTS_DIR_RESOLVED, safe, 'site');
  if (!existsSync(siteDir)) {
    return res.status(404).json({ message: '빌드된 사이트가 없습니다.' });
  }

  const rawPath = req.params.filePath;
  const requestedPath = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || 'index.html');
  const segments = requestedPath.split('/').filter(Boolean);
  const filePath = path.join(siteDir, ...segments);

  // 경로 탈출 방지
  if (!filePath.startsWith(siteDir)) {
    return res.status(403).json({ message: '접근 금지' });
  }

  try {
    if (!existsSync(filePath)) {
      const indexFallback = path.join(siteDir, 'index.html');
      if (existsSync(indexFallback)) return res.sendFile(indexFallback);
      return res.status(404).json({ message: '파일을 찾을 수 없습니다' });
    }

    const s = await fsStat(filePath);
    if (s.isDirectory()) {
      const dirIndex = path.join(filePath, 'index.html');
      if (existsSync(dirIndex)) return res.sendFile(dirIndex);
      return res.status(404).json({ message: '파일을 찾을 수 없습니다' });
    }

    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

if (LOCAL_MODE) {
  // LOCAL_MODE: 인증 없이 목(mock) 사용자 주입
  app.use('/api', (req, res, next) => {
    req.user = { googleId: 'local', email: 'local@eduflow', name: 'Local User' };
    req.userTier = 'master';
    next();
  });
  console.log('[EduFlow] LOCAL_MODE 활성화 — 인증 없이 실행');
} else {
  // === Deploy 모드: 구글 로그인 인증 + 사용자 승인 시스템 ===
  app.use('/api', requireAuth);

  // 사용자 상태 확인 (pending 여부 + 프로젝트 한도)
  app.get('/api/user/status', async (req, res) => {
    try {
      const { readFile: rf, readdir: rd } = await import('fs/promises');
      const usersRaw = existsSync(path.join(DATA_DIR, 'users.json'))
        ? JSON.parse(await rf(path.join(DATA_DIR, 'users.json'), 'utf-8'))
        : [];
      const user = usersRaw.find(u => u.googleId === req.user?.googleId);

      let projectCount = 0;
      if (existsSync(PROJECTS_DIR_RESOLVED)) {
        try {
          const entries = await rd(PROJECTS_DIR_RESOLVED, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === 'template') continue;
            const configFile = path.join(PROJECTS_DIR_RESOLVED, entry.name, 'config.json');
            if (!existsSync(configFile)) continue;
            try {
              const raw = await rf(configFile, 'utf-8');
              const config = JSON.parse(raw);
              if (config.owner?.googleId === req.user?.googleId) projectCount++;
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      const isAdmin = req.user?.email && ADMIN_EMAILS_LIST.includes(req.user.email);
      const userTier = isAdmin ? 'master' : (user?.tier || 'starter');

      res.json({
        status: user?.status || 'active',
        maxProjects: isAdmin ? 99 : (user?.maxProjects || 1),
        projectCount,
        isAdmin,
        tier: userTier,
        allowPremiumModels: TIER_CONFIG[userTier]?.allowPremiumModels ?? false,
      });
    } catch {
      res.json({ status: 'active', maxProjects: 1, projectCount: 0, tier: 'starter', allowPremiumModels: false });
    }
  });

  // 재신청 (inactive → pending)
  app.post('/api/user/reapply', async (req, res) => {
    try {
      const { readFile: rf, writeFile: wf } = await import('fs/promises');
      const usersFile = path.join(DATA_DIR, 'users.json');
      if (!existsSync(usersFile)) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

      const users = JSON.parse(await rf(usersFile, 'utf-8'));
      const idx = users.findIndex(u => u.googleId === req.user?.googleId);
      if (idx < 0) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      if (users[idx].status !== 'inactive') {
        return res.status(400).json({ message: '재신청은 비활성화된 계정만 가능합니다.' });
      }

      users[idx].status = 'pending';
      users[idx].reappliedAt = new Date().toISOString();
      await wf(usersFile, JSON.stringify(users, null, 2), 'utf-8');
      res.json({ success: true, status: 'pending' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // 사용자 프로필 업데이트
  app.put('/api/user/profile', async (req, res) => {
    try {
      const { readFile: rf, writeFile: wf, mkdir: mkd } = await import('fs/promises');
      const usersFile = path.join(DATA_DIR, 'users.json');
      if (!existsSync(DATA_DIR)) await mkd(DATA_DIR, { recursive: true });
      const users = existsSync(usersFile) ? JSON.parse(await rf(usersFile, 'utf-8')) : [];
      const idx = users.findIndex(u => u.googleId === req.user?.googleId);
      if (idx < 0) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

      const { name, affiliation, subjects, region, intro, motivation, topic, expertise, sampleChapter, samplePerspective } = req.body;
      if (name !== undefined) users[idx].name = name;
      if (affiliation !== undefined) users[idx].affiliation = affiliation;
      if (subjects !== undefined) users[idx].subjects = subjects;
      if (region !== undefined) users[idx].region = region;
      if (intro !== undefined) users[idx].intro = intro;
      if (motivation !== undefined) users[idx].motivation = motivation;
      if (topic !== undefined) users[idx].topic = topic;
      if (expertise !== undefined) users[idx].expertise = expertise;
      if (sampleChapter !== undefined) users[idx].sampleChapter = sampleChapter;
      if (samplePerspective !== undefined) users[idx].samplePerspective = samplePerspective;
      users[idx].updatedAt = new Date().toISOString();

      await wf(usersFile, JSON.stringify(users, null, 2), 'utf-8');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // 관리자 라우트
  app.use('/api/admin', adminRouter);

  // === 이하 라우트는 승인된 사용자만 접근 가능 ===
  app.use('/api', requireApproved);
}

// 라우트
app.use('/api/models', modelsRouter);

// 더 구체적인 프로젝트 서브라우트를 먼저 등록
app.use('/api/projects/:id/discussions', discussionsRouter);
app.use('/api/projects/:id/toc', tocRouter);
app.use('/api/projects/:id/chapters', chaptersRouter);
app.use('/api/projects/:id/deploy', deployRouter);

// 기본 프로젝트 라우트 (context, template-info, references 등 포함)
app.use('/api/projects', projectsRouter);

app.use('/api/portfolio', portfolioRouter);
app.use('/api/compare', compareRouter);

// API 404 핸들러
app.all('/api/{*path}', (req, res) => {
  res.status(404).json({ message: `API 경로를 찾을 수 없습니다: ${req.method} ${req.path}` });
});

// 프로덕션: 프론트엔드 정적 파일 서빙
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// 에러 핸들링 (반드시 마지막)
app.use(errorHandler);

// 전역 예외 처리
process.on('unhandledRejection', (reason) => {
  console.error('[EduFlow] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[EduFlow] Uncaught Exception:', err);
  process.exit(1);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[EduFlow] 서버 실행 중: http://localhost:${PORT}`);
  console.log(`[EduFlow] 프로젝트 디렉토리: ${process.env.PROJECTS_DIR || './projects'}`);
});

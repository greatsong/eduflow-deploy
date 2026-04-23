import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { signToken, requireAuth } from '../middleware/auth.js';
import { upsertUser, checkExistingUser } from './admin.js';
import { createOAuthState, normalizeReturnTo, verifyOAuthState } from '../services/oauthState.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// GitHub OAuth 환경변수
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback';

/**
 * POST /api/auth/google
 * 구글 ID 토큰을 검증하고 앱 JWT를 발급한다.
 */
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential이 필요합니다.' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const user = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const token = signToken(user);

    // 기존 사용자인지 확인 (신규는 여기서 생성하지 않음 → register에서 원자적으로 생성)
    let isNewUser = true;
    try {
      const result = await checkExistingUser(user);
      if (result.exists) {
        isNewUser = false;
        // 기존 사용자만 lastLoginAt 업데이트
        await upsertUser(user);
      }
    } catch (e) {
      console.error('[EduFlow] 사용자 확인 실패:', e.message);
    }

    console.log(`[EduFlow] 구글 로그인: ${user.name} (${user.email}) [${isNewUser ? '신규' : '재방문'}]`);

    res.json({ token, user, isNewUser });
  } catch (err) {
    console.error('[EduFlow] 구글 토큰 검증 실패:', err.message);
    res.status(401).json({ message: '구글 인증에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/register
 * 신규 사용자 원자적 등록: Google 인증 정보 + 프로필 데이터를 한 번에 저장.
 * 2단계 등록(auth → profile)의 데이터 유실 문제를 근본적으로 해결.
 */
router.post('/register', requireAuth, async (req, res) => {
  const { name, affiliation, subjects, region, intro, motivation, topic, expertise, sampleChapter, samplePerspective } = req.body;

  // 필수 필드 검증
  if (!name?.trim() || !affiliation?.trim() || !subjects?.trim() || !region?.trim()
      || !intro?.trim() || !motivation?.trim() || !topic?.trim() || !expertise?.trim()
      || !sampleChapter?.trim() || !samplePerspective?.trim()) {
    return res.status(400).json({ message: '모든 필수 항목을 입력해주세요.' });
  }

  try {
    // 프로필 데이터를 포함하여 사용자 원자적 생성
    const result = await upsertUser({
      googleId: req.user.googleId,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    }, {
      name, affiliation, subjects, region,
      intro, motivation, topic, expertise,
      sampleChapter, samplePerspective,
    });

    console.log(`[EduFlow] 신규 등록 완료: ${name} (${req.user.email}) — 프로필 데이터 포함`);
    res.json({ success: true, user: result });
  } catch (err) {
    console.error('[EduFlow] 신규 등록 실패:', err.message);
    res.status(500).json({ message: '등록에 실패했습니다. 다시 시도해주세요.' });
  }
});

// =============================================
// GitHub OAuth 라우트
// =============================================

/**
 * GET /api/auth/github
 * GitHub OAuth 인증 URL을 반환한다.
 * 쿼리 파라미터 returnTo: 인증 후 리다이렉트할 프론트엔드 URL
 */
router.get('/github', requireAuth, (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ message: 'GitHub OAuth가 설정되지 않았습니다.' });
  }

  // state에 사용자 정보를 서명하여 콜백에서 식별 (변조 방지)
  const state = createOAuthState({
    googleId: req.user.googleId,
    returnTo: normalizeReturnTo(req.query.returnTo),
    issuedAt: Date.now(),
  });

  // 콜백 URL을 절대 경로로 생성
  const callbackUrl = GITHUB_CALLBACK_URL.startsWith('http')
    ? GITHUB_CALLBACK_URL
    : `${req.protocol}://${req.get('host')}${GITHUB_CALLBACK_URL}`;

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'repo');
  authUrl.searchParams.set('state', state);

  res.json({ url: authUrl.toString() });
});

/**
 * GET /api/auth/github/callback
 * GitHub OAuth 콜백: code를 access_token으로 교환하고 저장.
 * 브라우저에서 직접 리다이렉트되므로 인증 미들웨어 없이 state로 사용자 식별.
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('GitHub 인증 파라미터가 누락되었습니다.');
  }

  try {
    // state 검증하여 사용자 정보 복원
    const stateData = verifyOAuthState(state);
    if (!stateData) {
      return res.status(400).send('잘못된 state 파라미터입니다.');
    }

    const { googleId, returnTo } = stateData;
    if (!googleId) {
      return res.status(400).send('사용자 식별 정보가 없습니다.');
    }
    if (stateData.issuedAt && Date.now() - stateData.issuedAt > 10 * 60 * 1000) {
      return res.status(400).send('GitHub 인증 요청이 만료되었습니다. 다시 시도해주세요.');
    }

    // code → access_token 교환
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[EduFlow] GitHub 토큰 교환 실패:', tokenData.error_description);
      return res.status(400).send(`GitHub 인증 실패: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;

    // GitHub 사용자 정보 가져오기
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EduFlow',
      },
    });

    if (!userResponse.ok) {
      return res.status(400).send('GitHub 사용자 정보를 가져올 수 없습니다.');
    }

    const githubUser = await userResponse.json();

    // UserStore에 토큰 저장
    const userStore = req.app.locals.userStore;
    if (userStore) {
      await userStore.saveGitHubToken(googleId, accessToken, githubUser.login);
    }

    console.log(`[EduFlow] GitHub 연동 완료: ${githubUser.login} (Google ID: ${googleId})`);

    const appOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const safeReturnTo = normalizeReturnTo(returnTo);

    // 팝업 창에서 부모 창으로 postMessage 전달 후 자동 닫기
    res.send(`<!DOCTYPE html>
<html><head><title>GitHub 연동 완료</title></head>
<body>
<p>GitHub 연동이 완료되었습니다. 이 창은 자동으로 닫힙니다.</p>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'github-auth-success',
      returnTo: ${JSON.stringify(safeReturnTo)},
      user: {
        username: ${JSON.stringify(githubUser.login)},
        avatarUrl: ${JSON.stringify(githubUser.avatar_url || '')}
      }
    }, ${JSON.stringify(appOrigin)});
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`);
  } catch (err) {
    console.error('[EduFlow] GitHub OAuth 콜백 오류:', err.message);
    res.status(500).send('GitHub 인증 처리 중 오류가 발생했습니다.');
  }
});

/**
 * GET /api/auth/github/status
 * 현재 사용자의 GitHub 연동 상태 확인
 */
router.get('/github/status', requireAuth, async (req, res) => {
  try {
    const userStore = req.app.locals.userStore;
    if (!userStore) {
      return res.json({ connected: false });
    }

    const github = await userStore.getGitHubToken(req.user.googleId);
    if (!github) {
      return res.json({ connected: false });
    }

    // 토큰이 아직 유효한지 GitHub API로 확인
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${github.token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EduFlow',
        },
      });

      if (userResponse.ok) {
        const githubUser = await userResponse.json();
        return res.json({
          connected: true,
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          connectedAt: github.connectedAt,
        });
      } else {
        // 토큰 만료/무효 — 정리
        await userStore.removeGitHubToken(req.user.googleId);
        return res.json({ connected: false, reason: '토큰이 만료되었습니다.' });
      }
    } catch {
      // 네트워크 오류 등 — 저장된 정보 반환
      return res.json({
        connected: true,
        username: github.username,
        connectedAt: github.connectedAt,
        verified: false,
      });
    }
  } catch (err) {
    console.error('[EduFlow] GitHub 상태 확인 오류:', err.message);
    res.status(500).json({ message: 'GitHub 상태 확인 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/auth/github/disconnect
 * GitHub 연동 해제
 */
router.post('/github/disconnect', requireAuth, async (req, res) => {
  try {
    const userStore = req.app.locals.userStore;
    if (!userStore) {
      return res.status(500).json({ message: 'UserStore가 초기화되지 않았습니다.' });
    }

    await userStore.removeGitHubToken(req.user.googleId);
    console.log(`[EduFlow] GitHub 연동 해제: Google ID ${req.user.googleId}`);

    res.json({ success: true, message: 'GitHub 연동이 해제되었습니다.' });
  } catch (err) {
    console.error('[EduFlow] GitHub 연동 해제 오류:', err.message);
    res.status(500).json({ message: 'GitHub 연동 해제 중 오류가 발생했습니다.' });
  }
});

export default router;

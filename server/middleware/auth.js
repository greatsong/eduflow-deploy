import jwt from 'jsonwebtoken';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getJwtSecret } from '../services/jwtSecret.js';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * 구글 로그인 인증 미들웨어
 * Authorization: Bearer <jwt> 헤더를 검증한다.
 * 인증 실패 시 401 반환.
 */
export function requireAuth(req, res, next) {
  let authHeader = req.headers.authorization;

  // 이미지 등 <img src="?token=xxx"> 요청을 위해 쿼리 토큰도 지원
  if (!authHeader?.startsWith('Bearer ') && req.query.token) {
    authHeader = `Bearer ${req.query.token}`;
    req.headers.authorization = authHeader;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: '인증이 만료되었습니다. 다시 로그인해주세요.' });
  }
}

/**
 * 승인된 사용자만 허용하는 미들웨어
 * pending/inactive 사용자는 403 반환.
 * 관리자는 항상 통과.
 * req.userTier도 여기서 세팅.
 */
export async function requireApproved(req, res, next) {
  // 관리자는 항상 통과 + master 등급
  if (req.user?.email && ADMIN_EMAILS.includes(req.user.email)) {
    req.userTier = 'master';
    return next();
  }

  // users.json에서 사용자 상태 확인
  try {
    if (!existsSync(USERS_FILE)) {
      return res.status(403).json({
        message: '사용자 등록 정보가 없습니다. 다시 로그인 후 지원서를 완료해주세요.',
        code: 'PROFILE_REQUIRED',
      });
    }
    const users = JSON.parse(await readFile(USERS_FILE, 'utf-8'));
    const user = users.find(u => u.googleId === req.user?.googleId);

    if (!user) {
      return res.status(403).json({
        message: '사용자 등록 정보가 없습니다. 지원서를 먼저 완료해주세요.',
        code: 'PROFILE_REQUIRED',
      });
    }

    // 사용자 등급 세팅
    req.userTier = user.tier || 'starter';

    if (user.status === 'pending') {
      return res.status(403).json({
        message: '관리자 승인 대기 중입니다. 승인 후 이용 가능합니다.',
        code: 'PENDING_APPROVAL',
      });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({
        message: '계정이 비활성화되었습니다. 관리자에게 문의하세요.',
        code: 'ACCOUNT_INACTIVE',
      });
    }
  } catch {
    return res.status(503).json({
      message: '사용자 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
      code: 'USER_STATUS_UNAVAILABLE',
    });
  }

  if (!req.userTier) req.userTier = 'starter';
  next();
}

/**
 * JWT 토큰 생성 (구글 인증 후 발급)
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

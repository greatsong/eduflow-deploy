import jwt from 'jsonwebtoken';
import { ServerSettings } from '../services/settings.js';
import { join } from 'path';
import { TIER_CONFIG, PREMIUM_MODEL_TIERS } from '../../shared/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'eduflow-default-secret-change-me';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const serverSettings = new ServerSettings(join(DATA_DIR, 'settings.json'));

/**
 * 요청자가 관리자인지 판별 (JWT 디코딩)
 */
function isAdmin(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return false;
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return decoded?.email && ADMIN_EMAILS.includes(decoded.email);
  } catch {
    return false;
  }
}

/**
 * API 키 검증 미들웨어 (멀티 프로바이더 지원)
 *
 * 키 우선순위:
 * 1. 요청 헤더 (사용자 직접 입력 키)
 * 2. settings.json adminApiKeys (관리자가 UI에서 입력한 키)
 *    - shared: true → 모든 사용자에게 제공
 *    - shared: false → 관리자만 사용 가능
 * 3. 환경변수 (fly secrets 등)
 */
export async function requireApiKey(req, res, next) {
  try {
    const admin = isAdmin(req);
    const settings = await serverSettings.get();
    const adminKeys = settings.adminApiKeys || {};

    // 프로바이더별 키 수집
    const keys = {};
    for (const provider of ['anthropic', 'openai', 'google', 'upstage']) {
      const headerKey = req.headers[`x-${provider}-key`] || '';
      const envKey = process.env[`${provider.toUpperCase()}_API_KEY`] || '';

      // settings.json 키: 관리자이면 모두 사용, 일반 사용자는 shared만
      const stored = adminKeys[provider];
      const storedKey = stored?.key && (admin || stored.shared) ? stored.key : '';

      keys[provider] = headerKey || storedKey || envKey || '';
    }

    // 하위 호환: 기존 x-api-key 헤더는 anthropic 키로 취급
    const legacyKey = req.headers['x-api-key'];
    if (legacyKey && !keys.anthropic) {
      keys.anthropic = legacyKey;
    }

    // _default: 프로바이더를 특정하지 않은 범용 키 (기존 호환)
    keys._default = keys.anthropic || legacyKey || '';

    const hasAnyKey = Object.entries(keys).some(([k, v]) => k !== '_default' && v);

    if (!hasAnyKey) {
      return res.status(401).json({
        message: 'API 키가 필요합니다. 관리자에게 문의하거나, AI 설정에서 직접 API 키를 입력하세요.',
      });
    }

    // 기존 호환: req.apiKey 유지
    req.apiKey = keys._default || keys.anthropic || keys.openai || keys.google || keys.upstage;
    req.apiKeys = keys;
    next();
  } catch (err) {
    return res.status(500).json({ message: 'API 키 검증 중 오류: ' + err.message });
  }
}

/**
 * 모델 접근 권한 검증 미들웨어
 * 프리미엄 모델은 Pro 이상 등급에서만 사용 가능
 */
export async function requireModelAccess(req, res, next) {
  const model = req.body?.model || req.query?.model;
  const models = req.body?.models; // 비교 모드 (모델 ID 배열)

  const userTier = req.userTier || 'starter';
  const tierConfig = TIER_CONFIG[userTier];

  // Pro/Master는 모든 모델 사용 가능
  if (tierConfig?.allowPremiumModels) return next();

  // 모델 설정 로드하여 tier 확인
  try {
    const { loadModelConfig } = await import('../config/modelConfig.js');
    const config = await loadModelConfig();
    const modelList = config.models || [];

    // 단일 모델 체크
    if (model) {
      const modelEntry = modelList.find(m => m.id === model);
      if (modelEntry && PREMIUM_MODEL_TIERS.includes(modelEntry.tier)) {
        return res.status(403).json({
          message: `${modelEntry.display_name}은(는) Pro 이상 등급에서 사용할 수 있습니다. 현재 등급: ${tierConfig?.labelKo || '스타터'}`,
          code: 'MODEL_TIER_RESTRICTED',
          requiredTier: 'pro',
          currentTier: userTier,
        });
      }
    }

    // 모델 배열 체크 (비교 모드)
    if (Array.isArray(models)) {
      for (const mid of models) {
        const modelEntry = modelList.find(m => m.id === mid);
        if (modelEntry && PREMIUM_MODEL_TIERS.includes(modelEntry.tier)) {
          return res.status(403).json({
            message: `${modelEntry.display_name}은(는) Pro 이상 등급에서 사용할 수 있습니다. 현재 등급: ${tierConfig?.labelKo || '스타터'}`,
            code: 'MODEL_TIER_RESTRICTED',
            requiredTier: 'pro',
            currentTier: userTier,
          });
        }
      }
    }
  } catch {
    // 모델 설정 로드 실패 시 서비스 중단 방지 — 통과
  }

  next();
}

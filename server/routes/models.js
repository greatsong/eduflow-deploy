import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getModelDisplayOptions,
  getDefaultModel,
  getModelPricing,
  getProviders,
} from '../config/modelConfig.js';
import { TIER_CONFIG, PREMIUM_MODEL_TIERS } from '../../shared/constants.js';

const router = Router();

// GET /api/models - 모델 목록 + 가격 + 프로바이더 정보
router.get('/', asyncHandler(async (req, res) => {
  let models = await getModelDisplayOptions();
  const pricing = await getModelPricing();
  const providers = await getProviders();

  // 어떤 프로바이더에 API 키가 설정되어 있는지 표시
  const availableProviders = {};
  for (const [key, info] of Object.entries(providers)) {
    availableProviders[key] = {
      ...info,
      configured: !!process.env[info.envKey],
    };
  }

  // 사용자 등급에 따라 프리미엄 모델에 locked 표시
  const userTier = req.userTier || 'starter';
  const tierConfig = TIER_CONFIG[userTier];
  if (!tierConfig?.allowPremiumModels) {
    models = models.map(m => ({
      ...m,
      locked: PREMIUM_MODEL_TIERS.includes(m.tier),
      lockReason: PREMIUM_MODEL_TIERS.includes(m.tier) ? 'Pro 이상 등급 필요' : null,
    }));
  }

  res.json({ models, pricing, providers: availableProviders, userTier });
}));

// GET /api/models/default/:purpose - 용도별 기본 모델
router.get('/default/:purpose', asyncHandler(async (req, res) => {
  const modelId = await getDefaultModel(req.params.purpose);
  res.json({ modelId });
}));

export default router;

const LOCAL_FALLBACK_SECRET = 'eduflow-local-dev-secret';

/**
 * JWT 서명/검증에 사용할 시크릿을 반환한다.
 * Fly/프로덕션 환경에서는 기본값으로 서비스가 뜨지 않도록 fail-fast 처리한다.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret;

  const productionLike = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;
  if (productionLike) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  }

  return LOCAL_FALLBACK_SECRET;
}

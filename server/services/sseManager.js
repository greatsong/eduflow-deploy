/**
 * SSE 연결 관리자 — 동시 연결 추적, 사용자별 제한, 자동 정리
 *
 * 20~30명 동시 사용 시 SSE 좀비 연결 메모리 누수를 방지한다.
 */

const MAX_PER_USER = 3;       // 사용자당 최대 SSE 동시 연결
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5분 무활동 타임아웃

// userId → Set<connectionId>
const connections = new Map();
let nextId = 1;

/**
 * SSE 연결 등록. 제한 초과 시 false 반환.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {{ ok: boolean, connId: number | null }}
 */
export function registerSSE(req, res) {
  const userId = req.user?.googleId || req.ip || 'anonymous';
  const userConns = connections.get(userId) || new Set();

  if (userConns.size >= MAX_PER_USER) {
    return { ok: false, connId: null };
  }

  const connId = nextId++;
  userConns.add(connId);
  connections.set(userId, userConns);

  // 무활동 타임아웃
  const timer = setTimeout(() => {
    cleanup();
    try { res.end(); } catch { /* already closed */ }
  }, IDLE_TIMEOUT);

  // 연결 종료 시 정리
  const cleanup = () => {
    clearTimeout(timer);
    const set = connections.get(userId);
    if (set) {
      set.delete(connId);
      if (set.size === 0) connections.delete(userId);
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

  return { ok: true, connId };
}

/**
 * SSE 활동 갱신 — 타임아웃 리셋용
 * 실제로는 registerSSE에서 타임아웃을 고정하므로,
 * 필요 시 별도 구현. 현재는 5분 절대 타임아웃.
 */

/**
 * 현재 활성 연결 통계
 */
export function getStats() {
  let total = 0;
  const perUser = {};
  for (const [userId, set] of connections) {
    perUser[userId] = set.size;
    total += set.size;
  }
  return { total, perUser };
}

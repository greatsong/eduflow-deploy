import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

/**
 * 현재 로그인된 사용자가 관리자인지 확인하는 훅.
 * 서버의 /api/admin/check 엔드포인트를 호출하여 검증한다.
 * 관리자가 아니면 403이 반환되므로 false를 세팅한다.
 */
export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/check')
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}

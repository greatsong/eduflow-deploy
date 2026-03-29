import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

/* global __LOCAL_MODE__ */
const LOCAL_MODE = typeof __LOCAL_MODE__ !== 'undefined' && __LOCAL_MODE__;

/**
 * 현재 로그인된 사용자가 관리자인지 확인하는 훅.
 * LOCAL_MODE에서는 항상 true.
 */
export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(LOCAL_MODE);

  useEffect(() => {
    if (LOCAL_MODE) return;
    apiFetch('/api/admin/check')
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}

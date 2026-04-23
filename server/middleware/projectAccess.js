import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { sanitizeId } from './sanitize.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(req) {
  return !!req.user?.email && ADMIN_EMAILS.includes(req.user.email);
}

export function canAccessProject(req, config) {
  if (isAdmin(req)) return true;
  if (!config?.owner?.googleId) return true; // 레거시/로컬 프로젝트 호환
  return config.owner.googleId === req.user?.googleId;
}

export async function loadProjectConfig(projectsDir, id) {
  const safe = sanitizeId(id);
  if (!safe) return null;
  const configFile = join(projectsDir, safe, 'config.json');
  if (!existsSync(configFile)) return null;
  return JSON.parse(await readFile(configFile, 'utf-8'));
}

export function requireProjectAccess(projectsDir) {
  return async (req, res, next) => {
    const projectId = req.params.id;
    const safe = sanitizeId(projectId);
    if (!safe) {
      return res.status(400).json({ message: '잘못된 프로젝트 ID입니다.' });
    }

    try {
      const config = await loadProjectConfig(projectsDir, safe);
      if (!config) return next(); // 존재 여부는 각 라우트의 404 처리에 맡긴다.
      if (!canAccessProject(req, config)) {
        return res.status(403).json({ message: '이 프로젝트에 접근할 권한이 없습니다.' });
      }
      req.projectConfig = config;
      return next();
    } catch (err) {
      return res.status(500).json({ message: `프로젝트 권한 확인 중 오류: ${err.message}` });
    }
  };
}

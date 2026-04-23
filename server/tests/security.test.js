import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ReferenceManager } from '../services/referenceManager.js';
import { createOAuthState, verifyOAuthState } from '../services/oauthState.js';
import { requireProjectAccess } from '../middleware/projectAccess.js';
import { sanitizeId, sanitizeFilename } from '../middleware/sanitize.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

test('sanitizeId rejects traversal and separators', () => {
  assert.equal(sanitizeId('../project'), '');
  assert.equal(sanitizeId('nested/project'), '');
  assert.equal(sanitizeId('project-01'), 'project-01');
  assert.equal(sanitizeId('정보교재_1'), '정보교재_1');
});

test('sanitizeFilename rejects traversal and keeps normal names', () => {
  assert.equal(sanitizeFilename('../secret.txt'), '');
  assert.equal(sanitizeFilename('nested/file.txt'), '');
  assert.equal(sanitizeFilename('참고 자료 1.pdf'), '참고 자료 1.pdf');
});

test('ReferenceManager blocks path traversal filenames', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eduflow-ref-'));
  try {
    const project = join(root, 'project');
    await mkdir(project, { recursive: true });
    const refs = new ReferenceManager(project);

    await assert.rejects(
      refs.saveFile(Buffer.from('bad'), '../evil.txt'),
      /잘못된 파일명/
    );

    const saved = await refs.saveFile(Buffer.from('hello'), '참고 자료.txt');
    assert.ok(saved.endsWith('참고 자료.txt'));
    const content = await refs.readFileContent('참고 자료.txt');
    assert.equal(content.status, 'ok');
    assert.equal(content.content, 'hello');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('OAuth state is signed and tamper resistant', () => {
  const state = createOAuthState({ googleId: 'user-1', returnTo: '/deploy', issuedAt: Date.now() });
  assert.equal(verifyOAuthState(state).googleId, 'user-1');

  const [payload, signature] = state.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ googleId: 'user-2' })).toString('base64url');
  assert.equal(verifyOAuthState(`${tamperedPayload}.${signature}`), null);
  assert.equal(verifyOAuthState(`${payload}.bad-signature`), null);
});

test('project access middleware allows owners and blocks other users', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eduflow-projects-'));
  try {
    const project = join(root, 'owned-project');
    await mkdir(project, { recursive: true });
    await writeFile(join(project, 'config.json'), JSON.stringify({
      name: 'owned-project',
      owner: { googleId: 'owner-1' },
    }), 'utf-8');

    const middleware = requireProjectAccess(root);

    let nextCalled = false;
    await middleware(
      { params: { id: 'owned-project' }, user: { googleId: 'owner-1', email: 'owner@example.com' } },
      {},
      () => { nextCalled = true; }
    );
    assert.equal(nextCalled, true);

    let statusCode = 0;
    let responseBody = null;
    await middleware(
      { params: { id: 'owned-project' }, user: { googleId: 'other-1', email: 'other@example.com' } },
      {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return this; },
      },
      () => { throw new Error('next should not be called'); }
    );

    assert.equal(statusCode, 403);
    assert.match(responseBody.message, /권한/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

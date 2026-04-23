import crypto from 'crypto';
import { getJwtSecret } from './jwtSecret.js';

function signPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createOAuthState(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') return null;
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(givenBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

export function normalizeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

import { getAuthToken } from '../components/EntryForm';

/* global __LOCAL_MODE__ */
const LOCAL_MODE = typeof __LOCAL_MODE__ !== 'undefined' && __LOCAL_MODE__;

export const API_BASE = import.meta.env.VITE_API_URL || '';

// 프로바이더별 localStorage 키 매핑
const PROVIDER_KEYS = {
  anthropic: 'eduflow_api_key',       // 기존 호환
  openai: 'eduflow_openai_key',
  google: 'eduflow_google_key',
  upstage: 'eduflow_upstage_key',
};

/** 프로바이더별 API 키 가져오기 */
export function getApiKey(provider = 'anthropic') {
  return localStorage.getItem(PROVIDER_KEYS[provider] || PROVIDER_KEYS.anthropic) || '';
}

/** 프로바이더별 API 키 저장 */
export function setApiKey(key, provider = 'anthropic') {
  const storageKey = PROVIDER_KEYS[provider] || PROVIDER_KEYS.anthropic;
  if (key) {
    localStorage.setItem(storageKey, key);
  } else {
    localStorage.removeItem(storageKey);
  }
}

/** 설정된 모든 프로바이더 키 조회 */
export function getAllApiKeys() {
  const keys = {};
  for (const [provider, storageKey] of Object.entries(PROVIDER_KEYS)) {
    const val = localStorage.getItem(storageKey);
    if (val) keys[provider] = val;
  }
  return keys;
}

/** 아무 API 키라도 설정되어 있는지 확인 */
export function hasApiKey() {
  return Object.values(PROVIDER_KEYS).some((k) => !!localStorage.getItem(k));
}

/** 공통 헤더 생성 — 인증 토큰 + 프로바이더 키 전송 */
function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json' };

  // 구글 로그인 인증 토큰 (LOCAL_MODE에서는 스킵)
  if (!LOCAL_MODE) {
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // Anthropic 키: x-anthropic-key + 레거시 호환 x-api-key 동시 전송
  const anthropicKey = getApiKey('anthropic');
  if (anthropicKey) {
    headers['x-anthropic-key'] = anthropicKey;
    headers['x-api-key'] = anthropicKey; // 하위 호환
  }

  // 프로바이더별 헤더
  const openaiKey = getApiKey('openai');
  if (openaiKey) headers['x-openai-key'] = openaiKey;
  const googleKey = getApiKey('google');
  if (googleKey) headers['x-google-key'] = googleKey;
  const upstageKey = getApiKey('upstage');
  if (upstageKey) headers['x-upstage-key'] = upstageKey;

  Object.assign(headers, extra);
  return headers;
}

/**
 * 기본 fetch 래퍼
 */
export async function apiFetch(path, options = {}) {
  const fetchOptions = {
    ...options,
    headers: authHeaders(options.headers),
  };
  // body가 객체면 자동 JSON 직렬화
  if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API 오류: ${res.status}`);
  }

  return res.json();
}

/**
 * SSE(Server-Sent Events) 스트리밍 연결
 */
export function apiSSE(path, { onText, onProgress, onError, onDone } = {}) {
  const es = new EventSource(`${API_BASE}${path}`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'text':
          onText?.(data.content);
          break;
        case 'progress':
          onProgress?.(data);
          break;
        case 'error':
          onError?.(new Error(data.message));
          es.close();
          break;
        case 'done':
          onDone?.(data);
          es.close();
          break;
      }
    } catch (e) {
      onError?.(e);
    }
  };

  es.onerror = () => {
    onError?.(new Error('SSE 연결 끊김'));
    es.close();
  };

  return () => es.close();
}

/**
 * POST 요청 후 SSE 스트리밍 (EventSource는 GET만 지원하므로 fetch 사용)
 * body가 FormData면 multipart로 전송 (Content-Type은 브라우저가 자동 설정)
 */
export async function apiStreamPost(path, body, { onText, onProgress, onError, onDone, onToc } = {}) {
  const isFormData = body instanceof FormData;
  const headers = authHeaders();
  if (isFormData) {
    // multipart에서는 Content-Type을 브라우저가 경계 문자와 함께 자동 설정
    delete headers['Content-Type'];
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API 오류: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6);
      if (raw === '[DONE]') { onDone?.(); return; }

      try {
        const data = JSON.parse(raw);
        switch (data.type) {
          case 'text': onText?.(data.content); break;
          case 'progress': onProgress?.(data); break;
          case 'report': onProgress?.(data); break;
          case 'toc': onToc?.(data.toc); break;
          case 'error': onError?.(new Error(data.message)); return;
          case 'done': onDone?.(data); return;
        }
      } catch (e) {
        // 파싱 실패 무시
      }
    }
  }
}
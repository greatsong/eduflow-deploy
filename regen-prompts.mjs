#!/usr/bin/env node
// v2 프로젝트의 images_meta.json prompt 필드를 Claude로 재작성.
// - 피사체·구도·시각요소·색상팔레트를 명시화
// - 실제 글자 렌더링 금지 지침 반영
// - 원본은 _original_prompt로 백업

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';
import { config } from 'dotenv';

config({ path: '/Users/greatsong/greatsong-project/eduflow-deploy/.env' });

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('ANTHROPIC_API_KEY missing from .env');
  process.exit(1);
}

const META_PATH = '/Users/greatsong/greatsong-project/eduflow/projects/rhythm-and-data-v2/images_meta.json';
const meta = JSON.parse(await readFile(META_PATH, 'utf-8'));

const client = new Anthropic({ apiKey: key });
const MODEL = 'claude-opus-4-5';

const INSTRUCTION = `당신은 고등학교 교과서용 교육 삽화의 이미지 생성 프롬프트를 다듬는 전문가입니다.

아래 **원본 설명**을 바탕으로, Google Gemini Image 모델이 선명하고 구체적으로 그림을 그릴 수 있도록 재작성하세요.

재작성 규칙:
1. 한국어로 작성. 250~400자.
2. 구조는 다음 4요소를 모두 포함:
   - **주요 피사체**: 무엇이/누가 중심에 있는지 구체적으로
   - **구도·시점**: 정면/측면/조감/근경/원경 중 하나 명시
   - **시각 요소 4~6개**: 보조적으로 배치될 소품·기호·아이콘을 나열
   - **색상 팔레트**: 2~3개의 주요 색상 또는 무드
3. 이미지 안에 **실제 한글·영문 텍스트가 들어가지 않아야 함**. 글자가 필요하면 "추상적 기호", "가로선 플레이스홀더", "아이콘"으로 서술.
4. 인물이 등장해도 얼굴 클로즈업은 피하도록 서술 (중간 거리 또는 실루엣).
5. 교육용 분위기 유지: 친근하고 따뜻한 톤.
6. 마지막 줄에 "Landscape orientation" 명시.

출력 형식: **재작성된 설명 본문만** (도입부·해설·따옴표 없이).`;

async function rewriteOne(oldPrompt, chapterId, imgIdx, total) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `${INSTRUCTION}\n\n---\n\n**원본 설명**:\n${oldPrompt}`,
      },
    ],
  });
  const newPrompt = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  console.log(`  [${imgIdx + 1}/${total}] ${chapterId}: ${newPrompt.slice(0, 70)}…`);
  return newPrompt;
}

console.log(`[regen] 총 ${meta.images.length}개 prompt 재작성 시작 (모델: ${MODEL})…`);
const t0 = Date.now();

let okCount = 0;
let failCount = 0;
for (let i = 0; i < meta.images.length; i += 1) {
  const img = meta.images[i];
  if (img._original_prompt) {
    // 이미 재작성된 항목은 스킵 (재실행 안전)
    console.log(`  [${i + 1}/${meta.images.length}] ${img.chapter_id}: skipped (already rewritten)`);
    continue;
  }
  try {
    const newPrompt = await rewriteOne(img.prompt, img.chapter_id, i, meta.images.length);
    img._original_prompt = img.prompt;
    img.prompt = newPrompt;
    img._prompt_rewritten_at = new Date().toISOString();
    img._prompt_rewritten_by = MODEL;
    // 재생성 트리거용: status를 pending으로 초기화 (웹 UI에서 재생성 대상이 되도록)
    img.status = 'pending';
    okCount += 1;
  } catch (e) {
    console.error(`  [${i + 1}] ${img.chapter_id} FAILED:`, e.message);
    failCount += 1;
  }
}

await writeFile(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');

const sec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n[regen] 완료: ${okCount}개 재작성, ${failCount}개 실패, ${sec}s`);
console.log(`[regen] ${META_PATH} 저장됨`);

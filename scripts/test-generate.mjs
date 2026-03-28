#!/usr/bin/env node
/**
 * 에듀플로 교재 생성 E2E 테스트
 *
 * "차시별 수업 교재" (lesson-per-session) 템플릿으로
 * "기후변화와 우리의 삶" 5차시 교재를 생성합니다.
 */
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';

// .env 수동 로드 (dotenv 호환 문제 대응)
const envContent = await readFile('.env', 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.includes('=') && !line.startsWith('#')) {
    const eqIdx = line.indexOf('=');
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key && val) process.env[key] = val;
  }
}
import { join } from 'path';
import { existsSync } from 'fs';
import { TemplateManager } from '../server/services/templateManager.js';
import { ChapterGenerator } from '../server/services/chapterGenerator.js';

const PROJECT_DIR = join(process.cwd(), 'test-project');
const TEMPLATE_ID = 'lesson-per-session';
const MODEL = 'claude-sonnet-4-6';

const PROJECT_TITLE = '기후변화와 우리의 삶';
const TOC = [
  { id: 'ch01', title: '1차시: 기후변화란 무엇인가' },
  { id: 'ch02', title: '2차시: 온실효과와 탄소 순환' },
  { id: 'ch03', title: '3차시: 기후변화의 영향 — 우리 동네에서 지구까지' },
  { id: 'ch04', title: '4차시: 기후 행동 — 개인과 사회의 대응' },
  { id: 'ch05', title: '5차시: 종합 프로젝트 — 우리 학교 탄소 발자국 줄이기' },
];

async function main() {
  console.log('🚀 에듀플로 교재 생성 E2E 테스트 시작\n');
  console.log(`📖 교재: ${PROJECT_TITLE}`);
  console.log(`📝 템플릿: ${TEMPLATE_ID}`);
  console.log(`🤖 모델: ${MODEL}`);
  console.log(`📄 챕터: ${TOC.length}개\n`);

  // 1. 프로젝트 디렉토리 생성
  for (const dir of [PROJECT_DIR, join(PROJECT_DIR, 'docs'), join(PROJECT_DIR, 'outlines'), join(PROJECT_DIR, 'logs')]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  }

  // 2. 템플릿 적용
  const tm = new TemplateManager();
  await tm.applyTemplate(TEMPLATE_ID, PROJECT_DIR, {
    subject: '과학/환경',
    grade: '중학교 2학년',
  });
  console.log('✅ 템플릿 적용 완료\n');

  // 3. 프로젝트 config 생성
  const config = {
    title: PROJECT_TITLE,
    templateId: TEMPLATE_ID,
    claude_model: MODEL,
    created: new Date().toISOString(),
  };
  await writeFile(join(PROJECT_DIR, 'config.json'), JSON.stringify(config, null, 2));

  // 4. TOC 저장
  const tocData = {
    toc: TOC.map(ch => ({ id: ch.id, title: ch.title })),
    confirmed: true,
  };
  await writeFile(join(PROJECT_DIR, 'toc.json'), JSON.stringify(tocData, null, 2));

  // 5. 아웃라인 생성 (간단한 개요)
  const outlines = {
    'ch01': '기후변화의 정의, 자연적 기후변화 vs 인위적 기후변화, 과거 100년간의 기온 변화 데이터, 핵심 질문: 왜 지구가 뜨거워질까?',
    'ch02': '온실효과의 원리, 주요 온실가스(CO2, CH4, N2O), 탄소 순환 과정, 실습: 온실효과 시뮬레이션',
    'ch03': '해수면 상승, 극단적 기상현상, 생태계 변화, 식량 위기, 우리 지역의 기후변화 사례 조사',
    'ch04': '파리 기후협약, 탄소 중립, 재생에너지, 개인의 탄소 발자국 계산, 실천 방안 토론',
    'ch05': '학교 에너지 사용량 조사, 탄소 발자국 계산, 감축 계획 수립, 발표 및 성찰',
  };
  if (!existsSync(join(PROJECT_DIR, 'outlines'))) {
    await mkdir(join(PROJECT_DIR, 'outlines'), { recursive: true });
  }
  for (const [id, outline] of Object.entries(outlines)) {
    await writeFile(join(PROJECT_DIR, 'outlines', `${id}.md`), outline);
  }

  // 6. 챕터 생성
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 환경변수가 없습니다');
    process.exit(1);
  }

  const generator = new ChapterGenerator(PROJECT_DIR, { anthropic: apiKey, _default: apiKey });
  await generator.init();

  console.log('📝 챕터 생성 시작...\n');

  for (let i = 0; i < TOC.length; i++) {
    const ch = TOC[i];
    const startTime = Date.now();
    console.log(`--- [${i + 1}/${TOC.length}] ${ch.title} ---`);

    try {
      // generateChapter(chapterId, chapterTitle, partContext, model, maxTokens, progressCallback, estimatedTime, totalChapters, currentNum)
      const result = await generator.generateChapter(
        ch.id,
        ch.title,
        'Part 1 - 기후변화와 우리의 삶',  // partContext
        MODEL,
        8000,    // maxTokens
        (progress) => {
          if (typeof progress === 'string') {
            const clean = progress.replace(/\n/g, ' ').substring(0, 80);
            process.stdout.write(`  ${clean}${''.padEnd(20)}\r`);
          }
        },
        '50분',  // estimatedTime
        TOC.length,   // totalChapters
        i + 1,        // currentNum
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const charCount = result?.content?.length || 0;

      if (result?.success !== false) {
        console.log(`  ✅ 완료 (${charCount.toLocaleString()}자, ${elapsed}초)`);
      } else {
        console.log(`  ⚠️ 생성됨 (경고 있음, ${charCount.toLocaleString()}자, ${elapsed}초)`);
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ❌ 실패 (${elapsed}초): ${error.message}`);
    }
  }

  // 7. 결과 요약
  console.log('\n\n📊 결과 요약');
  console.log('='.repeat(50));

  const docsDir = join(PROJECT_DIR, 'docs');
  if (existsSync(docsDir)) {
    const files = (await readdir(docsDir)).filter(f => f.endsWith('.md'));
    console.log(`생성된 파일: ${files.length}개`);

    let totalChars = 0;
    for (const file of files) {
      const content = await readFile(join(docsDir, file), 'utf-8');
      totalChars += content.length;
      console.log(`  📄 ${file}: ${content.length.toLocaleString()}자`);

      // 핵심 요소 체크
      const checks = [];
      if (content.includes('lesson-banner')) checks.push('수업배너');
      if (content.includes('cards-grid')) checks.push('카드그리드');
      if (content.includes('steps')) checks.push('Steps');
      if (content.includes('assessment')) checks.push('평가');
      if (content.includes('mermaid')) checks.push('Mermaid');
      if (content.includes('|') && content.includes('---')) checks.push('테이블');
      if (content.includes('<svg') || content.includes('svg-diagram')) checks.push('SVG');
      console.log(`     요소: ${checks.length > 0 ? checks.join(', ') : '없음'}`);
    }

    console.log(`\n총 글자 수: ${totalChars.toLocaleString()}자`);
    console.log(`평균 글자 수: ${Math.round(totalChars / files.length).toLocaleString()}자/챕터`);
  }

  console.log('\n✅ E2E 테스트 완료!');
  console.log(`📁 결과 디렉토리: ${PROJECT_DIR}`);
}

main().catch(err => {
  console.error('❌ 테스트 실패:', err);
  process.exit(1);
});

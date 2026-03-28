/**
 * chapterGenerator.js에서 docStructure와 system_prompt를 추출하여
 * 각 템플릿 JSON 파일에 새 필드로 추가하는 스크립트
 *
 * 방법: Node.js eval로 실제 템플릿 리터럴을 실행하여 정확한 출력을 캡처
 *
 * 사용법: node scripts/extract-templates.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const code = readFileSync(join(ROOT, 'server/services/chapterGenerator.js'), 'utf8');
const lines = code.split('\n');

// ============================================================
// docStructure 코드 블록 추출 (줄 679~1791)
// ============================================================
const docStructureCode = lines.slice(678, 1791).join('\n');

// ============================================================
// prompt return 코드 블록 추출 (줄 1793~2438)
// ============================================================
// 줄 1793~2437 (2438은 메서드 닫는 중괄호이므로 제외)
const promptReturnCode = lines.slice(1792, 2437).join('\n');

// ============================================================
// 센티넬 값 정의 (나중에 {{변수}}로 치환)
// ============================================================
const SENTINELS = {
  effectiveTimeLabel: '___S_effectiveTimeLabel___',
  effectiveMinutes: '___S_effectiveMinutes___',
  chapterId: '___S_chapterId___',
  chapterTitle: '___S_chapterTitle___',
  partContext: '___S_partContext___',
  timeConstraint: '___S_timeConstraint___',
  refsText: '___S_refsText___',
  docStructure: '___S_docStructure___',
  guidelinesText: '___S_guidelinesText___',
  templateAddition: '___S_templateAddition___',
  outline: '___S_outline___',
  pc_role: '___S_pc_role___',
  pc_audience: '___S_pc_audience___',
  pc_philosophy: '___S_pc_philosophy___',
  pc_style: '___S_pc_style___',
  pc_tone: '___S_pc_tone___',
};

// 센티넬 → {{변수}} 치환 맵
const SENTINEL_TO_VAR = {
  [SENTINELS.effectiveTimeLabel]: '{{effectiveTimeLabel}}',
  [SENTINELS.effectiveMinutes]: '{{effectiveMinutes}}',
  [SENTINELS.chapterId]: '{{chapterId}}',
  [SENTINELS.chapterTitle]: '{{chapterTitle}}',
  [SENTINELS.partContext]: '{{partContext}}',
  [SENTINELS.timeConstraint]: '{{timeConstraint}}',
  [SENTINELS.refsText]: '{{refsText}}',
  [SENTINELS.docStructure]: '{{docStructure}}',
  [SENTINELS.guidelinesText]: '{{guidelinesText}}',
  [SENTINELS.templateAddition]: '{{templateAddition}}',
  [SENTINELS.outline]: '{{outline}}',
  [SENTINELS.pc_role]: '{{pc.role}}',
  [SENTINELS.pc_audience]: '{{pc.audience}}',
  [SENTINELS.pc_philosophy]: '{{pc.philosophy}}',
  [SENTINELS.pc_style]: '{{pc.style}}',
  [SENTINELS.pc_tone]: '{{pc.tone}}',
};

function replaceSentinels(text) {
  let result = text;
  for (const [sentinel, variable] of Object.entries(SENTINEL_TO_VAR)) {
    result = result.replaceAll(sentinel, variable);
  }
  return result;
}

// ============================================================
// docStructure 추출
// ============================================================
function extractDocStructure(templateId, isCompact) {
  const sandbox = {
    effectiveTimeLabel: SENTINELS.effectiveTimeLabel,
    effectiveMinutes: SENTINELS.effectiveMinutes,
    isCompact,
    templateId,
    isTeacherGuide: templateId === 'teacher-guide-4c',
    isWorkshop: templateId === 'workshop-material',
    isBusinessEdu: templateId === 'business-education',
    isStorytelling: templateId === 'storytelling',
    isTextbook: templateId === 'school-textbook',
    isSelfDirected: templateId === 'self-directed-learning',
    isAiLiteracy: templateId === 'lesson-per-session',
    isClassPreview: templateId === 'class-preview',
    isProgramming: templateId === 'programming-course',
    docStructure: undefined,
  };

  const wrappedCode = `${docStructureCode}\n; docStructure;`;

  try {
    const context = vm.createContext(sandbox);
    const result = vm.runInContext(wrappedCode, context);
    return replaceSentinels(result);
  } catch (err) {
    console.error(`  ❌ docStructure 추출 실패 (${templateId}, compact=${isCompact}):`, err.message);
    return null;
  }
}

// ============================================================
// system_prompt 추출
// ============================================================
function extractSystemPrompt(templateId) {
  const sandbox = {
    effectiveTimeLabel: SENTINELS.effectiveTimeLabel,
    effectiveMinutes: SENTINELS.effectiveMinutes,
    chapterId: SENTINELS.chapterId,
    chapterTitle: SENTINELS.chapterTitle,
    partContext: SENTINELS.partContext,
    timeConstraint: SENTINELS.timeConstraint,
    refsText: SENTINELS.refsText,
    docStructure: SENTINELS.docStructure,
    guidelinesText: SENTINELS.guidelinesText,
    templateAddition: SENTINELS.templateAddition,
    outline: SENTINELS.outline,
    pc: {
      role: SENTINELS.pc_role,
      audience: SENTINELS.pc_audience,
      philosophy: SENTINELS.pc_philosophy,
      style: SENTINELS.pc_style,
      tone: SENTINELS.pc_tone,
    },
    isCompact: false,
    templateId,
    isTeacherGuide: templateId === 'teacher-guide-4c',
    isWorkshop: templateId === 'workshop-material',
    isBusinessEdu: templateId === 'business-education',
    isStorytelling: templateId === 'storytelling',
    isTextbook: templateId === 'school-textbook',
    isSelfDirected: templateId === 'self-directed-learning',
    isAiLiteracy: templateId === 'lesson-per-session',
    isClassPreview: templateId === 'class-preview',
    isProgramming: templateId === 'programming-course',
  };

  // prompt 코드의 return문을 직접 실행하기 위해
  // if-return 패턴을 함수로 감싸기
  const wrappedCode = `(function() { ${promptReturnCode} })()`;

  try {
    const context = vm.createContext(sandbox);
    const result = vm.runInContext(wrappedCode, context);
    return replaceSentinels(result);
  } catch (err) {
    console.error(`  ❌ system_prompt 추출 실패 (${templateId}):`, err.message);
    return null;
  }
}

// ============================================================
// 전체 추출 실행
// ============================================================

const TEMPLATE_IDS = [
  'teacher-guide-4c',
  'workshop-material',
  'business-education',
  'storytelling',
  'school-textbook',
  'self-directed-learning',
  'lesson-per-session',
  'class-preview',
  'programming-course',
  '_default', // else 블록
];

// validation 데이터
const VALIDATION_DATA = {
  'storytelling': {
    section_checks: [
      { keywords: ['생각해보기'], label: '"생각해보기" 섹션' },
    ],
  },
  'school-textbook': {
    section_checks: [
      { keywords: ['학습 목표', '학습목표'], label: '"학습 목표" 섹션' },
      { keywords: ['탐구'], label: '"탐구" 섹션' },
      { keywords: ['확인 문제', '확인문제'], label: '"확인 문제" 섹션' },
    ],
  },
  'programming-course': {
    section_checks: [
      { keywords: ['```'], label: '코드 블록(```)' },
    ],
  },
  'self-directed-learning': {
    section_checks: [
      { keywords: ['체크포인트', '자가 진단', '자가진단'], label: '"체크포인트" 또는 "자가 진단" 섹션' },
    ],
  },
  'business-education': {
    section_checks: [
      { keywords: ['케이스', '사례'], label: '"케이스" 또는 "사례" 섹션' },
    ],
  },
  'teacher-guide-4c': {
    section_checks: [
      { keywords: ['수업 흐름', '수업흐름', '차시'], label: '"수업 흐름" 또는 "차시" 섹션' },
    ],
  },
  'workshop-material': {
    section_checks: [
      { keywords: ['분)', '타임라인'], label: '"분)" 또는 "타임라인" 섹션' },
    ],
  },
};

const REQUIRED_ASSETS = {
  'class-preview': { javascript: ['circuit-diagrams.js'] },
  'lesson-per-session': { css_sections: ['lesson-banner', 'cards-grid', 'steps', 'link-cards', 'assessment'] },
};

console.log('🔧 chapterGenerator.js에서 템플릿 데이터 추출 시작\n');

const allResults = {};

for (const templateId of TEMPLATE_IDS) {
  console.log(`📋 ${templateId}:`);

  // default(else)는 모든 is* 플래그가 false일 때 실행됨
  const effectiveId = templateId === '_default' ? 'unknown-template' : templateId;

  // docStructure 추출 (compact + standard)
  const docCompact = extractDocStructure(effectiveId, true);
  const docStandard = extractDocStructure(effectiveId, false);

  // 같은 내용인지 확인 (compact 분기가 없는 템플릿)
  const doc_structure = {};
  if (docCompact && docStandard) {
    if (docCompact === docStandard) {
      doc_structure.standard = docStandard;
      console.log(`  ✅ docStructure (단일): ${docStandard.length}자`);
    } else {
      doc_structure.compact = docCompact;
      doc_structure.standard = docStandard;
      console.log(`  ✅ docStructure compact: ${docCompact.length}자, standard: ${docStandard.length}자`);
    }
  }

  // system_prompt 추출
  const systemPrompt = extractSystemPrompt(effectiveId);
  if (systemPrompt) {
    console.log(`  ✅ system_prompt: ${systemPrompt.length}자`);
  }

  allResults[templateId] = { doc_structure, system_prompt_template: systemPrompt };
}

// ============================================================
// JSON 파일 업데이트
// ============================================================
console.log('\n\n📝 JSON 파일 업데이트 중...\n');

for (const [templateId, data] of Object.entries(allResults)) {
  const jsonFile = templateId === '_default'
    ? join(ROOT, 'templates', '_default.json')
    : join(ROOT, 'templates', `${templateId}.json`);

  let existing;
  if (templateId === '_default') {
    existing = {
      id: '_default',
      name: '기본 교육자료',
      description: '기본 교육자료 템플릿 (일치하는 템플릿 없을 때 폴백)',
      icon: '📚',
    };
  } else if (existsSync(jsonFile)) {
    existing = JSON.parse(readFileSync(jsonFile, 'utf8'));
  } else {
    console.warn(`  ⚠️ ${jsonFile} 없음, 건너뜀`);
    continue;
  }

  // 새 필드 추가
  if (data.doc_structure && Object.keys(data.doc_structure).length > 0) {
    existing.doc_structure = data.doc_structure;
  }
  if (data.system_prompt_template) {
    existing.system_prompt_template = data.system_prompt_template;
  }
  if (VALIDATION_DATA[templateId]) {
    existing.validation = VALIDATION_DATA[templateId];
  }
  if (REQUIRED_ASSETS[templateId]) {
    existing.required_assets = REQUIRED_ASSETS[templateId];
  }

  writeFileSync(jsonFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`  ✅ ${templateId === '_default' ? '_default' : templateId}.json 업데이트 완료`);
}

// ============================================================
// 통계
// ============================================================
console.log('\n📊 추출 통계:');
let totalChars = 0;
for (const [tid, data] of Object.entries(allResults)) {
  const docChars = data.doc_structure.compact
    ? (data.doc_structure.compact?.length || 0) + (data.doc_structure.standard?.length || 0)
    : (data.doc_structure.standard?.length || 0);
  const promptChars = data.system_prompt_template?.length || 0;
  totalChars += docChars + promptChars;
  console.log(`  ${tid}: doc ${docChars}자, prompt ${promptChars}자`);
}
console.log(`  총합: ${totalChars.toLocaleString()}자`);
console.log('\n✅ 추출 완료!');

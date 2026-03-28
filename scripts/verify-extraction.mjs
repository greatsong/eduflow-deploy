/**
 * 추출된 JSON 데이터와 원본 chapterGenerator.js의 출력을 1:1 비교
 *
 * 검증 방법:
 * 1. 원본 코드를 vm으로 실행하여 docStructure와 system_prompt 생성
 * 2. JSON에서 로드한 템플릿에 변수 치환하여 동일 결과 생성
 * 3. 두 결과를 문자열 비교
 *
 * 사용법: node scripts/verify-extraction.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const code = readFileSync(join(ROOT, 'server/services/chapterGenerator.js'), 'utf8');
const lines = code.split('\n');
const docStructureCode = lines.slice(678, 1791).join('\n');
const promptReturnCode = lines.slice(1792, 2437).join('\n');

// 테스트 변수값 (구체적인 값 사용)
const TEST_VARS = {
  effectiveTimeLabel: '50분',
  effectiveMinutes: '50',
  chapterId: 'ch01',
  chapterTitle: '튜링 테스트와 인공지능',
  partContext: '\\n**전체 과정**: 총 8차시 중 1차시\\n',
  timeConstraint: '\\n# ⏱️ 학습 시간 제약\\n**목표 학습 시간: 50분**\\n',
  refsText: '참고자료 없음',
  guidelinesText: '',
  templateAddition: '',
  outline: '이 챕터에서는 튜링 테스트의 개념을 다룹니다.',
  'pc.role': '교육 전문가',
  'pc.audience': '학생',
  'pc.philosophy': '학습자 중심',
  'pc.style': '체계적',
  'pc.tone': '친근한 톤',
};

function substituteVars(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value ?? ''));
  }
  return result;
}

// 원본에서 docStructure 생성
function getOriginalDocStructure(templateId, isCompact) {
  const sandbox = {
    effectiveTimeLabel: TEST_VARS.effectiveTimeLabel,
    effectiveMinutes: TEST_VARS.effectiveMinutes,
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
  const context = vm.createContext(sandbox);
  return vm.runInContext(`${docStructureCode}\n; docStructure;`, context);
}

// 원본에서 system_prompt 생성
function getOriginalPrompt(templateId) {
  const sandbox = {
    effectiveTimeLabel: TEST_VARS.effectiveTimeLabel,
    effectiveMinutes: TEST_VARS.effectiveMinutes,
    chapterId: TEST_VARS.chapterId,
    chapterTitle: TEST_VARS.chapterTitle,
    partContext: TEST_VARS.partContext,
    timeConstraint: TEST_VARS.timeConstraint,
    refsText: TEST_VARS.refsText,
    guidelinesText: TEST_VARS.guidelinesText,
    templateAddition: TEST_VARS.templateAddition,
    outline: TEST_VARS.outline,
    isCompact: false,
    templateId,
    pc: {
      role: TEST_VARS['pc.role'],
      audience: TEST_VARS['pc.audience'],
      philosophy: TEST_VARS['pc.philosophy'],
      style: TEST_VARS['pc.style'],
      tone: TEST_VARS['pc.tone'],
    },
    isTeacherGuide: templateId === 'teacher-guide-4c',
    isWorkshop: templateId === 'workshop-material',
    isBusinessEdu: templateId === 'business-education',
    isStorytelling: templateId === 'storytelling',
    isTextbook: templateId === 'school-textbook',
    isSelfDirected: templateId === 'self-directed-learning',
    isAiLiteracy: templateId === 'lesson-per-session',
    isClassPreview: templateId === 'class-preview',
    isProgramming: templateId === 'programming-course',
    docStructure: '___DOCSTRUCTURE___', // 프롬프트 안에 삽입되는 부분
  };
  return vm.runInContext(`(function() { ${promptReturnCode} })()`, vm.createContext(sandbox));
}

// JSON에서 로드한 템플릿으로 결과 생성
function getJsonDocStructure(templateId, isCompact) {
  const jsonFile = templateId === '_default'
    ? join(ROOT, 'templates', '_default.json')
    : join(ROOT, 'templates', `${templateId}.json`);
  const template = JSON.parse(readFileSync(jsonFile, 'utf8'));

  if (!template.doc_structure) return null;

  const raw = (isCompact && template.doc_structure.compact)
    ? template.doc_structure.compact
    : template.doc_structure.standard;

  return substituteVars(raw, TEST_VARS);
}

function getJsonPrompt(templateId) {
  const jsonFile = templateId === '_default'
    ? join(ROOT, 'templates', '_default.json')
    : join(ROOT, 'templates', `${templateId}.json`);
  const template = JSON.parse(readFileSync(jsonFile, 'utf8'));

  if (!template.system_prompt_template) return null;

  // 먼저 docStructure를 치환하고, 그 결과를 포함하여 전체 치환
  const vars = { ...TEST_VARS, docStructure: '___DOCSTRUCTURE___' };
  return substituteVars(template.system_prompt_template, vars);
}

// ============================================================
// 비교 실행
// ============================================================

const TEMPLATE_IDS = [
  'teacher-guide-4c', 'workshop-material', 'business-education',
  'storytelling', 'school-textbook', 'self-directed-learning',
  'lesson-per-session', 'class-preview', 'programming-course',
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

console.log('🔍 추출 결과 1:1 비교 검증\n');

for (const templateId of TEMPLATE_IDS) {
  console.log(`📋 ${templateId}:`);

  // docStructure 비교 (compact + standard)
  for (const isCompact of [true, false]) {
    const effectiveId = templateId;
    const original = getOriginalDocStructure(effectiveId, isCompact);
    const fromJson = getJsonDocStructure(templateId, isCompact);

    totalTests++;
    const label = isCompact ? 'compact' : 'standard';

    if (fromJson === null) {
      console.log(`  ⚠️ docStructure(${label}): JSON에 없음`);
      failedTests++;
    } else if (original === fromJson) {
      console.log(`  ✅ docStructure(${label}): 일치 (${original.length}자)`);
      passedTests++;
    } else {
      console.log(`  ❌ docStructure(${label}): 불일치!`);
      failedTests++;
      // 차이점 찾기
      const minLen = Math.min(original.length, fromJson.length);
      for (let i = 0; i < minLen; i++) {
        if (original[i] !== fromJson[i]) {
          console.log(`     첫 차이: 위치 ${i}`);
          console.log(`     원본: ...${original.slice(Math.max(0, i - 20), i + 20)}...`);
          console.log(`     JSON: ...${fromJson.slice(Math.max(0, i - 20), i + 20)}...`);
          break;
        }
      }
      if (original.length !== fromJson.length) {
        console.log(`     길이: 원본 ${original.length}, JSON ${fromJson.length}`);
      }
    }
  }

  // system_prompt 비교
  {
    const effectiveId = templateId;
    const original = getOriginalPrompt(effectiveId);
    const fromJson = getJsonPrompt(templateId);

    totalTests++;

    if (fromJson === null) {
      console.log(`  ⚠️ system_prompt: JSON에 없음`);
      failedTests++;
    } else if (original === fromJson) {
      console.log(`  ✅ system_prompt: 일치 (${original.length}자)`);
      passedTests++;
    } else {
      console.log(`  ❌ system_prompt: 불일치!`);
      failedTests++;
      const minLen = Math.min(original.length, fromJson.length);
      for (let i = 0; i < minLen; i++) {
        if (original[i] !== fromJson[i]) {
          console.log(`     첫 차이: 위치 ${i}`);
          console.log(`     원본: ...${JSON.stringify(original.slice(Math.max(0, i - 30), i + 30))}...`);
          console.log(`     JSON: ...${JSON.stringify(fromJson.slice(Math.max(0, i - 30), i + 30))}...`);
          break;
        }
      }
      if (original.length !== fromJson.length) {
        console.log(`     길이: 원본 ${original.length}, JSON ${fromJson.length}`);
      }
    }
  }
}

// default 템플릿도 비교
{
  console.log(`\n📋 _default:`);
  for (const isCompact of [true, false]) {
    const original = getOriginalDocStructure('unknown-template', isCompact);
    const fromJson = getJsonDocStructure('_default', isCompact);
    totalTests++;
    const label = isCompact ? 'compact' : 'standard';
    if (original === fromJson) {
      console.log(`  ✅ docStructure(${label}): 일치`);
      passedTests++;
    } else {
      console.log(`  ❌ docStructure(${label}): 불일치`);
      failedTests++;
    }
  }

  const original = getOriginalPrompt('unknown-template');
  const fromJson = getJsonPrompt('_default');
  totalTests++;
  if (original === fromJson) {
    console.log(`  ✅ system_prompt: 일치`);
    passedTests++;
  } else {
    console.log(`  ❌ system_prompt: 불일치`);
    failedTests++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`결과: ${passedTests}/${totalTests} 통과, ${failedTests} 실패`);
if (failedTests === 0) {
  console.log('🎉 모든 테스트 통과! 추출이 정확합니다.');
} else {
  console.log('⚠️ 일부 테스트 실패. 불일치 부분을 확인하세요.');
  process.exit(1);
}

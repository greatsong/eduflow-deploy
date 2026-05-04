#!/usr/bin/env node
/**
 * VPyLab 7개 코스 → 에듀플로 7개 프로젝트 시드
 *
 *   - VPyLab(client/src/data/courses.js)을 정규식으로 파싱해서 메타+lessons 추출
 *   - content/vpylab/<courseId>/chapterNN.md (이론 큐레이션)을 본문으로 사용
 *   - 각 챕터에 자동으로:
 *       1) 챕터 헤더(번호·제목·예상시간·대상)
 *       2) [VPyLab에서 실습하기] 딥링크 admonition
 *       3) lesson.code 코드 블록(```python …)
 *   - projects/vpylab-<courseId>/ 디렉토리에 config.json / toc.json / docs/*.md 작성
 *
 * 실행:
 *   node scripts/seed_vpylab_courses.mjs
 *   node scripts/seed_vpylab_courses.mjs --only beg-shapes      # 1개만
 *   node scripts/seed_vpylab_courses.mjs --dry-run              # 미리보기
 *
 * 환경변수 VPYLAB_BASE_URL — 학생용 VPyLab URL (기본: https://vpylab.vercel.app)
 */
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const VPYLAB_COURSES_JS = resolve(
  ROOT,
  '..',
  'vpylab/client/src/data/courses.js',
);
const PROJECTS_DIR = resolve(ROOT, 'projects');
const CONTENT_DIR = resolve(ROOT, 'content/vpylab');

const VPYLAB_BASE_URL =
  process.env.VPYLAB_BASE_URL || 'https://vpylab.vercel.app';

// ── CLI 옵션 ─────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const onlyId = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// ── courses.js 파싱 (정규식 — Node에서 ESM import 하면 React 의존성 끌어올 수 있어 회피) ──
function parseCourses(text) {
  const courses = [];
  // 큰 객체 단위로 자르기: const courses = [ ... ]
  const arrMatch = text.match(/const\s+courses\s*=\s*\[([\s\S]*?)\];\s*\n\s*\/\//);
  if (!arrMatch) {
    // 헬퍼 함수 직전까지로 fallback
    const fb = text.match(/const\s+courses\s*=\s*\[([\s\S]*?)\];\s*\n/);
    if (!fb) throw new Error('courses 배열을 찾을 수 없습니다.');
    arrMatch[1] = fb[1];
  }
  const body = arrMatch[1];

  // 코스 단위 분리: 최상위 { … }, 중첩 균형 추적
  const items = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        items.push(body.slice(start, i + 1));
        start = -1;
      }
    }
  }

  for (const block of items) {
    const id = (block.match(/id:\s*'([^']+)'/) || [])[1];
    const track = (block.match(/track:\s*'([^']+)'/) || [])[1];
    const level = parseInt(
      (block.match(/level:\s*(\d+)/) || [])[1] || '1',
      10,
    );
    const titleKo = (block.match(/title:\s*\{\s*ko:\s*'([^']+)'/) || [])[1];
    const titleEn = (block.match(/title:\s*\{[^}]*en:\s*'([^']+)'/) || [])[1];
    const subject = (block.match(/subject:\s*'([^']+)'/) || [])[1];
    const description = (block.match(/description:\s*\n?\s*'([^']+)'/) || [])[1] || '';
    const targetGrade = (block.match(/targetGrade:\s*'([^']+)'/) || [])[1];
    const sessions = parseInt(
      (block.match(/sessions:\s*(\d+)/) || [])[1] || '0',
      10,
    );
    const icon = (block.match(/icon:\s*'([^']+)'/) || [])[1];
    const colorTw = (block.match(/color:\s*'([^']+)'/) || [])[1];
    const starlightTheme =
      (block.match(/starlightTheme:\s*'([^']+)'/) || [])[1] || colorTw;

    // audience 객체
    const audienceMatch = block.match(/audience:\s*\{([\s\S]*?)\n    \},/);
    const audience = {};
    if (audienceMatch) {
      const a = audienceMatch[1];
      const fields = [
        'profile',
        'prerequisites',
        'motivation',
        'classroomSetting',
        'curriculumLink',
        'assessmentHint',
      ];
      for (const f of fields) {
        const m = a.match(
          new RegExp(`${f}:\\s*\\n?\\s*'([^']+)'`),
        );
        if (m) audience[f] = m[1];
      }
    }

    // lessons 배열
    const lessonsMatch = block.match(
      /lessons:\s*\[([\s\S]*)\],\s*\n\s*\}\s*$/,
    );
    const lessons = [];
    if (lessonsMatch) {
      const ltext = lessonsMatch[1];
      // 각 lesson { ... } 단위
      let d = 0;
      let s = -1;
      const lblocks = [];
      for (let i = 0; i < ltext.length; i += 1) {
        const c = ltext[i];
        if (c === '{') {
          if (d === 0) s = i;
          d += 1;
        } else if (c === '}') {
          d -= 1;
          if (d === 0 && s !== -1) {
            lblocks.push(ltext.slice(s, i + 1));
            s = -1;
          }
        }
      }
      for (const lb of lblocks) {
        const lid = (lb.match(/id:\s*'([^']+)'/) || [])[1];
        const ltitleKo = (lb.match(/title:\s*\{\s*ko:\s*'([^']+)'/) || [])[1];
        const ltitleEn =
          (lb.match(/title:\s*\{[^}]*en:\s*'([^']+)'/) || [])[1];
        const summary = (lb.match(/summary:\s*'([^']+)'/) || [])[1] || '';
        const codeMatch = lb.match(/code:\s*`([\s\S]*?)`,?\s*\n\s*\}/);
        const code = codeMatch ? codeMatch[1] : '';
        if (lid) {
          lessons.push({
            id: lid,
            title: { ko: ltitleKo || lid, en: ltitleEn || lid },
            summary,
            code,
          });
        }
      }
    }

    if (id) {
      courses.push({
        id,
        track,
        level,
        title: { ko: titleKo, en: titleEn },
        subject,
        description,
        targetGrade,
        sessions,
        icon,
        color: colorTw,
        starlightTheme,
        audience,
        lessons,
      });
    }
  }
  return courses;
}

// ── 한 챕터 본문 합성 ─────────────────────────────────────
function chapterFrontMatter({ chapterNo, lesson, course }) {
  const total = course.lessons.length;
  return [
    `# Chapter ${String(chapterNo).padStart(2, '0')}. ${lesson.title.ko}`,
    '',
    `**${course.title.ko}** · ${chapterNo}/${total}차시 · ⏱️ 50분`,
    '',
    `> ${lesson.summary}`,
    '',
    '---',
    '',
  ].join('\n');
}

function vpylabPracticeBox({ course, lesson }) {
  const url = `${VPYLAB_BASE_URL}/courses/${course.id}/${lesson.id}`;
  return [
    '!!! tip "✏️ VPyLab에서 실습"',
    `    이 차시의 코드를 직접 실행해 보고 변형해 보세요.`,
    '',
    `    [▶ VPyLab에서 실습 열기](${url})`,
    '',
    '    아래는 학생이 따라 칠 코드입니다.',
    '',
  ].join('\n');
}

function codeBlock(code) {
  return ['```python', code.trimEnd(), '```', ''].join('\n');
}

async function buildChapterMd({
  course,
  lesson,
  chapterNo,
  curatedTheory,
}) {
  const head = chapterFrontMatter({ chapterNo, lesson, course });
  const theory = curatedTheory.trim() + '\n\n';
  const practice = vpylabPracticeBox({ course, lesson });
  const code = codeBlock(lesson.code);
  const tail = [
    '---',
    '',
    '## ✅ 차시 마무리 체크',
    '',
    '- [ ] 학생이 코드를 실행해 결과를 확인했다',
    '- [ ] 학생이 한 군데 이상 변형해 보았다',
    '- [ ] 차시 산출물(스크린샷·소리 클립 등)을 기록했다',
    '',
  ].join('\n');
  return head + theory + practice + code + tail;
}

function buildIndexMd(course) {
  const lines = [
    `# ${course.title.ko}`,
    '',
    `> ${course.description}`,
    '',
    '## 코스 개요',
    '',
    `- **트랙**: ${course.track === 'beginner' ? '입문 트랙' : '융합 트랙'}`,
    `- **결합 교과**: ${course.subject}`,
    `- **권장 학년**: ${course.targetGrade}`,
    `- **차시 수**: ${course.sessions}차시 (50분 × ${course.sessions})`,
    '',
    '## 대상 학습자',
    '',
    `- **학습자 프로필**: ${course.audience.profile || '—'}`,
    `- **사전 지식**: ${course.audience.prerequisites || '—'}`,
    `- **학습 동기**: ${course.audience.motivation || '—'}`,
    `- **교실 환경**: ${course.audience.classroomSetting || '—'}`,
    `- **교육과정 연계**: ${course.audience.curriculumLink || '—'}`,
    `- **평가 가이드**: ${course.audience.assessmentHint || '—'}`,
    '',
    '## 차시 일람',
    '',
    '| # | 제목 | 핵심 활동 |',
    '|---|---|---|',
    ...course.lessons.map(
      (l, i) => `| ${i + 1} | ${l.title.ko} | ${l.summary} |`,
    ),
    '',
    '## 학생 실습 환경',
    '',
    `이 코스의 모든 차시는 VPyLab 웹 에디터에서 즉시 실행됩니다.`,
    '',
    `- **VPyLab**: ${VPYLAB_BASE_URL}/courses/${course.id}`,
    `- **설치 불필요**: 브라우저만 있으면 바로 시작`,
    '',
  ];
  return lines.join('\n');
}

// ── 코스 → 프로젝트 1개 시드 ─────────────────────────────
async function seedOne(course) {
  const projectId = `vpylab-${course.id}`;
  const projDir = join(PROJECTS_DIR, projectId);
  const docsDir = join(projDir, 'docs');

  console.log(`\n[${projectId}] ${course.title.ko}`);
  console.log(`  └ 차시 ${course.lessons.length}개, Starlight=${course.starlightTheme}`);

  // 큐레이션된 챕터 본문(이론) 로드
  const chapterTheory = [];
  for (let i = 0; i < course.lessons.length; i += 1) {
    const cfile = join(
      CONTENT_DIR,
      course.id,
      `chapter${String(i + 1).padStart(2, '0')}.md`,
    );
    if (existsSync(cfile)) {
      chapterTheory.push(await readFile(cfile, 'utf-8'));
    } else {
      // 큐레이션 미작성 — 자리 표시
      chapterTheory.push(
        `> ⚠️ TODO: 이 차시의 이론 본문이 아직 큐레이션되지 않았습니다.\n`,
      );
    }
  }

  if (dryRun) {
    console.log(`  (dry-run) 작성 예정 파일: config.json, toc.json, docs/index.md, docs/chapterNN.md × ${course.lessons.length}`);
    return;
  }

  await mkdir(docsDir, { recursive: true });

  // config.json
  const config = {
    name: projectId,
    title: `${course.title.ko} · 교사용 교재`,
    author: '석리송',
    description: course.description,
    claude_model: 'none',
    owner: { googleId: 'local', email: 'local@eduflow', name: 'Local User' },
    settings: {
      batch_generation_enabled: false,
      auto_save: true,
      max_tokens: 16000,
      temperature: 1,
    },
    include_hw_diagrams: false,
    image_generation_enabled: false,
    assessment_level: 1,
    deployment: {
      auto_commit: false,
      auto_deploy: false,
      build_docx: false,
      build_website: true,
      theme: 'starlight',
      colorTheme: course.starlightTheme,
    },
    vpylab: {
      courseId: course.id,
      track: course.track,
      lessons: course.lessons.map((l) => l.id),
      baseUrl: VPYLAB_BASE_URL,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await writeFile(
    join(projDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8',
  );

  // toc.json
  const toc = {
    title: course.title.ko,
    target_audience: `${course.targetGrade} · ${course.subject}`,
    description: course.description,
    total_hours: `${course.sessions}차시 (50분 × ${course.sessions})`,
    parts: [
      {
        part_number: 1,
        part_title: course.title.ko,
        part_description: course.description,
        chapters: course.lessons.map((l, i) => ({
          chapter_id: `chapter${String(i + 1).padStart(2, '0')}`,
          chapter_number: i + 1,
          chapter_title: l.title.ko,
          estimated_time: '50분',
          learning_objectives: [l.summary],
          key_topics: [],
          outline: l.summary,
          vpylab_lesson_id: l.id,
        })),
      },
    ],
  };
  await writeFile(
    join(projDir, 'toc.json'),
    JSON.stringify(toc, null, 2),
    'utf-8',
  );

  // docs/index.md
  await writeFile(join(docsDir, 'index.md'), buildIndexMd(course), 'utf-8');

  // docs/chapterNN.md
  for (let i = 0; i < course.lessons.length; i += 1) {
    const md = await buildChapterMd({
      course,
      lesson: course.lessons[i],
      chapterNo: i + 1,
      curatedTheory: chapterTheory[i],
    });
    const fname = `chapter${String(i + 1).padStart(2, '0')}.md`;
    await writeFile(join(docsDir, fname), md, 'utf-8');
  }

  // master-context.md (간단)
  const ctx = [
    `# ${course.title.ko} — 마스터 컨텍스트`,
    '',
    course.description,
    '',
    `## 대상 학습자`,
    '',
    JSON.stringify(course.audience, null, 2),
    '',
    `## VPyLab 연계`,
    '',
    `- 코스 ID: \`${course.id}\``,
    `- 학생용 URL: ${VPYLAB_BASE_URL}/courses/${course.id}`,
  ].join('\n');
  await writeFile(join(projDir, 'master-context.md'), ctx, 'utf-8');

  console.log('  ✓ 시드 완료');
}

// ── 메인 ────────────────────────────────────────────────
async function main() {
  const text = await readFile(VPYLAB_COURSES_JS, 'utf-8');
  const courses = parseCourses(text);
  console.log(`courses.js 파싱: ${courses.length}개 코스`);

  const targets = onlyId ? courses.filter((c) => c.id === onlyId) : courses;
  if (targets.length === 0) {
    console.error(`❌ --only ${onlyId} 에 해당하는 코스 없음`);
    process.exit(1);
  }

  await mkdir(PROJECTS_DIR, { recursive: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  for (const c of targets) {
    await seedOne(c);
  }
  console.log('\n✅ 모든 시드 완료.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

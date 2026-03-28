import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 회로도(hw-diagram) 프롬프트 — 모든 템플릿에서 옵션으로 사용 가능
const HW_DIAGRAM_PROMPT = `

### 시각 자료 & 회로도

하드웨어 관련 시각 자료는 **반드시** 아래 HTML 마크업을 사용:

\`\`\`html
<!-- Pico 핀 배치도 -->
<div class="hw-diagram" data-type="pico-pinout"
     data-highlight='[{"pin":"핀이름","label":"용도","color":"색상코드"}]'>
</div>

<!-- 회로 연결도 -->
<div class="hw-diagram" data-type="connection"
     data-title="제목"
     data-connections='[{"from":"핀","to":"부품","then":"다음부품","color":"색상"}]'
     data-notes='["주의사항1","주의사항2"]'>
</div>

<!-- 센서 모듈 연결 -->
<div class="hw-diagram" data-type="sensor-module"
     data-sensor="센서명"
     data-title="제목"
     data-connections='[{"pin":"센서핀","to":"Pico핀","note":"설명","color":"색상"}]'>
</div>
\`\`\`

소프트웨어/개념 다이어그램은 Mermaid를 사용:
\`\`\`mermaid
flowchart LR
  A[입력] --> B[처리] --> C[출력]
\`\`\`
`;

export class TemplateManager {
  constructor(templatesDir = null) {
    this.templatesDir = templatesDir || join(__dirname, '..', '..', 'templates');
  }

  async listTemplates() {
    if (!existsSync(this.templatesDir)) return [];

    const files = await readdir(this.templatesDir);
    const templates = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(this.templatesDir, file), 'utf-8');
        templates.push(JSON.parse(raw));
      } catch (e) {
        console.error(`템플릿 로드 실패 (${file}):`, e.message);
      }
    }

    return templates;
  }

  async getTemplate(templateId) {
    const filePath = join(this.templatesDir, `${templateId}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('템플릿 로드 실패:', e.message);
      return null;
    }
  }

  async applyTemplate(templateId, projectPath, variables = {}) {
    const template = await this.getTemplate(templateId);
    if (!template) return false;

    let contextTemplate = template.context_template || '';

    // 변수 치환
    for (const [key, value] of Object.entries(variables)) {
      contextTemplate = contextTemplate.replaceAll(`{{${key}}}`, String(value));
    }

    try {
      // master-context.md 생성
      const contextFile = join(projectPath, 'master-context.md');
      await writeFile(contextFile, `# 템플릿: ${template.name}\n\n${contextTemplate}`, 'utf-8');

      // template-info.json 저장
      const templateInfoFile = join(projectPath, 'template-info.json');
      const templateInfoData = {
        template_id: templateId,
        template_name: template.name,
        toc_prompt_addition: template.toc_prompt_addition || '',
        chapter_prompt_addition: template.chapter_prompt_addition || '',
      };
      if (template.required_assets) {
        templateInfoData.required_assets = template.required_assets;
      }
      if (template.validation) {
        templateInfoData.validation = template.validation;
      }
      await writeFile(templateInfoFile, JSON.stringify(templateInfoData, null, 2), 'utf-8');

      return true;
    } catch (e) {
      console.error('템플릿 적용 실패:', e.message);
      return false;
    }
  }

  async getTocPromptAddition(projectPath) {
    const filePath = join(projectPath, 'template-info.json');
    if (!existsSync(filePath)) return '';
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw).toc_prompt_addition || '';
    } catch {
      return '';
    }
  }

  async getChapterPromptAddition(projectPath) {
    const filePath = join(projectPath, 'template-info.json');
    let addition = '';
    try {
      if (existsSync(filePath)) {
        const raw = await readFile(filePath, 'utf-8');
        addition = JSON.parse(raw).chapter_prompt_addition || '';
      }
    } catch {
      // ignore
    }

    // config.json에서 include_hw_diagrams 옵션 확인
    const configPath = join(projectPath, 'config.json');
    try {
      if (existsSync(configPath)) {
        const configRaw = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configRaw);
        if (config.include_hw_diagrams) {
          // 이미 hw-diagram 마크업이 포함된 템플릿(class-preview)은 중복 추가 안 함
          if (!addition.includes('hw-diagram')) {
            addition += HW_DIAGRAM_PROMPT;
          }
        }
      }
    } catch {
      // ignore
    }

    return addition;
  }
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { apiFetch, apiStreamPost, API_BASE } from '../api/client';
import { getAuthToken } from '../components/EntryForm';

const TABS = ['프로젝트 설정', '참고자료', '프롬프트 설정', '빠른 시작'];

// 간단한 마크다운 → HTML 변환
function simpleMarkdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // 코드 블록 (```...```) — 먼저 처리하여 내부 내용이 다른 변환에 영향받지 않도록 함
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:#1e293b;color:#e2e8f0;border-radius:8px;padding:16px;overflow-x:auto;font-size:13px;line-height:1.5"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    );
    return `__CODE_BLOCK_${idx}__`;
  });

  // 인라인 코드
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>');

  // 헤딩
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:1em;font-weight:700;margin:20px 0 8px;color:#1e293b">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:700;margin:24px 0 10px;color:#1e293b">$1</h3>');
  html = html.replace(/^## .+$/gm, ''); // 최상위 섹션 제목은 모달 헤더에 이미 표시

  // 볼드, 이탤릭
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 블록인용
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #93c5fd;padding:8px 16px;margin:12px 0;background:#eff6ff;color:#1e40af;border-radius:0 8px 8px 0">$1</blockquote>');

  // 테이블 (간단 처리)
  html = html.replace(/^\|(.+)\|$/gm, (match, inner) => {
    const cells = inner.split('|').map(c => c.trim());
    // 구분선 행 건너뛰기
    if (cells.every(c => /^[-:]+$/.test(c))) return '';
    const tag = 'td';
    const cellsHtml = cells.map(c => `<${tag} style="border:1px solid #e2e8f0;padding:6px 12px;font-size:0.85em">${c}</${tag}>`).join('');
    return `<tr>${cellsHtml}</tr>`;
  });
  // 테이블 행들을 table로 감싸기
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table style="border-collapse:collapse;width:100%;margin:12px 0">$1</table>');

  // 리스트
  html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:disc">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:decimal">$2</li>');

  // 체크박스 리스트
  html = html.replace(/^- \[x\] (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:none"><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:none"><input type="checkbox" disabled> $1</li>');

  // details/summary
  html = html.replace(/<details><summary>(.+?)<\/summary>/g, '<details style="margin:12px 0;padding:8px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0"><summary style="cursor:pointer;font-weight:600;color:#475569">$1</summary>');

  // 단락: 빈 줄을 <br/>로 변환
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  // 코드 블록 복원
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  return html;
}

export default function ProjectManager() {
  const { projects, currentProject, fetchProjects, selectProject, clearProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('eduflow_pm_tab');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [userLimit, setUserLimit] = useState({ maxProjects: 99, projectCount: 0, isAdmin: false });

  const handleTabChange = (i) => {
    setActiveTab(i);
    sessionStorage.setItem('eduflow_pm_tab', String(i));
  };

  const fetchUserLimit = () => {
    apiFetch('/api/user/status')
      .then(data => setUserLimit({
        maxProjects: data.maxProjects || 1,
        projectCount: data.projectCount || 0,
        isAdmin: data.isAdmin || false,
      }))
      .catch(() => {});
  };

  useEffect(() => { fetchProjects(); fetchUserLimit(); }, []);

  const atLimit = !userLimit.isAdmin && userLimit.projectCount >= userLimit.maxProjects;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">📁 프로젝트 관리</h2>

      {/* 프로젝트 한도 정보 */}
      {!userLimit.isAdmin && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          atLimit ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          <span className="font-medium">프로젝트: {userLimit.projectCount} / {userLimit.maxProjects}개</span>
          {atLimit && <span className="text-xs">— 한도에 도달했습니다. 관리자에게 한도 증가를 요청하세요.</span>}
        </div>
      )}

      {/* 프로젝트 선택 */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">프로젝트:</label>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={currentProject?.name || ''}
          onChange={(e) => e.target.value ? selectProject(e.target.value) : clearProject()}
        >
          {!atLimit && <option value="">+ 새 프로젝트 만들기</option>}
          {atLimit && !currentProject && <option value="">프로젝트를 선택하세요</option>}
          {projects.map((p) => (
            <option key={p.name} value={p.name}>{p.title || p.name}</option>
          ))}
        </select>
        {currentProject && (
          <span className="text-sm text-green-600 font-medium">
            ✅ {currentProject.title}
          </span>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => handleTabChange(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === i
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 0 && <ProjectSettingsTab project={currentProject} onCreated={() => { fetchProjects(); fetchUserLimit(); }} onUpdated={fetchProjects} atLimit={atLimit} />}
      {activeTab === 1 && <ReferencesTab projectId={currentProject?.name} />}
      {activeTab === 2 && <PromptSettingsTab projectId={currentProject?.name} />}
      {activeTab === 3 && <QuickStartTab projectId={currentProject?.name} />}
    </div>
  );
}

// ============================================================
// 탭 1: 프로젝트 설정 (새 프로젝트 / 기존 프로젝트 수정)
// ============================================================
function ProjectSettingsTab({ project, onCreated, onUpdated, atLimit }) {
  const { selectProject } = useProjectStore();
  const navigate = useNavigate();

  // 새 프로젝트 폼 임시저장 (페이지 이동 시 유지)
  const DRAFT_KEY = 'eduflow_project_draft';
  const loadDraft = () => {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch { return null; }
  };
  const saveDraft = (data) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

  const draft = !project ? loadDraft() : null;
  const [form, setForm] = useState(
    draft?.form || { name: '', title: '', author: '', description: '', target_audience: '' }
  );
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(draft?.selectedTemplate || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(draft?.showPromptEditor || false);
  const [tocPrompt, setTocPrompt] = useState(draft?.tocPrompt || '');
  const [chapterPrompt, setChapterPrompt] = useState(draft?.chapterPrompt || '');
  const [includeHwDiagrams, setIncludeHwDiagrams] = useState(draft?.includeHwDiagrams || false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleContent, setSampleContent] = useState('');
  const [sampleTitle, setSampleTitle] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);

  // 새 프로젝트 폼 변경 시 자동 임시저장
  useEffect(() => {
    if (!project) {
      saveDraft({ form, selectedTemplate, tocPrompt, chapterPrompt, showPromptEditor, includeHwDiagrams });
    }
  }, [form, selectedTemplate, tocPrompt, chapterPrompt, showPromptEditor, includeHwDiagrams, project]);

  // 템플릿 목록 로드
  useEffect(() => {
    apiFetch('/api/projects/templates/list').then(setTemplates).catch(() => {});
  }, []);

  // 기존 프로젝트 선택 시 정보 로드
  useEffect(() => {
    if (!project) {
      // 새 프로젝트 모드: draft가 있으면 유지됨 (이미 useState에서 로드)
      setMessage('');
      return;
    }
    // 기존 프로젝트 선택 시 draft 삭제
    clearDraft();

    // 기존 프로젝트: 정보 로드
    setLoading(true);
    Promise.all([
      apiFetch(`/api/projects/${project.name}`).catch(() => ({})),
      apiFetch(`/api/projects/${project.name}/template-info`).catch(() => ({})),
    ]).then(([config, templateInfo]) => {
      setForm({
        name: project.name,
        title: config.title || project.title || '',
        author: config.author || '',
        description: config.description || '',
        target_audience: config.target_audience || '',
      });
      setSelectedTemplate(templateInfo.template_id || '');
      setTocPrompt(templateInfo.toc_prompt_addition || '');
      setChapterPrompt(templateInfo.chapter_prompt_addition || '');
      setIncludeHwDiagrams(config.include_hw_diagrams || false);
      if (templateInfo.template_id) setShowPromptEditor(true);
    }).finally(() => setLoading(false));
  }, [project]);

  // 템플릿 선택 시 프롬프트 로드 (새 프로젝트 모드에서만)
  useEffect(() => {
    if (project) return; // 기존 프로젝트면 무시
    if (!selectedTemplate) {
      setTocPrompt('');
      setChapterPrompt('');
      setShowPromptEditor(false);
      return;
    }
    const tmpl = templates.find((t) => t.id === selectedTemplate);
    if (tmpl) {
      setTocPrompt(tmpl.toc_prompt_addition || '');
      setChapterPrompt(tmpl.chapter_prompt_addition || '');
    }
  }, [selectedTemplate, templates, project]);

  const handleCreate = async () => {
    if (!form.name || !form.title) {
      setError('프로젝트 ID와 제목은 필수입니다');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const body = {
        ...form,
        template_id: selectedTemplate || undefined,
        include_hw_diagrams: includeHwDiagrams,
        custom_prompt_config: selectedTemplate ? {
          toc_prompt_addition: tocPrompt,
          chapter_prompt_addition: chapterPrompt,
        } : undefined,
      };
      await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(body) });
      clearDraft(); // 생성 완료 후 임시저장 삭제
      await onCreated();
      selectProject(form.name);
      setMessage('프로젝트가 생성되었습니다!');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.title) {
      setError('제목은 필수입니다');
      return;
    }
    setError('');
    setSaving(true);
    try {
      // config.json 업데이트
      await apiFetch(`/api/projects/${project.name}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title,
          author: form.author,
          description: form.description,
          target_audience: form.target_audience,
          include_hw_diagrams: includeHwDiagrams,
        }),
      });
      // template-info.json 업데이트
      await apiFetch(`/api/projects/${project.name}/template-info`, {
        method: 'PUT',
        body: JSON.stringify({
          template_id: selectedTemplate,
          toc_prompt_addition: tocPrompt,
          chapter_prompt_addition: chapterPrompt,
        }),
      });
      await onUpdated();
      setMessage('프로젝트가 업데이트되었습니다!');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShowSample = async () => {
    if (!selectedTemplate) return;
    setSampleLoading(true);
    setSampleContent('');
    setSampleTitle('');
    try {
      const data = await apiFetch(`/api/projects/templates/samples/${selectedTemplate}`);
      setSampleContent(data.content);
      setSampleTitle(data.title);
      setShowSampleModal(true);
    } catch (e) {
      setError('샘플을 불러올 수 없습니다: ' + e.message);
    } finally {
      setSampleLoading(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">프로젝트 정보 로딩 중...</div>;
  }

  const isEditMode = !!project;

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold mb-4">
        {isEditMode ? '✏️ 프로젝트 수정' : '🆕 새 프로젝트 만들기'}
      </h3>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">{message}</p>
          {message.includes('생성되었습니다') && (
            <button
              onClick={() => navigate('/discussion')}
              className="mt-3 w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              💬 Step 1: 방향성 논의 시작하기 →
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field
          label="프로젝트 ID"
          placeholder="my-book"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          disabled={isEditMode}
        />
        <Field label="제목" placeholder="나의 교육자료" value={form.title}
          onChange={(v) => setForm({ ...form, title: v })} />
        <Field label="작성자" placeholder="홍길동" value={form.author}
          onChange={(v) => setForm({ ...form, author: v })} />
        <Field label="대상 독자" placeholder="프로그래밍 입문자" value={form.target_audience}
          onChange={(v) => setForm({ ...form, target_audience: v })} />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          rows={3} placeholder="이 교육자료는..." value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {/* 템플릿 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">템플릿</label>
        <div className="flex gap-2">
          <select
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            <option value="">없음 (직접 설정)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
            ))}
          </select>
          {selectedTemplate && (
            <button
              type="button"
              onClick={handleShowSample}
              disabled={sampleLoading}
              className="px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {sampleLoading ? '로딩...' : '샘플 미리보기'}
            </button>
          )}
        </div>
        {selectedTemplate && (
          <p className="mt-1 text-xs text-gray-500">
            {templates.find((t) => t.id === selectedTemplate)?.description}
          </p>
        )}
      </div>

      {/* 회로도 포함 옵션 */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={includeHwDiagrams}
              onChange={(e) => setIncludeHwDiagrams(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
            <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">인터랙티브 회로도 포함</span>
            <p className="text-xs text-gray-500">Pico 핀배치, 회로 연결도, 센서 모듈 다이어그램을 자동 생성합니다</p>
          </div>
        </label>
      </div>

      {/* 샘플 미리보기 모달 */}
      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSampleModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">샘플 미리보기</h3>
                <p className="text-sm text-gray-500 mt-0.5">{sampleTitle}</p>
              </div>
              <button
                onClick={() => setShowSampleModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div
                className="text-sm leading-relaxed text-gray-800"
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(sampleContent) }}
              />
            </div>
            {/* 모달 하단 */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
              <p className="text-xs text-gray-400">이 템플릿으로 생성되는 챕터의 예시입니다</p>
              <button
                onClick={() => setShowSampleModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프롬프트 편집 토글 */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="text-sm text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
        >
          {showPromptEditor ? '▾ 프롬프트 설정 접기' : '▸ 프롬프트 설정 보기/수정'}
        </button>

        {showPromptEditor && (
          <div className="mt-3 space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                목차 생성 프롬프트 추가 지침
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed bg-white"
                rows={8}
                value={tocPrompt}
                onChange={(e) => setTocPrompt(e.target.value)}
                placeholder="목차 생성 시 AI에게 전달될 추가 지침..."
              />
              <p className="mt-1 text-xs text-gray-400">
                목차 자동 생성 시 이 지침이 프롬프트에 추가됩니다
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                챕터 작성 프롬프트 추가 지침
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed bg-white"
                rows={8}
                value={chapterPrompt}
                onChange={(e) => setChapterPrompt(e.target.value)}
                placeholder="챕터 작성 시 AI에게 전달될 추가 지침..."
              />
              <p className="mt-1 text-xs text-gray-400">
                각 챕터 생성 시 이 지침이 프롬프트에 추가됩니다
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 한도 도달 시 새 프로젝트 생성 차단 */}
      {!isEditMode && atLimit ? (
        <div className="w-full py-3 bg-gray-100 text-gray-500 rounded-lg font-medium text-center border border-gray-200">
          프로젝트 한도에 도달하여 새 프로젝트를 만들 수 없습니다
        </div>
      ) : (
        <button
          onClick={isEditMode ? handleUpdate : handleCreate}
          disabled={saving}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isEditMode ? '업데이트 중...' : '프로젝트 생성 중...'}
            </span>
          ) : isEditMode ? '💾 프로젝트 업데이트' : '🚀 프로젝트 만들기'}
        </button>
      )}
    </div>
  );
}

// ============================================================
// 탭 2: 참고자료 관리
// ============================================================
function ReferencesTab({ projectId }) {
  const [files, setFiles] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch(`/api/projects/${projectId}/references`);
      setFiles(data.files);
      setTotalSize(data.totalSize);
    } catch { }
  };

  useEffect(() => { loadFiles(); }, [projectId]);

  if (!projectId) {
    return <p className="text-gray-500">먼저 프로젝트를 선택하세요.</p>;
  }

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    const formData = new FormData();
    for (const f of fileList) formData.append('files', f);

    try {
      const headers = {};
      const token = getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/projects/${projectId}/references`, {
        method: 'POST', headers, body: formData,
      });
      await loadFiles();
    } catch { }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (filename) => {
    try {
      await apiFetch(`/api/projects/${projectId}/references/${filename}`, { method: 'DELETE' });
      await loadFiles();
    } catch { }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">📚 참고자료 관리</h3>

      {/* 업로드 */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-700">
            {uploading ? '업로드 중...' : '📤 파일 선택 및 업로드'}
          </span>
          <input type="file" multiple accept=".md,.txt,.markdown,.docx,.pdf,.csv,.xlsx,.xls,.json"
            onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {/* 통계 */}
      <div className="flex gap-6 mb-4 text-sm text-gray-600">
        <span>파일 수: <strong>{files.length}</strong></span>
        <span>전체 크기: <strong>{(totalSize / 1024).toFixed(1)} KB</strong></span>
      </div>

      {/* 파일 목록 */}
      {files.length === 0 ? (
        <p className="text-gray-400 text-sm">참고자료가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div>
                <span className="text-sm font-medium">📄 {f.name}</span>
                <span className="ml-2 text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
              <button onClick={() => handleDelete(f.name)}
                className="text-xs text-red-500 hover:text-red-700">삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 탭 3: 프롬프트 설정
// ============================================================
function PromptSettingsTab({ projectId }) {
  const [templateInfo, setTemplateInfo] = useState(null);
  const [tocPrompt, setTocPrompt] = useState('');
  const [chapterPrompt, setChapterPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiFetch(`/api/projects/${projectId}/template-info`)
      .then((data) => {
        setTemplateInfo(data);
        setTocPrompt(data.toc_prompt_addition || '');
        setChapterPrompt(data.chapter_prompt_addition || '');
      })
      .catch(() => {
        setTemplateInfo({ exists: false });
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return <p className="text-gray-500">먼저 프로젝트를 선택하세요.</p>;
  }

  if (loading) {
    return <p className="text-gray-400">로딩 중...</p>;
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/api/projects/${projectId}/template-info`, {
        method: 'PUT',
        body: JSON.stringify({
          toc_prompt_addition: tocPrompt,
          chapter_prompt_addition: chapterPrompt,
        }),
      });
      setMessage('저장되었습니다!');
    } catch (e) {
      setMessage('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h3 className="text-lg font-semibold mb-4">⚙️ 프롬프트 설정</h3>
      <p className="text-sm text-gray-500 mb-6">
        목차 생성 및 챕터 작성 시 AI에게 전달되는 추가 지침을 설정합니다.
        {templateInfo?.template_name && (
          <span className="ml-2 text-emerald-600">
            (템플릿: {templateInfo.template_name})
          </span>
        )}
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            목차 생성 프롬프트 추가 지침
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
            rows={10}
            value={tocPrompt}
            onChange={(e) => setTocPrompt(e.target.value)}
            placeholder="목차 생성 시 AI에게 전달될 추가 지침..."
          />
          <p className="mt-1 text-xs text-gray-400">
            AI가 목차를 자동 생성할 때 이 지침이 프롬프트에 추가됩니다
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            챕터 작성 프롬프트 추가 지침
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
            rows={10}
            value={chapterPrompt}
            onChange={(e) => setChapterPrompt(e.target.value)}
            placeholder="챕터 작성 시 AI에게 전달될 추가 지침..."
          />
          <p className="mt-1 text-xs text-gray-400">
            AI가 각 챕터를 작성할 때 이 지침이 프롬프트에 추가됩니다
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '💾 저장'}
          </button>
          {message && (
            <span className={`text-sm ${message.includes('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 탭 4: 빠른 시작 (AI 분석 + 직접 입력 통합)
// ============================================================
function QuickStartTab({ projectId }) {
  const navigate = useNavigate();
  const { refreshProgress } = useProjectStore();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('ai'); // 'ai' | 'manual'

  // AI 분석 모드 state
  const [mdContent, setMdContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [saveAsRef, setSaveAsRef] = useState(true);
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [models, setModels] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [done, setDone] = useState(false);

  // 직접 입력 모드 state
  const [discussionText, setDiscussionText] = useState('');
  const [tocText, setTocText] = useState('');
  const [inputMode, setInputMode] = useState('discussion');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch('/api/models').then((d) => {
      setModels(d.models);
      apiFetch('/api/models/default/conversation').then((r) => setModel(r.modelId)).catch(() => {});
    }).catch(() => {});
  }, []);

  // 직접 입력 모드에서 기존 데이터 로드
  useEffect(() => {
    if (!projectId || mode !== 'manual') return;
    apiFetch(`/api/projects/${projectId}/context`)
      .then(data => { if (data?.content) setDiscussionText(data.content); })
      .catch(() => {});
    apiFetch(`/api/projects/${projectId}/toc`)
      .then(data => { if (data?.toc_md) setTocText(data.toc_md); })
      .catch(() => {});
  }, [projectId, mode]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setMdContent(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProcess = async () => {
    if (!projectId || !mdContent) return;
    setProcessing(true);
    setLogs([]);
    setDone(false);

    try {
      await apiStreamPost(
        `/api/projects/${projectId}/toc/parse-md`,
        { content: mdContent, model, saveAsReference: saveAsRef },
        {
          onProgress: (data) => setLogs((prev) => [...prev, data.message]),
          onDone: () => { setProcessing(false); setDone(true); refreshProgress(); },
          onError: (err) => { setLogs((prev) => [...prev, `❌ 오류: ${err.message}`]); setProcessing(false); },
        }
      );
    } catch (err) {
      setLogs((prev) => [...prev, `❌ 오류: ${err.message}`]);
      setProcessing(false);
    }
  };

  const handleSaveDiscussion = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/api/projects/${projectId}/context`, {
        method: 'PUT',
        body: JSON.stringify({ content: discussionText }),
      });
      setMessage('논의사항이 저장되었습니다!');
    } catch (e) {
      setMessage('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToc = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/api/projects/${projectId}/toc/direct`, {
        method: 'POST',
        body: JSON.stringify({ toc_md: tocText }),
      });
      setMessage('목차가 저장되었습니다!');
    } catch (e) {
      setMessage('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return <p className="text-gray-500">먼저 프로젝트를 선택하세요.</p>;
  }

  return (
    <div className="max-w-3xl">
      <h3 className="text-lg font-semibold mb-2">🚀 빠른 시작</h3>
      <p className="text-sm text-gray-500 mb-4">
        Step 1~3을 건너뛰고 바로 챕터 제작 단계로 이동합니다.
      </p>

      {/* 모드 선택 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'ai' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🤖 AI 분석 (MD 파일 업로드)
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ✏️ 직접 입력
        </button>
      </div>

      {mode === 'ai' && (
        <>
          {/* 파일 업로드 */}
          <div className="mb-4">
            <label className="block mb-2">
              <span
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-700"
              >
                📤 MD/TXT 파일 선택
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="text-sm text-green-600 mt-1">📄 {fileName} ({mdContent.length.toLocaleString()}자)</p>
            )}
          </div>

          {mdContent && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">미리보기</label>
              <textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                className="w-full h-48 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
              />
            </div>
          )}

          {/* 옵션 */}
          <div className="mb-4 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={saveAsRef} onChange={(e) => setSaveAsRef(e.target.checked)} className="rounded" />
              참고자료로도 저장
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">모델:</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white">
                {models.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
              </select>
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={processing || !mdContent}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {processing ? '분석 중...' : '🚀 목차 분석 & 빠른 시작'}
          </button>

          {logs.length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
              {logs.map((log, i) => (<div key={i} className="text-xs text-gray-300 py-0.5 font-mono">{log}</div>))}
            </div>
          )}

          {done && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700 font-medium">✅ 빠른 시작 완료!</p>
                <p className="text-xs text-green-600 mt-1">Step 1~3이 자동 완료되었습니다.</p>
              </div>
              <button onClick={() => navigate('/chapters')} className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                ✍️ Step 4: 챕터 제작으로 →
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'manual' && (
        <>
          {/* 직접 입력 서브모드 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('discussion')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'discussion' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 논의사항 입력
            </button>
            <button
              onClick={() => setInputMode('toc')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'toc' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 목차 입력
            </button>
          </div>

          {inputMode === 'discussion' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">방향성 논의 내용 (master-context.md)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
                rows={12}
                value={discussionText}
                onChange={(e) => setDiscussionText(e.target.value)}
                placeholder={`# 교육 목표\n이 교육자료의 목표는...\n\n# 대상 독자\n- 프로그래밍 경험이 없는 입문자\n\n# 학습 시간\n약 20차시 (1차시 = 50분)`}
              />
              <p className="mt-1 text-xs text-gray-400">Markdown 형식으로 작성. AI 목차 생성 및 챕터 작성 시 참조됩니다.</p>
              <button
                onClick={handleSaveDiscussion}
                disabled={saving}
                className="mt-3 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '💾 논의사항 저장'}
              </button>
            </div>
          )}

          {inputMode === 'toc' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">목차 직접 입력 (Markdown 형식)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
                rows={12}
                value={tocText}
                onChange={(e) => setTocText(e.target.value)}
                placeholder={`# Part 1. 시작하기\n## Chapter 1. 개발 환경 설정\n- 예상 시간: 30분\n\n## Chapter 2. 첫 번째 프로그램\n- 예상 시간: 50분`}
              />
              <p className="mt-1 text-xs text-gray-400"># Part, ## Chapter 형식으로 작성하면 자동으로 JSON 구조로 변환됩니다.</p>
              <button
                onClick={handleSaveToc}
                disabled={saving}
                className="mt-3 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '💾 목차 저장 및 변환'}
              </button>
            </div>
          )}

          {message && (
            <p className={`mt-4 text-sm ${message.includes('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// 공통 컴포넌트
// ============================================================
function Field({ label, placeholder, value, onChange, disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-100 text-gray-500' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

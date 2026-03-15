import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { apiFetch, getApiKey } from '../api/client';

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* 히어로 섹션 — 글래스모피즘 + 대형 비주얼 */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white px-8 py-16 md:px-16 mb-12">
        {/* 데코 서클 */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-teal-400/20 blur-2xl" />
        <div className="absolute top-10 right-[30%] w-32 h-32 rounded-full bg-emerald-300/10 blur-xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          {/* 텍스트 */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur rounded-full text-xs font-medium mb-5 border border-white/20">
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
              v0.3 — Multi-AI · 사용자 관리 · 포트폴리오
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
              에듀플로
              <span className="block text-emerald-200 text-2xl md:text-3xl font-semibold mt-1">
                EduFlow
              </span>
            </h1>
            <p className="text-lg text-emerald-100/90 mb-2 leading-relaxed max-w-lg">
              AI와 함께, 교육 콘텐츠를 물 흐르듯 만들어보세요.
            </p>
            <p className="text-sm text-emerald-200/70 italic mb-8">
              "좋은 수업 아이디어를 체계적인 교육자료로"
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                to="/projects"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-emerald-700 rounded-xl font-bold text-base hover:bg-emerald-50 transition-all shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:-translate-y-0.5"
              >
                시작하기 →
              </Link>
              <Link
                to="/compare"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 backdrop-blur text-white rounded-xl font-medium text-sm border border-white/20 hover:bg-white/20 transition-all"
              >
                🤖 모델 비교하기
              </Link>
            </div>
          </div>

          {/* 로고 + 플로팅 카드 비주얼 */}
          <div className="relative shrink-0 hidden md:block">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-3xl blur-xl scale-110" />
              <div className="relative bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                <Logo size={120} />
              </div>
            </div>
            {/* 플로팅 미니 카드 */}
            <div className="absolute -bottom-4 -left-8 bg-white rounded-xl shadow-xl px-3 py-2 text-xs font-medium text-gray-700 animate-[float_3s_ease-in-out_infinite]">
              💬 AI 대화형 생성
            </div>
            <div className="absolute -top-3 -right-6 bg-white rounded-xl shadow-xl px-3 py-2 text-xs font-medium text-gray-700 animate-[float_3s_ease-in-out_infinite_0.5s]">
              🚀 원클릭 배포
            </div>
          </div>
        </div>
      </section>

      {/* 워크플로우 단계 카드 */}
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">6단계 워크플로우</h2>
          <p className="text-sm text-gray-500">아이디어부터 배포까지, AI가 모든 과정을 도와드립니다</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { step: 1, icon: '💬', title: '방향성 논의', desc: 'AI와 대화하며 교재 구상', color: 'from-emerald-500 to-emerald-600' },
            { step: 2, icon: '📋', title: '목차 작성', desc: '체계적 구조 자동 생성', color: 'from-green-500 to-green-600' },
            { step: 3, icon: '✅', title: '피드백', desc: '목차 검토 및 확정', color: 'from-teal-500 to-teal-600' },
            { step: 4, icon: '✍️', title: '챕터 제작', desc: '배치/개별 자동 작성', color: 'from-cyan-500 to-cyan-600' },
            { step: 5, icon: '🚀', title: '배포', desc: 'MkDocs/DOCX 배포', color: 'from-sky-500 to-sky-600' },
            { step: 6, icon: '📊', title: '포트폴리오', desc: '완성된 교재 모아보기', color: 'from-violet-500 to-violet-600' },
          ].map((item) => (
            <div key={item.step} className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {item.step}
                </div>
                <span className="text-xl">{item.icon}</span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
            </div>
          ))}
        </div>
      </section>

      {/* 핵심 기능 하이라이트 — 벤토 그리드 */}
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">주요 기능</h2>
          <p className="text-sm text-gray-500">교육자료 제작에 필요한 모든 것</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 대형 카드: 멀티 AI */}
          <div className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <span className="text-2xl mb-3 block">🤖</span>
              <h3 className="text-lg font-bold mb-2">멀티 AI 프로바이더</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                Claude, GPT, Gemini, Solar — 4개 AI를 자유롭게 선택하고 비교하세요.
                블라인드 테스트와 AI 자동 평가로 최적의 모델을 찾을 수 있습니다.
              </p>
              <MultiAIBanner />
            </div>
          </div>

          {/* 소형 카드들 */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100">
              <span className="text-2xl mb-2 block">📚</span>
              <h3 className="font-bold text-gray-900 text-sm mb-1">8종 교육 템플릿</h3>
              <p className="text-xs text-gray-600 leading-relaxed">학교 교과서, 프로그래밍 과정, 워크숍 등 다양한 템플릿으로 빠르게 시작</p>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-5 border border-teal-100">
              <span className="text-2xl mb-2 block">🌐</span>
              <h3 className="font-bold text-gray-900 text-sm mb-1">원클릭 웹 배포</h3>
              <p className="text-xs text-gray-600 leading-relaxed">MkDocs + GitHub Pages로 아름다운 교재 사이트를 즉시 배포</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center mb-12">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-bold text-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5"
        >
          교육자료 만들기 시작 →
        </Link>
      </section>

      {/* 설치 버전 안내 */}
      <section className="text-center mb-16">
        <a
          href="https://github.com/greatsong/eduflow-js"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-emerald-600 transition-colors"
        >
          <span>💻</span>
          <span className="underline underline-offset-2">에듀플로 설치버전 사용 안내</span>
          <span className="text-xs">(내 컴퓨터에 직접 설치하기)</span>
        </a>
      </section>

      {/* 개발자 편지 */}
      <DeveloperLetter />
    </div>
  );
}

const PROVIDER_INFO = [
  { id: 'anthropic', name: 'Claude', icon: '🟠', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'openai', name: 'GPT', icon: '🟢', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'google', name: 'Gemini', icon: '🔵', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'upstage', name: 'Solar', icon: '🟣', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

function MultiAIBanner() {
  const [sharedP, setSharedP] = useState({});
  const [serverP, setServerP] = useState({});
  const [apiMode, setApiMode] = useState('user');

  useEffect(() => {
    apiFetch('/api/auth/status')
      .then((d) => {
        setSharedP(d.sharedProviders || {});
        setServerP(d.serverProviders || {});
        setApiMode(d.apiMode || 'user');
      })
      .catch(() => {});
  }, []);

  const providerStatus = PROVIDER_INFO.map((p) => {
    const shared = !!sharedP[p.id];
    const adminOnly = !shared && !!serverP[p.id];
    const user = !serverP[p.id] && !!getApiKey(p.id);
    return { ...p, shared, adminOnly, user, available: shared || adminOnly || user };
  });

  return (
    <div className="flex flex-wrap gap-2">
      {providerStatus.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            p.available
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-white/5 border-white/10 text-white/40'
          }`}
        >
          <span>{p.icon}</span>
          <span>{p.name}</span>
          {p.shared ? (
            <span className="text-emerald-300" title="공개">🌐</span>
          ) : p.adminOnly ? (
            <span className="text-amber-300" title="비공개">🔒</span>
          ) : p.user ? (
            <span className="text-blue-300" title="내 키">👤</span>
          ) : (
            <span className="text-white/20">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

function DeveloperLetter() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer group"
      >
        <div className={`relative bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 shadow-lg transition-all duration-300 ${
          isOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl hover:shadow-xl hover:scale-[1.01]'
        }`}>
          <svg
            className={`absolute -top-[1px] left-0 right-0 w-full transition-all duration-500 ${
              isOpen ? 'opacity-0 -translate-y-2' : 'opacity-100'
            }`}
            viewBox="0 0 400 50"
            preserveAspectRatio="none"
            style={{ height: '40px' }}
          >
            <path
              d="M0,0 L200,45 L400,0 L400,0 L0,0 Z"
              fill="url(#envelopeFlapGradient)"
              stroke="#fcd34d"
              strokeWidth="2"
            />
            <defs>
              <linearGradient id="envelopeFlapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#fcd34d" />
              </linearGradient>
            </defs>
          </svg>

          <div className={`flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'py-4' : 'py-8'
          }`}>
            <span className="text-3xl mr-3">{isOpen ? '📨' : '💌'}</span>
            <span className="text-amber-800 font-medium">
              {isOpen ? '클릭하여 닫기' : '개발자의 편지 (클릭하여 열기)'}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-t-0 border-amber-300 rounded-b-2xl px-7 py-6 shadow-lg">
          <p className="text-gray-800 mb-3">
            <strong>안녕하세요! 선생님!</strong> 해적왕이 될 선생님, <strong>석리송</strong>입니다!
          </p>
          <p className="text-gray-600 text-sm mb-3 leading-relaxed">
            저는 교육 영역에서 기존에 풀리지 않거나, 풀리기 어려웠던 문제 중
            <strong className="text-gray-800"> AI로 풀 수 있는 가치있는 문제</strong>를 찾고 해결하고 있습니다!
          </p>
          <p className="text-gray-600 text-sm mb-3 leading-relaxed">
            이번 프로젝트에서는 선생님들께서 수업 아이디어를 구상할 때 도움이 되고,
            또 완성된 아이디어가 마음에 들 경우 웹으로 바로 배포할 수 있는
            <strong className="text-gray-800"> 수업 자료 개발 및 배포 자동화 시스템, 에듀플로(EduFlow)</strong>를 만들어보았습니다!
          </p>
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            사용해보시고 피드백 주시면 적극 반영하겠습니다!
          </p>
          <p className="text-gray-800 text-sm mb-2">
            그럼, 에듀플로와 함께, <strong>멋진 수업 만들어보세요!!</strong>
          </p>
          <p className="text-right text-gray-400 text-sm italic border-t border-dashed border-amber-300 pt-3 mt-3">
            — 개발자 석리송
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ProjectManager from './pages/ProjectManager';
import Discussion from './pages/Discussion';
import TableOfContents from './pages/TableOfContents';
import Feedback from './pages/Feedback';
import ChapterCreation from './pages/ChapterCreation';
import Deployment from './pages/Deployment';
import Portfolio from './pages/Portfolio';
import ModelCompare from './pages/ModelCompare';
import Admin from './pages/Admin';
import EntryForm, { hasUserInfo, getUserInfo, setUserInfo, clearUserInfo, getAuthToken } from './components/EntryForm';
import Logo from './components/Logo';
import { TIER_CONFIG } from '../../shared/constants.js';

/* global __LOCAL_MODE__ */
const LOCAL_MODE = typeof __LOCAL_MODE__ !== 'undefined' && __LOCAL_MODE__;

/** 폭죽/컨페티 애니메이션 캔버스 */
function ConfettiCanvas({ duration = 4000 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF69B4', '#00CED1', '#FFD700', '#FF7F50'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 4 + Math.random() * 8,
        h: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 1.5 + Math.random() * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    let animId;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.rotation += p.rotationSpeed;
        if (elapsed > duration * 0.6) {
          p.opacity = Math.max(0, p.opacity - 0.01);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < duration) {
        animId = requestAnimationFrame(animate);
      }
    }

    animate();
    return () => cancelAnimationFrame(animId);
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

/** 웰컴 화면 (가입 승인 후 첫 접속) */
function WelcomeScreen({ user, maxProjects, tier, onContinue }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex items-center justify-center p-4">
      <ConfettiCanvas duration={5000} />
      <div className="w-full max-w-lg text-center relative z-10 animate-[fadeInUp_0.8s_ease-out]">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Logo size={80} />
            <div className="absolute -top-2 -right-2 text-3xl animate-bounce">🎉</div>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold mb-3">
          <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-500 bg-clip-text text-transparent">
            환영합니다!
          </span>
        </h1>

        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white p-8 mt-6">
          {user?.picture && (
            <img src={user.picture} alt="" className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-emerald-200 shadow-lg" referrerPolicy="no-referrer" />
          )}
          <p className="text-xl font-bold text-gray-800 mb-1">{user?.name} 선생님</p>
          <p className="text-sm text-gray-500 mb-2">{user?.email}</p>
          <p className="text-sm text-gray-500 mb-6">
            {TIER_CONFIG[tier]?.label} 등급 · 프로젝트 {maxProjects}개
          </p>

          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-5 mb-6 border border-emerald-100">
            <p className="text-emerald-800 leading-relaxed text-sm">
              <strong>에듀플로</strong>에 오신 것을 진심으로 환영합니다! 🌟<br /><br />
              선생님의 전문성과 열정으로 만들어질<br />
              멋진 교육자료가 정말 기대됩니다.<br /><br />
              현재 <strong className="text-emerald-600">{maxProjects}개</strong>의 프로젝트를 만들 수 있습니다.<br />
              함께 훌륭한 교육 콘텐츠를 만들어가요! 💪
            </p>
          </div>

          <button
            onClick={onContinue}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            🚀 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

/** 레벨업 축하 화면 */
function LevelUpScreen({ user, oldLimit, newLimit, tier, onContinue }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-green-50 flex items-center justify-center p-4">
      <ConfettiCanvas duration={5000} />
      <div className="w-full max-w-lg text-center relative z-10 animate-[fadeInUp_0.8s_ease-out]">
        <div className="flex justify-center mb-6">
          <div className="text-6xl animate-bounce">🏆</div>
        </div>

        <h1 className="text-3xl font-extrabold mb-3">
          <span className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 bg-clip-text text-transparent">
            레벨업!
          </span>
        </h1>

        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white p-8 mt-6">
          {user?.picture && (
            <img src={user.picture} alt="" className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-emerald-200 shadow-lg" referrerPolicy="no-referrer" />
          )}
          <p className="text-xl font-bold text-gray-800 mb-1">{user?.name} 선생님</p>
          <p className="text-sm text-gray-500 mb-2">축하드립니다! 등급이 업그레이드되었습니다!</p>
          <p className="text-lg mb-6">
            <span className="font-bold text-emerald-600">{TIER_CONFIG[tier]?.label}</span> 등급으로 업그레이드!
          </p>

          {/* 레벨업 시각화 */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="bg-gray-100 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-bold text-gray-400">{oldLimit}</p>
              <p className="text-xs text-gray-400">이전</p>
            </div>
            <div className="text-3xl text-emerald-500 animate-pulse">→</div>
            <div className="bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl px-5 py-3 text-center border-2 border-emerald-300">
              <p className="text-2xl font-bold text-emerald-600">{newLimit}</p>
              <p className="text-xs text-emerald-500 font-medium">새 한도</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-5 mb-6 border border-emerald-100">
            <p className="text-emerald-800 leading-relaxed text-sm">
              <strong className="text-emerald-600">{TIER_CONFIG[tier]?.label}</strong> 등급으로 업그레이드되었습니다! 🎊<br /><br />
              프로젝트 {TIER_CONFIG[tier]?.maxProjects}개 · {TIER_CONFIG[tier]?.allowPremiumModels ? '전체 AI 모델' : '기본 AI 모델'}<br /><br />
              선생님의 기여에 큰 기대를 하고 있습니다.<br />
              더 많은 멋진 교육자료를 만들어주세요! 📚
            </p>
          </div>

          <button
            onClick={onContinue}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            💪 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}

/** 승인 대기 화면 */
function PendingApproval() {
  const user = getUserInfo();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    displayName: user?.name || '', affiliation: user?.affiliation || '', subjects: user?.subjects || '',
    region: user?.region || '', intro: user?.intro || '', motivation: user?.motivation || '',
    topic: user?.topic || '', expertise: user?.expertise || '', sampleChapter: user?.sampleChapter || '',
    samplePerspective: user?.samplePerspective || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleLogout = () => { clearUserInfo(); window.location.reload(); };
  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.affiliation.trim() || !form.subjects.trim() || !form.region.trim()
        || !form.intro.trim() || !form.motivation.trim() || !form.topic.trim() || !form.expertise.trim()
        || !form.sampleChapter.trim() || !form.samplePerspective.trim()) {
      setSaveMsg('모든 항목을 입력해주세요.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    const token = getAuthToken();
    const profileData = {
      name: form.displayName, affiliation: form.affiliation, subjects: form.subjects,
      region: form.region, intro: form.intro, motivation: form.motivation,
      topic: form.topic, expertise: form.expertise, sampleChapter: form.sampleChapter,
      samplePerspective: form.samplePerspective,
    };

    let saved = false;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(profileData),
        });
        if (res.ok) { saved = true; break; }
      } catch { /* retry */ }
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }

    setSaving(false);
    if (saved) {
      // localStorage도 업데이트
      const current = getUserInfo();
      setUserInfo({ ...current, ...profileData });
      setSaveMsg('저장 완료! 관리자가 검토 후 승인해드리겠습니다.');
      setShowForm(false);
    } else {
      setSaveMsg('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all text-sm";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <Logo size={64} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">승인 대기 중</h1>

        <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-8 mt-6">
          {user?.picture && (
            <img src={user.picture} alt="" className="w-16 h-16 rounded-full mx-auto mb-3" referrerPolicy="no-referrer" />
          )}
          <p className="font-medium text-gray-700">{user?.name}</p>
          <p className="text-sm text-gray-500 mb-6">{user?.email}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-sm leading-relaxed">
              관리자의 승인을 기다리고 있습니다.<br />
              승인이 완료되면 서비스를 이용하실 수 있습니다.
            </p>
          </div>

          {saveMsg && (
            <p className={`text-sm mb-4 ${saveMsg.includes('완료') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</p>
          )}

          {!showForm ? (
            <>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors mb-3"
              >
                승인 상태 확인
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors mb-3"
              >
                📝 지원서 보완하기
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                다른 계정으로 로그인
              </button>
            </>
          ) : (
            <form onSubmit={handleSaveProfile} className="text-left space-y-3">
              <p className="text-xs text-gray-500 text-center mb-3">지원서를 작성하거나 수정할 수 있습니다.</p>
              <div>
                <label className={labelCls}>이름 *</label>
                <input type="text" value={form.displayName} onChange={update('displayName')} placeholder="교재에 표시될 이름" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>소속 *</label>
                  <input type="text" value={form.affiliation} onChange={update('affiliation')} placeholder="예: OO고등학교" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>지역 *</label>
                  <select value={form.region} onChange={update('region')} className={inputCls + ' bg-white'}>
                    <option value="">선택</option>
                    {['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주','해외'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>올해 담당과목 *</label>
                <input type="text" value={form.subjects} onChange={update('subjects')} placeholder="예: 정보(3학점), 인공지능 기초(3학점)" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>간단한 자기소개 *</label>
                <textarea value={form.intro} onChange={update('intro')} rows={2} placeholder="교육 경력, 관심 분야 등" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>지원 이유 *</label>
                <textarea value={form.motivation} onChange={update('motivation')} rows={2} placeholder="어떤 계기로 지원하셨나요?" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>만들고 싶은 교재 주제 *</label>
                <input type="text" value={form.topic} onChange={update('topic')} placeholder="예: 고등학교 물리학 - 역학 단원" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>이 주제에 대한 전문성 *</label>
                <textarea value={form.expertise} onChange={update('expertise')} rows={2} placeholder="교육 경험, 자격증, 집필 경험 등" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>샘플 챕터 주제 *</label>
                <input type="text" value={form.sampleChapter} onChange={update('sampleChapter')} placeholder="예: 뉴턴의 운동 법칙" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>챕터 구성 관점 *</label>
                <textarea value={form.samplePerspective} onChange={update('samplePerspective')} rows={2} placeholder="어떤 관점으로 구성하고 싶으신가요?" className={inputCls + ' resize-none'} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-300">
                  {saving ? '저장 중...' : '저장하기'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // LOCAL_MODE: 인증 플로우 전체 스킵
  const [entered, setEntered] = useState(LOCAL_MODE || hasUserInfo());
  const [userStatus, setUserStatus] = useState(LOCAL_MODE ? 'active' : null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ oldLimit: 1, newLimit: 1 });
  const [maxProjects, setMaxProjects] = useState(LOCAL_MODE ? 99 : 1);
  const [tier, setTier] = useState(LOCAL_MODE ? 'master' : 'starter');
  const [isNewUser, setIsNewUser] = useState(false);

  // EntryForm 완료 시 신규 사용자 여부 체크
  const handleEntryComplete = (newUserFlag) => {
    if (newUserFlag) setIsNewUser(true);
    setEntered(true);
  };

  // 로그인 후 사용자 상태 확인 (Deploy 모드 전용)
  useEffect(() => {
    if (LOCAL_MODE || !entered) return;
    const token = getAuthToken();
    if (!token) { setUserStatus('active'); return; }

    fetch('/api/user/status', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { status: 'active' })
      .then(data => {
        const status = data.status || 'active';
        const mp = data.maxProjects || 1;
        const userTier = data.tier || 'starter';
        setMaxProjects(mp);
        setTier(userTier);
        setUserStatus(status);

        if (status === 'active') {
          const user = getUserInfo();
          // 환영 화면 노출 여부는 서버에 저장 (기기·브라우저 무관, 한 번만 노출)
          if (data.welcomed !== true) {
            localStorage.setItem(`eduflow_maxProjects_${user?.email}`, String(mp));
            localStorage.setItem(`eduflow_tier_${user?.email}`, userTier);
            setShowWelcome(true);
            return;
          }

          const prevLimitKey = `eduflow_maxProjects_${user?.email}`;
          const prevTierKey = `eduflow_tier_${user?.email}`;
          const prevLimit = parseInt(localStorage.getItem(prevLimitKey) || '1');
          const prevTier = localStorage.getItem(prevTierKey) || 'starter';
          if (mp > prevLimit || (userTier !== prevTier && TIER_CONFIG[userTier]?.maxProjects > TIER_CONFIG[prevTier]?.maxProjects)) {
            setLevelUpData({ oldLimit: prevLimit, newLimit: mp });
            localStorage.setItem(prevLimitKey, String(mp));
            localStorage.setItem(prevTierKey, userTier);
            setShowLevelUp(true);
            return;
          }
          localStorage.setItem(prevLimitKey, String(mp));
          localStorage.setItem(prevTierKey, userTier);
        }
      })
      .catch(() => setUserStatus('active'));
  }, [entered]);

  if (!entered) {
    return <EntryForm onComplete={handleEntryComplete} />;
  }

  // 상태 로딩 중
  if (userStatus === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  // 승인 대기 (Deploy 모드 전용)
  if (!LOCAL_MODE && userStatus === 'pending') {
    return <PendingApproval />;
  }

  // 비활성화 — 재신청 가능 (Deploy 모드 전용)
  if (!LOCAL_MODE && userStatus === 'inactive') {
    const handleReapply = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch('/api/user/reapply', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          setUserStatus('pending');
        } else {
          const data = await res.json();
          alert(data.message || '재신청에 실패했습니다.');
        }
      } catch {
        alert('네트워크 오류가 발생했습니다.');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-xl font-bold text-gray-800 mb-3">이번에는 함께하지 못해 아쉽습니다</h1>
          <p className="text-gray-500 mb-2 leading-relaxed">
            현재는 서비스 이용이 제한된 상태입니다.
          </p>
          <p className="text-gray-500 mb-6 leading-relaxed">
            다음 기회에 꼭 모시겠습니다!<br />
            재신청을 원하시면 아래 버튼을 눌러주세요.
          </p>
          <button
            onClick={handleReapply}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors mb-3"
          >
            ✨ 다시 신청하기
          </button>
          <button
            onClick={() => { clearUserInfo(); window.location.reload(); }}
            className="w-full py-2.5 border border-gray-300 text-gray-500 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // 웰컴 화면
  if (showWelcome) {
    return (
      <WelcomeScreen
        user={getUserInfo()}
        maxProjects={maxProjects}
        tier={tier}
        onContinue={() => {
          // 서버에 '환영 화면을 봤다'고 기록 (실패해도 UX는 계속 진행)
          const token = getAuthToken();
          if (token) {
            fetch('/api/user/welcomed', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
            }).catch(() => {});
          }
          setShowWelcome(false);
        }}
      />
    );
  }

  // 레벨업 축하 화면
  if (showLevelUp) {
    return (
      <LevelUpScreen
        user={getUserInfo()}
        oldLimit={levelUpData.oldLimit}
        newLimit={levelUpData.newLimit}
        tier={tier}
        onContinue={() => setShowLevelUp(false)}
      />
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/projects" element={<ProjectManager />} />
        <Route path="/discussion" element={<Discussion />} />
        <Route path="/toc" element={<TableOfContents />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/chapters" element={<ChapterCreation />} />
        <Route path="/deploy" element={<Deployment />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/compare" element={<ModelCompare />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

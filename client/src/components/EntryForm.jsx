import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';

const USER_KEY = 'eduflow_user_info';
const GOOGLE_CLIENT_ID = '853390253196-b1b9bt0i0mcegas9lv2578vtp0soi7hg.apps.googleusercontent.com';

/** 사용자 정보 저장/조회 */
export function getUserInfo() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setUserInfo(info) {
  localStorage.setItem(USER_KEY, JSON.stringify(info));
}

export function hasUserInfo() {
  const info = getUserInfo();
  return !!(info?.token && info?.name);
}

export function clearUserInfo() {
  localStorage.removeItem(USER_KEY);
}

export function getAuthToken() {
  return getUserInfo()?.token || '';
}

export default function EntryForm({ onComplete }) {
  const [step, setStep] = useState(1); // 1: 구글 로그인, 2: 추가 정보
  const [googleUser, setGoogleUser] = useState(null);
  const [form, setForm] = useState({ displayName: '', affiliation: '', subjects: '', region: '', intro: '', motivation: '', topic: '', expertise: '', sampleChapter: '', samplePerspective: '' });
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // 구글 로그인 콜백
  const handleGoogleCallback = async (response) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (!res.ok) throw new Error('구글 인증에 실패했습니다.');
      const data = await res.json();
      const userData = { ...data.user, token: data.token };
      setGoogleUser(userData);

      // 기존 사용자면 추가 정보 입력 건너뛰기
      if (!data.isNewUser) {
        setUserInfo({
          ...userData,
          affiliation: '',
          createdAt: new Date().toISOString(),
        });
        onComplete(false); // 기존 사용자
        return;
      }

      // 신규 사용자: 이름을 구글 이름으로 미리 채움
      setForm((prev) => ({ ...prev, displayName: data.user.name || '' }));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 구글 로그인 버튼 렌더링
  useEffect(() => {
    if (step !== 1 || !googleBtnRef.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 360,
        text: 'signin_with',
        locale: 'ko',
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step]);

  // 추가 정보 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.affiliation.trim() || !form.subjects.trim() || !form.region.trim()
        || !form.intro.trim() || !form.motivation.trim() || !form.topic.trim() || !form.expertise.trim()
        || !form.sampleChapter.trim() || !form.samplePerspective.trim()) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }
    if (!privacyAgreed) {
      setError('개인정보 수집·이용에 동의해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    const profileData = {
      name: form.displayName,
      affiliation: form.affiliation,
      subjects: form.subjects,
      region: form.region,
      intro: form.intro,
      motivation: form.motivation,
      topic: form.topic,
      expertise: form.expertise,
      sampleChapter: form.sampleChapter,
      samplePerspective: form.samplePerspective,
    };

    // 서버에 원자적 등록 (Google 기본정보 + 프로필 한 번에 저장, 재시도 포함)
    let registerSuccess = false;
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const registerRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${googleUser.token}`,
          },
          body: JSON.stringify(profileData),
        });

        if (registerRes.ok) {
          registerSuccess = true;
          break;
        }
        const errData = await registerRes.json().catch(() => ({}));
        lastError = errData.message || `HTTP ${registerRes.status}`;
        console.error(`[EntryForm] 등록 실패 (${attempt + 1}/3):`, lastError);
      } catch (err) {
        lastError = err.message;
        console.error(`[EntryForm] 등록 오류 (${attempt + 1}/3):`, err.message);
      }
      // 재시도 전 잠시 대기
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!registerSuccess) {
      setLoading(false);
      setError(`지원서 저장에 실패했습니다: ${lastError}. 네트워크를 확인하고 다시 시도해주세요.`);
      return;
    }

    const userInfoData = {
      ...googleUser,
      ...profileData,
      privacyAgreedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setUserInfo(userInfoData);
    setLoading(false);
    onComplete(true); // 신규 사용자
  };

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* 로고 + 타이틀 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size={80} />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent mb-2">
            에듀플로
          </h1>
          <p className="text-gray-500">
            AI와 함께, 교육 콘텐츠를 물 흐르듯 만들어보세요
          </p>
        </div>

        {/* Step 1: 구글 로그인 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">
              시작하려면 로그인하세요
            </h2>

            <div className="flex justify-center mb-4">
              <div ref={googleBtnRef} />
            </div>

            {loading && (
              <p className="text-sm text-emerald-600 text-center">인증 중...</p>
            )}
            {error && (
              <p className="text-sm text-red-500 text-center mt-3">{error}</p>
            )}

            <p className="mt-6 text-xs text-gray-400 text-center">
              Google 계정으로 간편하게 로그인할 수 있습니다.
            </p>
          </div>
        )}

        {/* Step 2: 추가 정보 입력 */}
        {step === 2 && googleUser && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            {/* 구글 프로필 */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-green-50 rounded-lg">
              {googleUser.picture && (
                <img src={googleUser.picture} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              )}
              <div>
                <p className="text-sm font-medium text-green-800">{googleUser.name}</p>
                <p className="text-xs text-green-600">{googleUser.email}</p>
              </div>
              <span className="ml-auto text-green-500 text-lg">&#10003;</span>
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              조금만 더 알려주세요
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={update('displayName')}
                  placeholder="교재에 표시될 이름"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">구글 이름이 기본 설정됩니다. 수정 가능합니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    소속 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.affiliation}
                    onChange={update('affiliation')}
                    placeholder="예: OO고등학교"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    지역 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={update('region')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                  >
                    <option value="">선택</option>
                    <option value="서울">서울</option>
                    <option value="부산">부산</option>
                    <option value="대구">대구</option>
                    <option value="인천">인천</option>
                    <option value="광주">광주</option>
                    <option value="대전">대전</option>
                    <option value="울산">울산</option>
                    <option value="세종">세종</option>
                    <option value="경기">경기</option>
                    <option value="강원">강원</option>
                    <option value="충북">충북</option>
                    <option value="충남">충남</option>
                    <option value="전북">전북</option>
                    <option value="전남">전남</option>
                    <option value="경북">경북</option>
                    <option value="경남">경남</option>
                    <option value="제주">제주</option>
                    <option value="해외">해외</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  올해 담당과목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.subjects}
                  onChange={update('subjects')}
                  placeholder="예: 정보(3학점), 인공지능 기초(3학점), 데이터 과학(3학점)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  간단한 자기소개 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.intro}
                  onChange={update('intro')}
                  placeholder="교육 경력, 관심 분야, 현재 하고 계신 일 등을 자유롭게 소개해주세요."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  에듀플로에 지원하시게 된 이유 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.motivation}
                  onChange={update('motivation')}
                  placeholder="어떤 계기로 에듀플로를 알게 되셨고, 어떤 기대를 갖고 지원하셨나요?"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  만들고 싶은 교재 주제 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={update('topic')}
                  placeholder="예: 고등학교 물리학 - 역학 단원, 중학교 국어 - 비유와 상징"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이 주제에 대한 선생님의 전문성을 알려주세요 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.expertise}
                  onChange={update('expertise')}
                  placeholder="해당 분야에서의 교육 경험, 연구 활동, 자격증, 집필 경험 등 전문성을 보여줄 수 있는 내용을 자유롭게 작성해주세요."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  샘플 챕터로 어떤 챕터를 만들어보실 건가요? <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.sampleChapter}
                  onChange={update('sampleChapter')}
                  placeholder="예: 뉴턴의 운동 법칙, 비유와 상징의 이해, 변수와 자료형"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">위 주제에서 가장 먼저 만들어보고 싶은 챕터 하나를 선택해주세요.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이 챕터를 어떤 관점으로 구성하고 싶으신가요? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.samplePerspective}
                  onChange={update('samplePerspective')}
                  placeholder="예: 실생활 예시와 탐구 활동을 결합해서 학생들이 직관적으로 이해할 수 있도록 구성하고 싶습니다. 특히 시각적 자료와 단계별 실습을 중심으로..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {/* 개인정보 수집·이용 동의 (개인정보보호법 제15조 제1항 제1호) */}
            <div className="mt-5 border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPrivacyDetail((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="text-sm font-medium text-gray-700">
                  [필수] 개인정보 수집·이용 동의 <span className="text-red-400">*</span>
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${showPrivacyDetail ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPrivacyDetail && (
                <div className="px-4 py-3 text-xs text-gray-600 bg-white border-t border-gray-200 space-y-3">
                  <p className="font-medium text-gray-700">
                    「에듀플로(EduFlow)」는 AI 교육 콘텐츠 생성 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.
                  </p>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-2 py-1.5 text-left font-medium w-24">구분</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-left font-medium">내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium align-top">수집 항목</td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <p>[필수] 이름, 이메일 주소, 프로필 사진(Google 계정 연동 시 자동 수집)</p>
                          <p className="mt-1">[필수] 소속 학교명, 지역</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium align-top">수집·이용 목적</td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>회원 식별 및 서비스 이용 권한 관리</li>
                            <li>AI 교육 콘텐츠(교재) 생성 및 제공</li>
                            <li>생성된 교재에 저자 정보 표시</li>
                            <li>서비스 이용 통계 및 품질 개선</li>
                          </ul>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium align-top">보유·이용 기간</td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <strong>회원 탈퇴 시 또는 수집일로부터 1년</strong> 중 먼저 도래하는 시점에 지체 없이 파기합니다.
                          <br />단, 관련 법령에 의한 보존 의무가 있는 경우 해당 기간까지 보존합니다.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium align-top">동의 거부 권리</td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          귀하는 위 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.
                          다만, 필수 항목에 대한 동의를 거부하실 경우 서비스 이용이 제한됩니다.
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <p className="text-gray-500 leading-relaxed">
                    ※ 본 서비스는 수집한 개인정보를 제3자에게 제공하지 않습니다.
                    다만, GitHub 연동을 통한 교재 배포 시 사용자가 직접 연동한 GitHub 계정으로만 배포되며,
                    이 경우 GitHub의 개인정보처리방침이 별도로 적용됩니다.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-2 px-4 py-3 bg-white border-t border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => { setPrivacyAgreed(e.target.checked); setError(''); }}
                  className="w-4 h-4 mt-0.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 shrink-0"
                />
                <span className="text-sm text-gray-700">
                  [필수] 위 개인정보 수집·이용에 동의합니다.
                </span>
              </label>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500 text-center">{error}</p>
            )}

            {/* 감사 인사 */}
            <div className="mt-5 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-sm text-emerald-700 text-center leading-relaxed">
                에듀플로에 관심 갖고 지원해주셔서 진심으로 감사합니다. 🙏<br />
                작성해주신 내용을 바탕으로 빠르게 검토 후 안내드리겠습니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={!privacyAgreed || loading}
              className={`mt-6 w-full py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg ${
                privacyAgreed && !loading
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? '제출 중...' : '지원서 제출하기'}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  School,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Smartphone,
  Mail,
  User,
  Database,
  ArrowRight,
  Users2,
  Search,
  KeyRound,
  Shield,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { INITIAL_ADMIN_EMAIL, ROLE_LABELS } from '../constants';
import { UserRole, UserProfile } from '../types';

export const LoginView: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithGoogleRedirect,
    signInWithSupabaseEmail,
    signUpWithSupabaseEmail,
    staffList,
    switchUser,
    activeSchool,
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'google' | 'quick_staff' | 'supabase'>('google');
  const [isSignUp, setIsSignUp] = useState(false);

  // Email/Pass form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);

  // Quick staff search & filter
  const [staffSearch, setStaffSearch] = useState('');
  const [staffDeptFilter, setStaffDeptFilter] = useState<string>('all');

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handleGoogleSignIn = async (useRedirect = false) => {
    try {
      setLoading(true);
      setErrorCode(null);
      setErrorMessage(null);
      setSuccessMessage(null);

      if (useRedirect) {
        await signInWithGoogleRedirect();
      } else {
        await signInWithGoogle();
      }
    } catch (err: any) {
      console.error('Google Login error:', err);
      const code = err?.code || '';
      setErrorCode(code);

      if (code === 'auth/unauthorized-domain') {
        setErrorMessage(
          `Tên miền "${currentHostname}" chưa được cấp phép trong danh sách Authorized domains của Firebase.`
        );
        setShowConfigGuide(true);
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMessage(
          'Phương thức đăng nhập bằng Google chưa được BẬT trên Firebase Console. Vui lòng bật Google trong Sign-in method.'
        );
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage(
          'Trình duyệt đã chặn cửa sổ pop-up. Bạn có thể sử dụng nút "Đăng nhập bằng Chuyển hướng" bên dưới hoặc chuyển sang tab "Tài khoản đã phân quyền".'
        );
      } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        setErrorMessage('Cửa sổ đăng nhập đã đóng trước khi hoàn tất.');
      } else {
        setErrorMessage(
          err?.message || 'Đăng nhập bằng Google không thành công. Vui lòng thử lại hoặc chọn tài khoản đã phân quyền.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    try {
      setLoading(true);
      setErrorCode(null);
      setErrorMessage(null);
      setSuccessMessage(null);

      if (isSignUp) {
        await signUpWithSupabaseEmail(email, password, fullName);
        setSuccessMessage(
          'Tạo tài khoản Supabase thành công! Nếu được yêu cầu xác thực email, vui lòng kiểm tra hộp thư, hoặc bạn có thể thử đăng nhập ngay.'
        );
      } else {
        await signInWithSupabaseEmail(email, password);
      }
    } catch (err: any) {
      console.error('Supabase auth error:', err);
      setErrorMessage(err?.message || 'Không thể đăng nhập bằng tài khoản Supabase. Vui lòng kiểm tra lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uid: string) => {
    setLoading(true);
    try {
      await switchUser(uid);
    } finally {
      setLoading(false);
    }
  };

  const isStaffBgh = (s: UserProfile) => {
    const posLower = (s.positionTitle || '').toLowerCase();
    const deptNameLower = (s.departmentName || '').toLowerCase();
    return (
      s.role === 'admin' ||
      s.role === 'vice_principal' ||
      posLower.includes('hiệu trưởng') ||
      posLower.includes('giám hiệu') ||
      posLower.includes('bgh') ||
      deptNameLower.includes('giám hiệu') ||
      s.departmentId === 'bgh'
    );
  };

  const filteredStaffList = staffList.filter((s) => {
    const isBgh = isStaffBgh(s);
    if (staffDeptFilter === 'bgh') {
      if (!isBgh) return false;
    } else if (staffDeptFilter !== 'all') {
      // Strictly exclude BGH from grade blocks
      if (isBgh) return false;
      if (s.departmentId !== staffDeptFilter) return false;
    }

    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase().trim();
      return (
        s.displayName.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.positionTitle && s.positionTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100/70 via-sky-50/70 to-indigo-100/60 flex flex-col justify-between text-slate-800 selection:bg-purple-200 selection:text-purple-900">
      {/* Top Navbar */}
      <header className="border-b border-purple-100/80 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-purple-200">
            <School className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-purple-950 tracking-tight">
              HỒ SƠ CHUYÊN MÔN SỐ
            </h1>
            <p className="text-[11px] text-sky-600 font-semibold">{activeSchool.name} • 5 Khối Lớp</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50/90 px-3 py-1.5 rounded-full border border-purple-200/80 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Hệ thống quản lý nội bộ trường học
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Col: Introduction */}
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200 text-purple-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Chuyển đổi số quản lý giáo án & hồ sơ chuyên môn
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-purple-950 leading-tight">
            Cổng Đăng Nhập
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-500 to-sky-500">
              {activeSchool.name}
            </span>
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Hệ thống hỗ trợ <strong>Hiệu trưởng, Phó Hiệu trưởng, Tổ trưởng chuyên môn</strong> và <strong>Giáo viên</strong> tiếp nhận, nhận xét, kiểm tra và phê duyệt giáo án điện tử theo đúng phân quyền từng khối lớp.
          </p>

          {/* 4 Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-2xl bg-white/80 border border-purple-100 space-y-1 shadow-2xs">
              <span className="font-bold text-purple-950 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                Hiệu trưởng & Phó Hiệu trưởng
              </span>
              <p className="text-[11px] text-slate-500">
                Toàn quyền kiểm tra, phê duyệt giáo án toàn trường, quản trị nhân sự và theo dõi báo cáo.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-purple-100 space-y-1 shadow-2xs">
              <span className="font-bold text-teal-950 flex items-center gap-1.5">
                <Users2 className="w-4 h-4 text-teal-600 shrink-0" />
                Tổ trưởng 5 Tổ Khối
              </span>
              <p className="text-[11px] text-slate-500">
                Theo dõi, đôn đốc và nhận xét giáo án của các giáo viên thuộc đúng tổ khối chuyên môn của mình.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-purple-100 space-y-1 shadow-2xs">
              <span className="font-bold text-sky-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                Giáo viên nộp giáo án
              </span>
              <p className="text-[11px] text-slate-500">
                Tải lên kế hoạch bài dạy hàng tuần, xem góp ý của người kiểm tra và cập nhật phiên bản mới.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-purple-100 space-y-1 shadow-2xs">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                Bảo mật theo Gmail phân quyền
              </span>
              <p className="text-[11px] text-slate-500">
                Chỉ những tài khoản Gmail đã được trường cấp quyền mới có thể đăng nhập vào hệ thống.
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Sign In Card */}
        <div className="lg:col-span-6">
          <div className="bg-white/95 backdrop-blur-xl p-5 sm:p-7 rounded-3xl border border-purple-100 shadow-xl shadow-purple-100/50 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-11 h-11 bg-gradient-to-tr from-purple-100 to-sky-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-1.5 border border-purple-200/80 shadow-2xs">
                <Lock className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-purple-950">Đăng Nhập Vào Hệ Thống</h3>
              <p className="text-xs text-slate-500">
                Chọn phương thức đăng nhập để vào đúng giao diện quyền hạn của bạn
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('google');
                  setErrorMessage(null);
                }}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMethod === 'google'
                    ? 'bg-white text-purple-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('quick_staff');
                  setErrorMessage(null);
                }}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMethod === 'quick_staff'
                    ? 'bg-white text-purple-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users2 className="w-3.5 h-3.5 text-purple-600" />
                <span>Đã phân quyền</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('supabase');
                  setErrorMessage(null);
                }}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMethod === 'supabase'
                    ? 'bg-white text-purple-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase</span>
              </button>
            </div>

            {/* Success message */}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Error Banner with detailed guidance */}
            {errorMessage && (
              <div
                className={`p-3.5 rounded-2xl text-xs space-y-2 border ${
                  errorCode === 'auth/unauthorized-domain'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-start gap-2 font-semibold">
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      errorCode === 'auth/unauthorized-domain' ? 'text-amber-600' : 'text-rose-500'
                    }`}
                  />
                  <div className="whitespace-pre-line leading-relaxed">{errorMessage}</div>
                </div>

                {errorCode === 'auth/unauthorized-domain' && (
                  <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 space-y-2 text-[11px]">
                    <div className="text-slate-700">
                      <strong>Mẹo nhanh:</strong> Bạn có thể chuyển sang tab <strong>"Đã phân quyền"</strong> ở phía trên để đăng nhập ngay vào đúng vai trò mà không cần cấu hình Google, HOẶC thêm tên miền Vercel vào Firebase:
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-amber-100/80 px-2 py-1 rounded-md text-amber-950 font-bold break-all flex-1">
                        {currentHostname}
                      </span>
                      <button
                        onClick={() => copyToClipboard(currentHostname)}
                        className="px-2.5 py-1 rounded-md bg-amber-700 text-white font-medium hover:bg-amber-800 transition flex items-center gap-1 shrink-0 cursor-pointer text-xs"
                      >
                        {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedDomain ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-amber-200/60">
                      <div>1. Mở Firebase Console → Chọn dự án <strong>mynhien-1985</strong></div>
                      <div>2. Vào <strong>Authentication</strong> → Thẻ <strong>Settings</strong> → <strong>Authorized domains</strong></div>
                      <div>3. Bấm <strong>Add domain</strong> → Dán <strong>{currentHostname || 'vercel.app'}</strong> → Bấm <strong>Add</strong>.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: GOOGLE LOGIN */}
            {authMethod === 'google' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1.5 text-xs text-slate-700">
                  <div className="font-bold text-purple-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    Quy định đăng nhập Google bảo mật:
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Tài khoản Gmail của Thầy/Cô phải trùng khớp với email đã được lưu tại mục <strong>Phân quyền & Tài khoản</strong>. Sau khi bấm đăng nhập, hệ thống sẽ tự động chuyển đúng vào giao diện vai trò: <strong>Hiệu trưởng, Phó Hiệu trưởng, Tổ trưởng chuyên môn hoặc Giáo viên</strong>.
                  </p>
                </div>

                {/* Primary Google Login Button */}
                <button
                  onClick={() => handleGoogleSignIn(false)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-white hover:bg-purple-50/80 text-slate-800 font-bold text-sm border-2 border-purple-200/90 shadow-md shadow-purple-100/50 transition transform active:scale-98 cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{loading ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}</span>
                </button>

                {/* Redirect alternative */}
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-purple-700 hover:text-purple-900 hover:bg-purple-50/50 rounded-xl transition cursor-pointer"
                  title="Sử dụng phương thức này nếu trình duyệt chặn cửa sổ pop-up"
                >
                  <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                  <span>Hoặc đăng nhập bằng Chuyển hướng trang (Redirect)</span>
                </button>
              </div>
            )}

            {/* TAB 2: QUICK LOGIN WITH AUTHORIZED STAFF */}
            {authMethod === 'quick_staff' && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-600 bg-sky-50/80 p-2.5 rounded-xl border border-sky-100 flex items-start gap-2">
                  <UserCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p>
                    Dưới đây là danh sách nhân sự đã được phân quyền trong trường <strong>{activeSchool.name}</strong>. Thầy/Cô có thể bấm vào tên mình để vào ngay giao diện làm việc tương ứng.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-purple-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm tên hoặc email..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-purple-200 bg-white text-slate-700 focus:outline-hidden focus:border-purple-400"
                    />
                  </div>

                  <select
                    value={staffDeptFilter}
                    onChange={(e) => setStaffDeptFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 rounded-xl border border-purple-200 bg-white text-slate-700 focus:outline-hidden"
                  >
                    <option value="all">Tất cả</option>
                    <option value="bgh">Ban Giám Hiệu</option>
                    <option value="khoi_1">Tổ Khối 1</option>
                    <option value="khoi_2">Tổ Khối 2</option>
                    <option value="khoi_3">Tổ Khối 3</option>
                    <option value="khoi_4">Tổ Khối 4</option>
                    <option value="khoi_5">Tổ Khối 5</option>
                  </select>
                </div>

                {/* Staff List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredStaffList.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 italic">
                      Không tìm thấy nhân sự phù hợp
                    </p>
                  ) : (
                    filteredStaffList.map((st) => {
                      const roleMeta = ROLE_LABELS[st.role] || ROLE_LABELS.teacher;
                      return (
                        <div
                          key={st.uid}
                          onClick={() => handleQuickLogin(st.uid)}
                          className="p-2.5 rounded-2xl bg-white hover:bg-purple-50/70 border border-purple-100 hover:border-purple-300 transition cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-purple-900 truncate">
                                {st.displayName}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${roleMeta.badgeClass}`}>
                                {st.role === 'admin' ? 'Hiệu trưởng' : st.positionTitle || roleMeta.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-purple-600/80 truncate mt-0.5 flex items-center gap-1.5">
                              <span>Gmail: <strong className="text-slate-700">{st.email}</strong></span>
                              {st.departmentName && (
                                <>
                                  <span>•</span>
                                  <span>{st.departmentName}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-purple-100 group-hover:bg-purple-600 text-purple-700 group-hover:text-white transition shrink-0"
                          >
                            Đăng nhập
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SUPABASE LOGIN */}
            {authMethod === 'supabase' && (
              <form onSubmit={handleSupabaseSubmit} className="space-y-3">
                {isSignUp && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Họ và tên</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Thầy/Cô Nguyễn Văn A"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-purple-200 focus:outline-hidden focus:ring-2 focus:ring-purple-400"
                        required={isSignUp}
                      />
                      <User className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-purple-200 focus:outline-hidden focus:ring-2 focus:ring-purple-400"
                      required
                    />
                    <Mail className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mật khẩu</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-purple-200 focus:outline-hidden focus:ring-2 focus:ring-purple-400"
                      required
                      minLength={6}
                    />
                    <Lock className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? 'Đang xử lý...' : isSignUp ? 'Đăng ký tài khoản' : 'Đăng nhập với Supabase'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-purple-700 hover:text-purple-900 underline font-medium cursor-pointer"
                  >
                    {isSignUp ? 'Đã có tài khoản? Bấm để Đăng nhập' : 'Chưa có tài khoản? Bấm để Đăng ký mới'}
                  </button>
                </div>
              </form>
            )}

            {/* Note on approval policy */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-50/70 to-sky-50/70 border border-purple-100 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-950 font-bold">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                Chính sách an toàn & phân quyền trường học:
              </div>
              <p>
                - Tài khoản <span className="text-purple-900 font-mono font-bold">{INITIAL_ADMIN_EMAIL}</span> tự động nhận toàn quyền <strong>Quản trị viên (Chủ sở hữu hệ thống)</strong>.
              </p>
              <p>
                - Quản trị viên có thể vào mục <strong>Phân quyền & Tài khoản</strong> để cập nhật địa chỉ Gmail của từng giáo viên, tổ trưởng hoặc BGH.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-100/80 py-4 px-6 text-center text-xs text-purple-600/80">
        Hệ Thống Quản Lý Hồ Sơ Chuyên Môn Số – {activeSchool.name} • 5 Tổ Khối Chuyên Môn
      </footer>
    </div>
  );
};

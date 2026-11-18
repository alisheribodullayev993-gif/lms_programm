import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { FormEvent, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { User, UserRole } from '../types';

interface AuthViewProps {
  initialMode: 'login' | 'register';
  initialRole?: UserRole;
  onBack: () => void;
  onAuthenticated: (user: User, token: string) => void;
}

export function AuthView({
  initialMode,
  initialRole = 'student',
  onBack,
  onAuthenticated,
}: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && fullName.trim().length < 2) {
      setError("Ism va familiyangizni to'liq kiriting.");
      return;
    }
    if (login.trim().length < 3) {
      setError("Login yoki email kamida 3 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await apiFetch<{ user: User; token: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            fullName: fullName.trim(),
            login: login.trim(),
            password,
            role,
            subject: subject.trim() || undefined,
          }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
      } else {
        const res = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            login: login.trim(),
            password,
            expectedRole: role,
          }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (demoRole: UserRole) => {
    setMode('login');
    setRole(demoRole);
    setError(null);
    if (demoRole === 'teacher') {
      setLogin('ustoz@sinxron.uz');
      setPassword('ustoz123');
    } else {
      setLogin('talaba@sinxron.uz');
      setPassword('talaba123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/60 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-md">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Bosh sahifaga qaytish
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="text-center">
            <p className="font-display text-xl font-extrabold tracking-tight text-blue-700">
              SINXRON TA&apos;LIM
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
              {mode === 'login' ? 'Tizimga kirish' : "Ro'yxatdan o'tish"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Rolingizni tanlang va shaxsiy kabinetingizga kiring
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tizimga kirish
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ro&apos;yxatdan o&apos;tish
            </button>
          </div>

          {/* Role Selector */}
          <div className="mt-5">
            <label className="block text-xs font-semibold text-slate-600">
              Foydalanuvchi roli
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                  role === 'student'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                O&apos;quvchi
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                  role === 'teacher'
                    ? 'border-violet-600 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                O&apos;qituvchi
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Ism va familiya
                  </label>
                  <div className="relative mt-1.5">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masalan: Jasur Alimov"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {role === 'teacher' ? "Fan yo'nalishi (ixtiyoriy)" : "Yo'nalish yoki guruh (ixtiyoriy)"}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={
                      role === 'teacher'
                        ? 'Masalan: Matematika va informatika'
                        : 'Masalan: 10-sinf / Dasturlash'
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Login yoki email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="ism@sinxron.uz"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Parol</label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 6 ta belgi"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Parolni ko'rsatish"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 cursor-pointer ${
                role === 'teacher'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Kabinetga kirish' : "Hisob yaratish"}
            </button>
          </form>

          {/* Quick Test Helper */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-medium text-slate-500">
              Platformani sinab ko&apos;rish uchun tayyor hisoblar:
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoCredentials('teacher')}
                className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                O&apos;qituvchi (Demo)
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('student')}
                className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                O&apos;quvchi (Demo)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

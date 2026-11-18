import {
  AlertCircle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  KeyRound,
  LogOut,
  Menu,
  Radio,
  Send,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  downloadWithAuth,
  fileToBase64,
  formatFileSize,
  formatUzDateTime,
} from '../lib/api';
import type {
  Assignment,
  AttendanceRecord,
  Lesson,
  Material,
  Question,
  Submission,
  User,
} from '../types';

type StudentTab = 'lessons' | 'materials' | 'assignments' | 'attendance' | 'questions';

interface StudentDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onEnterLiveRoom: (lesson: Lesson) => void;
  refreshSignal: number;
}

export function StudentDashboard({
  currentUser,
  onLogout,
  onEnterLiveRoom,
  refreshSignal,
}: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<StudentTab>('lessons');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Join by invite code
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  // Assignment submission drafts keyed by assignment ID
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [fileDrafts, setFileDrafts] = useState<Record<string, File | null>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Question form
  const [qLessonId, setQLessonId] = useState('');
  const [qText, setQText] = useState('');
  const [sendingQ, setSendingQ] = useState(false);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const fetchAllData = useCallback(async () => {
    try {
      const [lesRes, matRes, asgRes, attRes, qstRes] = await Promise.all([
        apiFetch<{ lessons: Lesson[] }>('/api/lessons'),
        apiFetch<{ materials: Material[] }>('/api/materials'),
        apiFetch<{ assignments: Assignment[]; submissions: Submission[] }>('/api/assignments'),
        apiFetch<{ attendance: AttendanceRecord[] }>('/api/attendance'),
        apiFetch<{ questions: Question[] }>('/api/questions'),
      ]);

      setLessons(lesRes.lessons);
      setMaterials(matRes.materials);
      setAssignments(asgRes.assignments);
      setSubmissions(asgRes.submissions);
      setAttendance(attRes.attendance);
      setQuestions(qstRes.questions);

      if (lesRes.lessons.length > 0) {
        setQLessonId((prev) => prev || lesRes.lessons[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, refreshSignal]);

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setError(null);
    setJoiningCode(true);
    try {
      await apiFetch('/api/lessons/join-code', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCodeInput.trim() }),
      });
      setInviteCodeInput('');
      showToast("Darsga muvaffaqiyatli qo'shildingiz!");
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Taklif kodi xato.');
    } finally {
      setJoiningCode(false);
    }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    setError(null);
    const answerText = answerDrafts[assignmentId] || '';
    const file = fileDrafts[assignmentId];
    if (!answerText.trim() && !file) {
      setError('Javob matnini kiriting yoki fayl biriktiring.');
      return;
    }

    setSubmittingId(assignmentId);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (file) {
        fileBase64 = await fileToBase64(file);
        fileName = file.name;
      }
      await apiFetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answerText, fileName, fileBase64 }),
      });
      setAnswerDrafts((prev) => ({ ...prev, [assignmentId]: '' }));
      setFileDrafts((prev) => ({ ...prev, [assignmentId]: null }));
      showToast('Topshiriq javobi yuborildi.');
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Javob yuborishda xatolik.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSendQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!qLessonId || qText.trim().length < 3) {
      setError('Darsni tanlang va savol matnini yozing.');
      return;
    }
    setError(null);
    setSendingQ(true);
    try {
      await apiFetch('/api/questions', {
        method: 'POST',
        body: JSON.stringify({ lessonId: qLessonId, questionText: qText.trim() }),
      });
      setQText('');
      showToast("Savolingiz o'qituvchiga yuborildi.");
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Savol yuborishda xatolik.');
    } finally {
      setSendingQ(false);
    }
  };

  const gradedSubs = submissions.filter((s) => s.status === 'graded' && typeof s.score === 'number');
  const avgScore =
    gradedSubs.length > 0
      ? Math.round(gradedSubs.reduce((acc, s) => acc + (s.score || 0), 0) / gradedSubs.length)
      : null;

  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePct =
    lessons.length > 0 ? Math.round((presentCount / lessons.length) * 100) : 100;

  const navItems: { id: StudentTab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: 'lessons', label: 'Mening darslarim', icon: Video, count: lessons.length },
    { id: 'materials', label: 'Materiallar', icon: FileText, count: materials.length },
    { id: 'assignments', label: 'Topshiriqlar va baholar', icon: ClipboardList, count: assignments.length },
    { id: 'attendance', label: 'Davomat', icon: CalendarCheck },
    { id: 'questions', label: "O'qituvchiga savol", icon: HelpCircle, count: questions.length },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-display text-lg font-extrabold tracking-tight text-blue-700">
            SINXRON TA&apos;LIM
          </p>
          <p className="mt-0.5 text-xs font-medium text-blue-600">O&apos;quvchi kabineti</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {currentUser.fullName}
              </p>
              <p className="truncate text-xs text-slate-500">{currentUser.login}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Chiqish
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-white p-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="font-display text-base font-extrabold text-blue-700">
                  SINXRON TA&apos;LIM
                </p>
                <p className="text-xs text-blue-600">O&apos;quvchi kabineti</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      active ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={onLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden cursor-pointer"
              aria-label="Menyuni ochish"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs text-slate-500">
                O&apos;quvchi / {navItems.find((n) => n.id === activeTab)?.label}
              </p>
              <h1 className="font-display text-lg font-bold text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>
          </div>

          {/* Join by Invite Code */}
          <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="Kod: SX-2026"
                className="w-36 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 font-mono text-xs uppercase focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={joiningCode || !inviteCodeInput.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Qo&apos;shilish
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {notice && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-xs font-semibold underline cursor-pointer">
                Yopish
              </button>
            </div>
          )}

          {/* KPI Summary Row */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Kurslar va darslar</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {lessons.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Jonli darslar</p>
              <p className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
                {lessons.filter((l) => l.status === 'live').length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">O&apos;rtacha baho</p>
              <p className="mt-1 font-display text-2xl font-bold text-violet-700 tabular-nums">
                {avgScore !== null ? `${avgScore} ball` : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Davomat</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {attendancePct}%
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </div>
          ) : (
            <>
              {/* TAB 1: LESSONS */}
              {activeTab === 'lessons' && (
                <div className="space-y-4">
                  {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                      <Video className="mx-auto h-10 w-10 text-slate-300" />
                      <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
                        Sizda hozircha darslar yo&apos;q
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        O&apos;qituvchi bergan taklif kodini yuqoridagi maydonga kiriting (masalan: <span className="font-mono font-semibold">SX-2026</span>).
                      </p>
                    </div>
                  ) : (
                    lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`rounded-2xl border bg-white p-5 sm:p-6 ${
                          lesson.status === 'live'
                            ? 'border-blue-300 ring-1 ring-blue-100'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                              <span>{lesson.subject}</span>
                              <span aria-hidden="true">&middot;</span>
                              <span>O&apos;qituvchi: {lesson.teacherName}</span>
                              <span aria-hidden="true">&middot;</span>
                              <span className="tabular-nums">
                                {formatUzDateTime(lesson.scheduledAt)}
                              </span>
                              <span aria-hidden="true">&middot;</span>
                              <span
                                className={`font-semibold ${
                                  lesson.status === 'live'
                                    ? 'text-blue-700'
                                    : lesson.status === 'ended'
                                    ? 'text-slate-500'
                                    : 'text-violet-700'
                                }`}
                              >
                                {lesson.status === 'live'
                                  ? 'Jonli efirda'
                                  : lesson.status === 'ended'
                                  ? 'Yakunlangan'
                                  : 'Rejalashtirilgan'}
                              </span>
                            </div>

                            <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                              {lesson.title}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">{lesson.topic}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => onEnterLiveRoom(lesson)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer ${
                                lesson.status === 'live'
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : 'bg-violet-600 hover:bg-violet-700'
                              }`}
                            >
                              <Radio className="h-3.5 w-3.5" />
                              {lesson.status === 'live'
                                ? "Jonli darsga qo'shilish"
                                : 'Dars xonasini ochish'}
                            </button>

                            <a
                              href={lesson.zoomUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                            >
                              Zoom havolasi
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: MATERIALS */}
              {activeTab === 'materials' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {materials.length === 0 ? (
                    <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      Hozircha o&apos;qituvchi tomonidan yuklangan materiallar yo&apos;q.
                    </div>
                  ) : (
                    materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <div>
                          <p className="text-xs font-medium text-violet-700">{mat.lessonTitle}</p>
                          <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                            {mat.title}
                          </h3>
                          {mat.description && (
                            <p className="mt-1 text-xs text-slate-600">{mat.description}</p>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <span className="truncate text-xs text-slate-400">
                            {mat.kind === 'file'
                              ? `${mat.fileName} (${formatFileSize(mat.fileSize)})`
                              : 'Tashqi o‘quv havolasi'}
                          </span>
                          {mat.kind === 'file' ? (
                            <button
                              onClick={() =>
                                downloadWithAuth(
                                  `/api/materials/${mat.id}/download`,
                                  mat.fileName || 'material'
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Yuklab olish
                            </button>
                          ) : (
                            <a
                              href={mat.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ochish
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: ASSIGNMENTS & GRADES */}
              {activeTab === 'assignments' && (
                <div className="space-y-4">
                  {assignments.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      Sizga biriktirilgan topshiriqlar hozircha yo&apos;q.
                    </div>
                  ) : (
                    assignments.map((asg) => {
                      const sub = submissions.find((s) => s.assignmentId === asg.id);
                      const draftText = answerDrafts[asg.id] ?? (sub?.answerText || '');
                      return (
                        <div
                          key={asg.id}
                          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-violet-700">
                                {asg.lessonTitle} &middot; Maksimal ball: {asg.maxScore}
                              </p>
                              <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                                {asg.title}
                              </h3>
                              <p className="mt-1 text-sm text-slate-600">{asg.instructions}</p>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-slate-500 tabular-nums">
                                Muddat: {formatUzDateTime(asg.dueAt)}
                              </p>
                              <p
                                className={`mt-1 font-semibold ${
                                  sub?.status === 'graded'
                                    ? 'text-blue-700'
                                    : sub
                                    ? 'text-violet-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {sub?.status === 'graded'
                                  ? `Baho: ${sub.score}/${asg.maxScore}`
                                  : sub
                                  ? 'Yuborilgan (tekshirilmoqda)'
                                  : 'Topshirilmagan'}
                              </p>
                            </div>
                          </div>

                          {sub?.status === 'graded' && (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm">
                              <p className="font-semibold text-blue-800 tabular-nums">
                                Olingan natija: {sub.score} / {asg.maxScore} ball
                              </p>
                              {sub.feedback && (
                                <p className="mt-1 text-slate-700">
                                  O&apos;qituvchi izohi: {sub.feedback}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <label className="block text-xs font-semibold text-slate-700">
                              {sub ? 'Javobingizni yangilash' : 'Javob yuborish'}
                            </label>
                            <textarea
                              rows={3}
                              value={draftText}
                              onChange={(e) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [asg.id]: e.target.value,
                                }))
                              }
                              placeholder="Topshiriq yechimini shu yerga yozing..."
                              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                            />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <input
                                type="file"
                                onChange={(e) =>
                                  setFileDrafts((prev) => ({
                                    ...prev,
                                    [asg.id]: e.target.files?.[0] || null,
                                  }))
                                }
                                className="text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
                              />
                              <button
                                onClick={() => handleSubmitAssignment(asg.id)}
                                disabled={submittingId === asg.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {submittingId === asg.id ? 'Yuborilmoqda...' : 'Javobni yuborish'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: ATTENDANCE */}
              {activeTab === 'attendance' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Mening davomat holatim
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Jonli dars xonasiga kirganingizda davomatingiz avtomatik qayd etiladi.
                  </p>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 pr-4">Dars nomi</th>
                          <th className="py-2.5 pr-4">Vaqt</th>
                          <th className="py-2.5 text-right">Davomat holati</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lessons.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
                              Hozircha darslar mavjud emas.
                            </td>
                          </tr>
                        ) : (
                          lessons.map((l) => {
                            const rec = attendance.find((a) => a.lessonId === l.id);
                            return (
                              <tr key={l.id}>
                                <td className="py-3 pr-4 font-semibold text-slate-900">
                                  {l.title}
                                </td>
                                <td className="py-3 pr-4 text-xs text-slate-500 tabular-nums">
                                  {formatUzDateTime(l.scheduledAt)}
                                </td>
                                <td className="py-3 text-right text-xs font-semibold">
                                  {rec?.status === 'present' ? (
                                    <span className="text-blue-700">Keldi</span>
                                  ) : rec?.status === 'late' ? (
                                    <span className="text-amber-600">Kechikdi</span>
                                  ) : rec?.status === 'absent' ? (
                                    <span className="text-red-600">Kelmadi</span>
                                  ) : (
                                    <span className="text-slate-400">Hali belgilanmagan</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: QUESTIONS TO TEACHER */}
              {activeTab === 'questions' && (
                <div className="grid gap-6 lg:grid-cols-12">
                  <form
                    onSubmit={handleSendQuestion}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5 lg:self-start"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      O&apos;qituvchiga savol yuborish
                    </h2>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Darsni tanlang
                      </label>
                      <select
                        value={qLessonId}
                        onChange={(e) => setQLessonId(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title} ({l.teacherName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Savolingiz
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="Tushunarsiz bo'lgan mavzu yoki topshiriq yuzasidan savol yozing..."
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sendingQ || lessons.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      {sendingQ ? 'Yuborilmoqda...' : 'Savolni yuborish'}
                    </button>
                  </form>

                  <div className="space-y-3 lg:col-span-7">
                    {questions.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        Hali savol yubormagansiz.
                      </div>
                    ) : (
                      questions.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-2xl border border-slate-200 bg-white p-5"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{q.lessonTitle}</span>
                            <span
                              className={`font-semibold ${
                                q.status === 'answered' ? 'text-blue-700' : 'text-violet-700'
                              }`}
                            >
                              {q.status === 'answered' ? 'Javob berilgan' : 'Kutilmoqda'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {q.questionText}
                          </p>
                          {q.answerText && (
                            <div className="mt-3 rounded-xl bg-blue-50/70 p-3 text-sm text-slate-800">
                              <p className="text-xs font-semibold text-blue-700">
                                O&apos;qituvchi javobi:
                              </p>
                              <p className="mt-1">{q.answerText}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

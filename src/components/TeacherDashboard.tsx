import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  LogOut,
  Menu,
  Plus,
  Radio,
  Trash2,
  Upload,
  Users,
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
  AttendanceStatus,
  Lesson,
  Material,
  Question,
  Submission,
  User,
} from '../types';

type TeacherTab = 'lessons' | 'materials' | 'students' | 'assignments' | 'questions';

interface TeacherDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onEnterLiveRoom: (lesson: Lesson) => void;
  refreshSignal: number;
}

export function TeacherDashboard({
  currentUser,
  onLogout,
  onEnterLiveRoom,
  refreshSignal,
}: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<TeacherTab>('lessons');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Lesson create/edit modal state
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lTitle, setLTitle] = useState('');
  const [lSubject, setLSubject] = useState('');
  const [lTopic, setLTopic] = useState('');
  const [lScheduledAt, setLScheduledAt] = useState('');
  const [lDuration, setLDuration] = useState('60');
  const [lZoomUrl, setLZoomUrl] = useState('');
  const [lZoomId, setLZoomId] = useState('');
  const [lZoomPass, setLZoomPass] = useState('');
  const [lInvitedIds, setLInvitedIds] = useState<string[]>([]);
  const [savingLesson, setSavingLesson] = useState(false);

  // Material form state
  const [mLessonId, setMLessonId] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mKind, setMKind] = useState<'file' | 'link'>('file');
  const [mFile, setMFile] = useState<File | null>(null);
  const [mUrl, setMUrl] = useState('');
  const [uploadingMat, setUploadingMat] = useState(false);

  // Assignment form state
  const [aLessonId, setALessonId] = useState('');
  const [aTitle, setATitle] = useState('');
  const [aInstructions, setAInstructions] = useState('');
  const [aDueAt, setADueAt] = useState('');
  const [aMaxScore, setAMaxScore] = useState('100');
  const [savingAsg, setSavingAsg] = useState(false);

  // Grading state keyed by submission ID
  const [gradeInputs, setGradeInputs] = useState<Record<string, { score: string; feedback: string }>>({});

  // Attendance selected lesson
  const [attLessonId, setAttLessonId] = useState('');

  // Question answer inputs keyed by question ID
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const fetchAllData = useCallback(async () => {
    try {
      const [lesRes, stuRes, matRes, asgRes, attRes, qstRes] = await Promise.all([
        apiFetch<{ lessons: Lesson[] }>('/api/lessons'),
        apiFetch<{ students: User[] }>('/api/users/students'),
        apiFetch<{ materials: Material[] }>('/api/materials'),
        apiFetch<{ assignments: Assignment[]; submissions: Submission[] }>('/api/assignments'),
        apiFetch<{ attendance: AttendanceRecord[] }>('/api/attendance'),
        apiFetch<{ questions: Question[] }>('/api/questions'),
      ]);

      setLessons(lesRes.lessons);
      setStudents(stuRes.students);
      setMaterials(matRes.materials);
      setAssignments(asgRes.assignments);
      setSubmissions(asgRes.submissions);
      setAttendance(attRes.attendance);
      setQuestions(qstRes.questions);

      if (lesRes.lessons.length > 0) {
        setMLessonId((prev) => prev || lesRes.lessons[0].id);
        setALessonId((prev) => prev || lesRes.lessons[0].id);
        setAttLessonId((prev) => prev || lesRes.lessons[0].id);
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

  const openCreateLesson = () => {
    setEditingLesson(null);
    setLTitle('');
    setLSubject('');
    setLTopic('');
    const nextHour = new Date(Date.now() + 3600000);
    setLScheduledAt(nextHour.toISOString().slice(0, 16));
    setLDuration('60');
    setLZoomUrl('');
    setLZoomId('');
    setLZoomPass('');
    setLInvitedIds(students.map((s) => s.id));
    setShowLessonForm(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLTitle(lesson.title);
    setLSubject(lesson.subject);
    setLTopic(lesson.topic);
    setLScheduledAt(lesson.scheduledAt.slice(0, 16));
    setLDuration(String(lesson.durationMinutes));
    setLZoomUrl(lesson.zoomUrl);
    setLZoomId(lesson.zoomMeetingId);
    setLZoomPass(lesson.zoomPasscode);
    setLInvitedIds(lesson.invitedStudentIds);
    setShowLessonForm(true);
  };

  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavingLesson(true);
    try {
      const payload = {
        title: lTitle,
        subject: lSubject,
        topic: lTopic,
        scheduledAt: lScheduledAt ? new Date(lScheduledAt).toISOString() : new Date().toISOString(),
        durationMinutes: Number(lDuration) || 60,
        zoomUrl: lZoomUrl,
        zoomMeetingId: lZoomId,
        zoomPasscode: lZoomPass,
        invitedStudentIds: lInvitedIds,
      };

      if (editingLesson) {
        await apiFetch(`/api/lessons/${editingLesson.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Dars ma’lumotlari yangilandi.');
      } else {
        await apiFetch('/api/lessons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Yangi dars muvaffaqiyatli yaratildi.');
      }
      setShowLessonForm(false);
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Darsni saqlashda xatolik.');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    setError(null);
    try {
      await apiFetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
      showToast("Dars o'chirildi.");
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Darsni o'chirishda xatolik.");
    }
  };

  const handleStartAndEnter = async (lesson: Lesson) => {
    setError(null);
    try {
      if (lesson.status !== 'live') {
        const res = await apiFetch<{ lesson: Lesson }>(`/api/lessons/${lesson.id}/start`, {
          method: 'POST',
        });
        await fetchAllData();
        onEnterLiveRoom(res.lesson);
      } else {
        onEnterLiveRoom(lesson);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jonli darsni boshlashda xatolik.');
    }
  };

  const handleUploadMaterial = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploadingMat(true);
    try {
      if (mKind === 'file') {
        if (!mFile) {
          throw new Error('Yuklash uchun faylni tanlang.');
        }
        const fileBase64 = await fileToBase64(mFile);
        await apiFetch('/api/materials', {
          method: 'POST',
          body: JSON.stringify({
            lessonId: mLessonId,
            title: mTitle,
            description: mDesc,
            kind: 'file',
            fileName: mFile.name,
            mimeType: mFile.type,
            fileBase64,
          }),
        });
      } else {
        await apiFetch('/api/materials', {
          method: 'POST',
          body: JSON.stringify({
            lessonId: mLessonId,
            title: mTitle,
            description: mDesc,
            kind: 'link',
            externalUrl: mUrl,
          }),
        });
      }
      setMTitle('');
      setMDesc('');
      setMFile(null);
      setMUrl('');
      showToast('O‘quv materiali muvaffaqiyatli qo‘shildi.');
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Material yuklashda xatolik.');
    } finally {
      setUploadingMat(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await apiFetch(`/api/materials/${id}`, { method: 'DELETE' });
      showToast("Material o'chirildi.");
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirishda xatolik.");
    }
  };

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavingAsg(true);
    try {
      await apiFetch('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: aLessonId,
          title: aTitle,
          instructions: aInstructions,
          dueAt: aDueAt ? new Date(aDueAt).toISOString() : undefined,
          maxScore: Number(aMaxScore) || 100,
        }),
      });
      setATitle('');
      setAInstructions('');
      showToast('Yangi topshiriq berildi.');
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Topshiriq yaratishda xatolik.');
    } finally {
      setSavingAsg(false);
    }
  };

  const handleGradeSubmission = async (subId: string) => {
    const input = gradeInputs[subId];
    if (!input || input.score === '') {
      setError('Baholash uchun ball kiriting.');
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/submissions/${subId}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          score: Number(input.score),
          feedback: input.feedback || '',
        }),
      });
      showToast("Baho va izoh saqlandi.");
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Baholashda xatolik.');
    }
  };

  const handleSetAttendance = async (
    lessonId: string,
    studentId: string,
    status: AttendanceStatus
  ) => {
    setError(null);
    try {
      await apiFetch('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ lessonId, studentId, status }),
      });
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Davomatni belgilashda xatolik.');
    }
  };

  const handleAnswerQuestion = async (questionId: string) => {
    const text = answerInputs[questionId] || '';
    if (text.trim().length < 2) {
      setError('Javob matnini kiriting.');
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/questions/${questionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answerText: text }),
      });
      setAnswerInputs((prev) => ({ ...prev, [questionId]: '' }));
      showToast('Savolga javob yuborildi.');
      await fetchAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Javob yuborishda xatolik.');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const navItems: { id: TeacherTab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: 'lessons', label: 'Darslar', icon: Video, count: lessons.length },
    { id: 'materials', label: 'Materiallar', icon: FileText, count: materials.length },
    { id: 'students', label: "O'quvchilar va davomat", icon: Users, count: students.length },
    { id: 'assignments', label: 'Topshiriqlar va natijalar', icon: ClipboardList, count: assignments.length },
    {
      id: 'questions',
      label: 'Savollar',
      icon: HelpCircle,
      count: questions.filter((q) => q.status === 'open').length,
    },
  ];

  const selectedAttLesson = lessons.find((l) => l.id === attLessonId) || lessons[0];
  const attLessonStudents = selectedAttLesson
    ? students.filter((s) => selectedAttLesson.invitedStudentIds.includes(s.id))
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-display text-lg font-extrabold tracking-tight text-blue-700">
            SINXRON TA&apos;LIM
          </p>
          <p className="mt-0.5 text-xs font-medium text-violet-700">O&apos;qituvchi kabineti</p>
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
                    ? 'bg-violet-50 text-violet-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-700' : 'text-slate-400'}`} />
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <GraduationCap className="h-4 w-4" />
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
                <p className="text-xs text-violet-700">O&apos;qituvchi kabineti</p>
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
                      active ? 'bg-violet-50 text-violet-800 font-semibold' : 'text-slate-700'
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

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
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
                O&apos;qituvchi / {navItems.find((n) => n.id === activeTab)?.label}
              </p>
              <h1 className="font-display text-lg font-bold text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>
          </div>

          <button
            onClick={openCreateLesson}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Yangi dars yaratish
          </button>
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

          {/* Summary Row */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Jami darslar</p>
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
              <p className="text-xs font-medium text-slate-500">O&apos;quvchilar</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {students.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Tekshirilmagan javoblar</p>
              <p className="mt-1 font-display text-2xl font-bold text-violet-700 tabular-nums">
                {submissions.filter((s) => s.status === 'submitted').length}
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
                        Hali dars yaratilmagan
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Birinchi sinxron darsingizni yarating, Zoom havolasini qo&apos;shing va o&apos;quvchilarni taklif qiling.
                      </p>
                      <button
                        onClick={openCreateLesson}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Yangi dars yaratish
                      </button>
                    </div>
                  ) : (
                    lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                              <span>{lesson.subject}</span>
                              <span aria-hidden="true">&middot;</span>
                              <span className="tabular-nums">
                                {formatUzDateTime(lesson.scheduledAt)} ({lesson.durationMinutes} daq)
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

                            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                Taklif qilinganlar: {lesson.invitedStudentIds.length} nafar
                              </span>
                              <button
                                type="button"
                                onClick={() => copyInviteCode(lesson.inviteCode)}
                                className="inline-flex items-center gap-1.5 font-mono font-semibold text-violet-700 hover:text-violet-900 cursor-pointer"
                              >
                                Taklif kodi: {lesson.inviteCode}
                                {copiedCode === lesson.inviteCode ? (
                                  <Check className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <a
                                href={lesson.zoomUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                              >
                                Zoom havolasi
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleStartAndEnter(lesson)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer ${
                                lesson.status === 'live'
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : 'bg-violet-600 hover:bg-violet-700'
                              }`}
                            >
                              <Radio className="h-3.5 w-3.5" />
                              {lesson.status === 'live'
                                ? 'Jonli xonaga kirish'
                                : 'Jonli darsni boshlash'}
                            </button>

                            <button
                              onClick={() => openEditLesson(lesson)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Tahrirlash
                            </button>

                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              O&apos;chirish
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: MATERIALS */}
              {activeTab === 'materials' && (
                <div className="grid gap-6 lg:grid-cols-12">
                  <form
                    onSubmit={handleUploadMaterial}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Darsga fayl yoki material yuklash
                    </h2>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Darsni tanlang
                      </label>
                      <select
                        value={mLessonId}
                        onChange={(e) => setMLessonId(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Material nomi
                      </label>
                      <input
                        type="text"
                        required
                        value={mTitle}
                        onChange={(e) => setMTitle(e.target.value)}
                        placeholder="Masalan: 3-ma'ruza taqdimoti"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Qisqacha izoh
                      </label>
                      <textarea
                        rows={2}
                        value={mDesc}
                        onChange={(e) => setMDesc(e.target.value)}
                        placeholder="Fayl haqida qo'shimcha ma'lumot..."
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setMKind('file')}
                        className={`rounded-lg py-1.5 text-xs font-semibold cursor-pointer ${
                          mKind === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Fayl yuklash
                      </button>
                      <button
                        type="button"
                        onClick={() => setMKind('link')}
                        className={`rounded-lg py-1.5 text-xs font-semibold cursor-pointer ${
                          mKind === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Tashqi havola
                      </button>
                    </div>

                    {mKind === 'file' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Faylni tanlang (10 MB gacha)
                        </label>
                        <input
                          type="file"
                          onChange={(e) => setMFile(e.target.files?.[0] || null)}
                          className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Havola (URL)
                        </label>
                        <input
                          type="url"
                          value={mUrl}
                          onChange={(e) => setMUrl(e.target.value)}
                          placeholder="https://..."
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={uploadingMat || lessons.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingMat ? 'Yuklanmoqda...' : 'Materialni saqlash'}
                    </button>
                  </form>

                  <div className="space-y-3 lg:col-span-7">
                    {materials.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        Hozircha yuklangan materiallar yo&apos;q.
                      </div>
                    ) : (
                      materials.map((mat) => (
                        <div
                          key={mat.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-violet-700">{mat.lessonTitle}</p>
                            <h3 className="mt-0.5 truncate font-display text-base font-bold text-slate-900">
                              {mat.title}
                            </h3>
                            {mat.description && (
                              <p className="mt-0.5 text-xs text-slate-600">{mat.description}</p>
                            )}
                            <p className="mt-1 text-xs text-slate-400">
                              {mat.kind === 'file'
                                ? `${mat.fileName} · ${formatFileSize(mat.fileSize)}`
                                : mat.externalUrl}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {mat.kind === 'file' ? (
                              <button
                                onClick={() =>
                                  downloadWithAuth(
                                    `/api/materials/${mat.id}/download`,
                                    mat.fileName || 'material'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Yuklash
                              </button>
                            ) : (
                              <a
                                href={mat.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Ochish
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteMaterial(mat.id)}
                              className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                              aria-label="O'chirish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STUDENTS & ATTENDANCE */}
              {activeTab === 'students' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Dars bo&apos;yicha davomat nazorati
                        </h2>
                        <p className="text-xs text-slate-500">
                          Jonli dars xonasiga kirgan o&apos;quvchilar avtomatik ravishda &quot;Keldi&quot; deb belgilanadi.
                        </p>
                      </div>

                      <select
                        value={attLessonId}
                        onChange={(e) => setAttLessonId(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-blue-600 focus:outline-none"
                      >
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                            <th className="py-2.5 pr-4">O&apos;quvchi</th>
                            <th className="py-2.5 pr-4">Login</th>
                            <th className="py-2.5 pr-4">Holati</th>
                            <th className="py-2.5 text-right">Davomatni belgilash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attLessonStudents.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                                Ushbu darsga taklif qilingan o&apos;quvchilar yo&apos;q.
                              </td>
                            </tr>
                          ) : (
                            attLessonStudents.map((stu) => {
                              const rec = attendance.find(
                                (a) =>
                                  a.lessonId === selectedAttLesson?.id &&
                                  a.studentId === stu.id
                              );
                              const status = rec?.status || 'absent';
                              return (
                                <tr key={stu.id}>
                                  <td className="py-3 pr-4 font-semibold text-slate-900">
                                    {stu.fullName}
                                  </td>
                                  <td className="py-3 pr-4 text-xs text-slate-500">{stu.login}</td>
                                  <td className="py-3 pr-4 text-xs font-semibold">
                                    {status === 'present' ? (
                                      <span className="text-blue-700">Keldi</span>
                                    ) : status === 'late' ? (
                                      <span className="text-amber-600">Kechikdi</span>
                                    ) : (
                                      <span className="text-slate-400">Kelmadi</span>
                                    )}
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                      {(['present', 'late', 'absent'] as AttendanceStatus[]).map(
                                        (st) => (
                                          <button
                                            key={st}
                                            onClick={() =>
                                              selectedAttLesson &&
                                              handleSetAttendance(
                                                selectedAttLesson.id,
                                                stu.id,
                                                st
                                              )
                                            }
                                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                              status === st
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            {st === 'present'
                                              ? 'Keldi'
                                              : st === 'late'
                                              ? 'Kechikdi'
                                              : 'Kelmadi'}
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* All Registered Students Directory */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Platformadagi barcha o&apos;quvchilar ro&apos;yxati
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {students.map((stu) => (
                        <div
                          key={stu.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                        >
                          <p className="font-semibold text-slate-900">{stu.fullName}</p>
                          <p className="text-xs text-slate-500">{stu.login}</p>
                          {stu.subject && (
                            <p className="mt-1 text-xs font-medium text-violet-700">
                              {stu.subject}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ASSIGNMENTS & GRADING */}
              {activeTab === 'assignments' && (
                <div className="grid gap-6 lg:grid-cols-12">
                  <form
                    onSubmit={handleCreateAssignment}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 lg:self-start"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Yangi topshiriq berish
                    </h2>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Darsni tanlang
                      </label>
                      <select
                        value={aLessonId}
                        onChange={(e) => setALessonId(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Topshiriq sarlavhasi
                      </label>
                      <input
                        type="text"
                        required
                        value={aTitle}
                        onChange={(e) => setATitle(e.target.value)}
                        placeholder="Masalan: Amaliy mashq #2"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Topshiriq sharti
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={aInstructions}
                        onChange={(e) => setAInstructions(e.target.value)}
                        placeholder="O'quvchilar bajarishi kerak bo'lgan vazifa..."
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Muddat
                        </label>
                        <input
                          type="datetime-local"
                          value={aDueAt}
                          onChange={(e) => setADueAt(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Maksimal ball
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={aMaxScore}
                          onChange={(e) => setAMaxScore(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingAsg || lessons.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      {savingAsg ? 'Saqlanmoqda...' : 'Topshiriqni yuborish'}
                    </button>
                  </form>

                  <div className="space-y-4 lg:col-span-8">
                    {assignments.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        Hozircha topshiriqlar yaratilmagan.
                      </div>
                    ) : (
                      assignments.map((asg) => {
                        const asgSubs = submissions.filter((s) => s.assignmentId === asg.id);
                        return (
                          <div
                            key={asg.id}
                            className="rounded-2xl border border-slate-200 bg-white p-5"
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
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums">
                                <Calendar className="h-3.5 w-3.5" />
                                Muddat: {formatUzDateTime(asg.dueAt)}
                              </span>
                            </div>

                            <div className="mt-5 border-t border-slate-100 pt-4">
                              <p className="text-xs font-semibold text-slate-700">
                                O&apos;quvchilar natijalari ({asgSubs.length})
                              </p>

                              {asgSubs.length === 0 ? (
                                <p className="mt-2 text-xs text-slate-400">
                                  Hali hech kim javob yubormagan.
                                </p>
                              ) : (
                                <div className="mt-3 space-y-3">
                                  {asgSubs.map((sub) => {
                                    const draft = gradeInputs[sub.id] || {
                                      score: sub.score !== undefined ? String(sub.score) : '',
                                      feedback: sub.feedback || '',
                                    };
                                    return (
                                      <div
                                        key={sub.id}
                                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-900">
                                            {sub.studentName}
                                          </p>
                                          <span className="text-xs font-semibold tabular-nums text-blue-700">
                                            {sub.status === 'graded'
                                              ? `Baholangan: ${sub.score}/${asg.maxScore}`
                                              : 'Tekshirilmoqda'}
                                          </span>
                                        </div>

                                        {sub.answerText && (
                                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                            {sub.answerText}
                                          </p>
                                        )}

                                        {sub.fileName && (
                                          <button
                                            onClick={() =>
                                              downloadWithAuth(
                                                `/api/submissions/${sub.id}/download`,
                                                sub.fileName || 'javob'
                                              )
                                            }
                                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                                          >
                                            <Download className="h-3.5 w-3.5" />
                                            {sub.fileName}
                                          </button>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <input
                                            type="number"
                                            min={0}
                                            max={asg.maxScore}
                                            placeholder={`Ball (0-${asg.maxScore})`}
                                            value={draft.score}
                                            onChange={(e) =>
                                              setGradeInputs((prev) => ({
                                                ...prev,
                                                [sub.id]: { ...draft, score: e.target.value },
                                              }))
                                            }
                                            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums focus:border-blue-600 focus:outline-none"
                                          />
                                          <input
                                            type="text"
                                            placeholder="O'qituvchi izohi..."
                                            value={draft.feedback}
                                            onChange={(e) =>
                                              setGradeInputs((prev) => ({
                                                ...prev,
                                                [sub.id]: { ...draft, feedback: e.target.value },
                                              }))
                                            }
                                            className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                                          />
                                          <button
                                            onClick={() => handleGradeSubmission(sub.id)}
                                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                                          >
                                            Baholash
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: QUESTIONS */}
              {activeTab === 'questions' && (
                <div className="space-y-4">
                  {questions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      Hozircha o&apos;quvchilardan savollar kelib tushmagan.
                    </div>
                  ) : (
                    questions.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            <strong className="text-slate-900">{q.studentName}</strong> &middot;{' '}
                            {q.lessonTitle}
                          </span>
                          <span
                            className={`font-semibold ${
                              q.status === 'answered' ? 'text-blue-700' : 'text-violet-700'
                            }`}
                          >
                            {q.status === 'answered' ? 'Javob berilgan' : 'Javob kutilmoqda'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{q.questionText}</p>

                        {q.answerText ? (
                          <div className="mt-3 rounded-xl bg-blue-50/70 p-3 text-sm text-slate-800">
                            <p className="text-xs font-semibold text-blue-700">Sizning javobingiz:</p>
                            <p className="mt-1">{q.answerText}</p>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={answerInputs[q.id] || ''}
                              onChange={(e) =>
                                setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              placeholder="O'quvchiga javob yozing..."
                              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                            />
                            <button
                              onClick={() => handleAnswerQuestion(q.id)}
                              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 cursor-pointer"
                            >
                              Javob yuborish
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create / Edit Lesson Modal */}
      {showLessonForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editingLesson ? 'Darsni tahrirlash' : 'Yangi dars yaratish'}
              </h2>
              <button
                onClick={() => setShowLessonForm(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Dars nomi</label>
                  <input
                    type="text"
                    required
                    value={lTitle}
                    onChange={(e) => setLTitle(e.target.value)}
                    placeholder="Masalan: Matematika 10-sinf"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fan yo&apos;nalishi
                  </label>
                  <input
                    type="text"
                    value={lSubject}
                    onChange={(e) => setLSubject(e.target.value)}
                    placeholder="Masalan: Algebra"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Dars mavzusi</label>
                <textarea
                  rows={2}
                  required
                  value={lTopic}
                  onChange={(e) => setLTopic(e.target.value)}
                  placeholder="Bugungi darsda ko'riladigan asosiy mavzu..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Dars vaqti</label>
                  <input
                    type="datetime-local"
                    required
                    value={lScheduledAt}
                    onChange={(e) => setLScheduledAt(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Davomiylik (daqiqa)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={360}
                    value={lDuration}
                    onChange={(e) => setLDuration(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Zoom uchrashuv havolasi
                </label>
                <input
                  type="url"
                  required
                  value={lZoomUrl}
                  onChange={(e) => setLZoomUrl(e.target.value)}
                  placeholder="https://zoom.us/j/1234567890"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Zoom Meeting ID (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={lZoomId}
                    onChange={(e) => setLZoomId(e.target.value)}
                    placeholder="Havoladan avtomatik olinadi"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Zoom Passcode (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={lZoomPass}
                    onChange={(e) => setLZoomPass(e.target.value)}
                    placeholder="Masalan: 123456"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    O&apos;quvchilarni taklif qilish ({lInvitedIds.length} tanlangan)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLInvitedIds(
                        lInvitedIds.length === students.length ? [] : students.map((s) => s.id)
                      )
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    {lInvitedIds.length === students.length
                      ? 'Barchasini bekor qilish'
                      : 'Barchasini tanlash'}
                  </button>
                </div>

                <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  {students.length === 0 ? (
                    <p className="col-span-2 text-xs text-slate-500">
                      Hozircha ro&apos;yxatdan o&apos;tgan o&apos;quvchilar yo&apos;q. Dars yaratilgandan so&apos;ng taklif kodini ulashishingiz mumkin.
                    </p>
                  ) : (
                    students.map((stu) => {
                      const checked = lInvitedIds.includes(stu.id);
                      return (
                        <label
                          key={stu.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-xs hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setLInvitedIds((prev) =>
                                checked ? prev.filter((id) => id !== stu.id) : [...prev, stu.id]
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <span className="truncate font-medium text-slate-800">{stu.fullName}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLessonForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingLesson ? 'Saqlanmoqda...' : editingLesson ? 'Saqlash' : 'Darsni yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

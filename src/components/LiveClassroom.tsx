import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hand,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Radio,
  Send,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  apiFetch,
  downloadWithAuth,
  formatFileSize,
  formatUzTime,
  getAuthToken,
  getWebSocketUrl,
} from '../lib/api';
import type {
  ChatMessage,
  Lesson,
  LiveParticipant,
  Material,
  User,
  ZoomSignatureResponse,
} from '../types';

interface LiveClassroomProps {
  lesson: Lesson;
  currentUser: User;
  onBack: () => void;
  onLessonUpdated: (updated: Lesson) => void;
}

export function LiveClassroom({
  lesson: initialLesson,
  currentUser,
  onBack,
  onLessonUpdated,
}: LiveClassroomProps) {
  const [lesson, setLesson] = useState<Lesson>(initialLesson);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [stageTab, setStageTab] = useState<'zoom' | 'hardware'>('zoom');
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'participants'>('chat');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Zoom Meeting SDK state
  const [zoomSdkInfo, setZoomSdkInfo] = useState<ZoomSignatureResponse | null>(null);
  const [loadingSdk, setLoadingSdk] = useState(false);

  // Real Local Camera / Mic / Screen Share Self-Check state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLesson(initialLesson);
  }, [initialLesson]);

  // Load initial chat messages & lesson materials
  useEffect(() => {
    let active = true;
    apiFetch<{ messages: ChatMessage[] }>(`/api/lessons/${lesson.id}/messages`)
      .then((res) => {
        if (active) setMessages(res.messages);
      })
      .catch(() => {});

    apiFetch<{ materials: Material[] }>(`/api/materials?lessonId=${lesson.id}`)
      .then((res) => {
        if (active) setMaterials(res.materials);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [lesson.id]);

  // Live elapsed timer when lesson is live
  useEffect(() => {
    if (lesson.status !== 'live') {
      setElapsedSeconds(0);
      return;
    }
    const startMs = lesson.startedAt ? new Date(lesson.startedAt).getTime() : Date.now();
    const updateTimer = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lesson.status, lesson.startedAt]);

  // Real-time WebSocket connection for room chat & participant presence
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let closedIntentionally = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(getWebSocketUrl(token, lesson.id));
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'chat:new') {
            const incomingMsg = parsed.payload as ChatMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]
            );
          } else if (parsed.event === 'room:participants') {
            setParticipants(parsed.payload.participants || []);
          } else if (parsed.event === 'lesson:status') {
            const updatedLesson = parsed.payload.lesson as Lesson;
            if (updatedLesson) {
              setLesson(updatedLesson);
              onLessonUpdated(updatedLesson);
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedIntentionally) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [lesson.id, onLessonUpdated]);

  // Scroll chat to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Bind camera stream to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = camStream;
    }
  }, [camStream, stageTab]);

  useEffect(() => {
    if (screenRef.current) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream, stageTab]);

  // Cleanup local hardware streams on exit
  useEffect(() => {
    return () => {
      camStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
    };
  }, [camStream, screenStream]);

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rem = secs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
        rem
      ).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat:send', text: clean }));
    setChatInput('');
  };

  const handleToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'hand:toggle', raised: next }));
    }
  };

  const handleTeacherLessonState = async (action: 'start' | 'end') => {
    setBusyAction(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ lesson: Lesson }>(`/api/lessons/${lesson.id}/${action}`, {
        method: 'POST',
      });
      setLesson(res.lesson);
      onLessonUpdated(res.lesson);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Amalni bajarib bo‘lmadi.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCheckZoomSdk = async () => {
    setLoadingSdk(true);
    setActionError(null);
    try {
      const res = await apiFetch<ZoomSignatureResponse>('/api/zoom/signature', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: lesson.id,
          meetingNumber: lesson.zoomMeetingId,
        }),
      });
      setZoomSdkInfo(res);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Zoom SDK tekshiruvida xatolik.');
    } finally {
      setLoadingSdk(false);
    }
  };

  const startCameraCheck = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setCamStream(stream);
      setMicMuted(false);
    } catch {
      setMediaError(
        "Kamera yoki mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering."
      );
    }
  };

  const stopCameraCheck = () => {
    camStream?.getTracks().forEach((t) => t.stop());
    setCamStream(null);
  };

  const toggleMicMute = () => {
    if (!camStream) return;
    const nextMuted = !micMuted;
    camStream.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setMicMuted(nextMuted);
  };

  const startScreenPreview = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };
      setScreenStream(stream);
    } catch {
      setMediaError('Ekran namoyishini boshlash bekor qilindi.');
    }
  };

  const stopScreenPreview = () => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const zoomWebUrl = lesson.zoomMeetingId
    ? `https://zoom.us/wc/join/${lesson.zoomMeetingId}${
        lesson.zoomPasscode ? `?pwd=${encodeURIComponent(lesson.zoomPasscode)}` : ''
      }`
    : lesson.zoomUrl;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Kabinetga qaytish
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{lesson.subject}</span>
                <span aria-hidden="true">&middot;</span>
                <span className="truncate">O&apos;qituvchi: {lesson.teacherName}</span>
              </div>
              <h1 className="truncate font-display text-base font-bold text-slate-900 sm:text-lg">
                {lesson.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium tabular-nums">
              {lesson.status === 'live' ? (
                <>
                  <Radio className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold text-blue-700">Jonli efir</span>
                  <span aria-hidden="true" className="text-slate-300">
                    |
                  </span>
                  <span className="font-mono text-slate-700">{formatDuration(elapsedSeconds)}</span>
                </>
              ) : lesson.status === 'ended' ? (
                <span className="font-semibold text-slate-600">Dars yakunlangan</span>
              ) : (
                <span className="font-semibold text-violet-700">Boshlanishi kutilmoqda</span>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500">
              {wsConnected ? 'Chat ulangan' : 'Ulanmoqda...'}
            </div>

            {currentUser.role === 'student' && lesson.status === 'live' && (
              <button
                onClick={handleToggleHand}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  handRaised
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
                {handRaised ? "Qo'lni tushirish" : "Qo'l ko'tarish"}
              </button>
            )}

            {currentUser.role === 'teacher' && lesson.teacherId === currentUser.id && (
              <>
                {lesson.status !== 'live' ? (
                  <button
                    disabled={busyAction}
                    onClick={() => handleTeacherLessonState('start')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Jonli darsni boshlash
                  </button>
                ) : (
                  <button
                    disabled={busyAction}
                    onClick={() => handleTeacherLessonState('end')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    Darsni tugatish
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {actionError && (
        <div className="mx-auto mt-3 w-full max-w-[1440px] px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Left Video/Zoom Stage + Right Live Chat & Participants */}
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-12">
        {/* Left Stage (8 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Stage Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setStageTab('zoom')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    stageTab === 'zoom'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Zoom videokonferensiya
                </button>
                <button
                  onClick={() => setStageTab('hardware')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    stageTab === 'hardware'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kamera, mikrofon va ekran
                </button>
              </div>

              <span className="text-xs font-medium text-slate-500">
                Mavzu: {lesson.topic}
              </span>
            </div>

            {stageTab === 'zoom' ? (
              <div className="p-6">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-violet-950 p-6 text-white sm:p-8">
                  <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-semibold text-blue-300">
                        Zoom orqali jonli dars
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-bold text-white">
                        {lesson.title}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm text-slate-300">
                        Kamera, mikrofon va ekran namoyishi Zoom videokonferensiyasi orqali ishlaydi. Quyidagi haqiqiy havola orqali Zoom uchrashuviga kiring.
                      </p>
                    </div>

                    <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs backdrop-blur-sm">
                      <p className="text-slate-300">Taklif kodi</p>
                      <div className="mt-1 flex items-center gap-2 font-mono text-sm font-semibold text-white">
                        <span>{lesson.inviteCode}</span>
                        <button
                          onClick={() => copyText('invite', lesson.inviteCode)}
                          className="text-blue-200 hover:text-white cursor-pointer"
                          title="Nusxalash"
                        >
                          {copiedField === 'invite' ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Zoom Credentials Grid */}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <p className="text-xs text-slate-300">Zoom Meeting ID</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums">
                          {lesson.zoomMeetingId || "Havola ichida ko'rsatilgan"}
                        </p>
                      </div>
                      {lesson.zoomMeetingId && (
                        <button
                          onClick={() => copyText('zoomId', lesson.zoomMeetingId)}
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          {copiedField === 'zoomId' ? (
                            <Check className="h-4 w-4 text-blue-300" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <p className="text-xs text-slate-300">Kirish kodi (Passcode)</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums">
                          {lesson.zoomPasscode || 'Parol talab qilinmaydi'}
                        </p>
                      </div>
                      {lesson.zoomPasscode && (
                        <button
                          onClick={() => copyText('pass', lesson.zoomPasscode)}
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          {copiedField === 'pass' ? (
                            <Check className="h-4 w-4 text-blue-300" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Direct Real Zoom Actions */}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href={lesson.zoomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Video className="h-4 w-4" />
                      {currentUser.role === 'teacher'
                        ? "Zoom dasturida darsni boshlash"
                        : "Zoom dasturida qo'shilish"}
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    <a
                      href={zoomWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
                    >
                      Zoom brauzer orqali ochish
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    <button
                      type="button"
                      onClick={handleCheckZoomSdk}
                      disabled={loadingSdk}
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-500/20 px-4 py-3 text-sm font-semibold text-violet-100 hover:bg-violet-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {loadingSdk ? 'Tekshirilmoqda...' : 'Zoom Meeting SDK holati'}
                    </button>
                  </div>
                </div>

                {/* Honest Zoom Meeting SDK status panel */}
                {zoomSdkInfo && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    {zoomSdkInfo.configured ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-blue-700">
                          Zoom Meeting SDK imzosi (JWT) serverda muvaffaqiyatli yaratildi
                        </p>
                        <p className="text-xs text-slate-600">
                          Uchrashuv raqami:{' '}
                          <span className="font-mono font-semibold">
                            {zoomSdkInfo.meetingNumber}
                          </span>{' '}
                          &middot; Rol:{' '}
                          <span className="font-semibold">
                            {zoomSdkInfo.role === 1 ? "Mezbon (O'qituvchi)" : "Qatnashchi (O'quvchi)"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Xavfsizlik sababli Zoom web uchrashuvini alohida oynada ochish tavsiya etiladi:
                        </p>
                        <a
                          href={zoomWebUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Imzolangan Zoom Web sessiyasini ochish
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800">
                          Zoom Meeting SDK integratsiyasi tayyor
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600">
                          {zoomSdkInfo.message} Agar platforma ichiga Zoom SDK ni o&apos;rnatmoqchi bo&apos;lsangiz, serverning <code className="font-mono text-violet-700">.env</code> fayliga <code className="font-mono">ZOOM_SDK_KEY</code> va <code className="font-mono">ZOOM_SDK_SECRET</code> qiymatlarini kiriting. Ungacha yuqoridagi haqiqiy Zoom havolasi to&apos;liq ishlaydi.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Real Browser MediaDevices Check */
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Kamera, mikrofon va ekran namoyishini tekshirish
                    </h2>
                    <p className="text-xs text-slate-500">
                      Zoom darsiga kirishdan oldin qurilmalaringiz ishlashini tekshirib oling.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!camStream ? (
                      <button
                        onClick={startCameraCheck}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                      >
                        <Video className="h-4 w-4" />
                        Kamerani yoqish
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={toggleMicMute}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          {micMuted ? (
                            <>
                              <MicOff className="h-4 w-4 text-red-600" />
                              Mikrofon o&apos;chiq
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4 text-blue-600" />
                              Mikrofon yoqilgan
                            </>
                          )}
                        </button>
                        <button
                          onClick={stopCameraCheck}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                        >
                          <VideoOff className="h-4 w-4" />
                          O&apos;chirish
                        </button>
                      </>
                    )}

                    {!screenStream ? (
                      <button
                        onClick={startScreenPreview}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 cursor-pointer"
                      >
                        <Monitor className="h-4 w-4" />
                        Ekranni tekshirish
                      </button>
                    ) : (
                      <button
                        onClick={stopScreenPreview}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        Ekran namoyishini to&apos;xtatish
                      </button>
                    )}
                  </div>
                </div>

                {mediaError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                    {mediaError}
                  </div>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {camStream ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center text-slate-400">
                        <VideoOff className="h-8 w-8" />
                        <p className="mt-2 text-xs">Kamera o&apos;chirilgan</p>
                      </div>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {screenStream ? (
                      <video
                        ref={screenRef}
                        autoPlay
                        muted
                        playsInline
                        className="aspect-video w-full object-contain"
                      />
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center text-slate-400">
                        <Monitor className="h-8 w-8" />
                        <p className="mt-2 text-xs">Ekran namoyishi faol emas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attached Lesson Materials */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900">
                Darsga biriktirilgan materiallar
              </h3>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {materials.length} ta material
              </span>
            </div>

            {materials.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Ushbu darsga hozircha fayl yoki havola biriktirilmagan.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{mat.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {mat.kind === 'file'
                          ? `${mat.fileName} (${formatFileSize(mat.fileSize)})`
                          : mat.externalUrl}
                      </p>
                    </div>
                    {mat.kind === 'file' ? (
                      <button
                        onClick={() =>
                          downloadWithAuth(
                            `/api/materials/${mat.id}/download`,
                            mat.fileName || 'material'
                          )
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Yuklash
                      </button>
                    ) : (
                      <a
                        href={mat.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ochish
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Participants + Live Real-Time Chat (4 cols) */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-4 lg:h-[calc(100vh-116px)] lg:sticky lg:top-20">
          {/* Panel Switcher */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/60 p-1.5">
            <button
              onClick={() => setMobilePanel('chat')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                mobilePanel === 'chat'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Jonli chat ({messages.length})
            </button>
            <button
              onClick={() => setMobilePanel('participants')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                mobilePanel === 'participants'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Qatnashchilar ({participants.length})
            </button>
          </div>

          {mobilePanel === 'participants' ? (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-medium text-slate-500">
                Hozir xonada onlayn qatnashayotganlar:
              </p>
              <div className="mt-3 space-y-2">
                {participants.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Qatnashchilar ro&apos;yxati yuklanmoqda...
                  </p>
                ) : (
                  participants.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {p.fullName}
                          {p.userId === currentUser.id ? ' (Siz)' : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.role === 'teacher' ? "O'qituvchi" : "O'quvchi"}
                        </p>
                      </div>
                      {p.handRaised && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800">
                          <Hand className="h-3 w-3" />
                          Savol bor
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Live Chat Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-10 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-600">Hali xabarlar yo&apos;q</p>
                    <p className="mt-1 text-xs">
                      Birinchi bo&apos;lib salomlashing yoki savol yozing.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{msg.senderName}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>
                            {msg.senderRole === 'teacher' ? "O'qituvchi" : "O'quvchi"}
                          </span>
                          <span aria-hidden="true">&middot;</span>
                          <span className="tabular-nums">{formatUzTime(msg.createdAt)}</span>
                        </div>
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            isSelf
                              ? 'bg-blue-600 text-white'
                              : msg.senderRole === 'teacher'
                              ? 'border border-violet-200 bg-violet-50 text-slate-900'
                              : 'border border-slate-200 bg-slate-50 text-slate-900'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendChat}
                className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Xabar yozing..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || !wsConnected}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Yuborish</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

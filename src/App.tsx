import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuthView } from './components/AuthView';
import { LandingPage } from './components/LandingPage';
import { LiveClassroom } from './components/LiveClassroom';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { apiFetch, getAuthToken, getWebSocketUrl, setAuthToken } from './lib/api';
import type { Lesson, User, UserRole } from './types';

type AppView = 'landing' | 'auth' | 'dashboard' | 'live-room';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<UserRole>('student');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [pendingLiveLessonId, setPendingLiveLessonId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Restore persisted user session on boot
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    apiFetch<{ user: User }>('/api/auth/me')
      .then((res) => {
        setCurrentUser(res.user);
        setView('dashboard');
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  // Global WebSocket listener for real-time dashboard updates (lesson start/end, grading, Q&A)
  useEffect(() => {
    if (!currentUser) return;
    const token = getAuthToken();
    if (!token) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(getWebSocketUrl(token));
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'platform:update') {
            setRefreshSignal((s) => s + 1);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        if (!closed) {
          timer = setTimeout(connect, 4000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [currentUser]);

  const handleOpenAuth = (mode: 'login' | 'register', role: UserRole = 'student') => {
    setAuthMode(mode);
    setAuthDefaultRole(role);
    setView('auth');
  };

  const handleAuthenticated = async (user: User) => {
    setCurrentUser(user);
    if (pendingLiveLessonId) {
      try {
        const res = await apiFetch<{ lessons: Lesson[] }>('/api/lessons');
        const found =
          res.lessons.find((l) => l.id === pendingLiveLessonId) ||
          res.lessons.find((l) => l.status === 'live');
        setPendingLiveLessonId(null);
        if (found) {
          setActiveLesson(found);
          setView('live-room');
          return;
        }
      } catch {
        setPendingLiveLessonId(null);
      }
    }
    setView('dashboard');
  };

  const handleJoinLiveClick = async (lessonId?: string) => {
    if (!currentUser) {
      setPendingLiveLessonId(lessonId || '__first_live__');
      handleOpenAuth('login', 'student');
      return;
    }

    try {
      const res = await apiFetch<{ lessons: Lesson[] }>('/api/lessons');
      const target =
        (lessonId && res.lessons.find((l) => l.id === lessonId)) ||
        res.lessons.find((l) => l.status === 'live') ||
        res.lessons[0];

      if (target) {
        setActiveLesson(target);
        setView('live-room');
      } else {
        setView('dashboard');
      }
    } catch {
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setActiveLesson(null);
    setPendingLiveLessonId(null);
    setView('landing');
  };

  const handleLessonUpdated = useCallback((updated: Lesson) => {
    setActiveLesson(updated);
    setRefreshSignal((s) => s + 1);
  }, []);

  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-700">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium">SINXRON TA&apos;LIM yuklanmoqda...</p>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <AuthView
        initialMode={authMode}
        initialRole={authDefaultRole}
        onBack={() => {
          setPendingLiveLessonId(null);
          setView('landing');
        }}
        onAuthenticated={(user) => handleAuthenticated(user)}
      />
    );
  }

  if (view === 'live-room' && currentUser && activeLesson) {
    return (
      <LiveClassroom
        lesson={activeLesson}
        currentUser={currentUser}
        onBack={() => {
          setActiveLesson(null);
          setView('dashboard');
          setRefreshSignal((s) => s + 1);
        }}
        onLessonUpdated={handleLessonUpdated}
      />
    );
  }

  if (view === 'dashboard' && currentUser) {
    if (currentUser.role === 'teacher') {
      return (
        <TeacherDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onEnterLiveRoom={(lesson) => {
            setActiveLesson(lesson);
            setView('live-room');
          }}
          refreshSignal={refreshSignal}
        />
      );
    }

    return (
      <StudentDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onEnterLiveRoom={(lesson) => {
          setActiveLesson(lesson);
          setView('live-room');
        }}
        refreshSignal={refreshSignal}
      />
    );
  }

  return (
    <LandingPage
      currentUser={currentUser}
      onOpenAuth={handleOpenAuth}
      onOpenDashboard={() => setView('dashboard')}
      onJoinLiveClick={handleJoinLiveClick}
    />
  );
}

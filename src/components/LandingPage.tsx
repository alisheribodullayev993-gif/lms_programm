import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  MessageSquare,
  Radio,
  Users,
  Video,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { apiFetch, formatUzDateTime } from '../lib/api';
import type { PublicLesson, User, UserRole } from '../types';

interface LandingPageProps {
  currentUser: User | null;
  onOpenAuth: (mode: 'login' | 'register', defaultRole?: UserRole) => void;
  onOpenDashboard: () => void;
  onJoinLiveClick: (lessonId?: string) => void;
}

export function LandingPage({
  currentUser,
  onOpenAuth,
  onOpenDashboard,
  onJoinLiveClick,
}: LandingPageProps) {
  const [publicLessons, setPublicLessons] = useState<PublicLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [heroImgError, setHeroImgError] = useState(false);
  const [collabImgError, setCollabImgError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ lessons: PublicLesson[] }>('/api/lessons/public')
      .then((res) => {
        if (active) setPublicLessons(res.lessons);
      })
      .catch(() => {
        // Keep empty list gracefully on network error
      })
      .finally(() => {
        if (active) setLoadingLessons(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <a
            href="#bosh"
            className="font-display text-lg font-extrabold tracking-tight text-blue-700 whitespace-nowrap shrink-0"
          >
            SINXRON TA&apos;LIM
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#imkoniyatlar"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Imkoniyatlar
            </a>
            <a
              href="#jarayon"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Ishlash tartibi
            </a>
            <a
              href="#jonli-darslar"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Jonli darslar
            </a>
            <a
              href="#afzalliklar"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Kabinetlar
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            {currentUser ? (
              <button
                onClick={onOpenDashboard}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kabinetga o&apos;tish
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tizimga kirish
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="bosh"
        className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-violet-50/70 via-white to-blue-50/40"
      >
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center lg:col-span-6"
          >
            <p className="mb-3 text-sm font-semibold text-violet-700">
              Sinxron onlayn ta&apos;lim platformasi
            </p>
            <h1
              className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:leading-[1.1]"
              style={{ textWrap: 'balance' }}
            >
              O&apos;qituvchi va o&apos;quvchilar bir vaqtda bog&apos;lanadigan jonli dars maydoni
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              SINXRON TA&apos;LIM — Zoom videokonferensiyasi, real vaqt rejimidagi chat, dars materiallari, topshiriqlar va avtomatik davomatni yagona o&apos;zbek tilidagi platformada birlashtiradi.
            </p>

            {/* Primary & Role Entry Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onJoinLiveClick()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Radio className="h-4 w-4" />
                Jonli darsga qo&apos;shilish
              </button>

              <button
                onClick={() =>
                  currentUser?.role === 'teacher'
                    ? onOpenDashboard()
                    : onOpenAuth('login', 'teacher')
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <GraduationCap className="h-4 w-4" />
                O&apos;qituvchi kirishi
              </button>

              <button
                onClick={() =>
                  currentUser?.role === 'student'
                    ? onOpenDashboard()
                    : onOpenAuth('login', 'student')
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="h-4 w-4" />
                O&apos;quvchi kirishi
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200/80 pt-5 text-xs font-medium text-slate-500">
              <span>Zoom integratsiyasi</span>
              <span aria-hidden="true">&middot;</span>
              <span>Real vaqt WebSocket chat</span>
              <span aria-hidden="true">&middot;</span>
              <span>Avtomatik davomat va baholash</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
              {!heroImgError ? (
                <img
                  src="/src/assets/images/hero_sinxron_classroom_1795002641112.jpg"
                  alt="SINXRON TA'LIM o'qituvchisi jonli onlayn dars o'tkazmoqda"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-violet-700 p-8 text-center text-white">
                  <Video className="h-12 w-12 opacity-90" />
                  <p className="mt-4 font-display text-xl font-bold">
                    Jonli sinxron dars xonasi
                  </p>
                  <p className="mt-1 text-sm text-blue-100">
                    Zoom video va real vaqt chat bir oynada
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities Asymmetric Bento Section */}
      <section id="imkoniyatlar" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-700">Platforma imkoniyatlari</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Darsni rejalashtirishdan tortib baholashgacha yagona tizim
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-12">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 md:col-span-7">
            <div>
              <p className="font-mono text-xs font-medium text-violet-700">01. Jonli videodars</p>
              <h3 className="mt-2 font-display text-xl font-bold text-slate-900">
                Zoom uchrashuvlari va jonli sinf xonasi
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                O&apos;qituvchi darsga haqiqiy Zoom uchrashuv havolasini biriktiradi va darsni bir tugma bilan jonli efirga chiqaradi. O&apos;quvchilar bir vaqtning o&apos;zida kirib, kamera, mikrofon va ekran namoyishi orqali darsda qatnashadi.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {!collabImgError ? (
                <img
                  src="/src/assets/images/feature_live_collaboration_1795002641264.jpg"
                  alt="O'quvchi noutbuk orqali jonli darsda qatnashmoqda"
                  referrerPolicy="no-referrer"
                  onError={() => setCollabImgError(true)}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700">
                  <Users className="h-10 w-10" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 md:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-violet-50/50 p-6">
              <p className="font-mono text-xs font-medium text-violet-700">02. Real vaqt chat</p>
              <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                Xabar almashish va qatnashchilar ro&apos;yxati
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Jonli dars xonasining o&apos;ng qismida WebSocket asosidagi tezkor chat va faol qatnashchilar ro&apos;yxati ishlaydi. O&apos;quvchi qo&apos;l ko&apos;tarishi va savol yo&apos;llashi mumkin.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="font-mono text-xs font-medium text-blue-700">03. Materiallar va fayllar</p>
              <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                Dars fayllarini yuklash va saqlash
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Taqdimotlar, konspektlar va amaliy fayllarni darsga biriktiring. O&apos;quvchilar kerakli materiallarni istalgan payt yuklab olishlari mumkin.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-blue-50/40 p-6">
              <p className="font-mono text-xs font-medium text-blue-700">04. Topshiriq va davomat</p>
              <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                Avtomatik davomat va baholash tizimi
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Jonli darsga kirgan o&apos;quvchining davomati qayd etiladi. Topshiriq javoblari tekshirilib, ball va izohlar o&apos;quvchi kabinetida darhol ko&apos;rinadi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Steps */}
      <section id="jarayon" className="border-y border-slate-200/80 bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-violet-700">Ishlash tartibi</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Uch bosqichda sinxron darsni boshlang
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                1. Dars yarating va taklif qiling
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                O&apos;qituvchi dars nomi, mavzusi, vaqti va Zoom havolasini kiritib o&apos;quvchilarni qo&apos;shadi.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                2. Jonli dars xonasida uchrashing
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Zoom orqali video dars olib boring, jonli chatda savollarga javob bering va qatnashchilarni kuzating.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                3. Topshiriqlarni tekshiring
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                O&apos;quvchilar uy vazifasini yuboradi, o&apos;qituvchi esa ball va tavsiya bilan baholaydi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live & Upcoming Lessons Preview from Server */}
      <section id="jonli-darslar" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Faol jadval</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Jonli va rejalashtirilgan darslar
            </h2>
          </div>
          <button
            onClick={() => onJoinLiveClick()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
          >
            Barcha darslarni ochish
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {loadingLessons ? (
            <>
              <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            </>
          ) : publicLessons.length === 0 ? (
            <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">
                Hozircha rejalashtirilgan darslar mavjud emas. O&apos;qituvchi sifatida kirib birinchi darsni yarating.
              </p>
            </div>
          ) : (
            publicLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                    <span>{lesson.subject}</span>
                    {lesson.status === 'live' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700">
                        <Radio className="h-3.5 w-3.5" />
                        Jonli efirda
                      </span>
                    ) : (
                      <span>Rejalashtirilgan</span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                    {lesson.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{lesson.topic}</p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 tabular-nums">
                    <span>O&apos;qituvchi: {lesson.teacherName}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatUzDateTime(lesson.scheduledAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => onJoinLiveClick(lesson.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      lesson.status === 'live'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                    }`}
                  >
                    {lesson.status === 'live' ? "Darsga qo'shilish" : 'Kabinetda ko‘rish'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Role Comparison Section */}
      <section id="afzalliklar" className="border-t border-slate-200/80 bg-gradient-to-b from-white to-violet-50/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  O&apos;qituvchi kabineti
                </h3>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  Yangi dars yaratish, mavzu va vaqtni belgilash, o&apos;quvchilarni taklif qilish
                </li>
                <li className="flex items-start gap-2.5">
                  <Video className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  Zoom uchrashuv havolasini qo&apos;shish va jonli darsni boshlash/tugatish
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  Fayllar yuklash, davomatni kuzatish, topshiriq berish va baholash
                </li>
              </ul>
              <button
                onClick={() => onOpenAuth('register', 'teacher')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors cursor-pointer"
              >
                O&apos;qituvchi sifatida ro&apos;yxatdan o&apos;tish
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  O&apos;quvchi kabineti
                </h3>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <Radio className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  Rejalashtirilgan va jonli darslarni ko&apos;rish hamda bir tugma bilan qo&apos;shilish
                </li>
                <li className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  O&apos;qituvchi yuklagan materiallarni yuklab olish va topshiriq yuborish
                </li>
                <li className="flex items-start gap-2.5">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  Baholar, davomat holatini kuzatish va o&apos;qituvchiga savol yuborish
                </li>
              </ul>
              <button
                onClick={() => onOpenAuth('register', 'student')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                O&apos;quvchi sifatida ro&apos;yxatdan o&apos;tish
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p className="font-display font-bold text-slate-800">SINXRON TA&apos;LIM</p>
          <p>&copy; {new Date().getFullYear()} SINXRON TA&apos;LIM. Barcha huquqlar himoyalangan.</p>
        </div>
      </footer>
    </div>
  );
}

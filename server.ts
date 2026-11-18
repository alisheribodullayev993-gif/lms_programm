import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  Assignment,
  AttendanceRecord,
  AttendanceStatus,
  ChatMessage,
  Lesson,
  LiveParticipant,
  Material,
  Question,
  Submission,
  User,
  UserRole,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'sinxron-talim-platform-secret-2026';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'sinxron_db.json');

interface StoredUser extends User {
  passwordHash: string;
}

interface StoredMaterial extends Material {
  storedFileName?: string;
}

interface StoredSubmission extends Submission {
  storedFileName?: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  lessons: Lesson[];
  materials: StoredMaterial[];
  assignments: Assignment[];
  submissions: StoredSubmission[];
  attendance: AttendanceRecord[];
  messages: ChatMessage[];
  questions: Question[];
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signToken(payload: { userId: string; role: UserRole; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): { userId: string; role: UserRole; exp: number } | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed.userId || !parsed.role || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractZoomDetails(url: string, providedId?: string, providedPass?: string) {
  let zoomMeetingId = (providedId || '').trim();
  let zoomPasscode = (providedPass || '').trim();
  try {
    const parsed = new URL(url.trim());
    const match = parsed.pathname.match(/\/(?:j|wc\/join|wc\/start)\/(\d{7,15})/);
    if (match && !zoomMeetingId) {
      zoomMeetingId = match[1];
    }
    const pwd = parsed.searchParams.get('pwd');
    if (pwd && !zoomPasscode) {
      zoomPasscode = pwd;
    }
  } catch {
    // Keep provided values if URL isn't standard
  }
  return { zoomMeetingId, zoomPasscode };
}

function generateInviteCode(): string {
  const num = crypto.randomInt(1000, 9999);
  return `SX-${num}`;
}

function seedInitialDatabase(): DatabaseSchema {
  ensureDirectories();
  const now = Date.now();
  const teacherId = 'usr_teacher_dilnoza';
  const student1Id = 'usr_student_azizbek';
  const student2Id = 'usr_student_madina';
  const lesson1Id = 'les_algoritmlar_101';
  const lesson2Id = 'les_veb_dasturlash_204';
  const materialId = 'mat_algoritm_konspekt';

  const starterGuideContent = [
    "SINXRON TA'LIM — O'QUV QO'LLANMA",
    'Fan: Algoritmlar va ma’lumotlar tuzilmasi',
    "Mavzu: Rekursiya, graf algoritmlari va vaqt murakkabligi (Big-O)",
    '',
    '1. Asosiy tushunchalar:',
    '   - O(1): Doimiy vaqt (massiv elementiga indeks orqali murojaat).',
    '   - O(log n): Binar qidiruv algoritmi.',
    '   - O(n log n): Merge Sort va Quick Sort (o‘rtacha holatda).',
    '',
    '2. Amaliy topshiriq:',
    '   Dars yakunida berilgan 3 ta rekursiv funksiyaning murakkabligini asoslab bering.',
  ].join('\n');

  const storedGuideName = `${materialId}_algoritmlar_qollanma.txt`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storedGuideName), starterGuideContent, 'utf8');

  return {
    users: [
      {
        id: teacherId,
        fullName: 'Dilnoza Karimova',
        login: 'ustoz@sinxron.uz',
        role: 'teacher',
        subject: 'Informatika va dasturlash',
        createdAt: new Date(now - 86400000 * 5).toISOString(),
        passwordHash: hashPassword('ustoz123'),
      },
      {
        id: student1Id,
        fullName: 'Azizbek Rahimov',
        login: 'talaba@sinxron.uz',
        role: 'student',
        subject: 'Dasturiy injiniring',
        createdAt: new Date(now - 86400000 * 4).toISOString(),
        passwordHash: hashPassword('talaba123'),
      },
      {
        id: student2Id,
        fullName: 'Madina Tursunova',
        login: 'madina@sinxron.uz',
        role: 'student',
        subject: 'Dasturiy injiniring',
        createdAt: new Date(now - 86400000 * 3).toISOString(),
        passwordHash: hashPassword('madina123'),
      },
    ],
    lessons: [
      {
        id: lesson1Id,
        teacherId,
        teacherName: 'Dilnoza Karimova',
        title: 'Algoritmlar va ma’lumotlar tuzilmasi',
        subject: 'Informatika',
        topic: 'Graf algoritmlari: BFS va DFS amaliy tahlili',
        scheduledAt: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        zoomUrl: 'https://zoom.us/j/84920194821',
        zoomMeetingId: '84920194821',
        zoomPasscode: '202645',
        inviteCode: 'SX-2026',
        invitedStudentIds: [student1Id, student2Id],
        status: 'live',
        startedAt: new Date(now - 600000).toISOString(),
        createdAt: new Date(now - 86400000 * 2).toISOString(),
      },
      {
        id: lesson2Id,
        teacherId,
        teacherName: 'Dilnoza Karimova',
        title: 'TypeScript va zamonaviy veb-arxitektura',
        subject: 'Veb dasturlash',
        topic: 'Real vaqt rejimidagi WebSocket tizimlarini loyihalash',
        scheduledAt: new Date(now + 86400000).toISOString(),
        durationMinutes: 90,
        zoomUrl: 'https://zoom.us/j/93104857210',
        zoomMeetingId: '93104857210',
        zoomPasscode: '774411',
        inviteCode: 'SX-1042',
        invitedStudentIds: [student1Id, student2Id],
        status: 'scheduled',
        createdAt: new Date(now - 86400000).toISOString(),
      },
    ],
    materials: [
      {
        id: materialId,
        lessonId: lesson1Id,
        teacherId,
        title: 'Graf algoritmlari bo‘yicha ma’ruza konspekti',
        description: 'BFS va DFS algoritmlarining murakkabligi hamda misollar to‘plami.',
        kind: 'file',
        fileName: 'algoritmlar_qollanma.txt',
        storedFileName: storedGuideName,
        fileSize: Buffer.byteLength(starterGuideContent, 'utf8'),
        mimeType: 'text/plain; charset=utf-8',
        createdAt: new Date(now - 3600000 * 5).toISOString(),
      },
    ],
    assignments: [
      {
        id: 'asg_bfs_amaliy',
        lessonId: lesson1Id,
        teacherId,
        title: '1-amaliy topshiriq: Eng qisqa yo‘lni topish',
        instructions:
          'Berilgan yo‘naltirilmagan grafda A tugundan B tugungacha bo‘lgan eng qisqa yo‘lni BFS algoritmi yordamida topish bosqichlarini yozing.',
        dueAt: new Date(now + 86400000 * 2).toISOString(),
        maxScore: 100,
        createdAt: new Date(now - 3600000 * 4).toISOString(),
      },
    ],
    submissions: [],
    attendance: [
      {
        id: 'att_init_1',
        lessonId: lesson1Id,
        studentId: student1Id,
        studentName: 'Azizbek Rahimov',
        status: 'present',
        joinedAt: new Date(now - 500000).toISOString(),
        updatedAt: new Date(now - 500000).toISOString(),
      },
    ],
    messages: [
      {
        id: 'msg_init_1',
        lessonId: lesson1Id,
        senderId: teacherId,
        senderName: 'Dilnoza Karimova',
        senderRole: 'teacher',
        text: 'Assalomu alaykum! Jonli darsimiz boshlandi. Konspekt faylini materiallar bo‘limidan yuklab olishingiz mumkin.',
        createdAt: new Date(now - 480000).toISOString(),
      },
      {
        id: 'msg_init_2',
        lessonId: lesson1Id,
        senderId: student1Id,
        senderName: 'Azizbek Rahimov',
        senderRole: 'student',
        text: 'Va alaykum assalom, ustoz! Ovoz va taqdimot yaxshi ko‘rinyapti.',
        createdAt: new Date(now - 360000).toISOString(),
      },
    ],
    questions: [
      {
        id: 'qst_init_1',
        lessonId: lesson1Id,
        studentId: student2Id,
        studentName: 'Madina Tursunova',
        teacherId,
        questionText: 'BFS algoritmida navbat (queue) o‘rniga stek ishlatsak nima o‘zgaradi?',
        answerText:
          'Stek ishlatilsa algoritm kenglik bo‘yicha (BFS) emas, chuqurlik bo‘yicha (DFS) qidiruvga aylanadi va eng qisqa yo‘lni kafolatlamaydi.',
        status: 'answered',
        createdAt: new Date(now - 3600000 * 2).toISOString(),
        answeredAt: new Date(now - 3600000).toISOString(),
      },
    ],
  };
}

function loadDatabase(): DatabaseSchema {
  ensureDirectories();
  if (!fs.existsSync(DB_PATH)) {
    const initial = seedInitialDatabase();
    saveDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    const initial = seedInitialDatabase();
    saveDatabase(initial);
    return initial;
  }
}

function saveDatabase(data: DatabaseSchema) {
  ensureDirectories();
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_PATH);
}

let db = loadDatabase();

function sanitizeUser(u: StoredUser): User {
  const { passwordHash: _ignored, ...safe } = u;
  return safe;
}

interface AuthedRequest extends Request {
  authUser?: User;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken =
    header && header.startsWith('Bearer ') ? header.slice(7).trim() : queryToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Tizimga kirish talab qilinadi.' });
    return;
  }

  const decoded = verifyToken(rawToken);
  if (!decoded) {
    res.status(401).json({ error: 'Sessiya muddati tugagan. Qayta kiring.' });
    return;
  }

  const user = db.users.find((u) => u.id === decoded.userId);
  if (!user) {
    res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });
    return;
  }

  req.authUser = sanitizeUser(user);
  next();
}

function requireRole(role: UserRole) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
      return;
    }
    if (req.authUser.role !== role) {
      res.status(403).json({
        error:
          role === 'teacher'
            ? "Bu amal faqat o'qituvchilar uchun ruxsat etilgan."
            : "Bu amal faqat o'quvchilar uchun ruxsat etilgan.",
      });
      return;
    }
    next();
  };
}

function canAccessLesson(lesson: Lesson, user: User): boolean {
  if (user.role === 'teacher') {
    return lesson.teacherId === user.id;
  }
  return lesson.invitedStudentIds.includes(user.id);
}

// Live WebSocket room tracking
interface RoomClient {
  ws: WebSocket;
  user: User;
  lessonId: string;
  handRaised: boolean;
  joinedAt: string;
}

const roomClients = new Map<string, Set<RoomClient>>();
const globalUserSockets = new Map<string, Set<WebSocket>>();

function broadcastToRoom(lessonId: string, event: string, payload: unknown) {
  const clients = roomClients.get(lessonId);
  if (!clients) return;
  const message = JSON.stringify({ event, payload });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function broadcastGlobal(event: string, payload: unknown) {
  const message = JSON.stringify({ event, payload });
  for (const sockets of globalUserSockets.values()) {
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(message);
      }
    }
  }
}

function getRoomParticipants(lessonId: string): LiveParticipant[] {
  const clients = roomClients.get(lessonId);
  if (!clients) return [];
  const unique = new Map<string, LiveParticipant>();
  for (const c of clients) {
    unique.set(c.user.id, {
      userId: c.user.id,
      fullName: c.user.fullName,
      role: c.user.role,
      handRaised: c.handRaised,
      joinedAt: c.joinedAt,
    });
  }
  return Array.from(unique.values());
}

function markStudentPresent(lessonId: string, student: User) {
  if (student.role !== 'student') return;
  const existing = db.attendance.find(
    (a) => a.lessonId === lessonId && a.studentId === student.id
  );
  const nowIso = new Date().toISOString();
  if (!existing) {
    db.attendance.push({
      id: `att_${crypto.randomUUID().slice(0, 8)}`,
      lessonId,
      studentId: student.id,
      studentName: student.fullName,
      status: 'present',
      joinedAt: nowIso,
      updatedAt: nowIso,
    });
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'attendance', lessonId });
  } else if (existing.status === 'absent') {
    existing.status = 'present';
    existing.joinedAt = existing.joinedAt || nowIso;
    existing.updatedAt = nowIso;
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'attendance', lessonId });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- AUTH ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const { fullName, login, password, role, subject } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: "Ism va familiya kamida 2 ta harfdan iborat bo'lishi kerak." });
      return;
    }
    if (!login || typeof login !== 'string' || login.trim().length < 3) {
      res.status(400).json({ error: "Login yoki email kamida 3 ta belgidan iborat bo'lishi kerak." });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak." });
      return;
    }
    if (role !== 'teacher' && role !== 'student') {
      res.status(400).json({ error: "Foydalanuvchi roli 'teacher' yoki 'student' bo'lishi kerak." });
      return;
    }

    const normalizedLogin = login.trim().toLowerCase();
    const duplicate = db.users.find((u) => u.login.toLowerCase() === normalizedLogin);
    if (duplicate) {
      res.status(409).json({ error: 'Ushbu login yoki email allaqachon ro‘yxatdan o‘tgan.' });
      return;
    }

    const newUser: StoredUser = {
      id: `usr_${role}_${crypto.randomUUID().slice(0, 8)}`,
      fullName: fullName.trim().slice(0, 80),
      login: normalizedLogin.slice(0, 80),
      role,
      subject: typeof subject === 'string' ? subject.trim().slice(0, 80) : undefined,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };

    db.users.push(newUser);
    saveDatabase(db);

    const token = signToken({
      userId: newUser.id,
      role: newUser.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { login, password, expectedRole } = req.body || {};
    if (!login || !password || typeof login !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Login va parolni kiriting.' });
      return;
    }

    const normalizedLogin = login.trim().toLowerCase();
    const user = db.users.find((u) => u.login.toLowerCase() === normalizedLogin);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Login yoki parol noto'g'ri." });
      return;
    }

    if (expectedRole && (expectedRole === 'teacher' || expectedRole === 'student') && user.role !== expectedRole) {
      res.status(403).json({
        error:
          expectedRole === 'teacher'
            ? "Bu hisob o'quvchi sifatida ro'yxatdan o'tgan. O'quvchi bo'limidan kiring."
            : "Bu hisob o'qituvchi sifatida ro'yxatdan o'tgan. O'qituvchi bo'limidan kiring.",
      });
      return;
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ token, user: sanitizeUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // --- USERS (STUDENTS LIST FOR TEACHER) ---
  app.get('/api/users/students', requireAuth, requireRole('teacher'), (_req, res) => {
    const students = db.users
      .filter((u) => u.role === 'student')
      .map(sanitizeUser)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    res.json({ students });
  });

  // --- PUBLIC LESSONS PREVIEW (LANDING PAGE) ---
  app.get('/api/lessons/public', (_req, res) => {
    const publicLessons = db.lessons
      .filter((l) => l.status !== 'ended')
      .sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : a.scheduledAt.localeCompare(b.scheduledAt)))
      .slice(0, 6)
      .map((l) => ({
        id: l.id,
        title: l.title,
        subject: l.subject,
        topic: l.topic,
        teacherName: l.teacherName,
        scheduledAt: l.scheduledAt,
        durationMinutes: l.durationMinutes,
        status: l.status,
        studentCount: l.invitedStudentIds.length,
      }));
    res.json({ lessons: publicLessons });
  });

  // --- LESSONS CRUD ---
  app.get('/api/lessons', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const list = db.lessons
      .filter((l) => canAccessLesson(l, user))
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    res.json({ lessons: list });
  });

  app.post('/api/lessons', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const {
      title,
      subject,
      topic,
      scheduledAt,
      durationMinutes,
      zoomUrl,
      zoomMeetingId,
      zoomPasscode,
      invitedStudentIds,
    } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      res.status(400).json({ error: 'Dars nomini kiriting.' });
      return;
    }
    if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
      res.status(400).json({ error: 'Dars mavzusini kiriting.' });
      return;
    }
    if (!zoomUrl || typeof zoomUrl !== 'string' || !/^https?:\/\//i.test(zoomUrl.trim())) {
      res.status(400).json({ error: "To'g'ri Zoom uchrashuv havolasini kiriting (https://...)." });
      return;
    }

    const parsedZoom = extractZoomDetails(zoomUrl, zoomMeetingId, zoomPasscode);
    const validStudentIds = Array.isArray(invitedStudentIds)
      ? invitedStudentIds.filter((id) =>
          db.users.some((u) => u.id === id && u.role === 'student')
        )
      : [];

    let inviteCode = generateInviteCode();
    while (db.lessons.some((l) => l.inviteCode === inviteCode)) {
      inviteCode = generateInviteCode();
    }

    const lesson: Lesson = {
      id: `les_${crypto.randomUUID().slice(0, 8)}`,
      teacherId: user.id,
      teacherName: user.fullName,
      title: title.trim().slice(0, 120),
      subject: typeof subject === 'string' && subject.trim() ? subject.trim().slice(0, 80) : 'Umumiy fan',
      topic: topic.trim().slice(0, 300),
      scheduledAt: scheduledAt || new Date().toISOString(),
      durationMinutes: Number(durationMinutes) > 0 ? Math.min(Number(durationMinutes), 360) : 60,
      zoomUrl: zoomUrl.trim(),
      zoomMeetingId: parsedZoom.zoomMeetingId,
      zoomPasscode: parsedZoom.zoomPasscode,
      inviteCode,
      invitedStudentIds: validStudentIds,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    db.lessons.push(lesson);
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'lesson:created', lessonId: lesson.id });
    res.status(201).json({ lesson });
  });

  app.put('/api/lessons/:id', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    if (lesson.teacherId !== user.id) {
      res.status(403).json({ error: "Faqat o'zingiz yaratgan darsni tahrirlay olasiz." });
      return;
    }

    const {
      title,
      subject,
      topic,
      scheduledAt,
      durationMinutes,
      zoomUrl,
      zoomMeetingId,
      zoomPasscode,
      invitedStudentIds,
    } = req.body || {};

    if (typeof title === 'string' && title.trim().length >= 2) {
      lesson.title = title.trim().slice(0, 120);
    }
    if (typeof subject === 'string' && subject.trim()) {
      lesson.subject = subject.trim().slice(0, 80);
    }
    if (typeof topic === 'string' && topic.trim().length >= 2) {
      lesson.topic = topic.trim().slice(0, 300);
    }
    if (typeof scheduledAt === 'string' && scheduledAt) {
      lesson.scheduledAt = scheduledAt;
    }
    if (durationMinutes && Number(durationMinutes) > 0) {
      lesson.durationMinutes = Math.min(Number(durationMinutes), 360);
    }
    if (typeof zoomUrl === 'string' && /^https?:\/\//i.test(zoomUrl.trim())) {
      lesson.zoomUrl = zoomUrl.trim();
      const parsedZoom = extractZoomDetails(zoomUrl, zoomMeetingId, zoomPasscode);
      lesson.zoomMeetingId = parsedZoom.zoomMeetingId;
      lesson.zoomPasscode = parsedZoom.zoomPasscode;
    } else {
      if (typeof zoomMeetingId === 'string') lesson.zoomMeetingId = zoomMeetingId.trim();
      if (typeof zoomPasscode === 'string') lesson.zoomPasscode = zoomPasscode.trim();
    }
    if (Array.isArray(invitedStudentIds)) {
      lesson.invitedStudentIds = invitedStudentIds.filter((id) =>
        db.users.some((u) => u.id === id && u.role === 'student')
      );
    }

    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'lesson:updated', lessonId: lesson.id });
    res.json({ lesson });
  });

  app.delete('/api/lessons/:id', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const idx = db.lessons.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    if (db.lessons[idx].teacherId !== user.id) {
      res.status(403).json({ error: "Faqat o'zingiz yaratgan darsni o'chira olasiz." });
      return;
    }
    const lessonId = db.lessons[idx].id;
    db.lessons.splice(idx, 1);
    db.materials = db.materials.filter((m) => m.lessonId !== lessonId);
    db.assignments = db.assignments.filter((a) => a.lessonId !== lessonId);
    db.submissions = db.submissions.filter((s) => s.lessonId !== lessonId);
    db.attendance = db.attendance.filter((a) => a.lessonId !== lessonId);
    db.messages = db.messages.filter((m) => m.lessonId !== lessonId);
    db.questions = db.questions.filter((q) => q.lessonId !== lessonId);
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'lesson:deleted', lessonId });
    res.json({ ok: true });
  });

  app.post('/api/lessons/:id/start', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson || lesson.teacherId !== user.id) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    lesson.status = 'live';
    lesson.startedAt = new Date().toISOString();
    lesson.endedAt = undefined;
    saveDatabase(db);
    broadcastToRoom(lesson.id, 'lesson:status', { lessonId: lesson.id, status: 'live', lesson });
    broadcastGlobal('platform:update', { type: 'lesson:started', lessonId: lesson.id });
    res.json({ lesson });
  });

  app.post('/api/lessons/:id/end', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson || lesson.teacherId !== user.id) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    lesson.status = 'ended';
    lesson.endedAt = new Date().toISOString();
    saveDatabase(db);
    broadcastToRoom(lesson.id, 'lesson:status', { lessonId: lesson.id, status: 'ended', lesson });
    broadcastGlobal('platform:update', { type: 'lesson:ended', lessonId: lesson.id });
    res.json({ lesson });
  });

  app.post('/api/lessons/join-code', requireAuth, requireRole('student'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { inviteCode } = req.body || {};
    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ error: 'Taklif kodini kiriting (masalan: SX-2026).' });
      return;
    }
    const cleanCode = inviteCode.trim().toUpperCase();
    const lesson = db.lessons.find((l) => l.inviteCode.toUpperCase() === cleanCode);
    if (!lesson) {
      res.status(404).json({ error: "Bunday taklif kodiga ega dars topilmadi." });
      return;
    }
    if (!lesson.invitedStudentIds.includes(user.id)) {
      lesson.invitedStudentIds.push(user.id);
      saveDatabase(db);
      broadcastGlobal('platform:update', { type: 'lesson:joined', lessonId: lesson.id });
    }
    res.json({ lesson });
  });

  // --- MATERIALS (REAL FILE UPLOAD & DOWNLOAD) ---
  app.get('/api/materials', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const lessonFilter = typeof req.query.lessonId === 'string' ? req.query.lessonId : undefined;
    const accessibleLessonIds = new Set(
      db.lessons.filter((l) => canAccessLesson(l, user)).map((l) => l.id)
    );
    const items = db.materials
      .filter((m) => accessibleLessonIds.has(m.lessonId) && (!lessonFilter || m.lessonId === lessonFilter))
      .map(({ storedFileName: _ignored, ...rest }) => ({
        ...rest,
        lessonTitle: db.lessons.find((l) => l.id === rest.lessonId)?.title || 'Dars',
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ materials: items });
  });

  app.post('/api/materials', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { lessonId, title, description, kind, fileName, mimeType, fileBase64, externalUrl } = req.body || {};

    const lesson = db.lessons.find((l) => l.id === lessonId && l.teacherId === user.id);
    if (!lesson) {
      res.status(404).json({ error: 'Tegishli dars topilmadi.' });
      return;
    }
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      res.status(400).json({ error: 'Material nomini kiriting.' });
      return;
    }

    const materialId = `mat_${crypto.randomUUID().slice(0, 8)}`;

    if (kind === 'link') {
      if (!externalUrl || typeof externalUrl !== 'string' || !/^https?:\/\//i.test(externalUrl.trim())) {
        res.status(400).json({ error: "To'g'ri havola kiriting (https://...)." });
        return;
      }
      const item: StoredMaterial = {
        id: materialId,
        lessonId: lesson.id,
        teacherId: user.id,
        title: title.trim().slice(0, 140),
        description: typeof description === 'string' ? description.trim().slice(0, 400) : '',
        kind: 'link',
        externalUrl: externalUrl.trim(),
        createdAt: new Date().toISOString(),
      };
      db.materials.push(item);
      saveDatabase(db);
      broadcastGlobal('platform:update', { type: 'material:created', lessonId: lesson.id });
      res.status(201).json({ material: item });
      return;
    }

    if (!fileBase64 || typeof fileBase64 !== 'string' || !fileName || typeof fileName !== 'string') {
      res.status(400).json({ error: 'Yuklash uchun faylni tanlang.' });
      return;
    }

    const base64Body = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(base64Body, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ error: 'Fayl hajmi 10 MB dan oshmasligi kerak.' });
      return;
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const storedFileName = `${materialId}_${safeName}`;
    ensureDirectories();
    fs.writeFileSync(path.join(UPLOADS_DIR, storedFileName), buffer);

    const item: StoredMaterial = {
      id: materialId,
      lessonId: lesson.id,
      teacherId: user.id,
      title: title.trim().slice(0, 140),
      description: typeof description === 'string' ? description.trim().slice(0, 400) : '',
      kind: 'file',
      fileName: fileName.slice(0, 120),
      storedFileName,
      fileSize: buffer.length,
      mimeType: typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      createdAt: new Date().toISOString(),
    };

    db.materials.push(item);
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'material:created', lessonId: lesson.id });

    const { storedFileName: _ignored, ...safeItem } = item;
    res.status(201).json({ material: safeItem });
  });

  app.get('/api/materials/:id/download', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const material = db.materials.find((m) => m.id === req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Material topilmadi.' });
      return;
    }
    const lesson = db.lessons.find((l) => l.id === material.lessonId);
    if (!lesson || !canAccessLesson(lesson, user)) {
      res.status(403).json({ error: 'Ushbu faylni yuklab olishga ruxsatingiz yo‘q.' });
      return;
    }
    if (!material.storedFileName) {
      res.status(400).json({ error: 'Ushbu material fayl emas.' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, material.storedFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Fayl serverda topilmadi.' });
      return;
    }
    res.download(filePath, material.fileName || 'material');
  });

  app.delete('/api/materials/:id', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const idx = db.materials.findIndex((m) => m.id === req.params.id);
    if (idx === -1 || db.materials[idx].teacherId !== user.id) {
      res.status(404).json({ error: 'Material topilmadi.' });
      return;
    }
    const removed = db.materials.splice(idx, 1)[0];
    if (removed.storedFileName) {
      const filePath = path.join(UPLOADS_DIR, removed.storedFileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- ASSIGNMENTS & SUBMISSIONS ---
  app.get('/api/assignments', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const accessibleLessonIds = new Set(
      db.lessons.filter((l) => canAccessLesson(l, user)).map((l) => l.id)
    );

    const assignments = db.assignments
      .filter((a) => accessibleLessonIds.has(a.lessonId))
      .map((a) => ({
        ...a,
        lessonTitle: db.lessons.find((l) => l.id === a.lessonId)?.title || 'Dars',
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const submissions = db.submissions
      .filter((s) =>
        user.role === 'teacher'
          ? accessibleLessonIds.has(s.lessonId)
          : s.studentId === user.id && accessibleLessonIds.has(s.lessonId)
      )
      .map(({ storedFileName: _ignored, ...rest }) => rest)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    res.json({ assignments, submissions });
  });

  app.post('/api/assignments', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { lessonId, title, instructions, dueAt, maxScore } = req.body || {};
    const lesson = db.lessons.find((l) => l.id === lessonId && l.teacherId === user.id);
    if (!lesson) {
      res.status(404).json({ error: 'Tegishli dars topilmadi.' });
      return;
    }
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      res.status(400).json({ error: 'Topshiriq nomini kiriting.' });
      return;
    }
    if (!instructions || typeof instructions !== 'string' || instructions.trim().length < 3) {
      res.status(400).json({ error: 'Topshiriq shartini kiriting.' });
      return;
    }

    const assignment: Assignment = {
      id: `asg_${crypto.randomUUID().slice(0, 8)}`,
      lessonId: lesson.id,
      teacherId: user.id,
      title: title.trim().slice(0, 140),
      instructions: instructions.trim().slice(0, 1500),
      dueAt: dueAt || new Date(Date.now() + 86400000 * 3).toISOString(),
      maxScore: Number(maxScore) > 0 ? Math.min(Number(maxScore), 100) : 100,
      createdAt: new Date().toISOString(),
    };

    db.assignments.push(assignment);
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'assignment:created', lessonId: lesson.id });
    res.status(201).json({ assignment });
  });

  app.delete('/api/assignments/:id', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const idx = db.assignments.findIndex((a) => a.id === req.params.id);
    if (idx === -1 || db.assignments[idx].teacherId !== user.id) {
      res.status(404).json({ error: 'Topshiriq topilmadi.' });
      return;
    }
    const id = db.assignments[idx].id;
    db.assignments.splice(idx, 1);
    db.submissions = db.submissions.filter((s) => s.assignmentId !== id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.post('/api/assignments/:id/submit', requireAuth, requireRole('student'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const assignment = db.assignments.find((a) => a.id === req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Topshiriq topilmadi.' });
      return;
    }
    const lesson = db.lessons.find((l) => l.id === assignment.lessonId);
    if (!lesson || !canAccessLesson(lesson, user)) {
      res.status(403).json({ error: 'Ushbu darsga a’zo emassiz.' });
      return;
    }

    const { answerText, fileName, fileBase64 } = req.body || {};
    if ((!answerText || !String(answerText).trim()) && !fileBase64) {
      res.status(400).json({ error: 'Javob matnini yozing yoki fayl biriktiring.' });
      return;
    }

    let storedFileName: string | undefined;
    let fileSize: number | undefined;
    const submissionId = `sub_${crypto.randomUUID().slice(0, 8)}`;

    if (fileBase64 && typeof fileBase64 === 'string' && fileName && typeof fileName === 'string') {
      const base64Body = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const buffer = Buffer.from(base64Body, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'Fayl hajmi 10 MB dan oshmasligi kerak.' });
        return;
      }
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      storedFileName = `${submissionId}_${safeName}`;
      fileSize = buffer.length;
      ensureDirectories();
      fs.writeFileSync(path.join(UPLOADS_DIR, storedFileName), buffer);
    }

    const existingIdx = db.submissions.findIndex(
      (s) => s.assignmentId === assignment.id && s.studentId === user.id
    );

    const record: StoredSubmission = {
      id: existingIdx >= 0 ? db.submissions[existingIdx].id : submissionId,
      assignmentId: assignment.id,
      lessonId: assignment.lessonId,
      studentId: user.id,
      studentName: user.fullName,
      answerText: typeof answerText === 'string' ? answerText.trim().slice(0, 4000) : '',
      fileName: typeof fileName === 'string' ? fileName.slice(0, 120) : undefined,
      storedFileName: storedFileName || (existingIdx >= 0 ? db.submissions[existingIdx].storedFileName : undefined),
      fileSize: fileSize || (existingIdx >= 0 ? db.submissions[existingIdx].fileSize : undefined),
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.submissions[existingIdx] = record;
    } else {
      db.submissions.push(record);
    }

    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'submission:created', assignmentId: assignment.id });
    const { storedFileName: _ignored, ...safeRecord } = record;
    res.status(201).json({ submission: safeRecord });
  });

  app.get('/api/submissions/:id/download', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const sub = db.submissions.find((s) => s.id === req.params.id);
    if (!sub || !sub.storedFileName) {
      res.status(404).json({ error: 'Fayl topilmadi.' });
      return;
    }
    const lesson = db.lessons.find((l) => l.id === sub.lessonId);
    const allowed =
      sub.studentId === user.id || (user.role === 'teacher' && lesson?.teacherId === user.id);
    if (!allowed) {
      res.status(403).json({ error: 'Ruxsat yo‘q.' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, sub.storedFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Fayl serverda topilmadi.' });
      return;
    }
    res.download(filePath, sub.fileName || 'javob');
  });

  app.post('/api/submissions/:id/grade', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const sub = db.submissions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Topshiriq javobi topilmadi.' });
      return;
    }
    const lesson = db.lessons.find((l) => l.id === sub.lessonId);
    if (!lesson || lesson.teacherId !== user.id) {
      res.status(403).json({ error: 'Ushbu javobni baholashga ruxsatingiz yo‘q.' });
      return;
    }
    const assignment = db.assignments.find((a) => a.id === sub.assignmentId);
    const maxScore = assignment?.maxScore || 100;
    const scoreNum = Number(req.body?.score);
    if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      res.status(400).json({ error: `Baho 0 dan ${maxScore} gacha bo'lishi kerak.` });
      return;
    }

    sub.score = scoreNum;
    sub.feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim().slice(0, 800) : '';
    sub.status = 'graded';
    sub.gradedAt = new Date().toISOString();
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'submission:graded', submissionId: sub.id });

    const { storedFileName: _ignored, ...safeSub } = sub;
    res.json({ submission: safeSub });
  });

  // --- ATTENDANCE ---
  app.get('/api/attendance', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const accessibleLessonIds = new Set(
      db.lessons.filter((l) => canAccessLesson(l, user)).map((l) => l.id)
    );

    const records = db.attendance.filter((a) =>
      user.role === 'teacher'
        ? accessibleLessonIds.has(a.lessonId)
        : a.studentId === user.id && accessibleLessonIds.has(a.lessonId)
    );
    res.json({ attendance: records });
  });

  app.post('/api/attendance', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { lessonId, studentId, status } = req.body || {};
    const lesson = db.lessons.find((l) => l.id === lessonId && l.teacherId === user.id);
    if (!lesson) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    const student = db.users.find((u) => u.id === studentId && u.role === 'student');
    if (!student) {
      res.status(404).json({ error: "O'quvchi topilmadi." });
      return;
    }
    if (!['present', 'late', 'absent'].includes(status)) {
      res.status(400).json({ error: "Davomat holati noto'g'ri." });
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = db.attendance.find(
      (a) => a.lessonId === lessonId && a.studentId === studentId
    );
    if (existing) {
      existing.status = status as AttendanceStatus;
      existing.updatedAt = nowIso;
      if (status !== 'absent' && !existing.joinedAt) existing.joinedAt = nowIso;
    } else {
      db.attendance.push({
        id: `att_${crypto.randomUUID().slice(0, 8)}`,
        lessonId,
        studentId,
        studentName: student.fullName,
        status: status as AttendanceStatus,
        joinedAt: status !== 'absent' ? nowIso : undefined,
        updatedAt: nowIso,
      });
    }
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'attendance', lessonId });
    res.json({ ok: true });
  });

  // --- QUESTIONS (O'QITUVCHIGA SAVOL) ---
  app.get('/api/questions', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const list = db.questions
      .filter((q) => (user.role === 'teacher' ? q.teacherId === user.id : q.studentId === user.id))
      .map((q) => ({
        ...q,
        lessonTitle: db.lessons.find((l) => l.id === q.lessonId)?.title || 'Dars',
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ questions: list });
  });

  app.post('/api/questions', requireAuth, requireRole('student'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { lessonId, questionText } = req.body || {};
    const lesson = db.lessons.find((l) => l.id === lessonId && canAccessLesson(l, user));
    if (!lesson) {
      res.status(404).json({ error: 'Dars topilmadi.' });
      return;
    }
    if (!questionText || typeof questionText !== 'string' || questionText.trim().length < 3) {
      res.status(400).json({ error: 'Savol matnini kiriting.' });
      return;
    }

    const q: Question = {
      id: `qst_${crypto.randomUUID().slice(0, 8)}`,
      lessonId: lesson.id,
      studentId: user.id,
      studentName: user.fullName,
      teacherId: lesson.teacherId,
      questionText: questionText.trim().slice(0, 1000),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    db.questions.push(q);
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'question:created', lessonId: lesson.id });
    res.status(201).json({ question: q });
  });

  app.post('/api/questions/:id/answer', requireAuth, requireRole('teacher'), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const q = db.questions.find((item) => item.id === req.params.id && item.teacherId === user.id);
    if (!q) {
      res.status(404).json({ error: 'Savol topilmadi.' });
      return;
    }
    const { answerText } = req.body || {};
    if (!answerText || typeof answerText !== 'string' || answerText.trim().length < 2) {
      res.status(400).json({ error: 'Javob matnini kiriting.' });
      return;
    }
    q.answerText = answerText.trim().slice(0, 1500);
    q.status = 'answered';
    q.answeredAt = new Date().toISOString();
    saveDatabase(db);
    broadcastGlobal('platform:update', { type: 'question:answered', questionId: q.id });
    res.json({ question: q });
  });

  // --- LESSON CHAT HISTORY ---
  app.get('/api/lessons/:id/messages', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson || !canAccessLesson(lesson, user)) {
      res.status(403).json({ error: 'Ushbu dars chatiga kirish ruxsati yo‘q.' });
      return;
    }
    const messages = db.messages
      .filter((m) => m.lessonId === lesson.id)
      .slice(-100);
    res.json({ messages });
  });

  // --- ZOOM MEETING SDK SIGNATURE ---
  app.post('/api/zoom/signature', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { meetingNumber, lessonId } = req.body || {};
    const sdkKey = process.env.ZOOM_SDK_KEY?.trim();
    const sdkSecret = process.env.ZOOM_SDK_SECRET?.trim();

    if (!sdkKey || !sdkSecret) {
      res.json({
        configured: false,
        message:
          "Zoom Meeting SDK kalitlari (ZOOM_SDK_KEY va ZOOM_SDK_SECRET) server muhitida sozlanmagan. To'g'ridan-to'g'ri Zoom uchrashuv havolasi orqali ulanish faol.",
      });
      return;
    }

    const lesson = db.lessons.find((l) => l.id === lessonId);
    const cleanMeetingNumber = String(meetingNumber || lesson?.zoomMeetingId || '').replace(/\D/g, '');
    if (!cleanMeetingNumber) {
      res.status(400).json({ error: 'Zoom Meeting ID topilmadi.' });
      return;
    }

    const roleNum = user.role === 'teacher' ? 1 : 0;
    const iat = Math.round(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sdkKey,
        mn: cleanMeetingNumber,
        role: roleNum,
        iat,
        exp,
        appKey: sdkKey,
        tokenExp: exp,
      })
    ).toString('base64url');

    const sig = crypto
      .createHmac('sha256', sdkSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    res.json({
      configured: true,
      signature: `${header}.${payload}.${sig}`,
      sdkKey,
      meetingNumber: cleanMeetingNumber,
      role: roleNum,
    });
  });

  // --- VITE / STATIC FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // --- HTTP + WEBSOCKET SERVER ON PORT 3000 ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || '';
      const lessonId = url.searchParams.get('lessonId') || '';

      const decoded = verifyToken(token);
      if (!decoded) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      const storedUser = db.users.find((u) => u.id === decoded.userId);
      if (!storedUser) {
        ws.close(1008, 'User not found');
        return;
      }
      const user = sanitizeUser(storedUser);

      // Register global socket
      if (!globalUserSockets.has(user.id)) {
        globalUserSockets.set(user.id, new Set());
      }
      globalUserSockets.get(user.id)!.add(ws);

      let activeRoomClient: RoomClient | null = null;

      if (lessonId) {
        const lesson = db.lessons.find((l) => l.id === lessonId);
        if (lesson && canAccessLesson(lesson, user)) {
          activeRoomClient = {
            ws,
            user,
            lessonId,
            handRaised: false,
            joinedAt: new Date().toISOString(),
          };
          if (!roomClients.has(lessonId)) {
            roomClients.set(lessonId, new Set());
          }
          roomClients.get(lessonId)!.add(activeRoomClient);

          // Automatically record student attendance on entering live lesson
          if (lesson.status === 'live' && user.role === 'student') {
            markStudentPresent(lessonId, user);
          }

          broadcastToRoom(lessonId, 'room:participants', {
            lessonId,
            participants: getRoomParticipants(lessonId),
          });
        }
      }

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (!activeRoomClient) return;

          if (data.type === 'chat:send' && typeof data.text === 'string') {
            const cleanText = data.text.trim().slice(0, 1000);
            if (!cleanText) return;
            const msg: ChatMessage = {
              id: `msg_${crypto.randomUUID().slice(0, 8)}`,
              lessonId: activeRoomClient.lessonId,
              senderId: user.id,
              senderName: user.fullName,
              senderRole: user.role,
              text: cleanText,
              createdAt: new Date().toISOString(),
            };
            db.messages.push(msg);
            if (db.messages.length > 5000) {
              db.messages = db.messages.slice(-4000);
            }
            saveDatabase(db);
            broadcastToRoom(activeRoomClient.lessonId, 'chat:new', msg);
          }

          if (data.type === 'hand:toggle') {
            activeRoomClient.handRaised = Boolean(data.raised);
            broadcastToRoom(activeRoomClient.lessonId, 'room:participants', {
              lessonId: activeRoomClient.lessonId,
              participants: getRoomParticipants(activeRoomClient.lessonId),
            });
          }
        } catch {
          // Ignore malformed JSON frames
        }
      });

      ws.on('close', () => {
        const userSet = globalUserSockets.get(user.id);
        if (userSet) {
          userSet.delete(ws);
          if (userSet.size === 0) globalUserSockets.delete(user.id);
        }

        if (activeRoomClient) {
          const set = roomClients.get(activeRoomClient.lessonId);
          if (set) {
            set.delete(activeRoomClient);
            if (set.size === 0) {
              roomClients.delete(activeRoomClient.lessonId);
            }
          }
          broadcastToRoom(activeRoomClient.lessonId, 'room:participants', {
            lessonId: activeRoomClient.lessonId,
            participants: getRoomParticipants(activeRoomClient.lessonId),
          });
        }
      });
    } catch {
      ws.close();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SINXRON TA'LIM server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

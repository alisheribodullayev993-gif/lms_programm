export type UserRole = 'teacher' | 'student';

export interface User {
  id: string;
  fullName: string;
  login: string;
  role: UserRole;
  subject?: string;
  createdAt: string;
}

export type LessonStatus = 'scheduled' | 'live' | 'ended';

export interface Lesson {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  subject: string;
  topic: string;
  scheduledAt: string;
  durationMinutes: number;
  zoomUrl: string;
  zoomMeetingId: string;
  zoomPasscode: string;
  inviteCode: string;
  invitedStudentIds: string[];
  status: LessonStatus;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface PublicLesson {
  id: string;
  title: string;
  subject: string;
  topic: string;
  teacherName: string;
  scheduledAt: string;
  durationMinutes: number;
  status: LessonStatus;
  studentCount: number;
}

export interface Material {
  id: string;
  lessonId: string;
  lessonTitle?: string;
  teacherId: string;
  title: string;
  description: string;
  kind: 'file' | 'link';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalUrl?: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  lessonId: string;
  lessonTitle?: string;
  teacherId: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  answerText: string;
  fileName?: string;
  fileSize?: number;
  status: 'submitted' | 'graded';
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface AttendanceRecord {
  id: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  joinedAt?: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  lessonId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
}

export interface Question {
  id: string;
  lessonId: string;
  lessonTitle?: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  questionText: string;
  answerText?: string;
  status: 'open' | 'answered';
  createdAt: string;
  answeredAt?: string;
}

export interface LiveParticipant {
  userId: string;
  fullName: string;
  role: UserRole;
  handRaised: boolean;
  joinedAt: string;
}

export interface ZoomSignatureResponse {
  configured: boolean;
  signature?: string;
  sdkKey?: string;
  meetingNumber?: string;
  role?: number;
  message?: string;
}

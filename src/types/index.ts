// StudyFlow Data Types

export type Priority = 'baja' | 'media' | 'alta';
export type AssignmentStatus = 'pendiente' | 'en_progreso' | 'completado';
export type ExamStatus = 'pendiente' | 'realizado' | 'corregido';

export interface Subject {
  id: string;
  user_id?: string;
  name: string;
  color: string;
  teacher?: string;
  weekly_goal_minutes: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Assignment {
  id: string;
  user_id?: string;
  subject_id: string | null;
  title: string;
  description?: string;
  due_date: string; // ISO string
  priority: Priority;
  status: AssignmentStatus;
  estimated_minutes: number;
  actual_minutes: number;
  completed_at?: string | null;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Exam {
  id: string;
  user_id?: string;
  subject_id: string | null;
  name: string;
  exam_date: string; // ISO string
  syllabus?: string;
  notes?: string;
  priority: Priority;
  status: ExamStatus;
  grade?: number | null; // e.g. 8.5
  max_grade: number; // default 10
  weight_percentage?: number | null; // e.g. 30 (30%)
  created_at: string;
  updated_at?: string;
}

export interface StudySession {
  id: string;
  user_id?: string;
  subject_id: string | null;
  assignment_id?: string | null;
  description?: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  completed: boolean;
  created_at: string;
}

export interface AcademicPeriod {
  id: string;
  user_id?: string;
  name: string; // e.g. "Primer Trimestre", "Segundo Trimestre"
  start_date: string;
  end_date: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  daily_study_goal_minutes: number;
  reminder_time: string; // default "15:30"
  reminder_days: number[]; // [1,2,3,4,5,6,7]
  timezone: string;
  theme: 'dark' | 'light';
  calendar_first_day: number; // 1 = Lunes, 0 = Domingo
  calendar_default_view: 'month' | 'week' | 'day';
  notify_daily_reminder: boolean;
  notify_upcoming_exams: boolean;
  notify_due_assignments: boolean;
  notify_overdue_tasks: boolean;
  notify_study_sessions: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PushSubscriptionData {
  id?: string;
  user_id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  created_at?: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  sent_at: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'assignments'
  | 'calendar'
  | 'subjects'
  | 'exams'
  | 'timer'
  | 'analytics'
  | 'settings';

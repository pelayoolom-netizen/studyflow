// StudyFlow Automated Daily Reminder Scheduler
// Monitors clock time, respects timezone, prevents duplicates, and formats real academic status

import { UserProfile, Assignment, Exam } from '../types';
import { showDirectNotification } from './pushNotifications';

export interface NextReminderInfo {
  nextDate: Date | null;
  formattedTime: string;
  relativeText: string;
  isToday: boolean;
  isActive: boolean;
}

// Map JS day index (0=Sun, 1=Mon, ..., 6=Sat) to StudyFlow ISO day index (1=Mon, ..., 7=Sun)
export function getIsoDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

// Compute the exact next Date when the reminder should trigger
export function calculateNextReminder(profile: UserProfile): NextReminderInfo {
  if (!profile.notify_daily_reminder) {
    return {
      nextDate: null,
      formattedTime: profile.reminder_time || '15:30',
      relativeText: 'Avisos diarios desactivados en ajustes',
      isToday: false,
      isActive: false,
    };
  }

  const [hoursStr, minutesStr] = (profile.reminder_time || '15:30').split(':');
  const targetHour = parseInt(hoursStr || '15', 10);
  const targetMinute = parseInt(minutesStr || '30', 10);
  const activeDays = profile.reminder_days && profile.reminder_days.length > 0
    ? profile.reminder_days
    : [1, 2, 3, 4, 5, 6, 7];

  const now = new Date();
  const currentIsoDay = getIsoDayOfWeek(now);

  // Check if today is eligible and target time is still in the future
  const todayTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);

  if (activeDays.includes(currentIsoDay) && now < todayTarget) {
    const diffMs = todayTarget.getTime() - now.getTime();
    return {
      nextDate: todayTarget,
      formattedTime: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
      relativeText: formatRemainingTime(diffMs, true),
      isToday: true,
      isActive: true,
    };
  }

  // Otherwise, find the next upcoming eligible day (up to 7 days ahead)
  for (let offset = 1; offset <= 7; offset++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, targetHour, targetMinute, 0, 0);
    const candidateIsoDay = getIsoDayOfWeek(candidateDate);
    if (activeDays.includes(candidateIsoDay)) {
      const diffMs = candidateDate.getTime() - now.getTime();
      return {
        nextDate: candidateDate,
        formattedTime: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
        relativeText: formatRemainingTime(diffMs, false, candidateDate),
        isToday: false,
        isActive: true,
      };
    }
  }

  return {
    nextDate: null,
    formattedTime: profile.reminder_time || '15:30',
    relativeText: 'Sin días seleccionados',
    isToday: false,
    isActive: false,
  };
}

function formatRemainingTime(diffMs: number, isToday: boolean, futureDate?: Date): string {
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (isToday) {
    if (hours === 0 && minutes <= 1) {
      return 'en menos de un minuto';
    }
    if (hours === 0) {
      return `en ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
    return `hoy a las ${hours > 0 ? `${hours}h y ` : ''}${minutes}m`;
  }

  // Not today: Tomorrow or Day of week
  const dayName = futureDate?.toLocaleDateString('es-ES', { weekday: 'long' }) || 'próximamente';
  return `${dayName} (${hours}h restantes)`;
}

// Generate real text summary based on student's actual assignments & exams
export function buildReminderSummary(assignments: Assignment[], exams: Exam[]): string {
  const now = new Date();
  const activeAssignments = assignments.filter((a) => a.status !== 'completado');
  const overdue = activeAssignments.filter((a) => new Date(a.due_date) < now);
  const dueToday = activeAssignments.filter((a) => {
    const due = new Date(a.due_date);
    return due.toDateString() === now.toDateString();
  });

  const upcomingExams = exams
    .filter((e) => new Date(e.exam_date) >= now)
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  const parts: string[] = [];

  if (overdue.length > 0) {
    parts.push(`⚠️ ${overdue.length} deber${overdue.length > 1 ? 'es' : ''} atrasado${overdue.length > 1 ? 's' : ''}`);
  }

  if (dueToday.length > 0) {
    parts.push(`📋 ${dueToday.length} para hoy`);
  }

  if (upcomingExams.length > 0) {
    const nextExam = upcomingExams[0];
    const examDate = new Date(nextExam.exam_date);
    const diffDays = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dayLabel = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'mañana' : `en ${diffDays} días`;
    parts.push(`🎯 Próximo examen: ${nextExam.name} (${dayLabel})`);
  }

  if (parts.length === 0) {
    return '¡Excelente! Estás al día con todos tus deberes y exámenes. Momento perfecto para una sesión de estudio.';
  }

  return parts.join(' | ');
}

// The core runtime scheduler: evaluates every 30 seconds
export function startReminderEngine(
  getProfile: () => UserProfile,
  getAssignments: () => Assignment[],
  getExams: () => Exam[]
): () => void {
  if (typeof window === 'undefined') return () => {};

  const checkSchedule = async () => {
    try {
      const profile = getProfile();
      if (!profile.notify_daily_reminder) return;

      const [hoursStr, minutesStr] = (profile.reminder_time || '15:30').split(':');
      const targetHour = parseInt(hoursStr || '15', 10);
      const targetMinute = parseInt(minutesStr || '30', 10);

      const now = new Date();
      const currentIsoDay = getIsoDayOfWeek(now);
      const activeDays = profile.reminder_days || [1, 2, 3, 4, 5, 6, 7];

      // Must be an active day of week
      if (!activeDays.includes(currentIsoDay)) return;

      // Must match the target hour and minute
      if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) {
        return;
      }

      // Prevent duplicate notification on the same calendar day
      const todayDateString = now.toISOString().split('T')[0];
      const lastSentDate = localStorage.getItem('studyflow_last_reminder_date');
      if (lastSentDate === todayDateString) {
        return; // Already sent today
      }

      // Only fire if permission is granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const assignments = getAssignments();
        const exams = getExams();
        const bodyText = buildReminderSummary(assignments, exams);

        await showDirectNotification('StudyFlow — Recordatorio Diario', {
          body: bodyText,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'daily-scheduled-reminder-' + todayDateString,
          url: '/',
        });

        localStorage.setItem('studyflow_last_reminder_date', todayDateString);
        console.log(`[StudyFlow] Scheduled daily reminder emitted for ${todayDateString}`);
      }
    } catch (err) {
      console.warn('[StudyFlow] Error running reminder scheduler check:', err);
    }
  };

  // Run initial check and set interval for every 30 seconds
  checkSchedule();
  const intervalId = window.setInterval(checkSchedule, 30000);

  return () => {
    window.clearInterval(intervalId);
  };
}

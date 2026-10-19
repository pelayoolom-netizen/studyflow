import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './views/DashboardView';
import { AssignmentsView } from './views/AssignmentsView';
import { CalendarView } from './views/CalendarView';
import { SubjectsView } from './views/SubjectsView';
import { ExamsView } from './views/ExamsView';
import { StudyTimerView } from './views/StudyTimerView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import {
  ActiveTab,
  Subject,
  Assignment,
  Exam,
  StudySession,
  AcademicPeriod,
  UserProfile,
} from './types';
import { dataService, SyncState } from './lib/storage';
import { getSupabaseClient } from './lib/supabase';
import { registerServiceWorker } from './lib/pushNotifications';
import { startReminderEngine } from './lib/reminderScheduler';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [syncState, setSyncState] = useState<SyncState>('local');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Core Data Collections
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    id: 'local',
    full_name: 'Estudiante',
    daily_study_goal_minutes: 120,
    reminder_time: '15:30',
    reminder_days: [1, 2, 3, 4, 5, 6, 7],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
    theme: 'dark',
    calendar_first_day: 1,
    calendar_default_view: 'month',
    notify_daily_reminder: true,
    notify_upcoming_exams: true,
    notify_due_assignments: true,
    notify_overdue_tasks: true,
    notify_study_sessions: true,
  });

  // Pre-fill states for Timer
  const [timerSubjectId, setTimerSubjectId] = useState<string | undefined>(undefined);
  const [timerAssignmentId, setTimerAssignmentId] = useState<string | undefined>(undefined);

  // Listen to online / offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker on initial load
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Subscribe to sync state changes
  useEffect(() => {
    return dataService.onSyncChange((state) => {
      setSyncState(state);
    });
  }, []);

  // Automated daily reminder scheduler (monitors time, respects timezone, sends real tasks/exams)
  useEffect(() => {
    const cleanup = startReminderEngine(
      () => profile,
      () => assignments,
      () => exams
    );
    return cleanup;
  }, [profile, assignments, exams]);

  // Initial Data Load
  const loadAllData = useCallback(async () => {
    try {
      const [subs, asgs, exs, sess, pers, prof] = await Promise.all([
        dataService.getSubjects(),
        dataService.getAssignments(),
        dataService.getExams(),
        dataService.getStudySessions(),
        dataService.getAcademicPeriods(),
        dataService.getProfile(),
      ]);

      setSubjects(subs);
      setAssignments(asgs);
      setExams(exs);
      setStudySessions(sess);
      setPeriods(pers);
      setProfile(prof);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  }, []);

  // Check Supabase Auth user on mount
  useEffect(() => {
    loadAllData();

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserEmail(data.user.email || null);
          loadAllData();
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email || null);
        loadAllData();
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [loadAllData]);

  // Handlers for Assignments
  const handleSaveAssignment = async (asg: Assignment) => {
    const saved = await dataService.saveAssignment(asg);
    setAssignments((prev) => {
      const index = prev.findIndex((a) => a.id === saved.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    return saved;
  };

  const handleDeleteAssignment = async (id: string) => {
    await dataService.deleteAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleAssignment = async (id: string) => {
    const updated = await dataService.toggleAssignmentStatus(id);
    if (updated) {
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
  };

  // Handlers for Exams
  const handleSaveExam = async (exam: Exam) => {
    const saved = await dataService.saveExam(exam);
    setExams((prev) => {
      const index = prev.findIndex((e) => e.id === saved.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    return saved;
  };

  const handleDeleteExam = async (id: string) => {
    await dataService.deleteExam(id);
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  // Handlers for Subjects
  const handleSaveSubject = async (sub: Subject) => {
    const saved = await dataService.saveSubject(sub);
    setSubjects((prev) => {
      const index = prev.findIndex((s) => s.id === saved.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    return saved;
  };

  const handleDeleteSubject = async (id: string) => {
    await dataService.deleteSubject(id);
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers for Study Sessions
  const handleSaveStudySession = async (session: StudySession) => {
    const saved = await dataService.saveStudySession(session);
    setStudySessions((prev) => [saved, ...prev]);
    return saved;
  };

  // Handlers for Profile
  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    const updated = await dataService.updateProfile(updates);
    setProfile(updated);
    return updated;
  };

  // Quick navigation to Timer with pre-filled subject/assignment
  const handleStartTimer = (subId?: string, asgId?: string) => {
    setTimerSubjectId(subId);
    setTimerAssignmentId(asgId);
    setActiveTab('timer');
  };

  // Compute minutes studied today
  const minutesStudiedToday = useMemo(() => {
    const today = new Date().toDateString();
    return studySessions
      .filter((s) => new Date(s.start_time).toDateString() === today)
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [studySessions]);

  // Pending tasks summary text for Push notification
  const pendingTasksSummary = useMemo(() => {
    const now = new Date();
    const active = assignments.filter((a) => a.status !== 'completado');
    const overdue = active.filter((a) => new Date(a.due_date) < now);
    const dueToday = active.filter((a) => new Date(a.due_date).toDateString() === now.toDateString());

    let text = '';
    if (overdue.length > 0) text += `⚠️ ${overdue.length} deberes atrasados. `;
    if (dueToday.length > 0) text += `📋 ${dueToday.length} para hoy. `;
    if (exams.length > 0) {
      const nextEx = exams.find((e) => new Date(e.exam_date) >= now);
      if (nextEx) text += `🎯 Próximo examen: ${nextEx.name}.`;
    }
    return text || '¡Estás al día! Gran momento para concentrarte con StudyFlow.';
  }, [assignments, exams]);

  return (
    <div className="min-h-screen bg-[#090b0e] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Offline Toast */}
      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500/90 text-black px-4 py-1.5 text-xs font-bold shadow-xl backdrop-blur-xs">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Modo sin conexión activo — Tus cambios se sincronizarán al recuperar la red.</span>
        </div>
      )}

      {/* Navigation (Sidebar desktop + Bottom bar mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncState={syncState}
        minutesStudiedToday={minutesStudiedToday}
        dailyGoalMinutes={profile.daily_study_goal_minutes || 120}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        <Header
          syncState={syncState}
          userEmail={userEmail}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {activeTab === 'dashboard' && (
            <DashboardView
              userName={userEmail ? userEmail.split('@')[0] : profile.full_name}
              assignments={assignments}
              exams={exams}
              subjects={subjects}
              studySessions={studySessions}
              minutesStudiedToday={minutesStudiedToday}
              dailyGoalMinutes={profile.daily_study_goal_minutes || 120}
              onToggleAssignment={handleToggleAssignment}
              onSaveAssignment={handleSaveAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              onSaveExam={handleSaveExam}
              onSaveSubject={handleSaveSubject}
              onOpenNewAssignment={() => setActiveTab('assignments')}
              onOpenNewExam={() => setActiveTab('exams')}
              onStartTimer={handleStartTimer}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'assignments' && (
            <AssignmentsView
              assignments={assignments}
              subjects={subjects}
              onSaveAssignment={handleSaveAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              onToggleAssignment={handleToggleAssignment}
              onStartTimer={handleStartTimer}
              onSaveSubject={handleSaveSubject}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              assignments={assignments}
              exams={exams}
              studySessions={studySessions}
              subjects={subjects}
              onOpenNewAssignment={() => setActiveTab('assignments')}
              onOpenNewExam={() => setActiveTab('exams')}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsView
              subjects={subjects}
              assignments={assignments}
              exams={exams}
              studySessions={studySessions}
              onSaveSubject={handleSaveSubject}
              onDeleteSubject={handleDeleteSubject}
              onOpenNewAssignment={() => setActiveTab('assignments')}
              onOpenNewExam={() => setActiveTab('exams')}
              onStartTimer={handleStartTimer}
            />
          )}

          {activeTab === 'exams' && (
            <ExamsView
              exams={exams}
              subjects={subjects}
              onSaveExam={handleSaveExam}
              onDeleteExam={handleDeleteExam}
              onStartTimer={handleStartTimer}
              onSaveSubject={handleSaveSubject}
            />
          )}

          {activeTab === 'timer' && (
            <StudyTimerView
              subjects={subjects}
              assignments={assignments}
              studySessions={studySessions}
              onSaveSession={handleSaveStudySession}
              initialSubjectId={timerSubjectId}
              initialAssignmentId={timerAssignmentId}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              subjects={subjects}
              assignments={assignments}
              exams={exams}
              studySessions={studySessions}
              periods={periods}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              userEmail={userEmail}
              syncState={syncState}
              onSignOut={() => {
                const client = getSupabaseClient();
                if (client) client.auth.signOut();
                setUserEmail(null);
              }}
              pendingTasksSummary={pendingTasksSummary}
              onResetAllData={async () => {
                await dataService.resetAllData();
                setAssignments([]);
                setExams([]);
                setSubjects([]);
                setStudySessions([]);
              }}
            />
          )}
        </main>
      </div>

      {/* Supabase Authentication & Cloud Setup Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        userEmail={userEmail}
        onOpenSettings={() => {
          setIsAuthOpen(false);
          setActiveTab('settings');
        }}
        onAuthSuccess={(email) => {
          setUserEmail(email);
          loadAllData();
        }}
      />
    </div>
  );
}

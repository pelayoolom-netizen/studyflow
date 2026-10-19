import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  PlusCircle,
  Flame,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Edit3,
  Trash2,
  Play,
  Check,
  X,
  History,
  BookOpen,
  Filter,
  Search,
  CalendarDays,
  Award,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, Exam, Subject, ActiveTab, StudySession, Priority, AssignmentStatus } from '../types';

interface Props {
  userName?: string;
  assignments: Assignment[];
  exams: Exam[];
  subjects: Subject[];
  studySessions?: StudySession[];
  minutesStudiedToday: number;
  dailyGoalMinutes: number;
  onToggleAssignment: (id: string) => Promise<void>;
  onSaveAssignment: (assignment: Assignment) => Promise<Assignment>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onSaveExam: (exam: Exam) => Promise<Exam>;
  onSaveSubject: (subject: Subject) => Promise<Subject>;
  onOpenNewAssignment: () => void;
  onOpenNewExam: () => void;
  onStartTimer: (subjectId?: string, assignmentId?: string) => void;
  onNavigate: (tab: ActiveTab) => void;
}

const PRESET_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f59e0b', // amber
];

export const DashboardView: React.FC<Props> = ({
  userName = 'Estudiante',
  assignments,
  exams,
  subjects,
  studySessions = [],
  minutesStudiedToday,
  dailyGoalMinutes,
  onToggleAssignment,
  onSaveAssignment,
  onDeleteAssignment,
  onSaveExam,
  onSaveSubject,
  onStartTimer,
  onNavigate,
}) => {
  const now = new Date();

  // Dynamic greeting based on current local hour
  const currentHour = now.getHours();
  const greeting =
    currentHour < 13
      ? '¡Buenos días'
      : currentHour < 20
      ? '¡Buenas tardes'
      : '¡Buenas noches';

  // Date formatting in Spanish
  const formattedToday = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const capitalizedToday = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

  // Tab / Filter within task list
  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'upcoming' | 'history'>('today');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // History date selector (default yesterday)
  const defaultYesterday = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }, []);
  const [historyDate, setHistoryDate] = useState<string>(defaultYesterday);

  // Discreet Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3200);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Modal states: Create Task, Edit Task, Create Exam, Delete confirmation
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Assignment | null>(null);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Inline Subject Creator state (inside Task/Exam modal)
  const [showInlineSubjectCreator, setShowInlineSubjectCreator] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(PRESET_COLORS[0]);

  // Task Form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState<string>(subjects[0]?.id || '');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('media');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskEstimatedMinutes, setTaskEstimatedMinutes] = useState(30);

  // Exam Form fields
  const [examName, setExamName] = useState('');
  const [examSubjectId, setExamSubjectId] = useState<string>(subjects[0]?.id || '');
  const [examDate, setExamDate] = useState('');
  const [examPriority, setExamPriority] = useState<Priority>('alta');
  const [examSyllabus, setExamSyllabus] = useState('');
  const [examGrade, setExamGrade] = useState('');

  // Helper date comparisons
  const isSameCalendarDay = (dateStr: string, compareDate: Date) => {
    const d = new Date(dateStr);
    return (
      d.getDate() === compareDate.getDate() &&
      d.getMonth() === compareDate.getMonth() &&
      d.getFullYear() === compareDate.getFullYear()
    );
  };

  const isToday = (dateStr: string) => isSameCalendarDay(dateStr, now);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // 1. TAREAS DE HOY:
  // - Programadas para hoy (completadas o pendientes)
  // - O que se completaron hoy aunque tuvieran otra fecha programada
  const todayAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const dueToday = isToday(a.due_date);
      const completedToday = a.status === 'completado' && a.completed_at && isToday(a.completed_at);
      return dueToday || completedToday;
    });
  }, [assignments, now]);

  const todayCompleted = useMemo(() => {
    return todayAssignments.filter((a) => a.status === 'completado');
  }, [todayAssignments]);

  const todayPending = useMemo(() => {
    return todayAssignments.filter((a) => a.status !== 'completado');
  }, [todayAssignments]);

  // Progreso real de hoy:
  const todayTotalCount = todayAssignments.length;
  const todayCompletedCount = todayCompleted.length;
  const todayProgressPercent = todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;
  const isAllTodayDone = todayTotalCount > 0 && todayPending.length === 0;

  // 2. TAREAS ATRASADAS:
  // Fecha límite menor que el inicio de hoy y NO completadas
  const overdueAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (a.status === 'completado') return false;
      const due = new Date(a.due_date);
      return due < startOfToday;
    });
  }, [assignments, startOfToday]);

  // 3. TAREAS PRÓXIMAS (siguientes días):
  const upcomingAssignments = useMemo(() => {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return assignments
      .filter((a) => {
        if (a.status === 'completado') return false;
        const due = new Date(a.due_date);
        return due > endOfToday;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [assignments, now]);

  // 4. HISTORIAL DE DÍAS ANTERIORES:
  const historyData = useMemo(() => {
    if (!historyDate) return { scheduled: [], completedOnDate: [], sessions: [], examsOnDate: [] };
    const [y, m, d] = historyDate.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);

    // Tareas que vencían en esa fecha
    const scheduled = assignments.filter((a) => isSameCalendarDay(a.due_date, targetDate));
    // Tareas completadas en esa fecha
    const completedOnDate = assignments.filter((a) => a.completed_at && isSameCalendarDay(a.completed_at, targetDate));
    // Sesiones de estudio Pomodoro de esa fecha
    const sessions = studySessions.filter((s) => isSameCalendarDay(s.start_time, targetDate));
    // Exámenes o notas de esa fecha
    const examsOnDate = exams.filter((e) => isSameCalendarDay(e.exam_date, targetDate));

    return {
      scheduled,
      completedOnDate,
      sessions,
      examsOnDate,
    };
  }, [assignments, studySessions, exams, historyDate]);

  // 5. PRÓXIMO EXAMEN:
  const upcomingExams = useMemo(() => {
    return exams
      .filter((e) => new Date(e.exam_date) >= startOfToday && e.status !== 'corregido')
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  }, [exams, startOfToday]);

  const nextExam = upcomingExams[0] || null;

  const getDaysUntil = (dateStr: string) => {
    const target = new Date(dateStr);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días`;
  };

  const getSubject = (subId: string | null) => subjects.find((s) => s.id === subId);

  // Toggle completion with instant feedback
  const handleToggle = async (task: Assignment, e: React.MouseEvent) => {
    e.stopPropagation();
    const willBeCompleted = task.status !== 'completado';
    try {
      await onToggleAssignment(task.id);
      if (willBeCompleted) {
        setToastMessage({ text: '¡Deber completado! Buen trabajo.', type: 'success' });
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#34d399', '#6ee7b7'],
        });
      } else {
        setToastMessage({ text: 'Deber marcado como pendiente.', type: 'info' });
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ text: 'Error al actualizar el estado de la tarea.', type: 'error' });
    }
  };

  // Open Create Task Modal
  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskSubjectId(subjects[0]?.id || '');
    // Default today at 20:00 or tomorrow
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    setTaskDueDate(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
    setTaskPriority('media');
    setTaskEstimatedMinutes(30);
    setShowInlineSubjectCreator(false);
    setIsTaskModalOpen(true);
  };

  // Open Edit Task Modal
  const handleOpenEditTask = (task: Assignment) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskSubjectId(task.subject_id || subjects[0]?.id || '');
    const d = new Date(task.due_date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    setTaskDueDate(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
    setTaskPriority(task.priority);
    setTaskEstimatedMinutes(task.estimated_minutes || 30);
    setShowInlineSubjectCreator(false);
    setIsTaskModalOpen(true);
  };

  // Save Task Form
  const handleSaveTaskForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const payload: Assignment = {
      id: editingTask ? editingTask.id : 'asg-' + Date.now(),
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      subject_id: taskSubjectId || null,
      due_date: new Date(taskDueDate).toISOString(),
      priority: taskPriority,
      status: editingTask ? editingTask.status : 'pendiente',
      estimated_minutes: Number(taskEstimatedMinutes) || 30,
      actual_minutes: editingTask ? editingTask.actual_minutes : 0,
      completed_at: editingTask ? editingTask.completed_at : null,
      created_at: editingTask ? editingTask.created_at : new Date().toISOString(),
    };

    await onSaveAssignment(payload);
    setIsTaskModalOpen(false);
    setToastMessage({
      text: editingTask ? 'Deber actualizado con éxito.' : '¡Nuevo deber añadido!',
      type: 'success',
    });
  };

  // Confirm Delete Task
  const handleExecuteDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await onDeleteAssignment(deletingTaskId);
      setToastMessage({ text: 'Deber eliminado.', type: 'info' });
    } catch (err) {
      console.error(err);
      setToastMessage({ text: 'Error al eliminar el deber.', type: 'error' });
    } finally {
      setDeletingTaskId(null);
    }
  };

  // Open Create Exam Modal
  const handleOpenCreateExam = () => {
    setExamName('');
    setExamSubjectId(subjects[0]?.id || '');
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    inAWeek.setHours(9, 30, 0, 0);
    const tzOffset = inAWeek.getTimezoneOffset() * 60000;
    setExamDate(new Date(inAWeek.getTime() - tzOffset).toISOString().slice(0, 16));
    setExamPriority('alta');
    setExamSyllabus('');
    setExamGrade('');
    setShowInlineSubjectCreator(false);
    setIsExamModalOpen(true);
  };

  // Save Exam Form
  const handleSaveExamForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) return;

    const parsedGrade = examGrade.trim() !== '' ? Number(examGrade) : null;

    const payload: Exam = {
      id: 'ex-' + Date.now(),
      name: examName.trim(),
      subject_id: examSubjectId || null,
      exam_date: new Date(examDate).toISOString(),
      priority: examPriority,
      status: parsedGrade !== null ? 'corregido' : 'pendiente',
      grade: parsedGrade,
      max_grade: 10,
      syllabus: examSyllabus.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    await onSaveExam(payload);
    setIsExamModalOpen(false);
    setToastMessage({ text: '¡Examen añadido al calendario!', type: 'success' });
  };

  // Inline Subject Creator handler
  const handleCreateInlineSubject = async () => {
    if (!newSubjectName.trim()) return;
    const newSub: Subject = {
      id: 'sub-' + Date.now(),
      name: newSubjectName.trim(),
      color: newSubjectColor,
      weekly_goal_minutes: 120,
      created_at: new Date().toISOString(),
    };
    const saved = await onSaveSubject(newSub);
    setTaskSubjectId(saved.id);
    setExamSubjectId(saved.id);
    setNewSubjectName('');
    setShowInlineSubjectCreator(false);
    setToastMessage({ text: `Asignatura «${saved.name}» creada`, type: 'success' });
  };

  // Filter current displayed tasks
  const displayedTasks = useMemo(() => {
    let list: Assignment[] = [];
    if (activeTab === 'today') {
      list = [...todayPending, ...todayCompleted];
    } else if (activeTab === 'overdue') {
      list = overdueAssignments;
    } else if (activeTab === 'upcoming') {
      list = upcomingAssignments;
    }

    return list.filter((task) => {
      if (subjectFilter !== 'all' && task.subject_id !== subjectFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const sub = getSubject(task.subject_id);
        const matchesSub = sub?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSub) return false;
      }
      return true;
    });
  }, [activeTab, todayPending, todayCompleted, overdueAssignments, upcomingAssignments, subjectFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* ---------------------------------------------------- */}
      {/* DISCREET TOAST NOTIFICATION                          */}
      {/* ---------------------------------------------------- */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
              : 'bg-zinc-900/90 text-zinc-200 border-zinc-700/50'
          }`}
        >
          {toastMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. SECCIÓN PRINCIPAL: MI DÍA                        */}
      {/* ---------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121824] via-[#0f141e] to-[#0a0d14] border border-[#1e2738] p-5 md:p-7 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{capitalizedToday}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, <span className="text-emerald-400">{userName}</span>
            </h1>

            <p className="text-xs md:text-sm text-zinc-400 max-w-xl">
              {todayTotalCount === 0 && overdueAssignments.length === 0
                ? '¡Todo despejado! No tienes deberes pendientes para hoy. Puedes avanzar materia o añadir nuevas tareas.'
                : isAllTodayDone
                ? '¡Impresionante! Has terminado todas las tareas programadas para hoy 🎉'
                : `Tienes ${todayPending.length} deber${todayPending.length > 1 ? 'es' : ''} pendiente${todayPending.length > 1 ? 's' : ''} para hoy${
                    overdueAssignments.length > 0 ? ` y ${overdueAssignments.length} atrasado${overdueAssignments.length > 1 ? 's' : ''}` : ''
                  }.`}
            </p>
          </div>

          {/* 3 Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenCreateTask}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Añadir deber</span>
            </button>
            <button
              onClick={handleOpenCreateExam}
              className="px-3.5 py-2.5 rounded-xl bg-[#18202d] hover:bg-[#202b3d] text-zinc-200 border border-[#2a364d] font-semibold text-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Añadir examen</span>
            </button>
            <button
              onClick={() => onStartTimer()}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Iniciar Pomodoro</span>
            </button>
          </div>
        </div>

        {/* Real Dynamic Daily Progress Bar */}
        <div className="mt-6 pt-5 border-t border-[#1b2332]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Progreso de hoy:</span>
              <span className="text-zinc-300 font-medium">
                {todayCompletedCount} de {todayTotalCount} tareas completadas
              </span>
            </div>
            <div className="flex items-center gap-3">
              {overdueAssignments.length > 0 && (
                <span className="text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueAssignments.length} atrasadas
                </span>
              )}
              <span className="text-emerald-400 font-extrabold text-sm">{todayProgressPercent}%</span>
            </div>
          </div>

          <div className="w-full h-3 bg-zinc-800/80 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${todayProgressPercent}%` }}
            />
          </div>

          {/* Celebratory message when all today's tasks are done */}
          {isAllTodayDone && (
            <div className="mt-3 py-2 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-medium">
                ¡Objetivos de hoy completados! Has terminado todos tus deberes previstos.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* RESUMEN DE ESTADO & PRÓXIMO EXAMEN                  */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Tareas Pendientes Hoy */}
        <div
          onClick={() => setActiveTab('today')}
          className={`card-dark rounded-2xl p-4 cursor-pointer transition border hover:border-emerald-500/40 ${
            activeTab === 'today' ? 'border-emerald-500/50 bg-[#121824]' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-zinc-400">Pendientes Hoy</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Circle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{todayPending.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {todayPending.length === 0 ? 'Sin tareas pendientes' : 'Por hacer en este día'}
          </p>
        </div>

        {/* Tareas Completadas Hoy */}
        <div
          onClick={() => setActiveTab('today')}
          className="card-dark rounded-2xl p-4 cursor-pointer transition border hover:border-teal-500/40"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-zinc-400">Completadas Hoy</span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{todayCompletedCount}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {todayTotalCount > 0 ? `${todayProgressPercent}% de la lista de hoy` : '0 terminadas hoy'}
          </p>
        </div>

        {/* Tareas Atrasadas */}
        <div
          onClick={() => setActiveTab('overdue')}
          className={`card-dark rounded-2xl p-4 cursor-pointer transition border ${
            overdueAssignments.length > 0
              ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/60'
              : 'hover:border-zinc-700'
          } ${activeTab === 'overdue' ? 'ring-2 ring-rose-500/40' : ''}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-zinc-400">Atrasadas</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                overdueAssignments.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{overdueAssignments.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {overdueAssignments.length > 0 ? 'Requieren entrega urgente' : 'Sin retrasos'}
          </p>
        </div>

        {/* Próximo Examen */}
        <div
          onClick={() => onNavigate('exams')}
          className="card-dark rounded-2xl p-4 cursor-pointer transition border hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-zinc-400">Próximo Examen</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          {nextExam ? (
            <div>
              <div className="text-sm font-bold text-white truncate" title={nextExam.name}>
                {nextExam.name}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-bold text-amber-400">{getDaysUntil(nextExam.exam_date)}</span>
                <span className="text-[11px] text-zinc-500">
                  {new Date(nextExam.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-xs text-zinc-400">Sin exámenes previstos</span>
              <p className="text-[11px] text-emerald-400 mt-1">¡Horizonte despejado!</p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2 & 3. LISTA INTERACTIVA DE TAREAS (CENTRO DE ATENCIÓN) */}
      {/* ---------------------------------------------------- */}
      <section className="card-dark rounded-3xl p-5 md:p-7 space-y-5 border border-[#1e2738]">
        {/* Header de la lista y pestañas de organización */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1b2332]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-emerald-400" />
              <span>Lista de Deberes</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Marca tus objetivos conforme los completes. Se guardan y calculan en tiempo real.
            </p>
          </div>

          {/* Pestañas de grupo */}
          <div className="flex items-center gap-1 bg-[#121622] p-1 rounded-2xl border border-zinc-800 self-start md:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <span>Para Hoy</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                {todayAssignments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <span>Atrasadas</span>
              {overdueAssignments.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold">
                  {overdueAssignments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'upcoming'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <span>Próximas</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                {upcomingAssignments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial</span>
            </button>
          </div>
        </div>

        {/* Filtros rápidos: Asignatura, Prioridad, Buscador (solo visible si no estamos en Historial) */}
        {activeTab !== 'history' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar en deberes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121622] border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500/50"
              />
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-[#121622] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">Todas las asignaturas</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#121622] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">Todas las prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>

            <button
              onClick={handleOpenCreateTask}
              className="ml-auto px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nuevo deber</span>
            </button>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* VISTA DEL HISTORIAL DE DÍAS ANTERIORES             */}
        {/* -------------------------------------------------- */}
        {activeTab === 'history' ? (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121622] p-3.5 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Consultar Actividad Pasada:</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setHistoryDate(y.toISOString().split('T')[0]);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                    historyDate === defaultYesterday
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Ayer
                </button>
                <input
                  type="date"
                  value={historyDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="bg-[#18202d] border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Resumen del día histórico seleccionado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#121622] rounded-xl p-3 border border-zinc-800 text-center">
                <span className="text-[11px] text-zinc-400">Deberes programados</span>
                <p className="text-lg font-black text-white mt-0.5">{historyData.scheduled.length}</p>
              </div>
              <div className="bg-[#121622] rounded-xl p-3 border border-zinc-800 text-center">
                <span className="text-[11px] text-zinc-400">Completados en esa fecha</span>
                <p className="text-lg font-black text-emerald-400 mt-0.5">{historyData.completedOnDate.length}</p>
              </div>
              <div className="bg-[#121622] rounded-xl p-3 border border-zinc-800 text-center">
                <span className="text-[11px] text-zinc-400">Minutos estudiados</span>
                <p className="text-lg font-black text-teal-400 mt-0.5">
                  {historyData.sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)} min
                </p>
              </div>
            </div>

            {/* Listado de tareas de ese día histórico */}
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
                Deberes asignados para el {historyDate}
              </h4>
              {historyData.scheduled.length === 0 && historyData.completedOnDate.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500 card-dark rounded-xl">
                  No hay registros ni tareas guardadas para esta fecha.
                </div>
              ) : (
                historyData.scheduled.map((task) => {
                  const sub = getSubject(task.subject_id);
                  const isDone = task.status === 'completado';
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl p-3 bg-[#121722] border border-zinc-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {sub && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: `${sub.color}20`, color: sub.color }}
                              >
                                {sub.name}
                              </span>
                            )}
                            <span
                              className={`text-xs font-semibold ${
                                isDone ? 'text-zinc-400 line-through' : 'text-zinc-200'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isDone ? 'Completado' : 'Quedó pendiente'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* -------------------------------------------------- */
          /* LISTA INTERACTIVA DE TAREAS (HOY / ATRASADAS / PRÓXIMAS) */
          /* -------------------------------------------------- */
          <div className="space-y-2.5 pt-1">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl bg-[#121722]/50 border border-zinc-800/80 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {activeTab === 'today'
                    ? '¡No hay deberes pendientes para hoy!'
                    : activeTab === 'overdue'
                    ? '¡Estupendo! No tienes tareas atrasadas'
                    : 'Sin próximas tareas registradas'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {activeTab === 'today'
                    ? 'Estás completamente al día. Puedes registrar una sesión de estudio o añadir nuevos deberes.'
                    : 'Mantén tu ritmo para seguir con tu calendario al día.'}
                </p>
                <button
                  onClick={handleOpenCreateTask}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Añadir nuevo deber
                </button>
              </div>
            ) : (
              displayedTasks.map((task) => {
                const sub = getSubject(task.subject_id);
                const isCompleted = task.status === 'completado';
                const overdue = !isCompleted && new Date(task.due_date) < startOfToday;

                return (
                  <div
                    key={task.id}
                    className={`group rounded-2xl p-3.5 md:p-4 flex items-center justify-between gap-3 border transition-all duration-200 ${
                      isCompleted
                        ? 'bg-[#10141d]/60 border-zinc-800/50 opacity-75'
                        : overdue
                        ? 'bg-[#181116] border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-[#121722] border-[#1d2738] hover:border-emerald-500/30'
                    }`}
                  >
                    {/* Checkbox interactivo de un solo toque */}
                    <button
                      onClick={(e) => handleToggle(task, e)}
                      className="cursor-pointer shrink-0 p-1 -m-1 focus:outline-hidden"
                      title={isCompleted ? 'Desmarcar y volver a pendiente' : 'Marcar como completado'}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform active:scale-90 ${
                          isCompleted
                            ? 'bg-emerald-500 text-black shadow-xs shadow-emerald-500/50'
                            : 'border-2 border-zinc-600 hover:border-emerald-400 text-transparent'
                        }`}
                      >
                        <Check className={`w-4 h-4 stroke-[3] ${isCompleted ? 'block' : 'hidden'}`} />
                      </div>
                    </button>

                    {/* Detalle del deber */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {sub && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${sub.color}20`,
                              color: sub.color,
                            }}
                          >
                            {sub.name}
                          </span>
                        )}

                        {/* Indicador de vencimiento */}
                        <span
                          className={`text-[11px] font-medium flex items-center gap-1 ${
                            isCompleted
                              ? 'text-zinc-500'
                              : overdue
                              ? 'text-rose-400 font-semibold'
                              : 'text-zinc-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {isToday(task.due_date)
                            ? `Hoy ${new Date(task.due_date).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : new Date(task.due_date).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                              })}
                        </span>

                        {/* Prioridad */}
                        {task.priority === 'alta' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/30">
                            Alta
                          </span>
                        )}
                        {task.priority === 'baja' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-zinc-800 text-zinc-400">
                            Baja
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">
                            Completada
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-sm font-semibold truncate transition-all ${
                          isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-100'
                        }`}
                      >
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5 max-w-lg">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Acciones de la tarea */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isCompleted && (
                        <button
                          onClick={() => onStartTimer(task.subject_id || undefined, task.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
                          title="Estudiar con Pomodoro este deber"
                        >
                          <Play className="w-3 h-3 fill-emerald-400" />
                          <span className="hidden sm:inline">Estudiar</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEditTask(task)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                        title="Editar deber"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingTaskId(task.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                        title="Eliminar deber"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREAR / EDITAR DEBER CON CREADOR DE ASIGNATURAS */}
      {/* ---------------------------------------------------- */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0f141e] border border-[#222d3e] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
                {editingTask ? 'Editar Deber' : 'Nuevo Deber'}
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTaskForm} className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Título del deber <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ejercicios tema 4 de Matemáticas"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Asignatura con opción de crear nueva inline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">Asignatura</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineSubjectCreator(!showInlineSubjectCreator)}
                    className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    {showInlineSubjectCreator ? 'Cancelar nueva' : '+ Crear asignatura'}
                  </button>
                </div>

                {showInlineSubjectCreator ? (
                  <div className="p-3 rounded-xl bg-[#141b27] border border-emerald-500/30 space-y-2.5">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva asignatura..."
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="w-full bg-[#1c2433] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">Color:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewSubjectColor(color)}
                            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                              newSubjectColor === color ? 'scale-125 ring-2 ring-white' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateInlineSubject}
                        className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={taskSubjectId}
                    onChange={(e) => setTaskSubjectId(e.target.value)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Sin asignatura específica</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fecha y Hora límite */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Fecha y hora límite</label>
                  <input
                    type="datetime-local"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Prioridad</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Priority)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta (Urgente)</option>
                  </select>
                </div>
              </div>

              {/* Descripción opcional */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Descripción o apuntes (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Detalles de la entrega, páginas del libro o enlaces..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition shadow-lg shadow-emerald-950/60"
                >
                  {editingTask ? 'Guardar Cambios' : 'Crear Deber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREAR EXAMEN                                  */}
      {/* ---------------------------------------------------- */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0f141e] border border-[#222d3e] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Nuevo Examen</h3>
              <button
                onClick={() => setIsExamModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExamForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nombre del examen <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Examen Parcial Temas 1-4"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Asignatura */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">Asignatura</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineSubjectCreator(!showInlineSubjectCreator)}
                    className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    {showInlineSubjectCreator ? 'Cancelar' : '+ Crear asignatura'}
                  </button>
                </div>

                {showInlineSubjectCreator ? (
                  <div className="p-3 rounded-xl bg-[#141b27] border border-emerald-500/30 space-y-2.5">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva asignatura..."
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="w-full bg-[#1c2433] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">Color:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewSubjectColor(color)}
                            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                              newSubjectColor === color ? 'scale-125 ring-2 ring-white' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateInlineSubject}
                        className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={examSubjectId}
                    onChange={(e) => setExamSubjectId(e.target.value)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Sin asignatura específica</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fecha y Prioridad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Prioridad</label>
                  <select
                    value={examPriority}
                    onChange={(e) => setExamPriority(e.target.value as Priority)}
                    className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              {/* Temario / Contenido */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Temario o contenido (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Temas incluidos, fórmulas o conceptos clave..."
                  value={examSyllabus}
                  onChange={(e) => setExamSyllabus(e.target.value)}
                  className="w-full bg-[#18202d] border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition shadow-lg shadow-emerald-950/60"
                >
                  Guardar Examen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* DIÁLOGO DE CONFIRMACIÓN DE BORRADO DE DEBER         */}
      {/* ---------------------------------------------------- */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0f141e] border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">¿Eliminar este deber?</h4>
                <p className="text-xs text-zinc-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteTask}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

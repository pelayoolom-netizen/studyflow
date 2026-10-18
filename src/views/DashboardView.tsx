import React from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, Exam, Subject, ActiveTab } from '../types';

interface Props {
  userName?: string;
  assignments: Assignment[];
  exams: Exam[];
  subjects: Subject[];
  minutesStudiedToday: number;
  dailyGoalMinutes: number;
  onToggleAssignment: (id: string) => Promise<void>;
  onOpenNewAssignment: () => void;
  onOpenNewExam: () => void;
  onStartTimer: (subjectId?: string, assignmentId?: string) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<Props> = ({
  userName = 'Estudiante',
  assignments,
  exams,
  subjects,
  minutesStudiedToday,
  dailyGoalMinutes,
  onToggleAssignment,
  onOpenNewAssignment,
  onOpenNewExam,
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

  // Calculate task classifications
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (status === 'completado') return false;
    return new Date(dateStr) < now && !isToday(dateStr);
  };

  const overdueAssignments = assignments.filter((a) => isOverdue(a.due_date, a.status));
  const dueTodayAssignments = assignments.filter((a) => isToday(a.due_date) && a.status !== 'completado');
  const upcomingAssignments = assignments.filter(
    (a) => new Date(a.due_date) > now && !isToday(a.due_date) && a.status !== 'completado'
  );
  const completedTodayAssignments = assignments.filter((a) => {
    if (a.status !== 'completado' || !a.completed_at) return false;
    return isToday(a.completed_at);
  });

  // Total active tasks
  const pendingTotal = overdueAssignments.length + dueTodayAssignments.length + upcomingAssignments.length;
  const completedTotal = assignments.filter((a) => a.status === 'completado').length;
  const totalTasks = pendingTotal + completedTotal;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTotal / totalTasks) * 100) : 0;

  // Upcoming exams sorting (only future or pending exams)
  const upcomingExams = exams
    .filter((e) => new Date(e.exam_date) >= new Date(now.setHours(0, 0, 0, 0)) && e.status !== 'corregido')
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  const nextExam = upcomingExams[0] || null;

  // Days countdown to next exam
  const getDaysUntil = (dateStr: string) => {
    const target = new Date(dateStr);
    const diffTime = target.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días`;
  };

  // Helper to find subject color & name
  const getSubject = (subId: string | null) => {
    return subjects.find((s) => s.id === subId);
  };

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onToggleAssignment(id);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ---------------------------------------------------- */}
      {/* GREETING & HERO BANNER                                */}
      {/* ---------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121824] via-[#0f141e] to-[#0a0d14] border border-[#1e2738] p-5 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resumen Académico en Tiempo Real</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, <span className="text-emerald-400">{userName}</span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 max-w-xl">
              {totalTasks === 0
                ? '¡Bienvenido a StudyFlow! Tu central académica está lista y limpia. Empieza creando tus asignaturas, deberes o exámenes con los botones rápidos.'
                : pendingTotal === 0
                ? '¡Extraordinario! No tienes tareas pendientes para hoy. Puedes aprovechar para avanzar temario o registrar una sesión de estudio.'
                : `Tienes ${dueTodayAssignments.length} deberes programados para hoy${
                    overdueAssignments.length > 0 ? ` y ${overdueAssignments.length} pendientes con retraso` : ''
                  }.`}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenNewAssignment}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Crear Deber</span>
            </button>
            <button
              onClick={onOpenNewExam}
              className="px-3.5 py-2.5 rounded-xl bg-[#18202d] hover:bg-[#202b3d] text-zinc-200 border border-[#2a364d] font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Añadir Examen</span>
            </button>
            <button
              onClick={() => onStartTimer()}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Sesión Pomodoro</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* PRODUCTIVITY METRICS CARDS                           */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Metas de estudio hoy */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Estudio Hoy</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{minutesStudiedToday}</span>
              <span className="text-xs font-semibold text-zinc-500">/ {dailyGoalMinutes} min</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((minutesStudiedToday / Math.max(1, dailyGoalMinutes)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Tareas completadas */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Completadas</span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{completionPercentage}%</span>
              <span className="text-xs font-semibold text-zinc-500">
                ({completedTotal}/{totalTasks})
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              {completedTodayAssignments.length} finalizadas hoy
            </p>
          </div>
        </div>

        {/* Próximo Examen */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Próximo Examen</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          {nextExam ? (
            <div>
              <div className="text-base md:text-lg font-bold text-white truncate" title={nextExam.name}>
                {nextExam.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-amber-400">
                  {getDaysUntil(nextExam.exam_date)}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {new Date(nextExam.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-xs text-zinc-400">Sin exámenes próximos</span>
              <p className="text-[11px] text-emerald-400 mt-1">¡Todo despejado!</p>
            </div>
          )}
        </div>

        {/* Tareas Atrasadas / Urgencia */}
        <div
          className={`card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between border ${
            overdueAssignments.length > 0 ? 'border-rose-500/40 bg-rose-950/10' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Atrasadas</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                overdueAssignments.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {overdueAssignments.length}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              {overdueAssignments.length > 0 ? 'Requieren atención urgente' : 'Sin retrasos pendientes'}
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAREAS DE HOY & ATRASADAS (SINGLE-TOUCH COMPLETION)  */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Task List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Deberes de Mi Día</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#18202d] text-zinc-300 text-xs font-semibold border border-zinc-800">
                {dueTodayAssignments.length + overdueAssignments.length}
              </span>
            </div>
            <button
              onClick={() => onNavigate('assignments')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Urgent Overdue Section */}
          {overdueAssignments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider px-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Tareas con fecha vencida</span>
              </div>
              <div className="space-y-2">
                {overdueAssignments.map((task) => {
                  const sub = getSubject(task.subject_id);
                  return (
                    <div
                      key={task.id}
                      className="card-dark-hover rounded-xl p-3.5 flex items-center gap-3 border-l-4 border-l-rose-500"
                    >
                      <button
                        onClick={(e) => handleToggle(task.id, e)}
                        className="text-zinc-500 hover:text-emerald-400 transition cursor-pointer shrink-0"
                        title="Marcar como completado"
                      >
                        <Circle className="w-5 h-5 text-rose-400 hover:text-emerald-400" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
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
                          <span className="text-[11px] font-semibold text-rose-400">
                            Venció {new Date(task.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-100 truncate">{task.title}</h4>
                      </div>
                      <button
                        onClick={() => onStartTimer(task.subject_id || undefined, task.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition shrink-0 cursor-pointer"
                        title="Iniciar sesión de estudio para este deber"
                      >
                        Estudiar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Due Today Tasks */}
          <div className="space-y-2">
            {dueTodayAssignments.length === 0 && overdueAssignments.length === 0 ? (
              <div className="card-dark rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {totalTasks === 0 ? 'Sin tareas creadas todavía' : '¡Al día! Todo completado'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {totalTasks === 0
                    ? 'Empieza organizando tu curso añadiendo tu primer deber o entrega pendiente.'
                    : 'No tienes tareas pendientes para hoy. Puedes crear nuevos deberes o repasar tus asignaturas.'}
                </p>
                <button
                  onClick={onOpenNewAssignment}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {totalTasks === 0 ? 'Crear mi primer deber' : 'Añadir un nuevo deber'}
                </button>
              </div>
            ) : (
              dueTodayAssignments.map((task) => {
                const sub = getSubject(task.subject_id);
                return (
                  <div
                    key={task.id}
                    className="card-dark-hover rounded-xl p-3.5 flex items-center gap-3 border-l-4 border-l-emerald-500"
                  >
                    <button
                      onClick={(e) => handleToggle(task.id, e)}
                      className="text-zinc-500 hover:text-emerald-400 transition cursor-pointer shrink-0"
                      title="Marcar como completado"
                    >
                      <Circle className="w-5 h-5 text-zinc-500 hover:text-emerald-400" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
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
                        <span className="text-[11px] font-semibold text-emerald-400">
                          Vence hoy {new Date(task.due_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {task.priority === 'alta' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-300 font-semibold">
                            Alta
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-zinc-100 truncate">{task.title}</h4>
                    </div>
                    <button
                      onClick={() => onStartTimer(task.subject_id || undefined, task.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition shrink-0 cursor-pointer"
                    >
                      Estudiar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side Column: Próximos Exámenes & Avisos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Próximos Exámenes</h2>
            <button
              onClick={() => onNavigate('exams')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingExams.length === 0 ? (
              <div className="card-dark rounded-xl p-5 text-center text-xs text-zinc-400">
                No hay exámenes en el horizonte inmediato.
              </div>
            ) : (
              upcomingExams.slice(0, 3).map((exam) => {
                const sub = getSubject(exam.subject_id);
                return (
                  <div key={exam.id} className="card-dark rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
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
                        <h4 className="text-sm font-bold text-white mt-1">{exam.name}</h4>
                      </div>
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-lg shrink-0">
                        {getDaysUntil(exam.exam_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800">
                      <span>{new Date(exam.exam_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                      {exam.weight_percentage && (
                        <span className="text-emerald-400 font-semibold">{exam.weight_percentage}% de la nota</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Study Prompt Card */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-950/30 to-[#12161f] border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Consejo de Productividad
              </h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Completa bloques de 25 minutos seguidos de 5 de descanso activo. Tu retención a largo plazo aumentará un 40%.
            </p>
            <button
              onClick={() => onStartTimer()}
              className="w-full py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs transition cursor-pointer"
            >
              Iniciar Bloque Pomodoro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

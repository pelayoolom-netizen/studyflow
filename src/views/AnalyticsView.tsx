import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  History,
  BookOpen,
} from 'lucide-react';
import { Assignment, Exam, StudySession, Subject, AcademicPeriod } from '../types';

interface Props {
  subjects: Subject[];
  assignments: Assignment[];
  exams: Exam[];
  studySessions: StudySession[];
  periods: AcademicPeriod[];
}

type AnalyticsScale = 'weekly' | 'monthly' | 'quarterly' | 'history';

export const AnalyticsView: React.FC<Props> = ({
  subjects,
  assignments,
  exams,
  studySessions,
  periods,
}) => {
  const [scale, setScale] = useState<AnalyticsScale>('weekly');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(periods[0]?.id || '');
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  const now = new Date();

  // -----------------------------------------------------------
  // 1. WEEKLY METRICS COMPUTATION (Current 7 days vs Previous 7 days)
  // -----------------------------------------------------------
  const weeklyData = useMemo(() => {
    const curWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const prevWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    const prevWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    // Current week assignments
    const curCreated = assignments.filter((a) => new Date(a.created_at) >= curWeekStart);
    const curCompleted = assignments.filter((a) => a.completed_at && new Date(a.completed_at) >= curWeekStart);
    const curOverdue = assignments.filter((a) => a.status !== 'completado' && new Date(a.due_date) < now);

    // Prev week
    const prevCreated = assignments.filter((a) => {
      const d = new Date(a.created_at);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });
    const prevCompleted = assignments.filter((a) => {
      if (!a.completed_at) return false;
      const d = new Date(a.completed_at);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });

    // Current week study minutes
    const curSessions = studySessions.filter((s) => new Date(s.start_time) >= curWeekStart);
    const curMinutes = curSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

    // Prev week study minutes
    const prevSessions = studySessions.filter((s) => {
      const d = new Date(s.start_time);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });
    const prevMinutes = prevSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

    // Distribution by subject
    const subjectDistribution: { [subId: string]: number } = {};
    curSessions.forEach((s) => {
      const key = s.subject_id || 'general';
      subjectDistribution[key] = (subjectDistribution[key] || 0) + s.duration_minutes;
    });

    // Weekly exams
    const weeklyExams = exams.filter((e) => new Date(e.exam_date) >= curWeekStart && new Date(e.exam_date) <= now);

    const completionRate =
      curCreated.length > 0 ? Math.round((curCompleted.length / curCreated.length) * 100) : 100;

    return {
      created: curCreated.length,
      completed: curCompleted.length,
      overdue: curOverdue.length,
      completionRate,
      studyHours: Number((curMinutes / 60).toFixed(1)),
      studyMinutes: curMinutes,
      prevStudyHours: Number((prevMinutes / 60).toFixed(1)),
      diffHours: Number(((curMinutes - prevMinutes) / 60).toFixed(1)),
      subjectDistribution,
      weeklyExams,
    };
  }, [assignments, studySessions, exams, now]);

  // -----------------------------------------------------------
  // 2. MONTHLY METRICS COMPUTATION (Current 30 days)
  // -----------------------------------------------------------
  const monthlyData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthAssignments = assignments.filter((a) => new Date(a.due_date) >= thirtyDaysAgo);
    const completed = monthAssignments.filter((a) => a.status === 'completado');
    const pending = monthAssignments.filter((a) => a.status !== 'completado');
    const overdue = pending.filter((a) => new Date(a.due_date) < now);

    const monthSessions = studySessions.filter((s) => new Date(s.start_time) >= thirtyDaysAgo);
    const totalMinutes = monthSessions.reduce((acc, s) => acc + s.duration_minutes, 0);

    // Subject averages in this month
    const subjectAverages: { subject: Subject; avg: number; count: number }[] = [];
    subjects.forEach((sub) => {
      const subExams = exams.filter(
        (e) => e.subject_id === sub.id && e.grade !== null && e.grade !== undefined && new Date(e.exam_date) >= thirtyDaysAgo
      );
      if (subExams.length > 0) {
        const sum = subExams.reduce((acc, e) => acc + Number(e.grade), 0);
        subjectAverages.push({
          subject: sub,
          avg: Number((sum / subExams.length).toFixed(2)),
          count: subExams.length,
        });
      }
    });

    return {
      total: monthAssignments.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      studyHours: Number((totalMinutes / 60).toFixed(1)),
      subjectAverages,
    };
  }, [assignments, studySessions, exams, subjects, now]);

  // -----------------------------------------------------------
  // 3. QUARTERLY METRICS COMPUTATION
  // -----------------------------------------------------------
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) || periods[0];

  const quarterlyData = useMemo(() => {
    if (!selectedPeriod) return null;

    const start = new Date(selectedPeriod.start_date);
    const end = new Date(selectedPeriod.end_date);

    const periodAssignments = assignments.filter((a) => {
      const d = new Date(a.due_date);
      return d >= start && d <= end;
    });

    const completed = periodAssignments.filter((a) => a.status === 'completado');
    const uncompleted = periodAssignments.filter((a) => a.status !== 'completado');
    const overdue = uncompleted.filter((a) => new Date(a.due_date) < now);

    const periodExams = exams.filter((e) => {
      const d = new Date(e.exam_date);
      return d >= start && d <= end;
    });
    const gradedExams = periodExams.filter((e) => e.grade !== null && e.grade !== undefined);

    // Study time per subject
    const periodSessions = studySessions.filter((s) => {
      const d = new Date(s.start_time);
      return d >= start && d <= end;
    });
    const subjectMinutesMap: { [id: string]: number } = {};
    periodSessions.forEach((s) => {
      const key = s.subject_id || 'other';
      subjectMinutesMap[key] = (subjectMinutesMap[key] || 0) + s.duration_minutes;
    });

    return {
      periodAssignments,
      completedCount: completed.length,
      uncompletedCount: uncompleted.length,
      overdueCount: overdue.length,
      periodExams,
      gradedCount: gradedExams.length,
      subjectMinutesMap,
    };
  }, [selectedPeriod, assignments, exams, studySessions, now]);

  // -----------------------------------------------------------
  // 4. FULL HISTORY TABLE DATA
  // -----------------------------------------------------------
  const fullHistoryRecords = useMemo(() => {
    interface HistoryItem {
      id: string;
      date: string;
      category: 'deber' | 'examen' | 'sesion';
      title: string;
      subjectId: string | null;
      status: string;
      value?: string;
    }

    const items: HistoryItem[] = [];

    // Assignments
    assignments.forEach((a) => {
      items.push({
        id: a.id,
        date: a.completed_at || a.due_date,
        category: 'deber',
        title: a.title,
        subjectId: a.subject_id,
        status: a.status,
        value: a.estimated_minutes ? `${a.estimated_minutes} min` : undefined,
      });
    });

    // Exams
    exams.forEach((e) => {
      items.push({
        id: e.id,
        date: e.exam_date,
        category: 'examen',
        title: e.name,
        subjectId: e.subject_id,
        status: e.status,
        value: e.grade !== null && e.grade !== undefined ? `Nota: ${Number(e.grade).toFixed(2)}` : 'Sin nota',
      });
    });

    // Sessions
    studySessions.forEach((s) => {
      items.push({
        id: s.id,
        date: s.start_time,
        category: 'sesion',
        title: s.description || 'Sesión de concentración',
        subjectId: s.subject_id,
        status: s.completed ? 'completado' : 'incompleto',
        value: `${s.duration_minutes} min`,
      });
    });

    return items
      .filter((item) => {
        if (historySubjectFilter !== 'all' && item.subjectId !== historySubjectFilter) return false;
        if (historyTypeFilter !== 'all' && item.category !== historyTypeFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [assignments, exams, studySessions, historySubjectFilter, historyTypeFilter]);

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Analíticas de Rendimiento</h1>
          <p className="text-xs text-zinc-400">
            Métricas reales sobre cumplimiento de tareas, distribución del tiempo y evolución de notas.
          </p>
        </div>

        {/* Scale Switcher Tabs */}
        <div className="flex bg-[#141a26] p-1.5 rounded-2xl border border-zinc-800 text-xs font-semibold">
          <button
            onClick={() => setScale('weekly')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              scale === 'weekly' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setScale('monthly')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              scale === 'monthly' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setScale('quarterly')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              scale === 'quarterly' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Trimestral
          </button>
          <button
            onClick={() => setScale('history')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              scale === 'history' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Historial
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. WEEKLY DASHBOARD                                      */}
      {/* ======================================================== */}
      {scale === 'weekly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Cumplimiento Semanal</span>
              <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                {weeklyData.completionRate}%
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {weeklyData.completed} de {weeklyData.created} deberes
              </p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Horas Estudiadas</span>
              <div className="text-2xl md:text-3xl font-black text-white mt-2">
                {weeklyData.studyHours}h
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                {weeklyData.diffHours >= 0 ? (
                  <span className="text-emerald-400 font-semibold">+{weeklyData.diffHours}h vs sem. anterior</span>
                ) : (
                  <span className="text-amber-400 font-semibold">{weeklyData.diffHours}h vs sem. anterior</span>
                )}
              </p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Deberes Atrasados</span>
              <div className="text-2xl md:text-3xl font-black text-rose-400 mt-2">
                {weeklyData.overdue}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Requieren atención urgente</p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Exámenes Realizados</span>
              <div className="text-2xl md:text-3xl font-black text-teal-400 mt-2">
                {weeklyData.weeklyExams.length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Convocatorias evaluadas</p>
            </div>
          </div>

          {/* Time Distribution by Subject */}
          <div className="card-dark rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Distribución del Tiempo de Estudio por Asignatura</span>
            </h3>

            {Object.keys(weeklyData.subjectDistribution).length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                Aún no has registrado sesiones de estudio esta semana.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(weeklyData.subjectDistribution).map(([subId, minutes]) => {
                  const sub = getSubject(subId);
                  const percent = Math.round((minutes / Math.max(1, weeklyData.studyMinutes)) * 100);

                  return (
                    <div key={subId} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-zinc-300">
                        <span className="font-semibold flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: sub?.color || '#10b981' }}
                          />
                          {sub?.name || 'General / Repaso'}
                        </span>
                        <span className="font-bold text-zinc-200">
                          {minutes} min ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: sub?.color || '#10b981',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MONTHLY DASHBOARD                                     */}
      {/* ======================================================== */}
      {scale === 'monthly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Total Deberes del Mes</span>
              <div className="text-2xl md:text-3xl font-black text-white mt-2">
                {monthlyData.total}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {monthlyData.completed} terminados • {monthlyData.pending} activos
              </p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Horas Invertidas</span>
              <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                {monthlyData.studyHours}h
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Tiempo de concentración total</p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Entregas Fuera de Plazo</span>
              <div className="text-2xl md:text-3xl font-black text-rose-400 mt-2">
                {monthlyData.overdue}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Tareas vencidas</p>
            </div>

            <div className="card-dark rounded-2xl p-5">
              <span className="text-xs font-semibold text-zinc-400">Asignaturas Evaluadas</span>
              <div className="text-2xl md:text-3xl font-black text-teal-400 mt-2">
                {monthlyData.subjectAverages.length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Con exámenes en este mes</p>
            </div>
          </div>

          {/* Subject Average Grades in Month */}
          <div className="card-dark rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Media de Notas por Asignatura este Mes</span>
            </h3>

            {monthlyData.subjectAverages.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No hay notas registradas en los últimos 30 días.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthlyData.subjectAverages.map((item) => (
                  <div
                    key={item.subject.id}
                    className="p-4 rounded-xl bg-[#161c28] border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{item.subject.name}</h4>
                      <span className="text-[10px] text-zinc-400">{item.count} examen(es)</span>
                    </div>
                    <span className="text-xl font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {item.avg.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. QUARTERLY DASHBOARD (TRIMESTRAL)                      */}
      {/* ======================================================== */}
      {scale === 'quarterly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Period Selector */}
          <div className="card-dark rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-zinc-400">Seleccionar Trimestre Académico:</span>
            </div>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({new Date(p.start_date).toLocaleDateString('es-ES', { month: 'short' })} — {new Date(p.end_date).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })})
                </option>
              ))}
            </select>
          </div>

          {quarterlyData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="card-dark rounded-2xl p-5">
                  <span className="text-xs font-semibold text-zinc-400">Deberes Completados</span>
                  <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                    {quarterlyData.completedCount}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">en este periodo académico</p>
                </div>

                <div className="card-dark rounded-2xl p-5">
                  <span className="text-xs font-semibold text-zinc-400">Entregas Fuera de Plazo</span>
                  <div className="text-2xl md:text-3xl font-black text-rose-400 mt-2">
                    {quarterlyData.overdueCount}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">No entregados a tiempo</p>
                </div>

                <div className="card-dark rounded-2xl p-5">
                  <span className="text-xs font-semibold text-zinc-400">Exámenes Realizados</span>
                  <div className="text-2xl md:text-3xl font-black text-white mt-2">
                    {quarterlyData.periodExams.length}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {quarterlyData.gradedCount} con calificación
                  </p>
                </div>

                <div className="card-dark rounded-2xl p-5">
                  <span className="text-xs font-semibold text-zinc-400">Cumplimiento Global</span>
                  <div className="text-2xl md:text-3xl font-black text-teal-400 mt-2">
                    {quarterlyData.periodAssignments.length > 0
                      ? Math.round(
                          (quarterlyData.completedCount / quarterlyData.periodAssignments.length) * 100
                        )
                      : 100}
                    %
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">Objetivo del trimestre</p>
                </div>
              </div>

              {/* Study time by subject in this period */}
              <div className="card-dark rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Tiempo Dedicado a Cada Asignatura en el Trimestre</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map((sub) => {
                    const min = quarterlyData.subjectMinutesMap[sub.id] || 0;
                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl bg-[#161c28] border border-zinc-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color }}
                          />
                          <span className="text-xs font-bold text-white">{sub.name}</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">
                          {Math.floor(min / 60)}h {min % 60}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. FULL HISTORY TABLE                                    */}
      {/* ======================================================== */}
      {scale === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* History Filters */}
          <div className="card-dark rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={historySubjectFilter}
                onChange={(e) => setHistorySubjectFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">Todas las Asignaturas</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">Todos los Registros</option>
                <option value="deber">Deberes</option>
                <option value="examen">Exámenes</option>
                <option value="sesion">Sesiones de Estudio</option>
              </select>
            </div>

            <span className="text-xs text-zinc-400 self-end sm:self-center">
              {fullHistoryRecords.length} registros encontrados
            </span>
          </div>

          {/* Table */}
          <div className="card-dark rounded-2xl overflow-hidden border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161c28] text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Título / Actividad</th>
                    <th className="py-3 px-4">Asignatura</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {fullHistoryRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No hay registros que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    fullHistoryRecords.map((item) => {
                      const sub = getSubject(item.subjectId);
                      return (
                        <tr key={item.id} className="hover:bg-[#141924] transition">
                          <td className="py-3 px-4 text-zinc-300 font-medium whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                item.category === 'examen'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : item.category === 'deber'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-teal-500/15 text-teal-300'
                              }`}
                            >
                              {item.category === 'examen'
                                ? 'Examen'
                                : item.category === 'deber'
                                ? 'Deber'
                                : 'Sesión'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-white max-w-xs truncate">
                            {item.title}
                          </td>
                          <td className="py-3 px-4">
                            {sub ? (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: `${sub.color}20`, color: sub.color }}
                              >
                                {sub.name}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">General</span>
                            )}
                          </td>
                          <td className="py-3 px-4 capitalize text-zinc-400">
                            {item.status}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-zinc-200">
                            {item.value || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

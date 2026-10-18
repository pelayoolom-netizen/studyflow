import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
  GraduationCap,
  Clock,
  Plus,
  Filter,
} from 'lucide-react';
import { Assignment, Exam, StudySession, Subject } from '../types';

interface Props {
  assignments: Assignment[];
  exams: Exam[];
  studySessions: StudySession[];
  subjects: Subject[];
  onOpenNewAssignment: (initialDate?: string) => void;
  onOpenNewExam: (initialDate?: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  type: 'exam' | 'assignment' | 'session';
  title: string;
  date: Date;
  subjectId: string | null;
  status?: string;
  meta?: any;
}

export const CalendarView: React.FC<Props> = ({
  assignments,
  exams,
  studySessions,
  subjects,
  onOpenNewAssignment,
  onOpenNewExam,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeModalEvent, setActiveModalEvent] = useState<CalendarEvent | null>(null);

  // Helper to format date without timezone shifts
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  // Build unified calendar events list
  const allEvents: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];

    // Exams
    exams.forEach((ex) => {
      list.push({
        id: ex.id,
        type: 'exam',
        title: `Examen: ${ex.name}`,
        date: new Date(ex.exam_date),
        subjectId: ex.subject_id,
        status: ex.status,
        meta: ex,
      });
    });

    // Assignments
    assignments.forEach((asg) => {
      list.push({
        id: asg.id,
        type: 'assignment',
        title: `Entrega: ${asg.title}`,
        date: new Date(asg.due_date),
        subjectId: asg.subject_id,
        status: asg.status,
        meta: asg,
      });
    });

    // Study sessions
    studySessions.forEach((ses) => {
      list.push({
        id: ses.id,
        type: 'session',
        title: `Sesión Pomodoro (${ses.duration_minutes} min)`,
        date: new Date(ses.start_time),
        subjectId: ses.subject_id,
        status: ses.completed ? 'completado' : 'en_progreso',
        meta: ses,
      });
    });

    return list;
  }, [assignments, exams, studySessions]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterSubject !== 'all' && ev.subjectId !== filterSubject) return false;
      if (filterType !== 'all' && ev.type !== filterType) return false;
      return true;
    });
  }, [allEvents, filterSubject, filterType]);

  // Next 7 days events summary
  const next7DaysEvents = useMemo(() => {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 7);

    return filteredEvents
      .filter((ev) => ev.date >= now && ev.date <= future)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents]);

  // Events for currently selected day
  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter((ev) => isSameDay(ev.date, selectedDay))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents, selectedDay]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today);
  };

  // Month calendar grid computation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Spanish: Monday is 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Preceding month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Trailing month padding to fill complete grid of 35 or 42
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Helper for subject
  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentDate);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Calendario Académico</h1>
          <p className="text-xs text-zinc-400">
            Vista unificada de exámenes, entregas, sesiones de concentración y fechas límite.
          </p>
        </div>

        {/* View Mode Switcher and Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-[#141a26] p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Día
            </button>
          </div>

          <button
            onClick={() => onOpenNewAssignment(selectedDay.toISOString().split('T')[0])}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Evento</span>
          </button>
        </div>
      </div>

      {/* Filter and Month Navigation Bar */}
      <div className="card-dark rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation & Month Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#161c28] p-1 rounded-xl border border-zinc-800">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition cursor-pointer"
            >
              Hoy
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-white capitalize">{monthName}</h2>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Filter by Subject */}
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todas las asignaturas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Filter by Event Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todos los tipos</option>
            <option value="exam">🎯 Exámenes</option>
            <option value="assignment">📋 Deberes</option>
            <option value="session">⏱️ Sesiones</option>
          </select>
        </div>
      </div>

      {/* Main Calendar View Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Monthly Grid (3 cols) */}
        <div className="lg:col-span-3 card-dark rounded-2xl p-4 md:p-6 space-y-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-800">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mié</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sáb</span>
            <span>Dom</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {monthDays.map((item, idx) => {
              const dayDate = item.date;
              const isSelected = isSameDay(dayDate, selectedDay);
              const isToday = isSameDay(dayDate, new Date());
              const dayEvents = filteredEvents.filter((ev) => isSameDay(ev.date, dayDate));

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(dayDate)}
                  className={`min-h-[76px] md:min-h-[96px] p-1.5 md:p-2 rounded-xl transition cursor-pointer flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-[#182130] border-emerald-500 shadow-md shadow-emerald-950/40'
                      : item.isCurrentMonth
                      ? 'bg-[#121620] border-zinc-800/80 hover:bg-[#161c28]'
                      : 'bg-[#0d1017]/60 border-zinc-900 text-zinc-600'
                  }`}
                >
                  {/* Day number header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-emerald-500 text-black font-extrabold'
                          : isSelected
                          ? 'text-emerald-400'
                          : item.isCurrentMonth
                          ? 'text-zinc-300'
                          : 'text-zinc-600'
                      }`}
                    >
                      {dayDate.getDate()}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-zinc-400">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events preview badges */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const sub = getSubject(ev.subjectId);
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModalEvent(ev);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium flex items-center gap-1 ${
                            ev.type === 'exam'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : ev.type === 'assignment'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-teal-500/15 text-teal-300'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.color || '#10b981' }}
                          />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-zinc-500 font-bold block px-1">
                        +{dayEvents.length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Selected Day Details & Next 7 Days (1 col) */}
        <div className="space-y-6">
          {/* Selected Day Agenda */}
          <div className="card-dark rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Día Seleccionado
                </span>
                <h3 className="text-sm font-bold text-white capitalize">
                  {selectedDay.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
              </div>
              <button
                onClick={() => onOpenNewAssignment(selectedDay.toISOString().split('T')[0])}
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition cursor-pointer"
                title="Añadir evento a este día"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 space-y-2">
                  <CalendarIcon className="w-6 h-6 mx-auto text-zinc-600" />
                  <p>Sin eventos programados para este día.</p>
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const sub = getSubject(ev.subjectId);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setActiveModalEvent(ev)}
                      className="p-3 rounded-xl bg-[#161c28] border border-zinc-800 hover:border-zinc-700 transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
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
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {ev.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white leading-snug">{ev.title}</h4>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Next 7 Days Horizon */}
          <div className="card-dark rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Próximos 7 Días</span>
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {next7DaysEvents.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">No hay compromisos en los siguientes 7 días.</p>
              ) : (
                next7DaysEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setActiveModalEvent(ev)}
                    className="p-2.5 rounded-xl bg-[#141924] border border-zinc-800/80 hover:border-zinc-700 text-xs flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="truncate flex-1">
                      <p className="font-semibold text-zinc-200 truncate">{ev.title}</p>
                      <span className="text-[11px] text-zinc-500">
                        {ev.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        ev.type === 'exam'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {ev.type === 'exam' ? 'Examen' : 'Deber'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {activeModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl relative text-zinc-200 space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  activeModalEvent.type === 'exam'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {activeModalEvent.type === 'exam'
                  ? 'Examen Académico'
                  : activeModalEvent.type === 'assignment'
                  ? 'Deber / Entrega'
                  : 'Sesión de Estudio'}
              </span>
              <span className="text-xs text-zinc-400">
                {activeModalEvent.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white">{activeModalEvent.title}</h3>

            {activeModalEvent.meta?.description && (
              <p className="text-xs text-zinc-300 bg-[#161c28] p-3 rounded-xl border border-zinc-800 leading-relaxed">
                {activeModalEvent.meta.description}
              </p>
            )}

            {activeModalEvent.meta?.syllabus && (
              <div className="bg-[#161c28] p-3 rounded-xl border border-zinc-800 text-xs space-y-1">
                <span className="font-bold text-zinc-400">Temario:</span>
                <p className="text-zinc-300">{activeModalEvent.meta.syllabus}</p>
              </div>
            )}

            <button
              onClick={() => setActiveModalEvent(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

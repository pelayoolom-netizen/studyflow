import React, { useState } from 'react';
import {
  Plus,
  BookOpen,
  User,
  Clock,
  GraduationCap,
  CheckSquare,
  Edit3,
  Trash2,
  X,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { Subject, Assignment, Exam, StudySession } from '../types';

interface Props {
  subjects: Subject[];
  assignments: Assignment[];
  exams: Exam[];
  studySessions: StudySession[];
  onSaveSubject: (subject: Subject) => Promise<Subject>;
  onDeleteSubject: (id: string) => Promise<void>;
  onOpenNewAssignment: (subjectId?: string) => void;
  onOpenNewExam: (subjectId?: string) => void;
  onStartTimer: (subjectId?: string) => void;
}

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const SubjectsView: React.FC<Props> = ({
  subjects,
  assignments,
  exams,
  studySessions,
  onSaveSubject,
  onDeleteSubject,
  onOpenNewAssignment,
  onOpenNewExam,
  onStartTimer,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [teacher, setTeacher] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState(180);
  const [notes, setNotes] = useState('');

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setName('');
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setTeacher('');
    setWeeklyGoal(180);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setName(sub.name);
    setColor(sub.color);
    setTeacher(sub.teacher || '');
    setWeeklyGoal(sub.weekly_goal_minutes || 180);
    setNotes(sub.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Subject = {
      id: editingSubject ? editingSubject.id : 'sub-' + Date.now(),
      name: name.trim(),
      color,
      teacher: teacher.trim() || undefined,
      weekly_goal_minutes: Number(weeklyGoal) || 180,
      notes: notes.trim() || undefined,
      created_at: editingSubject ? editingSubject.created_at : new Date().toISOString(),
    };

    await onSaveSubject(payload);
    setIsModalOpen(false);
  };

  const currentDetailSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Detail view computations
  const detailAssignments = assignments.filter((a) => a.subject_id === selectedSubjectId);
  const detailExams = exams.filter((e) => e.subject_id === selectedSubjectId);
  const detailSessions = studySessions.filter((s) => s.subject_id === selectedSubjectId);
  const totalStudyMinutes = detailSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  // Subject Grades Average (weighted if weights exist, otherwise arithmetic)
  const gradedExams = detailExams.filter((e) => e.grade !== null && e.grade !== undefined);
  let averageGrade: number | null = null;
  let isWeighted = false;

  if (gradedExams.length > 0) {
    const withWeights = gradedExams.filter((e) => e.weight_percentage && e.weight_percentage > 0);
    if (withWeights.length === gradedExams.length) {
      // All graded have weights
      const totalWeight = withWeights.reduce((acc, e) => acc + (e.weight_percentage || 0), 0);
      if (totalWeight > 0) {
        const weightedSum = withWeights.reduce(
          (acc, e) => acc + (Number(e.grade) * Number(e.weight_percentage)),
          0
        );
        averageGrade = Number((weightedSum / totalWeight).toFixed(2));
        isWeighted = true;
      }
    }
    if (averageGrade === null) {
      const sum = gradedExams.reduce((acc, e) => acc + Number(e.grade), 0);
      averageGrade = Number((sum / gradedExams.length).toFixed(2));
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* If single subject detail view is open */}
      {currentDetailSubject ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Detail Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => setSelectedSubjectId(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a todas las asignaturas</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStartTimer(currentDetailSubject.id)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Estudiar {currentDetailSubject.name}</span>
              </button>
              <button
                onClick={() => handleOpenEdit(currentDetailSubject)}
                className="p-2 rounded-xl bg-[#141a26] text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer"
                title="Editar asignatura"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subject Hero Card */}
          <div
            className="rounded-2xl p-6 md:p-8 border relative overflow-hidden"
            style={{
              backgroundColor: '#121620',
              borderColor: `${currentDetailSubject.color}40`,
            }}
          >
            <div
              className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: currentDetailSubject.color }}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: currentDetailSubject.color }}
                  />
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    {currentDetailSubject.name}
                  </h1>
                </div>
                {currentDetailSubject.teacher && (
                  <p className="text-xs text-zinc-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Docente: {currentDetailSubject.teacher}</span>
                  </p>
                )}
                {currentDetailSubject.notes && (
                  <p className="text-xs text-zinc-400 max-w-xl pt-1">
                    {currentDetailSubject.notes}
                  </p>
                )}
              </div>

              {/* Stats pill cluster */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#181f2c] p-3.5 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Nota Media</span>
                  <span className="text-xl font-black text-emerald-400">
                    {averageGrade !== null ? averageGrade.toFixed(2) : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    {isWeighted ? 'Media ponderada' : 'Aritmética'}
                  </span>
                </div>

                <div className="bg-[#181f2c] p-3.5 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Tiempo Total</span>
                  <span className="text-xl font-black text-teal-400">{totalStudyMinutes}</span>
                  <span className="text-[9px] text-zinc-500 block">minutos de estudio</span>
                </div>

                <div className="bg-[#181f2c] p-3.5 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Meta Semanal</span>
                  <span className="text-xl font-black text-amber-400">
                    {currentDetailSubject.weekly_goal_minutes}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">min / semana</span>
                </div>
              </div>
            </div>
          </div>

          {/* Associated Content: Homework & Exams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Homework for this subject */}
            <div className="card-dark rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Deberes de la Asignatura</span>
                </h3>
                <button
                  onClick={() => onOpenNewAssignment(currentDetailSubject.id)}
                  className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir deber
                </button>
              </div>

              <div className="space-y-2">
                {detailAssignments.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Sin deberes registrados para esta asignatura.</p>
                ) : (
                  detailAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-[#161c28] border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate">
                        <p className={`font-semibold ${a.status === 'completado' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {a.title}
                        </p>
                        <span className="text-[11px] text-zinc-400">
                          Límite: {new Date(a.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          a.status === 'completado'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Exams for this subject */}
            <div className="card-dark rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span>Exámenes y Calificaciones</span>
                </h3>
                <button
                  onClick={() => onOpenNewExam(currentDetailSubject.id)}
                  className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir examen
                </button>
              </div>

              <div className="space-y-2">
                {detailExams.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Sin exámenes registrados.</p>
                ) : (
                  detailExams.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl bg-[#161c28] border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-zinc-200">{e.name}</p>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(e.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          {e.weight_percentage ? ` • Ponderación: ${e.weight_percentage}%` : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        {e.grade !== null && e.grade !== undefined ? (
                          <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {Number(e.grade).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500 font-medium italic">Pendiente</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Grid of all subjects */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Mis Asignaturas</h1>
              <p className="text-xs text-zinc-400">
                Estructura tu plan de estudios con metas semanales, seguimiento de exámenes y notas.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 self-start cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Asignatura</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => {
              const subAssignments = assignments.filter((a) => a.subject_id === sub.id);
              const pendingAsgCount = subAssignments.filter((a) => a.status !== 'completado').length;
              const subExams = exams.filter((e) => e.subject_id === sub.id);
              const upcomingExam = subExams.find((e) => new Date(e.exam_date) >= new Date() && e.status !== 'corregido');

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className="card-dark-hover rounded-2xl p-5 border-t-4 transition cursor-pointer space-y-4 flex flex-col justify-between"
                  style={{ borderTopColor: sub.color }}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-white tracking-tight">{sub.name}</h3>
                        {sub.teacher && (
                          <p className="text-xs text-zinc-400 flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-500" />
                            <span>{sub.teacher}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEdit(sub)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(sub.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {sub.notes && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{sub.notes}</p>
                    )}
                  </div>

                  {/* Summary indicators */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pendingAsgCount} deberes pendientes</span>
                    </span>

                    {upcomingExam ? (
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <Calendar className="w-3 h-3" />
                        <span>Examen {new Date(upcomingExam.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500 font-medium">{sub.weekly_goal_minutes} min/sem</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl text-zinc-200 space-y-4">
            <h3 className="text-base font-bold text-white">¿Eliminar esta asignatura?</h3>
            <p className="text-xs text-zinc-400">
              Las tareas y exámenes asociados no se borrarán pero quedarán sin materia asignada.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onDeleteSubject(deletingId);
                  if (selectedSubjectId === deletingId) setSelectedSubjectId(null);
                  setDeletingId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl relative text-zinc-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white">
              {editingSubject ? 'Editar Asignatura' : 'Nueva Asignatura'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Nombre de la asignatura *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Biología Celular"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Color distintivo
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                        color === c ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Profesor / Docente (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dra. Alicia Martínez"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Objetivo semanal de estudio (minutos)
                </label>
                <input
                  type="number"
                  min="30"
                  step="15"
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Notas personales
                </label>
                <textarea
                  rows={2}
                  placeholder="Criterios de evaluación, aula, temario..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition cursor-pointer"
                >
                  {editingSubject ? 'Guardar Cambios' : 'Crear Asignatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

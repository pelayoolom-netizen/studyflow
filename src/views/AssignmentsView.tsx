import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Copy,
  Trash2,
  Edit3,
  Calendar,
  AlertTriangle,
  History,
  X,
  Play,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, Priority, AssignmentStatus, Subject, Exam } from '../types';
import { VoiceAssistantModal } from '../components/VoiceAssistantModal';

interface Props {
  assignments: Assignment[];
  subjects: Subject[];
  onSaveAssignment: (assignment: Assignment) => Promise<Assignment>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onToggleAssignment: (id: string) => Promise<void>;
  onStartTimer: (subjectId?: string, assignmentId?: string) => void;
  openCreateModalDirectly?: boolean;
  onSaveSubject?: (subject: Subject) => Promise<Subject>;
  onSaveExam?: (exam: Exam) => Promise<Exam>;
}

export const AssignmentsView: React.FC<Props> = ({
  assignments,
  subjects,
  onSaveAssignment,
  onDeleteAssignment,
  onToggleAssignment,
  onStartTimer,
  onSaveSubject,
  onSaveExam,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active'); // 'all', 'active', 'pendiente', 'en_progreso', 'completado', 'atrasadas'
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Edit / Create modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubjectId, setFormSubjectId] = useState<string>(subjects[0]?.id || '');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>('media');
  const [formStatus, setFormStatus] = useState<AssignmentStatus>('pendiente');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState(30);
  const [formActualMinutes, setFormActualMinutes] = useState(0);
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline Subject Creator state
  const [showInlineSubjectCreator, setShowInlineSubjectCreator] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#10b981');

  const now = new Date();

  // Helper for overdue check
  const isOverdue = (dateStr: string, status: string) => {
    if (status === 'completado') return false;
    return new Date(dateStr) < now;
  };

  // Open modal for new assignment
  const handleOpenNew = () => {
    setEditingAssignment(null);
    setFormTitle('');
    setFormDescription('');
    setFormSubjectId(subjects[0]?.id || '');
    // Default tomorrow at 18:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    // Format for datetime-local: YYYY-MM-DDTHH:mm
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setFormDueDate(localISOTime);
    setFormPriority('media');
    setFormStatus('pendiente');
    setFormEstimatedMinutes(30);
    setFormActualMinutes(0);
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (asg: Assignment) => {
    setEditingAssignment(asg);
    setFormTitle(asg.title);
    setFormDescription(asg.description || '');
    setFormSubjectId(asg.subject_id || subjects[0]?.id || '');
    const d = new Date(asg.due_date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setFormDueDate(localISOTime);
    setFormPriority(asg.priority);
    setFormStatus(asg.status);
    setFormEstimatedMinutes(asg.estimated_minutes || 30);
    setFormActualMinutes(asg.actual_minutes || 0);
    setFormNotes(asg.notes || '');
    setIsModalOpen(true);
  };

  // Duplicate an assignment
  const handleDuplicate = async (asg: Assignment) => {
    const duplicated: Assignment = {
      ...asg,
      id: 'asg-' + Date.now(),
      title: `${asg.title} (Copia)`,
      status: 'pendiente',
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    await onSaveAssignment(duplicated);
  };

  // Form submit
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const payload: Assignment = {
      id: editingAssignment ? editingAssignment.id : 'asg-' + Date.now(),
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      subject_id: formSubjectId || null,
      due_date: new Date(formDueDate).toISOString(),
      priority: formPriority,
      status: formStatus,
      estimated_minutes: Number(formEstimatedMinutes) || 30,
      actual_minutes: Number(formActualMinutes) || 0,
      completed_at: formStatus === 'completado' ? (editingAssignment?.completed_at || new Date().toISOString()) : null,
      notes: formNotes.trim() || undefined,
      created_at: editingAssignment ? editingAssignment.created_at : new Date().toISOString(),
    };

    await onSaveAssignment(payload);
    setIsModalOpen(false);
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((asg) => {
      // Search
      if (searchTerm && !asg.title.toLowerCase().includes(searchTerm.toLowerCase()) && !asg.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Subject
      if (selectedSubject !== 'all' && asg.subject_id !== selectedSubject) {
        return false;
      }
      // Priority
      if (selectedPriority !== 'all' && asg.priority !== selectedPriority) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'active') {
        return asg.status !== 'completado';
      }
      if (selectedStatus === 'completado') {
        return asg.status === 'completado';
      }
      if (selectedStatus === 'atrasadas') {
        return isOverdue(asg.due_date, asg.status);
      }
      if (selectedStatus === 'pendiente' || selectedStatus === 'en_progreso') {
        return asg.status === selectedStatus;
      }
      return true;
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [assignments, searchTerm, selectedSubject, selectedStatus, selectedPriority]);

  // Statistics for created vs completed by day (last 7 days)
  const dayStats = useMemo(() => {
    const stats: { dateStr: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toDateString();
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

      const createdCount = assignments.filter((a) => new Date(a.created_at).toDateString() === dateKey).length;
      const completedCount = assignments.filter((a) => a.completed_at && new Date(a.completed_at).toDateString() === dateKey).length;
      stats.push({ dateStr: label, created: createdCount, completed: completedCount });
    }
    return stats;
  }, [assignments]);

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Gestión de Deberes</h1>
          <p className="text-xs text-zinc-400">
            Control integral de tareas, boletos de ejercicios y entregas con estimación de tiempo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-950/60 flex items-center gap-2 cursor-pointer border border-indigo-400/40"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Añadir con IA 🎙️</span>
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
              showHistory
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#141a26] text-zinc-300 border-zinc-800 hover:bg-[#1b2333]'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>{showHistory ? 'Ocultar Histórico' : 'Métricas Diarias'}</span>
          </button>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Deber</span>
          </button>
        </div>
      </div>

      {/* Histórico Diario de Deberes Creados vs Completados */}
      {showHistory && (
        <div className="card-dark rounded-2xl p-5 border border-emerald-500/20 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Balance de Deberes: Creados vs Completados (Últimos 7 días)</span>
            </h3>
            <span className="text-xs text-zinc-400">Datos reales calculados de la base de datos</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2">
            {dayStats.map((stat, idx) => (
              <div key={idx} className="bg-[#161c28] p-3 rounded-xl text-center space-y-1.5 border border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 capitalize block">{stat.dateStr}</span>
                <div className="flex justify-center items-center gap-2 text-xs font-bold">
                  <span className="text-amber-400" title="Deberes creados">+{stat.created}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-emerald-400" title="Deberes completados">✓{stat.completed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card-dark rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search text */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por título o contenido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 appearance-none cursor-pointer"
            >
              <option value="all">Todas las Asignaturas</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 appearance-none cursor-pointer"
            >
              <option value="active">Pendientes y En Progreso</option>
              <option value="atrasadas">⚠️ Solo Atrasadas</option>
              <option value="completado">✓ Solo Completadas</option>
              <option value="all">Todos los Estados</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 appearance-none cursor-pointer"
            >
              <option value="all">Todas las Prioridades</option>
              <option value="alta">Prioridad Alta</option>
              <option value="media">Prioridad Media</option>
              <option value="baja">Prioridad Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignment List */}
      <div className="space-y-3">
        {filteredAssignments.length === 0 ? (
          <div className="card-dark rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 mx-auto flex items-center justify-center">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No hay deberes con los filtros actuales</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Prueba a cambiar los criterios de búsqueda o crea un nuevo deber.
            </p>
            <button
              onClick={handleOpenNew}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Crear nuevo deber
            </button>
          </div>
        ) : (
          filteredAssignments.map((asg) => {
            const sub = getSubject(asg.subject_id);
            const overdue = isOverdue(asg.due_date, asg.status);
            const isCompleted = asg.status === 'completado';

            return (
              <div
                key={asg.id}
                className={`card-dark-hover rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${
                  isCompleted
                    ? 'border-l-zinc-600 opacity-65 bg-[#0f121a]'
                    : overdue
                    ? 'border-l-rose-500 bg-rose-950/10'
                    : 'border-l-emerald-500'
                }`}
              >
                {/* Left: Complete toggle + Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={async () => {
                      await onToggleAssignment(asg.id);
                      if (!isCompleted) {
                        confetti({
                          particleCount: 35,
                          spread: 50,
                          origin: { y: 0.8 },
                        });
                      }
                    }}
                    className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition cursor-pointer shrink-0"
                    title={isCompleted ? 'Desmarcar deber' : 'Marcar como completado'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : overdue ? (
                      <Circle className="w-6 h-6 text-rose-400 hover:text-emerald-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-zinc-500 hover:text-emerald-400" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {sub && (
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${sub.color}20`,
                            color: sub.color,
                          }}
                        >
                          {sub.name}
                        </span>
                      )}

                      {/* Status indicator badge */}
                      {isCompleted ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300">
                          Completado
                        </span>
                      ) : overdue ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Atrasado
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                          {asg.status === 'en_progreso' ? 'En progreso' : 'Pendiente'}
                        </span>
                      )}

                      {/* Priority badge */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          asg.priority === 'alta'
                            ? 'bg-rose-500/15 text-rose-400'
                            : asg.priority === 'media'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {asg.priority}
                      </span>
                    </div>

                    <h3
                      className={`text-base font-bold text-white tracking-tight ${
                        isCompleted ? 'line-through text-zinc-400' : ''
                      }`}
                    >
                      {asg.title}
                    </h3>

                    {asg.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{asg.description}</p>
                    )}

                    {/* Metadata footer */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          Límite: {new Date(asg.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las {new Date(asg.due_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>

                      {asg.estimated_minutes > 0 && (
                        <span>Est: ~{asg.estimated_minutes} min</span>
                      )}

                      {asg.completed_at && (
                        <span className="text-emerald-400/90">
                          Terminado: {new Date(asg.completed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 md:self-center shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-800">
                  {!isCompleted && (
                    <button
                      onClick={() => onStartTimer(asg.subject_id || undefined, asg.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Comenzar estudio con temporizador"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Estudiar</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(asg)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    title="Duplicar deber"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(asg)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    title="Editar deber"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingId(asg.id)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl text-zinc-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">¿Eliminar este deber?</h3>
            <p className="text-xs text-zinc-400">
              Esta acción no se puede deshacer y se eliminará de tus registros en la nube.
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
                  await onDeleteAssignment(deletingId);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl relative text-zinc-200 animate-in fade-in zoom-in duration-200 my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {editingAssignment ? 'Editar Deber' : 'Nuevo Deber Académico'}
            </h3>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Título del deber *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ejercicios de Termodinámica 1 a 10"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    Asignatura
                  </label>
                  {onSaveSubject && (
                    <button
                      type="button"
                      onClick={() => setShowInlineSubjectCreator(!showInlineSubjectCreator)}
                      className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                    >
                      {showInlineSubjectCreator ? 'Cancelar' : '+ Crear asignatura'}
                    </button>
                  )}
                </div>

                {showInlineSubjectCreator && onSaveSubject ? (
                  <div className="p-3 rounded-xl bg-[#141b27] border border-emerald-500/30 space-y-2.5 mb-2">
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
                        {['#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewSubjectColor(color)}
                            className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                              newSubjectColor === color ? 'scale-125 ring-2 ring-white' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newSubjectName.trim()) return;
                          const saved = await onSaveSubject({
                            id: 'sub-' + Date.now(),
                            name: newSubjectName.trim(),
                            color: newSubjectColor,
                            weekly_goal_minutes: 120,
                            created_at: new Date().toISOString(),
                          });
                          setFormSubjectId(saved.id);
                          setNewSubjectName('');
                          setShowInlineSubjectCreator(false);
                        }}
                        className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">Sin asignatura asignada</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Fecha y Hora Límite *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AssignmentStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Tiempo Estimado (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={formEstimatedMinutes}
                    onChange={(e) => setFormEstimatedMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Descripción / Instrucciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles de la entrega o páginas del libro..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Notas personales
                </label>
                <textarea
                  rows={2}
                  placeholder="Apuntes o recordatorios adicionales..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
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
                  {editingAssignment ? 'Guardar Cambios' : 'Crear Deber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        subjects={subjects}
        onSaveAssignment={onSaveAssignment}
        onSaveExam={onSaveExam || (async () => ({} as any))}
        onSaveSubject={onSaveSubject}
      />
    </div>
  );
};

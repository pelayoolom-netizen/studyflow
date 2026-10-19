import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Calendar,
  Award,
  BookOpen,
  Edit3,
  Trash2,
  X,
  TrendingUp,
  Info,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exam, Priority, ExamStatus, Subject } from '../types';

interface Props {
  exams: Exam[];
  subjects: Subject[];
  onSaveExam: (exam: Exam) => Promise<Exam>;
  onDeleteExam: (id: string) => Promise<void>;
  onStartTimer: (subjectId?: string) => void;
  openCreateModalDirectly?: boolean;
  onSaveSubject?: (subject: Subject) => Promise<Subject>;
}

export const ExamsView: React.FC<Props> = ({
  exams,
  subjects,
  onSaveExam,
  onDeleteExam,
  onStartTimer,
  onSaveSubject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Inline subject creator
  const [showInlineSubjectCreator, setShowInlineSubjectCreator] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#10b981');

  // Form states
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [examDate, setExamDate] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('alta');
  const [status, setStatus] = useState<ExamStatus>('pendiente');
  const [grade, setGrade] = useState<string>('');
  const [maxGrade, setMaxGrade] = useState<number>(10);
  const [weightPercentage, setWeightPercentage] = useState<string>('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingExam(null);
    setName('');
    setSubjectId(subjects[0]?.id || '');
    const inOneWeek = new Date();
    inOneWeek.setDate(inOneWeek.getDate() + 7);
    inOneWeek.setHours(9, 30, 0, 0);
    const tzOffset = inOneWeek.getTimezoneOffset() * 60000;
    const localISOTime = new Date(inOneWeek.getTime() - tzOffset).toISOString().slice(0, 16);
    setExamDate(localISOTime);
    setSyllabus('');
    setNotes('');
    setPriority('alta');
    setStatus('pendiente');
    setGrade('');
    setMaxGrade(10);
    setWeightPercentage('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exam: Exam) => {
    setEditingExam(exam);
    setName(exam.name);
    setSubjectId(exam.subject_id || subjects[0]?.id || '');
    const d = new Date(exam.exam_date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setExamDate(localISOTime);
    setSyllabus(exam.syllabus || '');
    setNotes(exam.notes || '');
    setPriority(exam.priority);
    setStatus(exam.status);
    setGrade(exam.grade !== null && exam.grade !== undefined ? String(exam.grade) : '');
    setMaxGrade(exam.max_grade || 10);
    setWeightPercentage(exam.weight_percentage ? String(exam.weight_percentage) : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedGrade = grade.trim() !== '' ? Number(grade) : null;
    const parsedWeight = weightPercentage.trim() !== '' ? Number(weightPercentage) : null;

    const payload: Exam = {
      id: editingExam ? editingExam.id : 'ex-' + Date.now(),
      name: name.trim(),
      subject_id: subjectId || null,
      exam_date: new Date(examDate).toISOString(),
      syllabus: syllabus.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
      status: parsedGrade !== null ? 'corregido' : status,
      grade: parsedGrade,
      max_grade: Number(maxGrade) || 10,
      weight_percentage: parsedWeight,
      created_at: editingExam ? editingExam.created_at : new Date().toISOString(),
    };

    await onSaveExam(payload);

    if (parsedGrade !== null && parsedGrade >= 8.5) {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#10b981', '#fbbf24', '#38bdf8'],
      });
    }

    setIsModalOpen(false);
  };

  // Filtered exams
  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      if (searchTerm && !ex.name.toLowerCase().includes(searchTerm.toLowerCase()) && !ex.syllabus?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedSubject !== 'all' && ex.subject_id !== selectedSubject) {
        return false;
      }
      if (selectedStatus !== 'all' && ex.status !== selectedStatus) {
        return false;
      }
      return true;
    }).sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  }, [exams, searchTerm, selectedSubject, selectedStatus]);

  // Accurate Average Calculation
  // CRITICAL RULE: Tests without grade do NOT count as 0. Only graded exams are evaluated.
  const gradeAnalytics = useMemo(() => {
    const graded = exams.filter((e) => e.grade !== null && e.grade !== undefined);
    if (graded.length === 0) {
      return { count: 0, average: null, isWeighted: false, highest: null, lowest: null };
    }

    const withWeight = graded.filter((e) => e.weight_percentage && e.weight_percentage > 0);
    const allHaveWeight = withWeight.length === graded.length;

    let average: number;
    let isWeighted = false;

    if (allHaveWeight) {
      const totalWeight = withWeight.reduce((acc, e) => acc + (e.weight_percentage || 0), 0);
      if (totalWeight > 0) {
        const weightedSum = withWeight.reduce(
          (acc, e) => acc + (Number(e.grade) * Number(e.weight_percentage)),
          0
        );
        average = Number((weightedSum / totalWeight).toFixed(2));
        isWeighted = true;
      } else {
        const sum = graded.reduce((acc, e) => acc + Number(e.grade), 0);
        average = Number((sum / graded.length).toFixed(2));
      }
    } else {
      const sum = graded.reduce((acc, e) => acc + Number(e.grade), 0);
      average = Number((sum / graded.length).toFixed(2));
    }

    const gradesList = graded.map((e) => Number(e.grade));
    const highest = Math.max(...gradesList);
    const lowest = Math.min(...gradesList);

    return {
      count: graded.length,
      average,
      isWeighted,
      highest,
      lowest,
    };
  }, [exams]);

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Exámenes y Calificaciones</h1>
          <p className="text-xs text-zinc-400">
            Control de convocatorias, temario, ponderaciones exactas y expediente académico.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Examen</span>
        </button>
      </div>

      {/* Grade Statistics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Media Global */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Media Global</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-white">
              {gradeAnalytics.average !== null ? gradeAnalytics.average.toFixed(2) : '—'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {gradeAnalytics.isWeighted ? 'Media ponderada exacta' : 'Media aritmética'}
            </p>
          </div>
        </div>

        {/* Exámenes evaluados */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Exámenes Calificados</span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-white">
              {gradeAnalytics.count} <span className="text-xs font-normal text-zinc-500">de {exams.length}</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {exams.length - gradeAnalytics.count} pendientes de calificar
            </p>
          </div>
        </div>

        {/* Nota más alta */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Calificación Máxima</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-amber-400">
              {gradeAnalytics.highest !== null ? gradeAnalytics.highest.toFixed(2) : '—'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Mejor resultado obtenido</p>
          </div>
        </div>

        {/* Nota más baja */}
        <div className="card-dark rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Mínima Registrada</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-zinc-300">
              {gradeAnalytics.lowest !== null ? gradeAnalytics.lowest.toFixed(2) : '—'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Área con oportunidad de mejora</p>
          </div>
        </div>
      </div>

      {/* Explanatory notice regarding academic average rules */}
      <div className="p-3.5 rounded-xl bg-[#141924] border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Cálculo riguroso:</strong> Las pruebas pendientes de realización o corrección <em>no</em> computan como cero ni penalizan la media de tu expediente. Si asignas ponderaciones a cada examen, se aplicará el cálculo ponderado correspondiente.
        </span>
      </div>

      {/* Filter and Search */}
      <div className="card-dark rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar examen por título o temario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todas las Asignaturas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="pendiente">Pendientes de Realizar</option>
            <option value="realizado">Realizados (Esperando Nota)</option>
            <option value="corregido">Corregidos con Calificación</option>
          </select>
        </div>
      </div>

      {/* Exams List */}
      <div className="space-y-3">
        {filteredExams.length === 0 ? (
          <div className="card-dark rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 mx-auto flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No hay exámenes registrados</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Añade tus convocatorias de exámenes con fecha y temario para preparar tus semanas de estudio.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Añadir un examen
            </button>
          </div>
        ) : (
          filteredExams.map((exam) => {
            const sub = getSubject(exam.subject_id);
            const isFuture = new Date(exam.exam_date) >= new Date();
            const hasGrade = exam.grade !== null && exam.grade !== undefined;

            return (
              <div
                key={exam.id}
                className="card-dark-hover rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4"
                style={{ borderLeftColor: sub?.color || '#10b981' }}
              >
                {/* Details */}
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

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        exam.status === 'corregido'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : exam.status === 'realizado'
                          ? 'bg-teal-500/15 text-teal-300'
                          : isFuture
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {exam.status === 'corregido'
                        ? 'Corregido'
                        : exam.status === 'realizado'
                        ? 'Realizado'
                        : 'Pendiente'}
                    </span>

                    {exam.weight_percentage && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                        Peso: {exam.weight_percentage}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{exam.name}</h3>

                  {exam.syllabus && (
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      <span className="font-semibold text-zinc-300">Temario:</span> {exam.syllabus}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {new Date(exam.exam_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} a las {new Date(exam.exam_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Grade display & Actions */}
                <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-800 justify-between md:justify-end">
                  {hasGrade ? (
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-400">
                          {Number(exam.grade).toFixed(2)}
                        </span>
                        <span className="text-xs font-semibold text-zinc-500">/ {exam.max_grade || 10}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">Calificación obtenida</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenEdit(exam)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Introducir Nota
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onStartTimer(exam.subject_id || undefined)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                      title="Estudiar para este examen"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(exam)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                      title="Editar examen"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(exam.id)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Eliminar examen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl text-zinc-200 space-y-4">
            <h3 className="text-base font-bold text-white">¿Eliminar este examen?</h3>
            <p className="text-xs text-zinc-400">
              Se eliminará del calendario y de las estadísticas académicas de la nube.
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
                  await onDeleteExam(deletingId);
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
              {editingExam ? 'Editar Examen' : 'Nuevo Examen Académico'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Nombre de la prueba o examen *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Examen Parcial de Álgebra Lineal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                          setSubjectId(saved.id);
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
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
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
                    Fecha y Hora de Convocatoria *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Estado actual
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExamStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="pendiente">Pendiente de examen</option>
                    <option value="realizado">Realizado (esperando nota)</option>
                    <option value="corregido">Corregido con nota</option>
                  </select>
                </div>
              </div>

              {/* Grades and Weighting Section */}
              <div className="p-3.5 rounded-xl bg-[#161c28] border border-zinc-700/60 space-y-3">
                <span className="text-[11px] font-bold text-emerald-400 block uppercase tracking-wider">
                  Calificación y Ponderación
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-300 mb-1">
                      Calificación
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={maxGrade}
                      placeholder="Ej: 8.75"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a2130] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-300 mb-1">
                      Nota Máxima
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={maxGrade}
                      onChange={(e) => setMaxGrade(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a2130] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-300 mb-1">
                      Peso (%) Opcional
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="Ej: 30"
                      value={weightPercentage}
                      onChange={(e) => setWeightPercentage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a2130] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Temario a evaluar
                </label>
                <textarea
                  rows={2}
                  placeholder="Temas del 1 al 5, problemas prácticos..."
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Notas personales
                </label>
                <textarea
                  rows={2}
                  placeholder="Material permitido, aula de examen..."
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
                  {editingExam ? 'Guardar Cambios' : 'Crear Examen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Calendar,
  Clock,
  BookOpen,
  Trash2,
  Plus,
  ArrowRight,
  Check,
  FileText,
  AlertTriangle,
  Keyboard,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, Exam, Subject, Priority } from '../types';

export interface ExtractedVoiceItem {
  id: string;
  type: 'deber' | 'examen';
  title: string;
  subject: string;
  date: string; // ISO string
  dateDescription?: string;
  priority: Priority;
  notes?: string;
  isDuplicate?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  assignments?: Assignment[];
  exams?: Exam[];
  onSaveAssignment: (assignment: Assignment) => Promise<Assignment>;
  onSaveExam: (exam: Exam) => Promise<Exam>;
  onSaveSubject?: (subject: Subject) => Promise<Subject>;
  onSuccessSaved?: (summary: { assignmentsCount: number; examsCount: number; duplicatesSkipped?: number }) => void;
}

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
];

// Helper to normalize strings for comparison (accents, lowercase, whitespace)
const normalizeStr = (str: string) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const VoiceAssistantModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subjects,
  assignments = [],
  exams = [],
  onSaveAssignment,
  onSaveExam,
  onSaveSubject,
  onSuccessSaved,
}) => {
  // Speech Recognition States
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [listeningSeconds, setListeningSeconds] = useState<number>(0);
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);

  // Text inputs
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');

  // Gemini Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isMissingApiKey, setIsMissingApiKey] = useState<boolean>(false);

  // Extracted Items Review Step
  const [extractedItems, setExtractedItems] = useState<ExtractedVoiceItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [step, setStep] = useState<'record' | 'review'>('record');

  // References for SpeechRecognition & Timer
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<any>(null);

  // Check Web Speech API support and Gemini status on modal open
  useEffect(() => {
    if (isOpen) {
      const SpeechRecognitionClass =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null;

      if (!SpeechRecognitionClass) {
        setIsSpeechSupported(false);
        setDictationNotice(
          'El dictado no está disponible en este navegador. Puedes usar el micrófono del teclado o escribir el texto.'
        );
      } else {
        setIsSpeechSupported(true);
        setDictationNotice(null);
      }

      fetch('/api/gemini/status')
        .then((res) => res.json())
        .then((data) => {
          if (!data.available) {
            setIsMissingApiKey(true);
          } else {
            setIsMissingApiKey(false);
          }
        })
        .catch(() => {
          // Keep default
        });
    } else {
      // Modal closed: stop dictation and reset transient state
      stopListening();
      setTranscriptText('');
      setInterimText('');
      setExtractedItems([]);
      setStep('record');
      setApiError(null);
      setDictationNotice(null);
      setIsAnalyzing(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Timer while listening
  useEffect(() => {
    if (isListening) {
      setListeningSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setListeningSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isListening]);

  // Start Speech Recognition
  const startListening = () => {
    setApiError(null);
    setDictationNotice(null);

    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setIsSpeechSupported(false);
      setDictationNotice(
        'El dictado no está disponible en este navegador. Puedes usar el micrófono del teclado o escribir el texto.'
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalChunk += text + ' ';
          } else {
            interimChunk += text;
          }
        }

        if (finalChunk.trim()) {
          setTranscriptText((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${finalChunk.trim()}` : finalChunk.trim();
          });
        }
        setInterimText(interimChunk.trim());
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
          setDictationNotice(
            'Permiso de micrófono denegado. Permite el acceso al micrófono en el navegador o escribe directamente en el cuadro de texto.'
          );
        } else if (event.error === 'network') {
          setDictationNotice('Error de red en el servicio de reconocimiento de voz. Puedes escribir el texto manualmente.');
        } else if (event.error === 'no-speech') {
          // Silent pause; continue listening if flag is active
        }
      };

      recognition.onend = () => {
        // Continuous dictation: if still supposed to listen and not manually stopped, restart
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err: any) {
      console.error('Error starting SpeechRecognition:', err);
      setIsListening(false);
      isListeningRef.current = false;
      setDictationNotice('No se pudo iniciar el dictado por voz. Puedes escribir el texto directamente en el cuadro.');
    }
  };

  // Stop Speech Recognition
  const stopListening = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    // Commit any residual interim text
    if (interimText.trim()) {
      setTranscriptText((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${interimText.trim()}` : interimText.trim();
      });
      setInterimText('');
    }
    setIsListening(false);
  };

  // Format seconds into MM:SS
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Check if an item already exists in current assignments or exams
  const checkIfDuplicate = (item: { type: 'deber' | 'examen'; title: string; date: string }) => {
    const itemNormTitle = normalizeStr(item.title);
    const itemDateDay = item.date ? item.date.slice(0, 10) : '';

    if (item.type === 'deber') {
      return assignments.some((a) => {
        const aNorm = normalizeStr(a.title);
        const aDay = a.due_date ? a.due_date.slice(0, 10) : '';
        return aNorm === itemNormTitle && aDay === itemDateDay;
      });
    } else {
      return exams.some((e) => {
        const eNorm = normalizeStr(e.name);
        const eDay = e.exam_date ? e.exam_date.slice(0, 10) : '';
        return eNorm === itemNormTitle && eDay === itemDateDay;
      });
    }
  };

  // Analyze text with Gemini via backend
  const handleAnalyzeWithGemini = async () => {
    setApiError(null);

    // Stop listening if currently dictating and capture everything
    if (isListening) {
      stopListening();
    }

    // Combine any pending interim text with transcriptText
    const fullText = [transcriptText.trim(), interimText.trim()].filter(Boolean).join(' ');

    if (!fullText.trim()) {
      setApiError('Por favor, dicta o escribe lo que tienes que hacer antes de analizar con Gemini.');
      return;
    }

    setIsAnalyzing(true);

    try {
      const clientDate = new Date().toISOString();
      const timezone = 'Europe/Madrid';
      const existingSubjects = subjects.map((s) => s.name);

      const response = await fetch('/api/gemini/analyze-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fullText,
          clientDate,
          timezone,
          existingSubjects,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.missingKey) {
          setIsMissingApiKey(true);
        }
        // Preserve the text for retry!
        throw new Error(data.error || 'Error al comunicarse con Gemini');
      }

      if (!data.items || data.items.length === 0) {
        // Keep the text in transcriptText so the user can easily tweak and retry
        setApiError(
          'Gemini no detectó ningún deber ni examen específico en el texto. Revisa o añade detalles (por ejemplo: "Para mañana ejercicios de Matemáticas y el viernes examen de Historia") y pulsa de nuevo en Analizar.'
        );
        setIsAnalyzing(false);
        return;
      }

      // Convert server items to editable voice items with duplicate detection
      const parsedItems: ExtractedVoiceItem[] = data.items.map((item: any, idx: number) => {
        let validDate = item.date;
        try {
          const testD = new Date(item.date);
          if (isNaN(testD.getTime())) {
            const fallback = new Date();
            fallback.setDate(fallback.getDate() + 1);
            fallback.setHours(item.type === 'examen' ? 9 : 18, 30, 0, 0);
            validDate = fallback.toISOString();
          }
        } catch {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + 1);
          fallback.setHours(item.type === 'examen' ? 9 : 18, 30, 0, 0);
          validDate = fallback.toISOString();
        }

        const isDup = checkIfDuplicate({
          type: item.type === 'examen' ? 'examen' : 'deber',
          title: item.title || '',
          date: validDate,
        });

        return {
          id: `voice-item-${Date.now()}-${idx}`,
          type: item.type === 'examen' ? 'examen' : 'deber',
          title: item.title || 'Tarea sin título',
          subject: item.subject || 'General',
          date: validDate,
          dateDescription: item.dateDescription,
          priority: (['alta', 'media', 'baja'].includes(item.priority) ? item.priority : 'media') as Priority,
          notes: item.notes || '',
          isDuplicate: isDup,
        };
      });

      setExtractedItems(parsedItems);
      setStep('review');
    } catch (err: any) {
      console.error('Error analyzing with Gemini:', err);
      // Retain the text so the user can retry!
      setApiError(err.message || 'Error inesperado al conectar con Gemini. Tu texto se conserva para reintentar.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Modify Extracted Item in Review Step
  const handleUpdateItem = (id: string, updates: Partial<ExtractedVoiceItem>) => {
    setExtractedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        updated.isDuplicate = checkIfDuplicate(updated);
        return updated;
      })
    );
  };

  // Delete Extracted Item
  const handleDeleteItem = (id: string) => {
    setExtractedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add another empty item manually to the batch
  const handleAddManualItem = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    const newItem: ExtractedVoiceItem = {
      id: `manual-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'deber',
      title: '',
      subject: subjects[0]?.name || 'General',
      date: tomorrow.toISOString(),
      dateDescription: 'Mañana a las 18:00',
      priority: 'media',
      notes: '',
      isDuplicate: false,
    };
    setExtractedItems((prev) => [...prev, newItem]);
  };

  // Save All Extracted Records into StudyFlow Real Database
  const handleSaveAll = async () => {
    if (extractedItems.length === 0) return;

    setIsSaving(true);
    setApiError(null);

    let createdAssignments = 0;
    let createdExams = 0;
    let duplicatesSkipped = 0;

    try {
      // Dynamic subjects map to avoid re-creating the same subject in one batch
      const subjectCache = new Map<string, Subject>();
      subjects.forEach((s) => {
        subjectCache.set(normalizeStr(s.name), s);
      });

      for (const item of extractedItems) {
        if (!item.title.trim()) continue;

        const normSubjectName = normalizeStr(item.subject);

        // 1. Resolve or Create Subject
        let matchedSubject = subjectCache.get(normSubjectName);

        if (!matchedSubject && onSaveSubject) {
          const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
          const newSub: Subject = {
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: item.subject.trim() || 'General',
            color: randomColor,
            weekly_goal_minutes: 120,
            created_at: new Date().toISOString(),
          };
          matchedSubject = await onSaveSubject(newSub);
          subjectCache.set(normSubjectName, matchedSubject);
        }

        const subjectId = matchedSubject ? matchedSubject.id : subjects[0]?.id || null;

        // 2. Duplicate Check Against Database
        const isDup = checkIfDuplicate(item);
        if (isDup) {
          duplicatesSkipped++;
          // Skip creating a redundant identical item
          continue;
        }

        // 3. Save Assignment or Exam into real storage
        if (item.type === 'deber') {
          const newAssignment: Assignment = {
            id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: item.title.trim(),
            description: item.notes?.trim() || undefined,
            subject_id: subjectId,
            due_date: new Date(item.date).toISOString(),
            priority: item.priority,
            status: 'pendiente',
            estimated_minutes: 45,
            actual_minutes: 0,
            completed_at: null,
            created_at: new Date().toISOString(),
          };
          await onSaveAssignment(newAssignment);
          createdAssignments++;
        } else {
          const newExam: Exam = {
            id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: item.title.trim(),
            subject_id: subjectId,
            exam_date: new Date(item.date).toISOString(),
            priority: item.priority || 'alta',
            status: 'pendiente',
            grade: null,
            max_grade: 10,
            syllabus: item.notes?.trim() || undefined,
            created_at: new Date().toISOString(),
          };
          await onSaveExam(newExam);
          createdExams++;
        }
      }

      // Celebratory Confetti
      confetti({
        particleCount: 70,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#38bdf8', '#fbbf24'],
      });

      if (onSuccessSaved) {
        onSuccessSaved({
          assignmentsCount: createdAssignments,
          examsCount: createdExams,
          duplicatesSkipped,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error al guardar registros:', err);
      setApiError(`Error al guardar: ${err.message || 'Inténtalo de nuevo'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for input type datetime-local
  const toLocalInputValue = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const fromLocalInputValue = (localStr: string) => {
    try {
      return new Date(localStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#0f141e] border border-[#222d42] rounded-3xl shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-gradient-to-r from-violet-600/20 via-indigo-500/20 to-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between p-4 sm:p-5 border-b border-[#1c2536] bg-[#121927]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-emerald-600 p-0.5 shadow-lg shadow-violet-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-[#111723] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Añadir con IA 🎙️
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30">
                  Dictado + Gemini
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Dicta por voz o escribe tus deberes y exámenes en lenguaje natural.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#182130] hover:bg-[#222e42] text-zinc-400 hover:text-white flex items-center justify-center transition border border-[#2a374f] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Missing API Key Notice (if any) */}
        {isMissingApiKey && (
          <div className="p-3.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Configuración de Gemini Requerida:</span>
              <span>
                Para analizar tareas con IA se necesita la variable{' '}
                <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono text-amber-300">
                  GEMINI_API_KEY
                </code>{' '}
                en el servidor.
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* STEP 1: DICTATE & WRITE */}
          {step === 'record' && (
            <div className="space-y-5">
              {/* Voice Dictation Controls Section */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#141c2b] to-[#101622] border border-[#232e44] text-center space-y-4">
                {/* Compatibility notice if SpeechRecognition is not available */}
                {!isSpeechSupported && (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-left flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Dictado por voz:</span>
                      <span>
                        El dictado no está disponible en este navegador. Puedes usar el micrófono del teclado o escribir el texto.
                      </span>
                    </div>
                  </div>
                )}

                {/* Dictation Notice/Error if any */}
                {dictationNotice && isSpeechSupported && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{dictationNotice}</span>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Big Microphone / Stop Button */}
                  <div className="relative flex items-center justify-center">
                    {isListening && (
                      <>
                        <div className="absolute w-28 h-28 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                        <div className="absolute w-24 h-24 rounded-full bg-rose-500/30 animate-pulse pointer-events-none" />
                      </>
                    )}

                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={isAnalyzing || !isSpeechSupported}
                      className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition shadow-2xl cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isListening
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                          : 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white shadow-indigo-950/70'
                      }`}
                      title={
                        !isSpeechSupported
                          ? 'Dictado no soportado en este navegador'
                          : isListening
                          ? 'Detener dictado'
                          : 'Iniciar dictado por voz'
                      }
                    >
                      {isListening ? (
                        <Square className="w-8 h-8 fill-current" />
                      ) : (
                        <Mic className="w-8 h-8" />
                      )}
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isListening ? (
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                          <span>Escuchando dictado en directo ({formatSeconds(listeningSeconds)})</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Habla con naturalidad. Toca el botón rojo o «Detener dictado» cuando termines.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-zinc-200 block">
                          {isSpeechSupported ? 'Pulsa para dictar por voz' : 'Escribe tus tareas abajo'}
                        </span>
                        <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                          Ejemplo: <em>«Para mañana tengo Física y el martes de la semana que viene tengo examen de Matemáticas»</em>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Explicit Stop Recognition Button when listening */}
                  {isListening && (
                    <button
                      onClick={stopListening}
                      className="px-4 py-1.5 rounded-xl bg-[#1e2738] hover:bg-[#28344b] text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 text-rose-400 fill-current" />
                      <span>Detener dictado</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Large Text Box for Recognized Text or Manual Typing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Texto a analizar (dictado o escrito manualmente)</span>
                  </label>
                  <button
                    onClick={() => {
                      setTranscriptText(
                        'Para mañana tengo Física y el martes de la semana que viene tengo examen de Matemáticas.'
                      );
                      setInterimText('');
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    Cargar ejemplo
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={
                      isListening && interimText
                        ? `${transcriptText ? transcriptText.trim() + ' ' : ''}${interimText}`
                        : transcriptText
                    }
                    onChange={(e) => {
                      setTranscriptText(e.target.value);
                      setInterimText('');
                    }}
                    placeholder="Escribe o dicta aquí tus deberes y exámenes. Ejemplo: «Para mañana ejercicios del 1 al 8 de Física y el viernes examen de Lengua»..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-2xl bg-[#141b27] border border-[#232e42] focus:border-indigo-500 text-white text-xs sm:text-sm placeholder:text-zinc-600 focus:outline-none transition resize-none leading-relaxed"
                  />
                  {Boolean(transcriptText || interimText) && (
                    <button
                      onClick={() => {
                        setTranscriptText('');
                        setInterimText('');
                      }}
                      className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      title="Borrar texto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isListening && interimText && (
                  <p className="text-[11px] text-emerald-400 italic flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Transcribiendo en directo: "{interimText}"</span>
                  </p>
                )}
              </div>

              {/* General API error (with text retained for retry!) */}
              {apiError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">No se pudo procesar con Gemini:</span>
                    <span>{apiError}</span>
                    <span className="block mt-1 text-[11px] text-rose-400 font-medium">
                      ✓ Tu texto se ha conservado intacto en el cuadro de arriba para que puedas corregirlo o volver a pulsar «Analizar con Gemini».
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#141c28] hover:bg-[#1a2433] text-zinc-300 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleAnalyzeWithGemini}
                  disabled={isAnalyzing || (!transcriptText.trim() && !interimText.trim())}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-950/60 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analizando con Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Analizar con Gemini</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT EXTRACTED ITEMS BEFORE SAVING */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1f293d]">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Registros detectados por Gemini ({extractedItems.length})</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Revisa las fechas, asignaturas o títulos antes de guardar en tu calendario y deberes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep('record')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1b2333] text-zinc-300 border border-zinc-800 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-400" />
                    <span>Volver al texto / dictar</span>
                  </button>
                  <button
                    onClick={handleAddManualItem}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir registro</span>
                  </button>
                </div>
              </div>

              {/* List of items */}
              <div className="space-y-3">
                {extractedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition ${
                      item.isDuplicate
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : item.type === 'examen'
                        ? 'bg-[#151a28] border-indigo-500/30'
                        : 'bg-[#121824] border-[#1e2738]'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {/* Type Toggle */}
                        <div className="flex rounded-lg bg-[#0e131d] p-0.5 border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(item.id, { type: 'deber' })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                              item.type === 'deber'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Deber
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(item.id, { type: 'examen' })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                              item.type === 'examen'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Examen
                          </button>
                        </div>

                        {/* Date description badge */}
                        {item.dateDescription && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#192336] text-emerald-400 border border-emerald-500/20">
                            {item.dateDescription}
                          </span>
                        )}

                        {/* Duplicate warning badge */}
                        {item.isDuplicate && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Posible duplicado</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Item Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Title */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-zinc-400">
                          Título
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                          placeholder="Título de la tarea o examen"
                          className="w-full px-3 py-2 rounded-xl bg-[#0c111a] border border-[#212c40] text-white text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Subject */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-emerald-400" />
                          <span>Asignatura</span>
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={item.subject}
                            onChange={(e) => handleUpdateItem(item.id, { subject: e.target.value })}
                            list={`subjects-list-${item.id}`}
                            placeholder="Materia (ej: Matemáticas)"
                            className="w-full px-3 py-2 rounded-xl bg-[#0c111a] border border-[#212c40] text-white text-xs focus:border-indigo-500 focus:outline-none"
                          />
                          <datalist id={`subjects-list-${item.id}`}>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          <span>Fecha y hora</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(item.date)}
                          onChange={(e) => handleUpdateItem(item.id, { date: fromLocalInputValue(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0c111a] border border-[#212c40] text-white text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Priority */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-400">
                          Prioridad
                        </label>
                        <select
                          value={item.priority}
                          onChange={(e) => handleUpdateItem(item.id, { priority: e.target.value as Priority })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0c111a] border border-[#212c40] text-white text-xs focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>

                      {/* Notes / Details */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-zinc-400" />
                          <span>Detalles o temario</span>
                        </label>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                          placeholder="Ej: ejercicios 1 al 8, tema 4..."
                          className="w-full px-3 py-2 rounded-xl bg-[#0c111a] border border-[#212c40] text-white text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {extractedItems.length === 0 && (
                  <div className="p-8 text-center rounded-2xl bg-[#121824] border border-[#1e2738] space-y-2">
                    <p className="text-xs text-zinc-400">No hay registros para guardar.</p>
                    <button
                      onClick={() => setStep('record')}
                      className="text-xs text-emerald-400 hover:underline font-semibold"
                    >
                      Volver a dictar o escribir
                    </button>
                  </div>
                )}
              </div>

              {/* Review Step Actions */}
              <div className="pt-3 border-t border-[#1c2536] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('record')}
                  className="px-3.5 py-2 rounded-xl bg-[#141c28] hover:bg-[#1a2433] text-zinc-300 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
                >
                  Volver al texto
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl bg-[#141c28] hover:bg-[#1a2433] text-zinc-400 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
                  >
                    Descartar
                  </button>

                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving || extractedItems.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando registros...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Guardar todos ({extractedItems.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

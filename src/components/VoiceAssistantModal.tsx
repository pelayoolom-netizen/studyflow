import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  RotateCcw,
  Calendar,
  Clock,
  BookOpen,
  Trash2,
  Plus,
  ArrowRight,
  HelpCircle,
  Check,
  Send,
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
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSaveAssignment: (assignment: Assignment) => Promise<Assignment>;
  onSaveExam: (exam: Exam) => Promise<Exam>;
  onSaveSubject?: (subject: Subject) => Promise<Subject>;
  onSuccessSaved?: (summary: { assignmentsCount: number; examsCount: number }) => void;
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

export const VoiceAssistantModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subjects,
  onSaveAssignment,
  onSaveExam,
  onSaveSubject,
  onSuccessSaved,
}) => {
  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [micError, setMicError] = useState<string | null>(null);

  // Transcription & Prompt Text
  const [transcriptText, setTranscriptText] = useState('');
  const [isManualInputMode, setIsManualInputMode] = useState(false);

  // Gemini Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isMissingApiKey, setIsMissingApiKey] = useState(false);

  // Extracted Items Review Step
  const [extractedItems, setExtractedItems] = useState<ExtractedVoiceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'record' | 'review'>('record');

  // MediaRecorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Check Gemini status on modal open
  useEffect(() => {
    if (isOpen) {
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
          // If network error, allow trying
        });
    } else {
      // Reset state on close
      cleanupRecording();
      setRecordedAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setTranscriptText('');
      setExtractedItems([]);
      setStep('record');
      setMicError(null);
      setApiError(null);
      setIsAnalyzing(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  // Clean up recording tracks & intervals
  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  // Start Voice Recording with real MediaRecorder & getUserMedia
  const startRecording = async () => {
    setMicError(null);
    setApiError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Tu navegador no soporta captura de audio mediante getUserMedia. Puedes usar el modo de escritura manual abajo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detect supported mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
      ];
      let supportedMime = '';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        for (const mime of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            supportedMime = mime;
            break;
          }
        }
      }

      setAudioMimeType(supportedMime || 'audio/webm');

      const options = supportedMime ? { mimeType: supportedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = supportedMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setRecordedAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop mic hardware tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // Start live speech recognition if supported in browser for instantaneous feedback
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'es-ES';

          recognition.onresult = (event: any) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
              fullTranscript += event.results[i][0].transcript + ' ';
            }
            if (fullTranscript.trim()) {
              setTranscriptText(fullTranscript.trim());
            }
          };

          recognition.onerror = () => {
            // SpeechRecognition is optional enhancement; MediaRecorder audio is what goes to Gemini
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition could not start:', e);
        }
      }

      mediaRecorder.start(250); // Slice into chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error al acceder al micrófono:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Permiso de micrófono denegado. Permite el acceso al micrófono en la barra de tu navegador o escribe manualmente.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('No se encontró ningún micrófono conectado en tu dispositivo.');
      } else {
        setMicError(`No se pudo iniciar la grabación: ${err.message || 'Error desconocido'}`);
      }
      cleanupRecording();
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Strip data:audio/*;base64, prefix
        const base64Content = base64data.includes(',')
          ? base64data.split(',')[1]
          : base64data;
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Analyze with Gemini
  const handleAnalyzeWithGemini = async () => {
    setApiError(null);

    const hasAudio = Boolean(recordedAudioBlob && recordedAudioBlob.size > 0);
    const hasText = Boolean(transcriptText.trim());

    if (!hasAudio && !hasText) {
      setApiError('Graba un mensaje de voz o escribe lo que tienes que hacer en el campo de texto.');
      return;
    }

    setIsAnalyzing(true);

    try {
      let audioBase64 = '';
      if (hasAudio && recordedAudioBlob) {
        audioBase64 = await blobToBase64(recordedAudioBlob);
      }

      const clientDate = new Date().toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
      const existingSubjects = subjects.map((s) => s.name);

      const response = await fetch('/api/gemini/analyze-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: audioBase64 || undefined,
          mimeType: audioMimeType,
          text: transcriptText.trim() || undefined,
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
        throw new Error(data.error || 'Error al comunicarse con Gemini');
      }

      if (data.transcription && !transcriptText.trim()) {
        setTranscriptText(data.transcription);
      }

      if (!data.items || data.items.length === 0) {
        setApiError('Gemini no detectó ningún deber ni examen en el mensaje. Intenta ser más explícito (ej: "Para mañana ejercicios de Matemáticas y el viernes examen de Historia").');
        setIsAnalyzing(false);
        return;
      }

      // Convert server items to editable voice items
      const parsedItems: ExtractedVoiceItem[] = data.items.map((item: any, idx: number) => {
        let validDate = item.date;
        try {
          const testD = new Date(item.date);
          if (isNaN(testD.getTime())) {
            const fallback = new Date();
            fallback.setDate(fallback.getDate() + 1);
            fallback.setHours(18, 0, 0, 0);
            validDate = fallback.toISOString();
          }
        } catch {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + 1);
          fallback.setHours(18, 0, 0, 0);
          validDate = fallback.toISOString();
        }

        return {
          id: 'v-item-' + Date.now() + '-' + idx,
          type: item.type === 'examen' ? 'examen' : 'deber',
          title: item.title || 'Tarea sin título',
          subject: item.subject || 'General',
          date: validDate,
          dateDescription: item.dateDescription,
          priority: (['alta', 'media', 'baja'].includes(item.priority) ? item.priority : 'media') as Priority,
          notes: item.notes || '',
        };
      });

      setExtractedItems(parsedItems);
      setStep('review');
    } catch (err: any) {
      console.error('Error analyzing with Gemini:', err);
      setApiError(err.message || 'Error inesperado al conectar con Gemini');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Modify Extracted Item
  const handleUpdateItem = (id: string, updates: Partial<ExtractedVoiceItem>) => {
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
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
      id: 'v-item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      type: 'deber',
      title: '',
      subject: subjects[0]?.name || 'General',
      date: tomorrow.toISOString(),
      dateDescription: 'Mañana a las 18:00',
      priority: 'media',
      notes: '',
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

    try {
      for (const item of extractedItems) {
        if (!item.title.trim()) continue;

        // 1. Resolve or Create Subject
        let matchedSubject = subjects.find(
          (s) => s.name.trim().toLowerCase() === item.subject.trim().toLowerCase()
        );

        if (!matchedSubject && onSaveSubject) {
          const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
          const newSub: Subject = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: item.subject.trim() || 'General',
            color: randomColor,
            weekly_goal_minutes: 120,
            created_at: new Date().toISOString(),
          };
          matchedSubject = await onSaveSubject(newSub);
        }

        const subjectId = matchedSubject ? matchedSubject.id : subjects[0]?.id || null;

        // 2. Save Assignment or Exam
        if (item.type === 'deber') {
          const newAssignment: Assignment = {
            id: 'asg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
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
            id: 'ex-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
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
        particleCount: 65,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#38bdf8', '#fbbf24'],
      });

      if (onSuccessSaved) {
        onSuccessSaved({ assignmentsCount: createdAssignments, examsCount: createdExams });
      }

      onClose();
    } catch (err: any) {
      console.error('Error al guardar registros:', err);
      setApiError(`Error al guardar: ${err.message || 'Inténtalo de nuevo'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper format seconds (00:00)
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Di o escribe tus deberes y exámenes en lenguaje natural.
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
                Para analizar voz de forma remota se necesita la variable{' '}
                <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono text-amber-300">
                  GEMINI_API_KEY
                </code>{' '}
                en el archivo <code className="font-mono">.env</code> del servidor. Puedes escribir el texto manualmente y pulsar "Analizar con Gemini" en cuanto la clave esté vinculada.
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* STEP 1: RECORD & TRANSCRIBE */}
          {step === 'record' && (
            <div className="space-y-5">
              {/* Voice Recording Central Hero */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#141c2b] to-[#101622] border border-[#232e44] text-center space-y-4">
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Huge Record Button with pulsing rings */}
                  <div className="relative flex items-center justify-center">
                    {isRecording && (
                      <>
                        <div className="absolute w-28 h-28 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                        <div className="absolute w-24 h-24 rounded-full bg-rose-500/30 animate-pulse pointer-events-none" />
                      </>
                    )}

                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isAnalyzing}
                      className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition shadow-2xl cursor-pointer active:scale-95 ${
                        isRecording
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                          : 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white shadow-indigo-950/70'
                      }`}
                    >
                      {isRecording ? (
                        <Square className="w-8 h-8 fill-current" />
                      ) : (
                        <Mic className="w-8 h-8" />
                      )}
                    </button>
                  </div>

                  {/* Status & Timer Indicator */}
                  <div>
                    {isRecording ? (
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                          <span>Grabando audio ({formatSeconds(recordingSeconds)})</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Toca el botón cuadrado rojo para detener la grabación.
                        </p>
                      </div>
                    ) : recordedAudioBlob ? (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-emerald-400 block">
                          ✓ Audio grabado ({formatSeconds(recordingSeconds)})
                        </span>
                        {audioUrl && (
                          <div className="flex items-center justify-center gap-2">
                            <audio controls src={audioUrl} className="h-8 max-w-xs" />
                            <button
                              onClick={() => {
                                setRecordedAudioBlob(null);
                                if (audioUrl) URL.revokeObjectURL(audioUrl);
                                setAudioUrl(null);
                              }}
                              title="Descartar y volver a grabar"
                              className="p-1.5 rounded-lg bg-[#182130] hover:bg-[#202c3f] text-zinc-400 hover:text-white transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Pulsa para grabar tu voz
                        </span>
                        <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                          Ejemplo: <em>"Para mañana tengo ejercicios 1 al 8 de Física. El jueves entrego Lengua y el martes examen de Matemáticas."</em>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mic error message */}
                {micError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{micError}</span>
                  </div>
                )}
              </div>

              {/* Editable Transcription / Manual Input Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>Transcripción / Texto a analizar</span>
                    <span className="text-[10px] text-zinc-500 font-normal">
                      (editable en cualquier momento)
                    </span>
                  </label>
                  <button
                    onClick={() => {
                      setTranscriptText(
                        'Para mañana tengo los ejercicios del 1 al 8 de Física. El jueves tengo que entregar el trabajo de Lengua y el martes de la semana que viene tengo examen de Matemáticas de ecuaciones.'
                      );
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    Cargar ejemplo
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="Habla por el micrófono o escribe aquí directamente tus tareas y exámenes con fechas..."
                    rows={4}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#141b27] border border-[#232e42] focus:border-indigo-500 text-white text-xs sm:text-sm placeholder:text-zinc-600 focus:outline-none transition resize-none leading-relaxed"
                  />
                  {transcriptText && (
                    <button
                      onClick={() => setTranscriptText('')}
                      className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition"
                      title="Borrar texto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* General API error */}
              {apiError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">No se pudo completar el análisis:</span>
                    <span>{apiError}</span>
                  </div>
                </div>
              )}

              {/* Action Button: Analizar con Gemini */}
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
                  disabled={isAnalyzing || isRecording || (!recordedAudioBlob && !transcriptText.trim())}
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
                    <span>Volver a grabar / texto</span>
                  </button>
                  <button
                    onClick={handleAddManualItem}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir otro</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {extractedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-[#131926] border border-[#232f44] hover:border-[#2d3c57] transition space-y-3"
                  >
                    {/* Top Row: Type toggle & Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 bg-[#0e131d] p-1 rounded-xl border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => handleUpdateItem(item.id, { type: 'deber' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            item.type === 'examen'
                              ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Examen
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.dateDescription && (
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-block">
                            {item.dateDescription}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Eliminar este registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Title & Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                          Título
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                          placeholder="Ej: Ejercicios del 1 al 8"
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0e131d] border border-[#20293b] text-white text-xs font-medium focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                          Asignatura
                        </label>
                        <input
                          type="text"
                          value={item.subject}
                          onChange={(e) => handleUpdateItem(item.id, { subject: e.target.value })}
                          placeholder="Materia (ej: Física)"
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0e131d] border border-[#20293b] text-white text-xs font-medium focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Bottom: Date picker & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>Fecha y Hora de Entrega / Examen</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(item.date)}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              date: fromLocalInputValue(e.target.value),
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0e131d] border border-[#20293b] text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                          Prioridad
                        </label>
                        <select
                          value={item.priority}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { priority: e.target.value as Priority })
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0e131d] border border-[#20293b] text-white text-xs font-medium focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div className="space-y-1 pt-0.5">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                        placeholder="Notas, páginas o temario opcional..."
                        className="w-full px-3 py-1 rounded-xl bg-[#0e131d]/60 border border-[#1b2333] text-zinc-300 text-[11px] placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Error if saving fails */}
              {apiError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Review Step Footer Actions */}
              <div className="pt-3 border-t border-[#1c2536] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('record')}
                  className="px-4 py-2.5 rounded-xl bg-[#141c28] hover:bg-[#1a2433] text-zinc-300 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
                >
                  Atrás
                </button>

                <button
                  onClick={handleSaveAll}
                  disabled={isSaving || extractedItems.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer active:scale-95"
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
          )}
        </div>
      </div>
    </div>
  );
};

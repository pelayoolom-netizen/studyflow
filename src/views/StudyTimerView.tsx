import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  Flame,
  Coffee,
  BookOpen,
  Volume2,
  VolumeX,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StudySession, Subject, Assignment } from '../types';

interface Props {
  subjects: Subject[];
  assignments: Assignment[];
  studySessions: StudySession[];
  onSaveSession: (session: StudySession) => Promise<StudySession>;
  initialSubjectId?: string;
  initialAssignmentId?: string;
}

type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak';

interface ActiveSessionStorage {
  mode: TimerMode;
  targetSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  startTimestamp: number;
  subjectId: string;
  assignmentId: string;
  description: string;
}

export const StudyTimerView: React.FC<Props> = ({
  subjects,
  assignments,
  studySessions,
  onSaveSession,
  initialSubjectId,
  initialAssignmentId,
}) => {
  // Timer settings
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [timerMode, setTimerMode] = useState<TimerMode>('pomodoro');

  // Timer states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || subjects[0]?.id || '');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(initialAssignmentId || '');
  const [sessionDescription, setSessionDescription] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(pomodoroMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Reset confirmation dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // References
  const intervalRef = useRef<any>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Load and recover active session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studyflow_active_timer_session');
      if (stored) {
        const parsed: ActiveSessionStorage = JSON.parse(stored);
        setTimerMode(parsed.mode);
        setSelectedSubjectId(parsed.subjectId || subjects[0]?.id || '');
        setSelectedAssignmentId(parsed.assignmentId || '');
        setSessionDescription(parsed.description || '');

        if (parsed.isRunning && parsed.startTimestamp) {
          const elapsed = Math.floor((Date.now() - parsed.startTimestamp) / 1000);
          const computedRemaining = Math.max(0, parsed.remainingSeconds - elapsed);
          setRemainingSeconds(computedRemaining);
          setIsRunning(computedRemaining > 0);
          sessionStartTimeRef.current = parsed.startTimestamp;
        } else {
          setRemainingSeconds(parsed.remainingSeconds);
          setIsRunning(false);
        }
      } else {
        setRemainingSeconds(pomodoroMinutes * 60);
      }
    } catch (e) {
      console.warn('Could not restore timer:', e);
    }
  }, []);

  // Save active timer to localStorage whenever relevant state changes
  useEffect(() => {
    if (isRunning) {
      const stateToStore: ActiveSessionStorage = {
        mode: timerMode,
        targetSeconds:
          timerMode === 'pomodoro'
            ? pomodoroMinutes * 60
            : timerMode === 'shortBreak'
            ? shortBreakMinutes * 60
            : longBreakMinutes * 60,
        remainingSeconds,
        isRunning: true,
        startTimestamp: Date.now(),
        subjectId: selectedSubjectId,
        assignmentId: selectedAssignmentId,
        description: sessionDescription,
      };
      localStorage.setItem('studyflow_active_timer_session', JSON.stringify(stateToStore));
    } else {
      localStorage.removeItem('studyflow_active_timer_session');
    }
  }, [isRunning, remainingSeconds, timerMode, selectedSubjectId, selectedAssignmentId, sessionDescription]);

  // Timer tick interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timerMode, selectedSubjectId, selectedAssignmentId]);

  // Audio beep
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch {
      // AudioContext not allowed or unavailable
    }
  };

  // When timer reaches 0
  const handleTimerComplete = async () => {
    setIsRunning(false);
    playAlertSound();

    if (timerMode === 'pomodoro') {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#f59e0b'],
      });

      // Save session into DB
      const session: StudySession = {
        id: 'ses-' + Date.now(),
        subject_id: selectedSubjectId || null,
        assignment_id: selectedAssignmentId || null,
        description: sessionDescription.trim() || undefined,
        start_time: new Date(Date.now() - pomodoroMinutes * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: pomodoroMinutes,
        completed: true,
        created_at: new Date().toISOString(),
      };

      await onSaveSession(session);
      localStorage.removeItem('studyflow_active_timer_session');
    }
  };

  // Change mode
  const switchMode = (mode: TimerMode) => {
    setIsRunning(false);
    setTimerMode(mode);
    if (mode === 'pomodoro') setRemainingSeconds(pomodoroMinutes * 60);
    else if (mode === 'shortBreak') setRemainingSeconds(shortBreakMinutes * 60);
    else setRemainingSeconds(longBreakMinutes * 60);
  };

  // Pause / Resume
  const togglePlay = () => {
    if (!isRunning) {
      sessionStartTimeRef.current = Date.now();
    }
    setIsRunning(!isRunning);
  };

  // Reset with confirmation
  const confirmReset = () => {
    setIsRunning(false);
    if (timerMode === 'pomodoro') setRemainingSeconds(pomodoroMinutes * 60);
    else if (timerMode === 'shortBreak') setRemainingSeconds(shortBreakMinutes * 60);
    else setRemainingSeconds(longBreakMinutes * 60);
    localStorage.removeItem('studyflow_active_timer_session');
    setShowResetConfirm(false);
  };

  // Formatting MM:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress circle
  const totalSecondsForMode =
    timerMode === 'pomodoro'
      ? pomodoroMinutes * 60
      : timerMode === 'shortBreak'
      ? shortBreakMinutes * 60
      : longBreakMinutes * 60;
  const progressPercent = ((totalSecondsForMode - remainingSeconds) / totalSecondsForMode) * 100;

  // Compute accumulated study time today
  const todaySessions = studySessions.filter((s) => {
    const d = new Date(s.start_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const minutesStudiedToday = todaySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Temporizador Pomodoro</h1>
          <p className="text-xs text-zinc-400">
            Bloques de estudio ininterrumpidos con registro automático en tu perfil.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#141a26] text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
            title={soundEnabled ? 'Silenciar avisos' : 'Activar avisos sonoros'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* Main Clock Card */}
      <div className="card-dark rounded-3xl p-6 md:p-10 border border-zinc-800 relative overflow-hidden text-center space-y-6">
        {/* Mode Switch Tabs */}
        <div className="inline-flex bg-[#161c28] p-1.5 rounded-2xl border border-zinc-800 text-xs font-semibold">
          <button
            onClick={() => switchMode('pomodoro')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
              timerMode === 'pomodoro' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Concentración ({pomodoroMinutes}m)</span>
          </button>
          <button
            onClick={() => switchMode('shortBreak')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
              timerMode === 'shortBreak' ? 'bg-teal-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Descanso Corto ({shortBreakMinutes}m)</span>
          </button>
          <button
            onClick={() => switchMode('longBreak')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
              timerMode === 'longBreak' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Descanso Largo ({longBreakMinutes}m)</span>
          </button>
        </div>

        {/* Huge Digital Clock Display */}
        <div className="py-4">
          <div className="font-['JetBrains_Mono',monospace] text-6xl sm:text-8xl md:text-9xl font-black text-white tracking-tighter select-none">
            {timeFormatted}
          </div>
          <p className="text-xs uppercase font-bold tracking-widest text-emerald-400 mt-2">
            {isRunning ? 'Sesión en marcha' : 'Pausado'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="max-w-md mx-auto w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-3.5 rounded-2xl bg-[#18202d] hover:bg-[#202b3d] text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
            title="Reiniciar temporizador"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className={`px-8 py-4 rounded-2xl font-black text-sm tracking-wide transition shadow-xl flex items-center gap-3 cursor-pointer ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Iniciar Estudio</span>
              </>
            )}
          </button>
        </div>

        {/* Subject & Task Linker */}
        {timerMode === 'pomodoro' && (
          <div className="pt-6 border-t border-zinc-800/80 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Asignatura vinculada
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="">General / Sin asignar</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Deber vinculado (opcional)
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="">Ninguno</option>
                {assignments
                  .filter((a) => a.status !== 'completado')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                ¿Qué vas a estudiar en esta sesión?
              </label>
              <input
                type="text"
                placeholder="Ej: Repasar tema 4 y resolver problemas pares..."
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Completed Sessions Today */}
      <div className="card-dark rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sesiones Completadas Hoy</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Acumulado de hoy: <strong>{minutesStudiedToday} minutos</strong>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {todaySessions.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">
              Aún no has completado sesiones hoy. ¡Inicia tu primer bloque de 25 minutos!
            </p>
          ) : (
            todaySessions.map((ses) => {
              const sub = getSubject(ses.subject_id);
              return (
                <div
                  key={ses.id}
                  className="p-3 rounded-xl bg-[#161c28] border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                      {ses.duration_minutes}m
                    </div>
                    <div>
                      {sub && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: `${sub.color}20`, color: sub.color }}
                        >
                          {sub.name}
                        </span>
                      )}
                      <p className="text-zinc-200 font-semibold mt-0.5">
                        {ses.description || 'Sesión de concentración'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(ses.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl text-zinc-200 space-y-4">
            <h3 className="text-base font-bold text-white">¿Reiniciar la sesión?</h3>
            <p className="text-xs text-zinc-400">
              El tiempo transcurrido en este bloque no se guardará como sesión completada.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                Continuar
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition cursor-pointer"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

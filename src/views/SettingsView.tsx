import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  Database,
  Download,
  Upload,
  Globe,
  Share2,
  LogOut,
  Smartphone,
  ShieldCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
  triggerDailyReminderNow,
  PushStatus,
} from '../lib/pushNotifications';
import { getSupabaseConfig, resetSupabaseClient, getSupabaseClient } from '../lib/supabase';
import { dataService } from '../lib/storage';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  userEmail: string | null;
  onSignOut: () => void;
  pendingTasksSummary: string;
  onResetAllData: () => Promise<void>;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 7, label: 'Dom' },
];

export const SettingsView: React.FC<Props> = ({
  profile,
  onUpdateProfile,
  userEmail,
  onSignOut,
  pendingTasksSummary,
  onResetAllData,
}) => {
  // Reset confirmation modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Push status
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [reminderTime, setReminderTime] = useState(profile.reminder_time || '14:15');
  const [selectedDays, setSelectedDays] = useState<number[]>(profile.reminder_days || [1, 2, 3, 4, 5, 6, 7]);
  const [timezone, setTimezone] = useState(profile.timezone || 'Europe/Madrid');

  // Categories
  const [notifyDaily, setNotifyDaily] = useState(profile.notify_daily_reminder);
  const [notifyExams, setNotifyExams] = useState(profile.notify_upcoming_exams);
  const [notifyAssignments, setNotifyAssignments] = useState(profile.notify_due_assignments);
  const [notifyOverdue, setNotifyOverdue] = useState(profile.notify_overdue_tasks);
  const [notifySessions, setNotifySessions] = useState(profile.notify_study_sessions);

  // Supabase manual config
  const config = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(config.url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(config.anonKey || '');
  const [dbSaved, setDbSaved] = useState(false);

  // Export / Import
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Refresh push state on mount
  useEffect(() => {
    checkPush();
  }, []);

  const checkPush = async () => {
    const status = await getPushStatus();
    setPushStatus(status);
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushMessage(null);

    if (pushStatus?.isSubscribed) {
      const ok = await unsubscribeFromPush();
      if (ok) {
        setPushMessage({ type: 'success', text: 'Notificaciones desactivadas en este dispositivo.' });
      }
    } else {
      const res = await subscribeToPush();
      if (res.success) {
        setPushMessage({
          type: 'success',
          text: '¡Suscripción Web Push activada con éxito! Este dispositivo recibirá avisos programados.',
        });
      } else {
        setPushMessage({
          type: 'error',
          text: res.error || 'No se pudo activar la suscripción Web Push.',
        });
      }
    }

    await checkPush();
    setPushLoading(false);
  };

  const handleSendTestPush = async () => {
    setPushLoading(true);
    setPushMessage(null);
    const res = await sendTestNotification();
    setPushMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
    setPushLoading(false);
  };

  const handleTriggerNow = async () => {
    setPushLoading(true);
    setPushMessage(null);
    const res = await triggerDailyReminderNow(pendingTasksSummary);
    setPushMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
    setPushLoading(false);
  };

  const handleDayToggle = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId].sort());
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      reminder_time: reminderTime,
      reminder_days: selectedDays,
      timezone,
      notify_daily_reminder: notifyDaily,
      notify_upcoming_exams: notifyExams,
      notify_due_assignments: notifyAssignments,
      notify_overdue_tasks: notifyOverdue,
      notify_study_sessions: notifySessions,
    });
    setPushMessage({
      type: 'success',
      text: 'Preferencias de recordatorios guardadas correctamente en la nube.',
    });
  };

  const handleSaveDbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('studyflow_custom_supabase_url', supabaseUrl.trim());
    localStorage.setItem('studyflow_custom_supabase_anon_key', supabaseAnonKey.trim());
    resetSupabaseClient();
    setDbSaved(true);
    setTimeout(() => setDbSaved(false), 3000);
  };

  // Export data
  const handleExport = async () => {
    const json = await dataService.exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import data
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const ok = await dataService.importData(content);
      if (ok) {
        setImportStatus('¡Datos importados con éxito! Recargando aplicación...');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setImportStatus('Error: Archivo de respaldo no válido o dañado.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Ajustes y Notificaciones</h1>
        <p className="text-xs text-zinc-400">
          Configuración del sistema Web Push, horarios de recordatorio diario y sincronización en la nube.
        </p>
      </div>

      {pushMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
            pushMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {pushMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{pushMessage.text}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. SISTEMA WEB PUSH Y NOTIFICACIONES REALES              */}
      {/* ======================================================== */}
      <div className="card-dark rounded-2xl p-6 space-y-6 border border-emerald-500/20">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Recordatorios y Web Push en Segundo Plano</h2>
              <p className="text-xs text-zinc-400">
                Notificaciones directas al dispositivo incluso con la aplicación cerrada.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="text-right">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                pushStatus?.isSubscribed
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {pushStatus?.isSubscribed ? 'Suscrito' : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Device Permission Info Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#161c28] border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-medium">Permiso en el Navegador</span>
            <p className="font-bold text-white capitalize">
              {pushStatus ? pushStatus.permission : 'Comprobando...'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#161c28] border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-medium">Service Worker</span>
            <p className="font-bold text-emerald-400">
              {pushStatus?.registration ? 'Operativo (sw.js)' : 'Pendiente de activar'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#161c28] border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-medium">Soporte Push API</span>
            <p className="font-bold text-white">
              {pushStatus?.isSupported ? 'Compatible 100%' : 'No soportado en este visor'}
            </p>
          </div>
        </div>

        {/* iPhone / Safari specific guidance */}
        <div className="p-4 rounded-xl bg-[#141924] border border-zinc-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Smartphone className="w-4 h-4" />
            <span>Requisitos para iPhone / iPad (iOS 16.4+) y Windows:</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            Para recibir notificaciones Web Push en iPhone, debes pulsar <strong>Compartir <Share2 className="w-3 h-3 inline mx-0.5 text-zinc-400" /> &gt; «Añadir a la pantalla de inicio»</strong> en Safari y abrir StudyFlow desde el icono de tu pantalla de inicio. En Windows/Mac puedes activar el permiso directamente desde tu navegador con HTTPS.
          </p>
        </div>

        {/* Push Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-2 ${
              pushStatus?.isSubscribed
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>
              {pushStatus?.isSubscribed
                ? 'Desactivar en este dispositivo'
                : 'Activar Notificaciones en este Dispositivo'}
            </span>
          </button>

          <button
            onClick={handleSendTestPush}
            disabled={pushLoading}
            className="px-4 py-2.5 rounded-xl bg-[#161c28] hover:bg-[#1d2535] text-zinc-200 border border-zinc-700 font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enviar Notificación de Prueba</span>
          </button>

          <button
            onClick={handleTriggerNow}
            disabled={pushLoading}
            className="px-4 py-2.5 rounded-xl bg-[#161c28] hover:bg-[#1d2535] text-amber-300 border border-amber-500/30 font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
            title="Genera un aviso real con tus deberes pendientes y exámenes de hoy"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Emitir Resumen Diario Ahora</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. PROGRAMACIÓN DEL RECORDATORIO DIARIO Y CATEGORÍAS     */}
      {/* ======================================================== */}
      <form onSubmit={handleSavePreferences} className="card-dark rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Programación del Recordatorio Diario</h2>
            <p className="text-xs text-zinc-400">
              Personaliza la hora exacta y los días de envío de tu informe académico.
            </p>
          </div>
        </div>

        {/* Time and Timezone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Hora del recordatorio diario (editable)
            </label>
            <input
              type="time"
              required
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-sm text-white focus:outline-hidden focus:border-emerald-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Configurado inicialmente a las 14:15.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Zona horaria del usuario
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Respeta automáticamente el horario de verano.</p>
          </div>
        </div>

        {/* Days of week selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300">
            Días de la semana para recibir el aviso
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDays.includes(day.id);
              return (
                <button
                  type="button"
                  key={day.id}
                  onClick={() => handleDayToggle(day.id)}
                  className={`w-11 h-11 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                      : 'bg-[#161c28] text-zinc-400 border-zinc-700/80 hover:text-white'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories toggles */}
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Categorías de notificaciones activas
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#161c28] border border-zinc-800 cursor-pointer hover:bg-[#1a2130]">
              <input
                type="checkbox"
                checked={notifyDaily}
                onChange={(e) => setNotifyDaily(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-emerald-500"
              />
              <span className="text-zinc-200">Resumen diario general</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#161c28] border border-zinc-800 cursor-pointer hover:bg-[#1a2130]">
              <input
                type="checkbox"
                checked={notifyExams}
                onChange={(e) => setNotifyExams(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-emerald-500"
              />
              <span className="text-zinc-200">Aviso de examen próximo</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#161c28] border border-zinc-800 cursor-pointer hover:bg-[#1a2130]">
              <input
                type="checkbox"
                checked={notifyAssignments}
                onChange={(e) => setNotifyAssignments(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-emerald-500"
              />
              <span className="text-zinc-200">Aviso de entrega cercana</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#161c28] border border-zinc-800 cursor-pointer hover:bg-[#1a2130]">
              <input
                type="checkbox"
                checked={notifyOverdue}
                onChange={(e) => setNotifyOverdue(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-emerald-500"
              />
              <span className="text-zinc-200">Aviso de deber atrasado</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#161c28] border border-zinc-800 cursor-pointer hover:bg-[#1a2130]">
              <input
                type="checkbox"
                checked={notifySessions}
                onChange={(e) => setNotifySessions(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-emerald-500"
              />
              <span className="text-zinc-200">Recordatorio de sesión de estudio</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition cursor-pointer"
        >
          Guardar Preferencias de Horarios
        </button>
      </form>

      {/* ======================================================== */}
      {/* 3. CONEXIÓN SUPABASE CLOUD POSTGRESQL                    */}
      {/* ======================================================== */}
      <div className="card-dark rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Base de Datos Supabase PostgreSQL en la Nube</h2>
            <p className="text-xs text-zinc-400">
              Conexión directa para sincronizar datos entre móvil, tableta y ordenador.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveDbConfig} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
              Project URL de Supabase
            </label>
            <input
              type="url"
              placeholder="https://xyzabcdef.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
              Anon Public Key de Supabase
            </label>
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition cursor-pointer"
            >
              Guardar y Conectar Supabase
            </button>
            {dbSaved && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> ¡Conexión guardada!
              </span>
            )}
          </div>
        </form>

        <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
          Encuentra el script de migración SQL con RLS en <code>supabase/migrations/20261018_initial_studyflow_schema.sql</code>.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 4. RESPALDO Y EXPORTACIÓN / IMPORTACIÓN DE DATOS         */}
      {/* ======================================================== */}
      <div className="card-dark rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Copia de Seguridad y Migración</span>
        </h2>
        <p className="text-xs text-zinc-400">
          Exporta todos tus deberes, exámenes y notas en un archivo JSON seguro o restaura un respaldo previo.
        </p>

        {importStatus && (
          <p className="text-xs text-emerald-400 font-semibold">{importStatus}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-[#161c28] hover:bg-[#1f2738] text-zinc-200 border border-zinc-700 text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Descargar Copia de Seguridad JSON</span>
          </button>

          <label className="px-4 py-2 rounded-xl bg-[#161c28] hover:bg-[#1f2738] text-zinc-200 border border-zinc-700 text-xs font-semibold transition flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-teal-400" />
            <span>Restaurar Respaldo JSON</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. REINICIAR DATOS A CERO (LIENZO EN BLANCO)             */}
      {/* ======================================================== */}
      <div className="card-dark rounded-2xl p-6 space-y-4 border border-rose-500/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Reiniciar a Cero (Lienzo en Blanco)</h2>
            <p className="text-xs text-zinc-400">
              Vacía todas tus tareas, deberes, exámenes y sesiones para comenzar completamente de cero.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Vaciar Todo y Empezar de Cero</span>
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12161f] border border-rose-500/40 p-6 shadow-2xl text-zinc-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white text-center">¿Confirmar reinicio total?</h3>
            <p className="text-xs text-zinc-400 text-center leading-relaxed">
              Esta acción eliminará todos los deberes, exámenes, asignaturas y sesiones registradas, dejándote la aplicación 100% limpia sin nada predeterminado.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  await onResetAllData();
                  setIsResetting(false);
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition cursor-pointer"
              >
                {isResetting ? 'Vaciando...' : 'Sí, vaciar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CUENTA Y CIERRE DE SESIÓN                             */}
      {/* ======================================================== */}
      {userEmail && (
        <div className="card-dark rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Sesión Activa</h3>
            <p className="text-xs text-zinc-400">{userEmail}</p>
          </div>
          <button
            onClick={onSignOut}
            className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </div>
  );
};

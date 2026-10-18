import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Timer,
  BarChart3,
  Settings,
  Flame,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { SyncState } from '../lib/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  syncState: SyncState;
  minutesStudiedToday: number;
  dailyGoalMinutes: number;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  syncState,
  minutesStudiedToday,
  dailyGoalMinutes,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Mi Día', icon: LayoutDashboard },
    { id: 'assignments', label: 'Deberes', icon: CheckSquare },
    { id: 'calendar', label: 'Calendario', icon: CalendarDays },
    { id: 'subjects', label: 'Asignaturas', icon: BookOpen },
    { id: 'exams', label: 'Exámenes', icon: GraduationCap },
    { id: 'timer', label: 'Estudio', icon: Timer },
    { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const goalPercent = Math.min(100, Math.round((minutesStudiedToday / Math.max(1, dailyGoalMinutes)) * 100));

  return (
    <>
      {/* ======================================================== */}
      {/* DESKTOP SIDEBAR (Visible on md and above)                 */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0c0f16] border-r border-[#1a2230] z-30 select-none">
        {/* Brand header */}
        <div className="p-5 border-b border-[#1a2230] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-950/60">
              <span className="font-extrabold text-black text-sm tracking-tighter">SF</span>
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight text-base leading-tight">StudyFlow</h1>
              <p className="text-[11px] text-zinc-400 font-medium">Central Académica</p>
            </div>
          </div>
          {/* Cloud Sync Status Icon */}
          <div
            className="flex items-center"
            title={
              syncState === 'synced'
                ? 'Sincronizado con Supabase Cloud'
                : syncState === 'saving'
                ? 'Guardando cambios en la nube...'
                : syncState === 'error'
                ? 'Error al sincronizar con la nube'
                : 'Modo local activo'
            }
          >
            {syncState === 'synced' && <Cloud className="w-4 h-4 text-emerald-400" />}
            {syncState === 'saving' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
            {syncState === 'local' && <CloudOff className="w-4 h-4 text-zinc-500" />}
            {syncState === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          </div>
        </div>

        {/* Daily Goal Quick Gauge */}
        <div className="mx-4 my-4 p-3.5 rounded-xl bg-[#121722] border border-[#1d2738]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Meta de hoy
            </span>
            <span className="font-semibold text-emerald-400 text-[11px]">
              {minutesStudiedToday}/{dailyGoalMinutes} min ({goalPercent}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>

        {/* Navigation items list */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141a26]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop Footer Actions */}
        <div className="p-4 border-t border-[#1a2230] space-y-2">
          <PWAInstallButton variant="full" />
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Visible below md)          */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Visible below md)          */}
      {/* ======================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d1017]/95 backdrop-blur-md border-t border-[#1a2230] z-40 safe-bottom">
        <div className="grid grid-cols-6 items-center px-1 py-1">
          {/* 1. Mi Día */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Mi Día</span>
          </button>

          {/* 2. Deberes */}
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'assignments' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'assignments' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <CheckSquare className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Deberes</span>
          </button>

          {/* 3. Calendario */}
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'calendar' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'calendar' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <CalendarDays className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Cal.</span>
          </button>

          {/* 4. Exámenes */}
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'exams' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'exams' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Exámenes</span>
          </button>

          {/* 5. Estudio / Pomodoro */}
          <button
            onClick={() => setActiveTab('timer')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'timer' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'timer' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <Timer className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Estudio</span>
          </button>

          {/* 6. AJUSTES (DIRECTAMENTE VISIBLE Y ACCESIBLE SIEMPRE) */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'settings' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'settings' ? 'bg-emerald-500/15 text-emerald-400' : ''}`}>
              <Settings className="w-4 h-4" />
            </div>
            <span className="mt-0.5 leading-tight truncate">Ajustes</span>
          </button>
        </div>
      </nav>
    </>
  );
};

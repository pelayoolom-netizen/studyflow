import React from 'react';
import { Cloud, CloudOff, RefreshCw, UserCheck, LogIn } from 'lucide-react';
import { SyncState } from '../lib/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  syncState: SyncState;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

export const Header: React.FC<Props> = ({
  syncState,
  userEmail,
  onOpenAuth,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Capitalize first letter of weekday
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <header className="sticky top-0 z-20 bg-[#090b0e]/85 backdrop-blur-md border-b border-[#181f2c] px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Date & Title */}
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
          Central Diaria
        </span>
        <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
          {capitalizedDate}
        </h2>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Sync Status Badge */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            syncState === 'synced'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : syncState === 'saving'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              : syncState === 'error'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40'
          }`}
        >
          {syncState === 'synced' && (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nube conectada</span>
            </>
          )}
          {syncState === 'saving' && (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Guardando...</span>
            </>
          )}
          {syncState === 'local' && (
            <>
              <CloudOff className="w-3.5 h-3.5 text-zinc-400" />
              <span>Modo local</span>
            </>
          )}
          {syncState === 'error' && (
            <>
              <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Error de sincronización</span>
            </>
          )}
        </div>

        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* Supabase User Account Button */}
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141a26] hover:bg-[#1b2333] border border-[#222c3d] text-xs font-medium text-zinc-200 transition cursor-pointer"
        >
          {userEmail ? (
            <>
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline max-w-[120px] truncate text-zinc-300">
                {userEmail.split('@')[0]}
              </span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cuenta en la Nube</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

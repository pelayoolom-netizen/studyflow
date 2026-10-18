import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, Monitor } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<Props> = ({ className = '', variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already running standalone, do not show button
  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleAction}
        className={`flex items-center gap-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
          variant === 'full'
            ? 'w-full justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
            : 'px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        } ${className}`}
        title="Instalar StudyFlow como App Nativa"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>Instalar App</span>
      </button>

      {/* Guide Modal for iOS Safari & Desktop Edge/Chrome */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#12161f] border border-zinc-800 p-6 shadow-2xl relative text-zinc-200 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Instalar StudyFlow</h3>
                <p className="text-xs text-zinc-400">Acceso instantáneo y notificaciones en tu dispositivo</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 bg-[#181f2b] p-4 rounded-xl border border-zinc-800 text-sm">
                <p className="font-semibold text-emerald-400 flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> Pasos para iPhone / iPad (Safari):
                </p>
                <ol className="list-decimal list-inside space-y-2 text-zinc-300 text-xs leading-relaxed">
                  <li>Toca el botón <strong>Compartir</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-zinc-400" /> en la barra inferior de Safari.</li>
                  <li>Desplázate hacia abajo y selecciona <strong>«Añadir a la pantalla de inicio»</strong>.</li>
                  <li>Pulsa en <strong>Añadir</strong> en la esquina superior derecha.</li>
                </ol>
                <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800">
                  Nota: iOS requiere abrir la app añadida a la pantalla de inicio para recibir notificaciones Web Push.
                </p>
              </div>
            ) : (
              <div className="space-y-3 bg-[#181f2b] p-4 rounded-xl border border-zinc-800 text-sm">
                <p className="font-semibold text-emerald-400 flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Pasos para Windows / Mac / Android:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-zinc-300 text-xs leading-relaxed">
                  <li>Si usas Chrome o Edge, pulsa el icono de <strong>Instalar</strong> en la barra de direcciones superior.</li>
                  <li>O bien abre el menú de tres puntos (⋮) y selecciona <strong>«Instalar StudyFlow»</strong>.</li>
                  <li>Se integrará en tu barra de tareas o pantalla de inicio como una aplicación de escritorio nativa.</li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs text-white transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

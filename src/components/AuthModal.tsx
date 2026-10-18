import React, { useState } from 'react';
import { X, KeyRound, Mail, Lock, LogOut, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { getSupabaseClient, getSupabaseConfig, resetSupabaseClient } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  onAuthSuccess: (email: string | null) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  userEmail,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'config'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Custom Supabase config inputs
  const config = getSupabaseConfig();
  const [customUrl, setCustomUrl] = useState(config.url || '');
  const [customKey, setCustomKey] = useState(config.anonKey || '');

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatusMsg({
        type: 'error',
        text: 'Primero debes configurar la URL y la Anon Key de Supabase en la pestaña "Configurar Nube".',
      });
      setMode('config');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          setStatusMsg({ type: 'success', text: '¡Cuenta creada e iniciada con éxito en la nube!' });
          onAuthSuccess(data.user?.email || email);
          setTimeout(onClose, 1200);
        } else {
          setStatusMsg({
            type: 'success',
            text: 'Registro completado. Por favor, revisa tu correo electrónico para confirmar la cuenta.',
          });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setStatusMsg({ type: 'success', text: '¡Sesión iniciada con éxito! Sincronizando datos...' });
        onAuthSuccess(data.user?.email || email);
        setTimeout(onClose, 1000);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error al autenticar con Supabase. Revisa las credenciales.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    onAuthSuccess(null);
    setLoading(false);
    onClose();
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('studyflow_custom_supabase_url', customUrl.trim());
    localStorage.setItem('studyflow_custom_supabase_anon_key', customKey.trim());
    resetSupabaseClient();
    setStatusMsg({
      type: 'success',
      text: '¡Conexión guardada! Ahora puedes iniciar sesión con tu cuenta de Supabase.',
    });
    setMode('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#11151e] border border-zinc-800 p-6 shadow-2xl relative text-zinc-200 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {userEmail ? (
          /* User is logged in */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sesión Activa en la Nube</h3>
                <p className="text-xs text-zinc-400">{userEmail}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Tus deberes, notas y calendario se sincronizan en tiempo real entre tus dispositivos.</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        ) : (
          /* Login / Signup / Config Tabs */
          <div>
            <div className="flex items-center justify-between mb-4 pr-6">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {mode === 'login' ? 'Iniciar Sesión' : mode === 'signup' ? 'Crear Cuenta' : 'Conexión Supabase'}
                </h3>
              </div>
            </div>

            {/* Mode switch pills */}
            <div className="flex gap-1 p-1 bg-[#161c28] rounded-xl mb-4 text-xs">
              <button
                type="button"
                onClick={() => { setMode('login'); setStatusMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  mode === 'login' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setStatusMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  mode === 'signup' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Registrarse
              </button>
              <button
                type="button"
                onClick={() => { setMode('config'); setStatusMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  mode === 'config' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Database className="w-3 h-3 inline mr-1" />
                Nube
              </button>
            </div>

            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs mb-4 flex items-start gap-2 ${
                  statusMsg.type === 'error'
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                {statusMsg.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {mode === 'config' ? (
              <form onSubmit={handleSaveConfig} className="space-y-3">
                <p className="text-xs text-zinc-400">
                  Introduce las credenciales de tu proyecto Supabase para sincronizar datos reales en la nube PostgreSQL:
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition mt-2 cursor-pointer"
                >
                  Guardar Conexión
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      placeholder="estudiante@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161c28] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition mt-4 disabled:opacity-50 cursor-pointer"
                >
                  {loading
                    ? 'Procesando...'
                    : mode === 'signup'
                    ? 'Crear mi cuenta'
                    : 'Acceder a StudyFlow'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

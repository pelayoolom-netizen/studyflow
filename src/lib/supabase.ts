import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get configuration from env or local storage
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const getSupabaseConfig = () => {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('studyflow_custom_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('studyflow_custom_supabase_anon_key') : null;

  const url = localUrl || envUrl || '';
  const anonKey = localKey || envAnonKey || '';

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20
  );

  return { url, anonKey, isConfigured };
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
};

// Reset client when user updates keys in Settings
export const resetSupabaseClient = () => {
  clientInstance = null;
  return getSupabaseClient();
};

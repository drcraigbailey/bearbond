import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const REMAIN_LOGGED_IN_KEY = 'bearbond.remainLoggedIn';

const safeStorage = (storageName) => {
  if (typeof window === 'undefined') return null;

  try {
    return window[storageName];
  } catch (_error) {
    return null;
  }
};

export const getRemainLoggedInPreference = () => {
  const localStorage = safeStorage('localStorage');
  return localStorage?.getItem(REMAIN_LOGGED_IN_KEY) !== 'false';
};

const isSupabaseAuthKey = (key) => key.startsWith('sb-');

const getAuthKeys = (storage) => {
  if (!storage) return [];

  return Object.keys(storage).filter(isSupabaseAuthKey);
};

export const migrateSupabaseAuthStorage = (shouldRemainLoggedIn) => {
  const localStorage = safeStorage('localStorage');
  const sessionStorage = safeStorage('sessionStorage');

  if (!localStorage || !sessionStorage) return;

  const preferredStorage = shouldRemainLoggedIn ? localStorage : sessionStorage;
  const oldStorage = shouldRemainLoggedIn ? sessionStorage : localStorage;
  const authKeys = new Set([...getAuthKeys(localStorage), ...getAuthKeys(sessionStorage)]);

  authKeys.forEach((key) => {
    const value = preferredStorage.getItem(key) || oldStorage.getItem(key);

    if (value) {
      preferredStorage.setItem(key, value);
    }

    oldStorage.removeItem(key);
  });
};

export const setRemainLoggedInPreference = (shouldRemainLoggedIn) => {
  const localStorage = safeStorage('localStorage');

  if (localStorage) {
    localStorage.setItem(REMAIN_LOGGED_IN_KEY, shouldRemainLoggedIn ? 'true' : 'false');
  }

  migrateSupabaseAuthStorage(shouldRemainLoggedIn);
};

const authStorage = {
  getItem: (key) => {
    const localStorage = safeStorage('localStorage');
    const sessionStorage = safeStorage('sessionStorage');

    if (getRemainLoggedInPreference()) {
      return localStorage?.getItem(key) || sessionStorage?.getItem(key) || null;
    }

    return sessionStorage?.getItem(key) || localStorage?.getItem(key) || null;
  },
  setItem: (key, value) => {
    const localStorage = safeStorage('localStorage');
    const sessionStorage = safeStorage('sessionStorage');

    if (getRemainLoggedInPreference()) {
      localStorage?.setItem(key, value);
      sessionStorage?.removeItem(key);
      return;
    }

    sessionStorage?.setItem(key, value);
    localStorage?.removeItem(key);
  },
  removeItem: (key) => {
    safeStorage('localStorage')?.removeItem(key);
    safeStorage('sessionStorage')?.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});


/*
 * Mokhleshpur High School — Supabase connection
 * Uses the public/publishable key only.
 * Never put a service_role or secret key here.
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://wolxiieqyqeihvdefomd.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_uBD6HEEQTsmJncjvdSeUWw_cCSlcrrF';

  function initializeSupabase() {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== 'function'
    ) {
      throw new Error('Supabase JS library is not loaded.');
    }

    if (
      !SUPABASE_PUBLISHABLE_KEY ||
      SUPABASE_PUBLISHABLE_KEY ===
        'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'
    ) {
      throw new Error(
        'Add the Supabase publishable key in js/supabase.js first.'
      );
    }

    if (!window.mhsSupabase) {
      // Keep Admin, Teacher and Student Auth sessions separate.
      // All three portals share the same origin, so Supabase's default
      // storage key would otherwise let one portal overwrite another portal's
      // signed-in user when used in parallel tabs.
      const path = String(window.location.pathname || '').toLowerCase();
      const storageKey = path.includes('/admin/')
        ? 'mhs-admin-auth'
        : path.includes('/teacher/')
          ? 'mhs-teacher-auth'
          : path.includes('/student/')
            ? 'mhs-student-auth'
            : 'mhs-public-auth';

      window.mhsSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            storageKey,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }

    return window.mhsSupabase;
  }

  window.mhsInitializeSupabase = initializeSupabase;

  window.mhsSupabaseReady = new Promise((resolve, reject) => {
    const start = () => {
      try {
        resolve(initializeSupabase());
      } catch (error) {
        reject(error);
      }
    };

    if (
      window.supabase &&
      typeof window.supabase.createClient === 'function'
    ) {
      start();
      return;
    }

    const script = document.createElement('script');

    script.src =
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

    script.async = true;

    script.onload = start;

    script.onerror = () => {
      reject(
        new Error(
          'Could not load Supabase JS. Check your internet connection.'
        )
      );
    };

    document.head.appendChild(script);
  });
})();

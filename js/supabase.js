/* Mokhleshpur High School — Supabase connection
   Uses the public/publishable key only. Never put a service_role/secret key here. */
(function () {
  const SUPABASE_URL = 'https://wolxiieqyqeihvdefomd.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE';

  function initializeSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase JS library is not loaded.');
    }
    if (SUPABASE_PUBLISHABLE_KEY === 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE') {
      throw new Error('Add the Supabase publishable key in js/supabase.js first.');
    }
    if (!window.mhsSupabase) {
      window.mhsSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );
    }
    return window.mhsSupabase;
  }

  window.mhsInitializeSupabase = initializeSupabase;
  window.mhsSupabaseReady = new Promise((resolve, reject) => {
    const start = () => {
      try { resolve(initializeSupabase()); }
      catch (error) { reject(error); }
    };

    if (window.supabase && typeof window.supabase.createClient === 'function') {
      start();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = start;
    script.onerror = () => reject(new Error('Could not load Supabase JS library.'));
    document.head.appendChild(script);
  });
})();

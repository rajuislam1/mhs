/*
 * MHS protected portal guard.
 * Client-side route gating is paired with Supabase RLS for actual data security.
 * Never rely on sessionStorage flags as proof of authentication.
 */
(function () {
  'use strict';

  const path = window.location.pathname.toLowerCase();
  const isAdmin = /\/admin\/(index\.html)?$/.test(path);
  const isTeacher = /\/teacher\/(index\.html)?$/.test(path);
  if (!isAdmin && !isTeacher) return;

  document.documentElement.style.visibility = 'hidden';

  const expectedRole = isAdmin ? 'super_admin' : 'teacher';
  const loginPath = isAdmin ? './login.html' : './login.html';

  async function protectPortal() {
    try {
      if (!window.mhsSupabaseReady) throw new Error('Supabase client unavailable');
      const supabase = await window.mhsSupabaseReady;
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        window.location.replace(loginPath);
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id, role, is_active')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !profile || profile.id !== session.user.id ||
          profile.role !== expectedRole || profile.is_active !== true) {
        await supabase.auth.signOut();
        sessionStorage.removeItem('mhs_admin');
        sessionStorage.removeItem('mhs_teacher');
        window.location.replace(loginPath);
        return;
      }

      // Session flags remain for legacy UI compatibility only; Supabase is authoritative.
      document.documentElement.style.visibility = '';
    } catch (error) {
      console.error('Portal authentication check failed:', error);
      document.documentElement.style.visibility = '';
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.style.cssText = 'margin:2rem;padding:1rem;color:#8b1e1e;background:#fff3f3;border-radius:8px';
      message.textContent = 'Unable to verify your login securely. Please refresh or sign in again.';
      document.body.prepend(message);
    }
  }

  protectPortal();
})();

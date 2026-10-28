/*
 * MHS protected portal guard.
 * Browser route checks improve navigation UX; Supabase RLS must secure data access.
 * sessionStorage flags are retained only for legacy UI compatibility, never as proof of auth.
 */
(function () {
  'use strict';
  const path = window.location.pathname.toLowerCase();
  const isAdmin = /\/admin\/(index\.html)?$/.test(path);
  const isTeacher = /\/teacher\/(index\.html)?$/.test(path);
  if (!isAdmin && !isTeacher) return;

  document.documentElement.style.visibility = 'hidden';
  const expectedRole = isAdmin ? 'super_admin' : 'teacher';
  const loginPath = './login.html';

  // Use Supabase Auth logout even if legacy portal scripts also register a click handler.
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('#logout');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    try {
      const sb = await window.mhsSupabaseReady;
      const { error } = await sb.auth.signOut();
      if (error) throw error;
      sessionStorage.removeItem('mhs_admin');
      sessionStorage.removeItem('mhs_teacher');
      window.location.replace(loginPath);
    } catch (error) {
      console.error('Logout failed:', error);
      button.disabled = false;
      alert('Logout could not be completed. Please try again.');
    }
  }, true);

  async function protectPortal() {
    try {
      if (!window.mhsSupabaseReady) throw new Error('Supabase client unavailable');
      const sb = await window.mhsSupabaseReady;
      const { data, error: sessionError } = await sb.auth.getSession();
      const session = data && data.session;
      if (sessionError || !session || !session.user) {
        window.location.replace(loginPath);
        return;
      }
      const { data: profile, error } = await sb.from('user_profiles')
        .select('id, role, is_active')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !profile || profile.id !== session.user.id ||
          profile.role !== expectedRole || profile.is_active !== true) {
        await sb.auth.signOut();
        sessionStorage.removeItem('mhs_admin');
        sessionStorage.removeItem('mhs_teacher');
        window.location.replace(loginPath);
        return;
      }
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

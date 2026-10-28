/*
 * MHS protected portal guard.
 * Client-side checks are for route UX; RLS is the actual data-security boundary.
 */
(function () {
  'use strict';
  const path = window.location.pathname.toLowerCase();
  const isAdmin = /\/admin\/(index\.html)?$/.test(path);
  const isTeacher = /\/teacher\/(index\.html)?$/.test(path);
  const isStudent = /\/student\/(index\.html)?$/.test(path);
  if (!isAdmin && !isTeacher && !isStudent) return;

  document.documentElement.style.visibility = 'hidden';
  const expectedRole = isAdmin ? 'super_admin' : (isTeacher ? 'teacher' : 'student');
  const loginPath = './login.html';

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
      sessionStorage.removeItem('mhs_student');
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
        sessionStorage.removeItem('mhs_student');
        window.location.replace(loginPath);
        return;
      }
      document.documentElement.style.visibility = '';
    } catch (error) {
      console.error('Portal authentication check failed:', error);
      document.body.innerHTML = '';
      document.documentElement.style.visibility = 'visible';
      document.body.style.cssText = 'font-family:system-ui;min-height:100vh;display:grid;place-items:center;background:#f3f7f5;margin:0';
      const message = document.createElement('main');
      message.setAttribute('role', 'alert');
      message.style.cssText = 'max-width:520px;margin:24px;padding:24px;color:#8b1e1e;background:#fff;border-radius:12px;box-shadow:0 4px 18px #0001';
      const heading = document.createElement('h1');
      heading.textContent = 'Secure login check unavailable';
      const detail = document.createElement('p');
      detail.textContent = 'Protected content is hidden because your session could not be verified. Check your connection and sign in again.';
      const link = document.createElement('a');
      link.href = loginPath;
      link.textContent = 'Return to login';
      message.append(heading, detail, link);
      document.body.appendChild(message);
    }
  }
  protectPortal();
})();

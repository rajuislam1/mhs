document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value;
  const msg = document.getElementById('msg');
  const button = e.currentTarget.querySelector('button[type="submit"]');

  msg.textContent = 'Signing in...';
  button.disabled = true;

  try {
    if (!window.mhsSupabaseReady) throw new Error('Supabase connection is not configured.');
    const supabase = await window.mhsSupabaseReady;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Authentication failed: ' + error.message);
    if (!data.user) throw new Error('Login succeeded but no user was returned.');

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles').select('id, role, is_active').eq('id', data.user.id).maybeSingle();

    if (profileError) throw new Error('Profile query failed: ' + profileError.message);
    if (!profile) throw new Error('No user profile found for this login account.');
    if (!['super_admin', 'admin', 'moderator'].includes(profile.role)) throw new Error('This account does not have Admin Portal access.');
    if (profile.is_active !== true) throw new Error('Administrator account is inactive.');

    sessionStorage.setItem('mhs_admin', '1');
    sessionStorage.setItem('mhs_admin_role', profile.role);
    sessionStorage.setItem('mhs_admin_permissions', JSON.stringify(profile.permissions || {}));
    sessionStorage.setItem('mhs_admin_name', data.user.user_metadata?.display_name || data.user.email || 'Administrator');
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Admin login error:', error);
    msg.textContent = error.message || 'Login failed. Please try again.';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('forgot-password').addEventListener('click', async () => {
  const emailInput = document.getElementById('u');
  const msg = document.getElementById('msg');
  const email = emailInput.value.trim();

  if (!email) {
    msg.textContent = 'প্রথমে Administrator Email লিখুন, তারপর Forgot Password চাপুন।';
    emailInput.focus();
    return;
  }

  const button = document.getElementById('forgot-password');
  button.disabled = true;
  msg.textContent = 'Sending password recovery email...';

  try {
    const supabase = await window.mhsSupabaseReady;
    const redirectTo = window.location.origin + '/admin/reset-password.html';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    msg.textContent = 'যদি এই ইমেইলে Admin account থাকে, password reset link পাঠানো হয়েছে। Inbox/Spam দেখুন।';
  } catch (error) {
    console.error('Password recovery error:', error);
    msg.textContent = error.message || 'Could not send password recovery email.';
  } finally {
    button.disabled = false;
  }
});

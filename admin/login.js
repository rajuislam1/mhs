
document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value;
  const msg = document.getElementById('msg');
  const button = e.currentTarget.querySelector('button');

  msg.textContent = 'Signing in...';
  button.disabled = true;

  try {
    if (!window.mhsSupabaseReady) {
      throw new Error('Supabase connection is not configured.');
    }

    const supabase = await window.mhsSupabaseReady;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error('Authentication failed: ' + error.message);
    }

    if (!data.user) {
      throw new Error('Login succeeded but no user was returned.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile query failed:', profileError);
      throw new Error(
        'Profile query failed: ' + profileError.message
      );
    }

    if (!profile) {
      console.error('No profile found for user ID:', data.user.id);
      throw new Error('No user profile found for this login account.');
    }

    console.log('Admin profile check:', {
      idMatches: profile.id === data.user.id,
      role: profile.role,
      is_active: profile.is_active
    });

    if (profile.role !== 'super_admin') {
      await supabase.auth.signOut();
      throw new Error(
        'Incorrect role returned: ' + String(profile.role)
      );
    }

    if (profile.is_active !== true) {
      await supabase.auth.signOut();
      throw new Error(
        'Administrator account is inactive. Returned value: ' +
        String(profile.is_active)
      );
    }

    sessionStorage.setItem('mhs_admin', '1');
    window.location.href = 'index.html';

  } catch (error) {
    console.error('Admin login error:', error);
    msg.textContent = error.message || 'Login failed. Please try again.';
  } finally {
    button.disabled = false;
  }
});

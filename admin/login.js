
document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value;
  const msg = document.getElementById('msg');
  const button = e.currentTarget.querySelector('button');

  msg.textContent = 'Signing in...';
  button.disabled = true;

  try {
    const supabase = await window.mhsSupabaseReady;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== 'super_admin' || !profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('This account does not have active administrator access.');
    }

    sessionStorage.setItem('mhs_admin', '1');
    window.location.href = 'index.html';

  } catch (error) {
    msg.textContent = error.message || 'Login failed. Please try again.';
  } finally {
    button.disabled = false;
  }
});

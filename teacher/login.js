
document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('u').value.trim().toLowerCase();
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

    if (error) throw new Error('Login failed: ' + error.message);
    if (!data.user) throw new Error('No user returned.');

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active, display_name')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) { await supabase.auth.signOut(); throw new Error('Could not verify teacher profile.'); }
    if (!profile || profile.role !== 'teacher' || profile.is_active !== true) {
      await supabase.auth.signOut();
      throw new Error('This account does not have active teacher access.');
    }

    const metadata = data.user.user_metadata || {};

    const teacherSession = {
      id: data.user.id,
      name: profile.display_name || metadata.display_name || email,
      username: metadata.username || email,
      email,
      subject: metadata.subject || '',
      designation: 'Teacher'
    };

    sessionStorage.setItem('mhs_teacher', JSON.stringify(teacherSession));
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Teacher login error:', error);
    msg.textContent = error.message || 'Login failed. Please try again.';
  } finally {
    button.disabled = false;
  }
});

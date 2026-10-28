document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const identifier = document.getElementById('u').value.trim();
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

    // The server resolves username to the linked Auth email and validates
    // credentials without exposing the teacher's email lookup to the browser.
    const response = await fetch('../api/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.session) {
      throw new Error(result?.error || 'Invalid username/email or password.');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token
    });

    if (sessionError) throw sessionError;

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data?.user) throw new Error('Could not verify the signed-in account.');

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active, display_name, teacher_id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      throw new Error('Could not verify teacher profile.');
    }

    if (!profile || profile.role !== 'teacher' || profile.is_active !== true) {
      await supabase.auth.signOut();
      throw new Error('This account does not have active teacher access.');
    }

    const metadata = data.user.user_metadata || {};

    const teacherSession = {
      id: data.user.id,
      name: profile.display_name || metadata.display_name || data.user.email,
      username: result.username || metadata.username || identifier,
      email: data.user.email,
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

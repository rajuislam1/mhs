const form = document.getElementById('reset-form');
const msg = document.getElementById('msg');
const saveButton = document.getElementById('save-password');

(async function verifyRecoverySession() {
  try {
    const supabase = await window.mhsSupabaseReady;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      msg.textContent = 'এই reset link টি invalid বা expired। Admin Login থেকে নতুন recovery link নিন।';
      saveButton.disabled = true;
    }
  } catch (error) {
    console.error('Recovery session error:', error);
    msg.textContent = 'Recovery session যাচাই করা যায়নি। নতুন reset link নিন।';
    saveButton.disabled = true;
  }
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password.length < 8) {
    msg.textContent = 'Password কমপক্ষে ৮ অক্ষরের হতে হবে।';
    return;
  }
  if (password !== confirmPassword) {
    msg.textContent = 'দুটি Password মিলছে না।';
    return;
  }

  saveButton.disabled = true;
  msg.textContent = 'Updating password...';
  try {
    const supabase = await window.mhsSupabaseReady;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) throw new Error('Recovery link invalid বা expired। নতুন link নিন।');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    await supabase.auth.signOut();
    msg.textContent = 'Password সফলভাবে পরিবর্তন হয়েছে। এখন নতুন Password দিয়ে Admin Login করুন।';
    form.reset();
  } catch (error) {
    console.error('Password update error:', error);
    msg.textContent = error.message || 'Password update করা যায়নি।';
  } finally {
    saveButton.disabled = false;
  }
});

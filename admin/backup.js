/* MHS Supabase database backup — authenticated Super Admin only. */
(function () {
  'use strict';
  const button = document.getElementById('backupData');
  if (!button) return;
  button.addEventListener('click', async function () {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Preparing database backup…';
    try {
      const sb = await window.mhsSupabaseReady;
      const { data, error } = await sb.auth.getSession();
      if (error || !data?.session?.access_token) throw new Error('Admin session expired. Sign in again.');
      const response = await fetch('/api/admin-backup', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + data.session.access_token, Accept: 'application/json' },
        cache: 'no-store'
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.backup) {
        throw new Error(result?.error || 'Could not create Supabase database backup.');
      }
      const payload = result.backup;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = 'mhs-supabase-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const rows = Object.values(payload.rowCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      const message = 'Supabase backup downloaded: ' + payload.tableCount + ' tables, ' + rows + ' rows. Keep this file securely; it contains student and school data.';
      if (window.mhsToast) window.mhsToast(message); else alert(message);
    } catch (error) {
      console.error('MHS Supabase backup failed:', error);
      alert('Backup failed: ' + (error.message || String(error)));
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
})();

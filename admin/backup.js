/* MHS migration safety step: export browser-local data before any database migration. */
(function () {
  'use strict';
  const button = document.getElementById('backupData');
  if (!button) return;
  button.addEventListener('click', function () {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      const payload = {
        product: 'Mokhleshpur High School website',
        backupType: 'browser-localStorage-export',
        createdAt: new Date().toISOString(),
        origin: location.origin,
        itemCount: Object.keys(data).length,
        localStorage: data
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = 'mhs-local-data-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (window.mhsToast) window.mhsToast('Backup downloaded. Keep this JSON file safe.');
      else alert('Backup downloaded. Keep this JSON file safe.');
    } catch (error) {
      console.error('MHS backup failed:', error);
      alert('Backup failed: ' + (error.message || String(error)));
    }
  });
})();

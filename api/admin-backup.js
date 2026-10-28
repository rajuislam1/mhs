module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ success: false, error: 'Supabase backup service is not configured.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, error: 'Admin login required.' });
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const rest = url + '/rest/v1';
  const parse = async response => { try { return await response.json(); } catch { return null; } };
  try {
    const authResponse = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
    if (!authResponse.ok) return res.status(401).json({ success: false, error: 'Admin session expired. Sign in again.' });
    const authUser = await authResponse.json();
    const profileResponse = await fetch(rest + '/user_profiles?id=eq.' + encodeURIComponent(authUser.id) + '&select=role,is_active', { headers });
    const profiles = await parse(profileResponse);
    if (!profileResponse.ok) return res.status(500).json({ success: false, error: 'Could not verify administrator.' });
    if (!profiles?.[0] || profiles[0].role !== 'super_admin' || profiles[0].is_active !== true) {
      return res.status(403).json({ success: false, error: 'Active Super Admin permission required.' });
    }
    const tables = [
      'academic_years','achievements','admission_applications','class_routines','class_subjects','classes',
      'exam_types','gallery','notice_tickers','notices','result_edit_requests','results','school_events',
      'school_settings','student_attendance','student_documents','student_enrollments','student_fees',
      'student_promotions','student_subjects','students','subjects','teacher_assignments','teacher_notifications',
      'teacher_public_profiles','teachers','user_profiles'
    ];
    const backup = { product: 'Mokhleshpur High School', backupType: 'supabase-database-export', createdAt: new Date().toISOString(), projectRef: 'wolxiieqyqeihvdefomd', tables: {} };
    for (const table of tables) {
      const rows = [];
      for (let offset = 0; offset < 100000; offset += 1000) {
        const response = await fetch(rest + '/' + table + '?select=*&limit=1000&offset=' + offset, { headers });
        const data = await parse(response);
        if (!response.ok) {
          console.error('Database backup failed for table:', table, data);
          return res.status(500).json({ success: false, error: 'Backup could not read table ' + table + '. Check its grants and RLS policy.' });
        }
        if (!Array.isArray(data)) return res.status(500).json({ success: false, error: 'Unexpected response while backing up ' + table + '.' });
        rows.push(...data);
        if (data.length < 1000) break;
      }
      backup.tables[table] = rows;
    }
    backup.tableCount = tables.length;
    backup.rowCounts = Object.fromEntries(Object.entries(backup.tables).map(([name, rows]) => [name, rows.length]));
    return res.status(200).json({ success: true, backup });
  } catch (error) {
    console.error('MHS database backup failed:', error);
    return res.status(500).json({ success: false, error: 'Database backup failed. Please retry.' });
  }
};

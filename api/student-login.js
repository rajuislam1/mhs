module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = 'sb_publishable_uBD6HEEQTsmJncjvdSeUWw_cCSlcrrF';
  if (!url || !key) return res.status(500).json({ success: false, error: 'Student login service is not configured on the server.' });
  try {
    const rollInput = String(req.body?.roll || '').trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!/^\\d{1,6}$/.test(rollInput) || !password || password.length > 1024) {
      return res.status(400).json({ success: false, error: 'Enter your roll number and password.' });
    }

    const headers = { apikey: key, Authorization: 'Bearer ' + key };
    const rest = url + '/rest/v1';
    const sr = await fetch(rest + '/students?roll=eq.' + encodeURIComponent(Number(rollInput)) + '&status=eq.true&select=id,student_id,name,roll', { headers });
    const students = await sr.json().catch(() => []);
    if (!sr.ok) {
      console.error('Student login roll lookup failed:', students);
      return res.status(500).json({ success: false, error: 'Could not verify student login.' });
    }
    if (!students.length) return res.status(401).json({ success: false, error: 'Invalid roll number or password, or student access is inactive.' });

    const profilesResponse = await fetch(rest + '/user_profiles?role=eq.student&is_active=eq.true&select=id,student_id,display_name', { headers });
    const profiles = await profilesResponse.json().catch(() => []);
    if (!profilesResponse.ok) return res.status(500).json({ success: false, error: 'Could not verify student account permissions.' });

    const candidates = students.filter(s => (profiles || []).some(p => p.student_id === s.id));
    if (!candidates.length) return res.status(401).json({ success: false, error: 'Invalid roll number or password, or student access is inactive.' });

    const matches = [];
    for (const student of candidates) {
      const authEmail = 'student.' + student.id + '@login.mokhleshpur-high-school.edu.bd';
      const authResponse = await fetch(url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password })
      });
      const session = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok || !session.access_token || !session.user?.id) continue;
      const profile = profiles.find(p => p.id === session.user.id && p.student_id === student.id && p.is_active === true);
      if (profile) matches.push({ student, session, profile });
    }

    if (matches.length !== 1) {
      return res.status(401).json({
        success: false,
        error: matches.length > 1
          ? 'This roll number is used by multiple active students with the same password. Ask the school office to set a unique portal password.'
          : 'Invalid roll number or password, or student access is inactive.'
      });
    }

    const { student, session } = matches[0];
    return res.status(200).json({
      success: true,
      student_id: student.student_id,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type
      }
    });
  } catch (error) {
    console.error('Student login API error:', error);
    return res.status(500).json({ success: false, error: 'Unexpected student login error.' });
  }
};

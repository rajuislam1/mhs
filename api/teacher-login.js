module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Publishable key is intentionally public; the service-role key stays server-side.
  const PUBLISHABLE_KEY = 'sb_publishable_uBD6HEEQTsmJncjvdSeUWw_cCSlcrrF';

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Teacher login service is not configured on the server.'
    });
  }

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY
  };

  try {
    const identifier = typeof req.body?.identifier === 'string'
      ? req.body.identifier.trim()
      : '';
    const password = typeof req.body?.password === 'string'
      ? req.body.password
      : '';

    if (!identifier || !password || identifier.length > 254 || password.length > 1024) {
      return res.status(400).json({
        success: false,
        error: 'Enter your username/email and password.'
      });
    }

    // Resolve either the teacher's username or the email stored with the account.
    const filter = identifier.includes('@')
      ? 'email=eq.' + encodeURIComponent(identifier.toLowerCase())
      : 'username=eq.' + encodeURIComponent(identifier);

    const teacherResponse = await fetch(
      SUPABASE_URL + '/rest/v1/teachers?select=id,email,username,status&' + filter + '&limit=1',
      { headers }
    );

    if (!teacherResponse.ok) {
      console.error('Teacher login lookup failed:', await teacherResponse.text());
      return res.status(500).json({ success: false, error: 'Could not verify teacher login.' });
    }

    const teachers = await teacherResponse.json();
    const teacher = teachers[0];

    // Use a generic error for missing, inactive, or incorrect credentials.
    if (!teacher || teacher.status !== true || !teacher.email) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password, or teacher access is inactive.'
      });
    }

    const authResponse = await fetch(
      SUPABASE_URL + '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          apikey: PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: teacher.email,
          password
        })
      }
    );

    const session = await authResponse.json().catch(() => ({}));

    if (!authResponse.ok || !session.access_token || !session.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password, or teacher access is inactive.'
      });
    }

    // Verify that this Auth user is linked to this active teacher record.
    const profileResponse = await fetch(
      SUPABASE_URL + '/rest/v1/user_profiles?id=eq.' +
        encodeURIComponent(session.user.id) +
        '&select=id,role,is_active,teacher_id',
      { headers }
    );

    if (!profileResponse.ok) {
      console.error('Teacher login profile check failed:', await profileResponse.text());
      return res.status(500).json({
        success: false,
        error: 'Could not verify teacher account permissions.'
      });
    }

    const profiles = await profileResponse.json();
    const profile = profiles[0];

    if (
      !profile ||
      profile.role !== 'teacher' ||
      profile.is_active !== true ||
      profile.teacher_id !== teacher.id
    ) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password, or teacher access is inactive.'
      });
    }

    return res.status(200).json({
      success: true,
      username: teacher.username,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type
      }
    });
  } catch (error) {
    console.error('Teacher login API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected teacher login error.'
    });
  }
};

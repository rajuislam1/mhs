
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      error: 'Supabase server configuration is missing.'
    });
  }

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({ error: 'Admin login required.' });
    }

    // Verify the current Supabase Auth user.
    const authCheck = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!authCheck.ok) {
      return res.status(401).json({
        error: 'Your login session is invalid or expired.'
      });
    }

    const admin = await authCheck.json();

    // Verify active Super Admin access.
    const profileCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(admin.id)}&select=id,role,is_active`,
      { headers }
    );

    if (!profileCheck.ok) {
      return res.status(500).json({
        error: 'Could not verify administrator permissions.'
      });
    }

    const profiles = await profileCheck.json();
    const adminProfile = profiles[0];

    if (
      !adminProfile ||
      adminProfile.role !== 'super_admin' ||
      adminProfile.is_active !== true
    ) {
      return res.status(403).json({
        error: 'Active Super Admin permission required.'
      });
    }

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';
    const username = typeof body.username === 'string'
      ? body.username.trim()
      : '';
    const password = typeof body.password === 'string'
      ? body.password
      : '';
    const subject = typeof body.subject === 'string'
      ? body.subject.trim()
      : '';

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: 'Name, username, email and password are required.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address.'
      });
    }

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-40 characters using letters, numbers, dots, underscores or hyphens.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must contain at least 8 characters.'
      });
    }

    // Create the teacher's secure Supabase Auth account.
    const createResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: name,
            username,
            subject
          }
        })
      }
    );

    const createdUser = await createResponse.json();

    if (!createResponse.ok) {
      return res.status(400).json({
        error: createdUser.msg ||
          createdUser.message ||
          createdUser.error_description ||
          'Could not create the teacher account.'
      });
    }

    // Add the teacher's authorization profile.
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          id: createdUser.id,
          role: 'teacher',
          is_active: true,
          display_name: name
        })
      }
    );

    if (!profileResponse.ok) {
      // Roll back the Auth account if its profile cannot be created.
      await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(createdUser.id)}`,
        {
          method: 'DELETE',
          headers
        }
      );

      console.error(
        'Teacher profile creation failed:',
        await profileResponse.text()
      );

      return res.status(500).json({
        error: 'Teacher profile could not be created. Please try again.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Teacher account created successfully.',
      teacher: {
        id: createdUser.id,
        name,
        username,
        email,
        subject
      }
    });
  } catch (error) {
    console.error('Create teacher API error:', error);

    return res.status(500).json({
      error: 'Unexpected server error.'
    });
  }
};

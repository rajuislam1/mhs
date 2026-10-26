
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
      error: 'Server Supabase environment variables are missing.'
    });
  }

  const jsonHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({ error: 'Admin login required.' });
    }

    // Verify the signed-in user with Supabase Auth.
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      return res.status(401).json({ error: 'Invalid or expired login.' });
    }

    const adminUser = await authResponse.json();

    // Only an active super administrator may create teacher accounts.
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(adminUser.id)}&select=id,role,is_active`,
      { headers: jsonHeaders }
    );

    if (!profileResponse.ok) {
      return res.status(500).json({ error: 'Could not verify admin profile.' });
    }

    const profiles = await profileResponse.json();
    const profile = profiles[0];

    if (!profile || profile.role !== 'super_admin' || profile.is_active !== true) {
      return res.status(403).json({ error: 'Active super administrator access required.' });
    }

    const { name, email, password } = req.body || {};

    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || password.length < 8
    ) {
      return res.status(400).json({
        error: 'Provide a name, valid email, and password of at least 8 characters.'
      });
    }

    // Create the teacher in Supabase Auth. The password is never stored
    // in the website's localStorage or in a custom password column.
    const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { display_name: name.trim() }
      })
    });

    const createdUser = await createResponse.json();

    if (!createResponse.ok) {
      return res.status(createResponse.status).json({
        error: createdUser.msg || createdUser.message || createdUser.error_description || 'Could not create teacher account.'
      });
    }

    // Create the corresponding teacher profile.
    const profileInsert = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        id: createdUser.id,
        role: 'teacher',
        is_active: true,
        display_name: name.trim()
      })
    });

    if (!profileInsert.ok) {
      // Avoid leaving an Auth user behind without a profile.
      await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(createdUser.id)}`,
        { method: 'DELETE', headers: jsonHeaders }
      );

      return res.status(500).json({
        error: 'Teacher profile creation failed. The new Auth account was rolled back.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Teacher account created successfully.',
      teacher: {
        id: createdUser.id,
        name: name.trim(),
        email: email.trim().toLowerCase()
      }
    });
  } catch (error) {
    console.error('Create teacher API error:', error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};

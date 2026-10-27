
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Supabase server configuration is missing.'
    });
  }

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({
        success: false,
        error: 'Method not allowed.'
      });
    }

    // Verify the signed-in user.
    const token = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin login required.'
      });
    }

    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        success: false,
        error: 'Login session is invalid or expired.'
      });
    }

    const authUser = await authResponse.json();

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles` +
      `?id=eq.${encodeURIComponent(authUser.id)}` +
      '&select=id,role,is_active',
      { headers }
    );

    if (!profileResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Could not verify admin permissions.'
      });
    }

    const profiles = await profileResponse.json();
    const profile = profiles[0];

    if (
      !profile ||
      profile.role !== 'super_admin' ||
      profile.is_active !== true
    ) {
      return res.status(403).json({
        success: false,
        error: 'Active Super Admin permission required.'
      });
    }

    const baseUrl =
      `${SUPABASE_URL}/rest/v1/teacher_public_profiles`;

    // GET: list public teacher profiles for the admin.
    if (req.method === 'GET') {
      const response = await fetch(
        `${baseUrl}?select=id,name,designation,subject,qualification,photo,is_published,created_at,updated_at&order=created_at.desc`,
        { headers }
      );

      const result = await response.json();

      if (!response.ok) {
        return res.status(500).json({
          success: false,
          error: 'Could not load public teacher profiles.'
        });
      }

      return res.status(200).json({
        success: true,
        teachers: result
      });
    }

    const body = req.body || {};

    // POST: add a public teacher profile.
    if (req.method === 'POST') {
      const name = typeof body.name === 'string'
        ? body.name.trim() : '';

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Teacher name is required.'
        });
      }

      const payload = {
        name,
        designation: typeof body.designation === 'string'
          ? body.designation.trim() || 'Teacher' : 'Teacher',
        subject: typeof body.subject === 'string'
          ? body.subject.trim() || null : null,
        qualification: typeof body.qualification === 'string'
          ? body.qualification.trim() || null : null,
        photo: typeof body.photo === 'string'
          ? body.photo.trim() || null : null,
        is_published: true
      };

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => []);

      if (!response.ok) {
        console.error('Public teacher insert failed:', result);
        return res.status(500).json({
          success: false,
          error: 'Could not save teacher profile.'
        });
      }

      return res.status(201).json({
        success: true,
        teacher: result[0]
      });
    }

    const id = typeof body.id === 'string' ? body.id.trim() : '';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher profile ID is required.'
      });
    }

    // PATCH: edit a public teacher profile.
    if (req.method === 'PATCH') {
      const allowed = [
        'name', 'designation', 'subject',
        'qualification', 'photo', 'is_published'
      ];

      const payload = {};

      for (const field of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          payload[field] = body[field];
        }
      }

      if (typeof payload.name === 'string') {
        payload.name = payload.name.trim();
      }

      if (typeof payload.name === 'string' && !payload.name) {
        return res.status(400).json({
          success: false,
          error: 'Teacher name cannot be empty.'
        });
      }

      payload.updated_at = new Date().toISOString();

      const response = await fetch(
        `${baseUrl}?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            Prefer: 'return=representation'
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json().catch(() => []);

      if (!response.ok) {
        return res.status(500).json({
          success: false,
          error: 'Could not update teacher profile.'
        });
      }

      if (!result.length) {
        return res.status(404).json({
          success: false,
          error: 'Teacher profile not found.'
        });
      }

      return res.status(200).json({
        success: true,
        teacher: result[0]
      });
    }

    // DELETE: unpublish the profile rather than permanently delete it.
    const response = await fetch(
      `${baseUrl}?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          is_published: false,
          updated_at: new Date().toISOString()
        })
      }
    );

    const result = await response.json().catch(() => []);

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: 'Could not remove teacher from the public website.'
      });
    }

    if (!result.length) {
      return res.status(404).json({
        success: false,
        error: 'Teacher profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Teacher profile unpublished successfully.'
    });
  } catch (error) {
    console.error('Manage public teacher API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Unexpected server error.'
    });
  }
};

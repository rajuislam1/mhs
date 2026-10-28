
const crypto = require('crypto');

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

  let createdUserId = null;
  let teacherRowCreated = false;
  let profileCreated = false;

  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({
        error: 'Admin login required.'
      });
    }

    // Verify the current Supabase Auth session.
    const authCheck = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authCheck.ok) {
      return res.status(401).json({
        error: 'Your login session is invalid or expired.'
      });
    }

    const admin = await authCheck.json();

    // Verify the administrator's role and active status.
    const profileCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles` +
      `?id=eq.${encodeURIComponent(admin.id)}` +
      '&select=id,role,is_active',
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

    const name = typeof body.name === 'string'
      ? body.name.trim() : '';

    const username = typeof body.username === 'string'
      ? body.username.trim() : '';

    const suppliedEmail = typeof body.email === 'string'
      ? body.email.trim().toLowerCase() : '';

    // Email is optional in the school workflow. Keep a deterministic internal
    // Auth email so Supabase Auth can still authenticate username/password.
    const email = suppliedEmail || `teacher.${crypto.createHash('sha256').update(username.toLowerCase()).digest('hex').slice(0, 32)}@login.mokhleshpur-high-school.edu.bd`;

    const password = typeof body.password === 'string'
      ? body.password : '';

    const designation = typeof body.designation === 'string'
      ? body.designation.trim() : '';

    const subject = typeof body.subject === 'string'
      ? body.subject.trim() : '';

    const qualification = typeof body.qualification === 'string'
      ? body.qualification.trim() : '';

    const photo = typeof body.photo === 'string'
      ? body.photo : null;

    if (!name || !username || !password) {
      return res.status(400).json({
        error: 'Name, username and password are required.'
      });
    }

    if (suppliedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)) {
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

    // Create the authentication account.
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
        error:
          createdUser.msg ||
          createdUser.message ||
          createdUser.error_description ||
          'Could not create the teacher account.'
      });
    }

    createdUserId = createdUser.id;

    // Insert the teacher's profile record.
    const teacherId = `T-${createdUserId}`;

    const teacherResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teachers`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          teacher_id: teacherId,
          name,
          designation: designation || null,
          mobile: null,
          email,
          username,
          subject: subject || null,
          qualification: qualification || null,
          photo,
          status: true
        })
      }
    );

    if (!teacherResponse.ok) {
      const detail = await teacherResponse.text();
      console.error('Teacher row creation failed:', detail);
      throw new Error(
        'Could not save teacher details. Please check the database constraints.'
      );
    }

    const teacherRows = await teacherResponse.json();
    teacherRowCreated = true;

    const teacherRow = teacherRows[0];

    // Link the Auth account to the teacher database row.
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          id: createdUserId,
          role: 'teacher',
          teacher_id: teacherRow.id,
          display_name: name,
          is_active: true
        })
      }
    );

    if (!profileResponse.ok) {
      const detail = await profileResponse.text();
      console.error('Teacher profile creation failed:', detail);
      throw new Error(
        'Could not link the teacher account to its profile.'
      );
    }

    profileCreated = true;

    return res.status(201).json({
      success: true,
      message: 'Teacher account created successfully.',
      teacher: {
        id: teacherRow.id,
        authId: createdUserId,
        teacher_id: teacherId,
        name,
        username,
        email,
        designation,
        subject,
        qualification,
        photo
      }
    });
  } catch (error) {
    console.error('Create teacher API error:', error);

    // Roll back records created during this request.
    if (createdUserId) {
      try {
        if (profileCreated) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(createdUserId)}`,
            {
              method: 'DELETE',
              headers
            }
          );
        }

        if (teacherRowCreated) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/teachers?teacher_id=eq.${encodeURIComponent(`T-${createdUserId}`)}`,
            {
              method: 'DELETE',
              headers
            }
          );
        }

        await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(createdUserId)}`,
          {
            method: 'DELETE',
            headers
          }
        );
      } catch (rollbackError) {
        console.error('Teacher rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      error: error.message || 'Unexpected server error.'
    });
  }
};

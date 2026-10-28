

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const allowedMethods = ['GET', 'PATCH', 'DELETE'];

  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods.join(', '));
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      error: 'Supabase server configuration is missing.'
    });
  }

  const adminHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  const rest = `${SUPABASE_URL}/rest/v1`;

  try {
    // Authenticate the current administrator.
    const token = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({
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
        error: 'Session invalid or expired. Please sign in again.'
      });
    }

    const admin = await authResponse.json();

    const profileResponse = await fetch(
      `${rest}/user_profiles?id=eq.${encodeURIComponent(admin.id)}&select=id,role,is_active`,
      { headers: adminHeaders }
    );

    if (!profileResponse.ok) {
      return res.status(500).json({
        error: 'Could not verify administrator permissions.'
      });
    }

    const adminProfiles = await profileResponse.json();
    const adminProfile = adminProfiles[0];

    if (
      !adminProfile ||
      adminProfile.role !== 'super_admin' ||
      adminProfile.is_active !== true
    ) {
      return res.status(403).json({
        error: 'Active Super Admin permission required.'
      });
    }

    // GET: list teachers from the database.
    if (req.method === 'GET') {
      const response = await fetch(
        `${rest}/teachers?select=id,teacher_id,name,designation,mobile,email,username,subject,qualification,photo,status,created_at,updated_at&order=created_at.desc`,
        { headers: adminHeaders }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Teacher list error:', result);
        return res.status(500).json({
          error: 'Could not load teachers.'
        });
      }

      return res.status(200).json({
        success: true,
        teachers: result
      });
    }

    const body = req.body || {};
    const teacherRowId = String(body.id || '').trim();

    if (!teacherRowId) {
      return res.status(400).json({
        error: 'Teacher database ID is required.'
      });
    }

    // Find the teacher record.
    const lookupResponse = await fetch(
      `${rest}/teachers?id=eq.${encodeURIComponent(teacherRowId)}&select=id,teacher_id,name,email,username,status`,
      { headers: adminHeaders }
    );

    if (!lookupResponse.ok) {
      return res.status(500).json({
        error: 'Could not look up the teacher.'
      });
    }

    const rows = await lookupResponse.json();
    const teacher = rows[0];

    if (!teacher) {
      return res.status(404).json({
        error: 'Teacher not found.'
      });
    }

    // Find a linked teacher Auth account through user_profiles.
    const linkedProfileResponse = await fetch(
      `${rest}/user_profiles?teacher_id=eq.${encodeURIComponent(teacher.id)}&select=id,role,is_active`,
      { headers: adminHeaders }
    );

    if (!linkedProfileResponse.ok) {
      return res.status(500).json({
        error: 'Could not look up the teacher account.'
      });
    }

    const linkedProfiles = await linkedProfileResponse.json();
    const linkedProfile = linkedProfiles.find(
      profile => profile.role === 'teacher'
    );

    if (req.method === 'PATCH') {
      const allowedFields = [
        'name',
        'designation',
        'mobile',
        'email',
        'username',
        'subject',
        'qualification',
        'photo',
        'status'
      ];

      const update = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          update[field] = body[field];
        }
      }

      if (!Object.keys(update).length) {
        return res.status(400).json({
          error: 'No editable fields supplied.'
        });
      }

      if (
        update.name !== undefined &&
        (typeof update.name !== 'string' || !update.name.trim())
      ) {
        return res.status(400).json({
          error: 'Teacher name cannot be empty.'
        });
      }

      if (
        update.email !== undefined &&
        update.email !== null &&
        update.email !== '' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.email)
      ) {
        return res.status(400).json({
          error: 'Invalid email address.'
        });
      }

      if (
        update.username !== undefined &&
        !/^[a-zA-Z0-9._-]{3,40}$/.test(update.username)
      ) {
        return res.status(400).json({
          error: 'Invalid username.'
        });
      }

      if (
        update.status !== undefined &&
        typeof update.status !== 'boolean'
      ) {
        return res.status(400).json({
          error: 'Status must be true or false.'
        });
      }

      for (const field of [
        'name', 'designation', 'mobile', 'email',
        'username', 'subject', 'qualification', 'photo'
      ]) {
        if (typeof update[field] === 'string') {
          update[field] = update[field].trim();
        }
      }

      update.updated_at = new Date().toISOString();

      const updateResponse = await fetch(
        `${rest}/teachers?id=eq.${encodeURIComponent(teacherRowId)}`,
        {
          method: 'PATCH',
          headers: {
            ...adminHeaders,
            Prefer: 'return=representation'
          },
          body: JSON.stringify(update)
        }
      );

      const updatedRows = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error('Teacher update error:', updatedRows);
        return res.status(400).json({
          error: 'Could not update teacher. Check duplicate username or database constraints.'
        });
      }

      // Keep the login profile activation state synchronized with the teacher record.
      if (linkedProfile && typeof update.status === 'boolean') {
        const activationResponse = await fetch(
          `${rest}/user_profiles?id=eq.${encodeURIComponent(linkedProfile.id)}`,
          {
            method: 'PATCH',
            headers: { ...adminHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify({
              is_active: update.status,
              updated_at: new Date().toISOString()
            })
          }
        );
        if (!activationResponse.ok) {
          return res.status(500).json({
            error: 'Teacher record updated but login activation could not be synchronized. Please refresh and verify account status.'
          });
        }
      }

      // Keep the public profile display name in sync.
      if (
        linkedProfile &&
        update.name !== undefined
      ) {
        const profileUpdate = await fetch(
          `${rest}/user_profiles?id=eq.${encodeURIComponent(linkedProfile.id)}`,
          {
            method: 'PATCH',
            headers: {
              ...adminHeaders,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              display_name: update.name
            })
          }
        );

        if (!profileUpdate.ok) {
          console.error(
            'Teacher profile display name sync failed:',
            await profileUpdate.text()
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Teacher updated successfully.',
        teacher: updatedRows[0]
      });
    }

    // DELETE: deactivate rather than permanently delete.
    const deactivateResponse = await fetch(
      `${rest}/teachers?id=eq.${encodeURIComponent(teacherRowId)}`,
      {
        method: 'PATCH',
        headers: {
          ...adminHeaders,
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          status: false,
          updated_at: new Date().toISOString()
        })
      }
    );

    const deactivatedRows = await deactivateResponse.json();

    if (!deactivateResponse.ok) {
      console.error('Teacher deactivation error:', deactivatedRows);
      return res.status(500).json({
        error: 'Could not deactivate teacher.'
      });
    }

    // Deactivate the linked teacher profile too.
    if (linkedProfile) {
      const profileDeactivateResponse = await fetch(
        `${rest}/user_profiles?id=eq.${encodeURIComponent(linkedProfile.id)}`,
        {
          method: 'PATCH',
          headers: {
            ...adminHeaders,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            is_active: false,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!profileDeactivateResponse.ok) {
        console.error(
          'Teacher account deactivation failed:',
          await profileDeactivateResponse.text()
        );

        return res.status(500).json({
          error: 'Teacher record was deactivated, but account deactivation failed. Please check the account status.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Teacher deactivated. The record has not been permanently deleted.'
    });
  } catch (error) {
    console.error('Manage teacher API error:', error);

    return res.status(500).json({
      error: 'Unexpected server error.'
    });
  }
};

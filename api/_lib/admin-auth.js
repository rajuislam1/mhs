const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authorizeAdmin(req, res, permission) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ success: false, error: 'Supabase server configuration is missing.' });
    return null;
  }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ success: false, error: 'Admin login required.' });
    return null;
  }
  const headers = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + token };
  const authResponse = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', { headers });
  if (!authResponse.ok) {
    res.status(401).json({ success: false, error: 'Session invalid or expired. Please sign in again.' });
    return null;
  }
  const user = await authResponse.json();
  const profileResponse = await fetch(
    SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/user_profiles?id=eq.' +
      encodeURIComponent(user.id) + '&select=id,role,is_active,permissions,display_name,email',
    { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
  );
  if (!profileResponse.ok) {
    res.status(500).json({ success: false, error: 'Could not verify account permissions.' });
    return null;
  }
  const profiles = await profileResponse.json();
  const profile = profiles[0];
  const allowed = profile && profile.is_active === true &&
    (profile.role === 'super_admin' ||
      (['admin', 'moderator'].includes(profile.role) &&
       permission &&
       profile.permissions &&
       profile.permissions[permission] === true));
  if (!allowed) {
    res.status(403).json({ success: false, error: 'You do not have permission to perform this action.' });
    return null;
  }
  return { user, profile, headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' }, base: SUPABASE_URL.replace(/\/$/, '') };
}

module.exports = { authorizeAdmin };

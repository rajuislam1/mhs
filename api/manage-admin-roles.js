const { authorizeAdmin } = require('./_lib/admin-auth');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODULES = [
  'notices','attendance','teachers','results','routine','examroutine',
  'editrequests','gallery','students','subjects','studentSubjects',
  'promotion','admissions','fees','feePayments','admitcards'
];
const cleanPermissions = value => {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(MODULES.map(key => [key, input[key] === true]));
};
async function rest(base, headers, path, options = {}) {
  const response = await fetch(base + '/rest/v1/' + path, {
    ...options, headers: { ...headers, ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.details || 'Database request failed.');
  return data;
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  let pendingAuthId = null;
  try {
    const auth = await authorizeAdmin(req, res, null);
    if (!auth) return;
    if (auth.profile.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only the Super Admin can manage administrator accounts.' });
    }
    const { base, headers } = auth;
    if (req.method === 'GET') {
      const profiles = await rest(base, headers, 'user_profiles?role=in.(admin,moderator)&select=id,role,display_name,email,is_active,permissions,created_at&order=created_at.desc');
      const usersResponse = await fetch(base + '/auth/v1/admin/users?page=1&per_page=1000', { headers });
      const usersData = usersResponse.ok ? await usersResponse.json() : { users: [] };
      const users = usersData.users || [];
      const result = profiles.map(profile => ({
        ...profile,
        email: profile.email || users.find(user => user.id === profile.id)?.email || ''
      }));
      return res.status(200).json({ success: true, accounts: result });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = body.role === 'moderator' ? 'moderator' : 'admin';
      const permissions = cleanPermissions(body.permissions);
      if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
      if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters.' });
      if (!Object.values(permissions).some(Boolean)) return res.status(400).json({ success: false, error: 'Select at least one module permission.' });
      const createResponse = await fetch(base + '/auth/v1/admin/users', {
        method: 'POST', headers,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: name, role } })
      });
      const created = await createResponse.json();
      if (!createResponse.ok) return res.status(400).json({ success: false, error: created.message || created.msg || 'Could not create account.' });
      pendingAuthId = created.id;
      const saved = await rest(base, headers, 'user_profiles', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ id: created.id, role, display_name: name, email, is_active: true, permissions })
      });
      pendingAuthId = null;
      return res.status(201).json({ success: true, account: saved?.[0] || { id: created.id, role, display_name: name, email, is_active: true, permissions } });
    }
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ success: false, error: 'Valid account ID is required.' });
      const rows = await rest(base, headers, 'user_profiles?id=eq.' + encodeURIComponent(id) + '&role=in.(admin,moderator)&select=id,role');
      if (!rows.length) return res.status(404).json({ success: false, error: 'Admin/Moderator account not found.' });
      const update = { updated_at: new Date().toISOString() };
      if (Object.prototype.hasOwnProperty.call(body, 'permissions')) {
        update.permissions = cleanPermissions(body.permissions);
        if (!Object.values(update.permissions).some(Boolean)) update.permissions = {};
      }
      if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
        if (typeof body.is_active !== 'boolean') return res.status(400).json({ success: false, error: 'Account status must be true or false.' });
        update.is_active = body.is_active;
      }
      if (typeof body.name === 'string' && body.name.trim()) update.display_name = body.name.trim();
      if (body.role === 'admin' || body.role === 'moderator') update.role = body.role;
      if (typeof body.password === 'string' && body.password.length) {
        if (body.password.length < 8) return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters.' });
        const passwordResponse = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(id), {
          method: 'PUT', headers, body: JSON.stringify({ password: body.password })
        });
        if (!passwordResponse.ok) return res.status(400).json({ success: false, error: 'Could not update account password.' });
      }
      const saved = await rest(base, headers, 'user_profiles?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(update)
      });
      return res.status(200).json({ success: true, account: saved?.[0] || null });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  } catch (error) {
    if (pendingAuthId && URL && KEY) {
      await fetch(URL.replace(/\\/$/, '') + '/auth/v1/admin/users/' + encodeURIComponent(pendingAuthId), {
        method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
      }).catch(() => {});
    }
    console.error('Admin role management failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Unexpected server error.' });
  }
};

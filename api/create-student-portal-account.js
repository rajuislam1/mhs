module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ success: false, error: 'Supabase server configuration is missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  }

  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const rest = url + '/rest/v1';
  const parse = async r => { try { return await r.json(); } catch { return null; } };

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, error: 'Admin login required.' });
    const auth = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
    if (!auth.ok) return res.status(401).json({ success: false, error: 'Admin session expired. Sign in again.' });
    const adminUser = await auth.json();
    const pr = await fetch(rest + '/user_profiles?id=eq.' + encodeURIComponent(adminUser.id) + '&select=role,is_active', { headers });
    const profiles = await parse(pr);
    if (!pr.ok) return res.status(500).json({ success: false, error: 'Could not verify administrator.' });
    if (!profiles?.[0] || profiles[0].role !== 'super_admin' || profiles[0].is_active !== true) {
      return res.status(403).json({ success: false, error: 'Active Super Admin permission required.' });
    }

    const b = req.body || {};
    const studentId = String(b.student_id || '').trim();
    const admission = String(b.admission_number || '').trim();
    const name = String(b.name || '').trim();
    const classNumber = Number(b.class);
    const roll = Number(b.roll);
    const password = String(b.password || '');
    const section = String(b.section || '').trim();
    const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date_of_birth || '')) ? String(b.date_of_birth) : null;
    const requestedAcademicYearId = String(b.academic_year_id || '').trim();
    const gender = String(b.gender || '').trim();
    const guardian = String(b.guardian || '').trim();
    const mobile = String(b.guardian_phone || '').trim();
    const photo = typeof b.photo === 'string' && /^https?:\/\//i.test(b.photo) ? b.photo : null;

    if (!studentId || !admission || !name || !Number.isInteger(classNumber) || !Number.isInteger(roll) || roll < 0 || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Enter Student ID, Admission No., name, class, roll and a password of at least 8 characters.' });
    }

    const duplicate = await fetch(rest + '/students?select=student_id,admission_number', { headers });
    const existingStudents = await parse(duplicate);
    if (!duplicate.ok) return res.status(500).json({ success: false, error: 'Could not check duplicate student ID/admission number.' });
    if ((existingStudents || []).some(s => String(s.admission_number || '').trim().toLowerCase() === admission.toLowerCase())) {
      return res.status(409).json({ success: false, error: 'Admission No. already exists in Supabase. Please use the existing student record instead of adding it twice.' });
    }
    if ((existingStudents || []).some(s => String(s.student_id) === studentId)) {
      const maxId = (existingStudents || []).reduce((max, s) => /^\d+$/.test(String(s.student_id || '')) ? Math.max(max, Number(s.student_id)) : max, 100000);
      b.student_id = String(maxId + 1);
    }
    const finalStudentId = String(b.student_id || studentId).trim();

    const [classResponse, yearResponse] = await Promise.all([
      fetch(rest + '/classes?class_number=eq.' + encodeURIComponent(classNumber) + '&status=eq.true&select=id,class_number,name&limit=1', { headers }),
      fetch(requestedAcademicYearId ? rest + '/academic_years?id=eq.' + encodeURIComponent(requestedAcademicYearId) + '&select=id,year&limit=1' : rest + '/academic_years?year=eq.' + encodeURIComponent(new Date().getFullYear()) + '&select=id,year&limit=1', { headers })
    ]);
    const classes = await parse(classResponse);
    const years = await parse(yearResponse);
    if (!classResponse.ok || !yearResponse.ok) return res.status(500).json({ success: false, error: 'Could not look up class/academic year in Supabase.' });
    if (!classes?.[0]) return res.status(400).json({ success: false, error: 'This class is not configured in Supabase. Ask the administrator to configure Classes first.' });
    if (!years?.[0]) return res.status(400).json({ success: false, error: 'The current academic year is not configured in Supabase.' });

    const studentResponse = await fetch(rest + '/students', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        student_id: finalStudentId,
        admission_number: admission,
        name,
        date_of_birth: dateOfBirth,
        class_id: classes[0].id,
        academic_year_id: years[0].id,
        roll,
        section: section || null,
        gender: gender || null,
        guardian: guardian || null,
        mobile: mobile || null,
        photo,
        status: true,
        admission_date: new Date().toISOString().slice(0, 10)
      })
    });
    const studentRows = await parse(studentResponse);
    const student = studentRows?.[0];
    if (!studentResponse.ok || !student?.id) {
      console.error('Create student record failed:', studentRows);
      return res.status(400).json({ success: false, error: studentRows?.message || studentRows?.details || 'Could not save the student record in Supabase.' });
    }

    // Students sign in using roll/student ID; this confirmed synthetic email is never shown to them.
    const authEmail = 'student.' + student.id + '@login.mokhleshpur-high-school.edu.bd';
    const createAuth = await fetch(url + '/auth/v1/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { role: 'student', student_id: student.id, student_number: finalStudentId, roll, display_name: name }
      })
    });
    const authData = await parse(createAuth);
    if (!createAuth.ok || !authData?.id) {
      await fetch(rest + '/students?id=eq.' + encodeURIComponent(student.id), { method: 'DELETE', headers });
      return res.status(400).json({ success: false, error: authData?.msg || authData?.message || 'Could not create the student login account. Student record creation was rolled back.' });
    }

    const profileResponse = await fetch(rest + '/user_profiles', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ id: authData.id, role: 'student', student_id: student.id, display_name: name, is_active: true })
    });
    const profileData = await parse(profileResponse);
    if (!profileResponse.ok) {
      await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(authData.id), { method: 'DELETE', headers });
      await fetch(rest + '/students?id=eq.' + encodeURIComponent(student.id), { method: 'DELETE', headers });
      return res.status(500).json({ success: false, error: profileData?.message || 'Could not link student login to profile. Student and Auth account rollback was attempted.' });
    }

    return res.status(201).json({ success: true, message: 'Student record and portal login created successfully.', student_id: finalStudentId, student_record_id: student.id, roll, login: 'Use Roll Number and the password you set.' });
  } catch (error) {
    console.error('Create student portal account error:', error);
    return res.status(500).json({ success: false, error: 'Unexpected server error while creating student.' });
  }
};

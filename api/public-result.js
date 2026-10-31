module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Server database configuration is missing.' });
  const cls = String(req.query.class || '').trim();
  const roll = String(req.query.roll || '').trim();
  const year = String(req.query.year || '').trim();
  const exam = String(req.query.exam || '').trim();
  if (!/^(6|7|8|9|10)$/.test(cls) || !/^\d{1,6}$/.test(roll) || !/^20\d{2}$/.test(year) || !exam || exam.length > 80) {
    return res.status(400).json({ error: 'Enter a valid class, roll, academic year, and exam.' });
  }
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  const base = url.replace(/\/$/, '') + '/rest/v1';
  async function get(path) {
    const r = await fetch(base + path, { headers });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error('Database request failed.');
    return body;
  }
  try {
    const [classes, years] = await Promise.all([
      get('/classes?select=id&class_number=eq.' + encodeURIComponent(cls) + '&limit=1'),
      get('/academic_years?select=id&year=eq.' + encodeURIComponent(year) + '&limit=1')
    ]);
    if (!classes?.length || !years?.length) return res.status(404).json({ error: 'No published result found for the supplied details.' });
    const students = await get('/students?select=id,name,roll,class_id,academic_year_id,section&roll=eq.' + encodeURIComponent(roll) + '&class_id=eq.' + encodeURIComponent(classes[0].id) + '&academic_year_id=eq.' + encodeURIComponent(years[0].id) + '&status=eq.true&limit=1');
    if (!students?.length) return res.status(404).json({ error: 'No published result found for the supplied details.' });
    const student = students[0];
    const rows = await get('/results?select=marks,grade,grade_point,exam_name,status,class_subjects(subject_id,subjects(name))&student_id=eq.' + encodeURIComponent(student.id) + '&academic_year_id=eq.' + encodeURIComponent(years[0].id) + '&status=eq.published&exam_name=eq.' + encodeURIComponent(exam));
    if (!rows?.length) return res.status(404).json({ error: 'No published result found for the supplied details.' });
    const subjects = rows.map(r => ({
      subject: r.class_subjects?.subjects?.name || 'Subject',
      marks: Number(r.marks || 0),
      grade: r.grade || '',
      point: Number(r.grade_point || 0)
    }));
    const total = subjects.reduce((sum, row) => sum + row.marks, 0);
    const average = total / subjects.length;
    const gpa = subjects.some(row => row.point === 0) ? 0 : Math.min(5, subjects.reduce((sum, row) => sum + row.point, 0) / subjects.length);
    return res.status(200).json({
      result: {
        name: student.name, class: cls, roll, year, exam, subjects, total,
        average, gpa: Number(gpa.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Public result lookup failed:', error);
    return res.status(500).json({ error: 'Unable to retrieve the published result right now.' });
  }
};

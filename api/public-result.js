module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ success: false, error: 'Result service is not configured.' });
  }
  const query = req.query || {};
  const classNumber = Number(query.class);
  const roll = String(query.roll || '').trim();
  const year = Number(query.year);
  const exam = String(query.exam || '').trim();
  const exams = new Set(['Half Yearly', 'Final Exam', 'Class Test', 'Lab Test']);
  if (!Number.isInteger(classNumber) || classNumber < 6 || classNumber > 10 ||
      !/^\d{1,4}$/.test(roll) || !Number.isInteger(year) || year < 2000 || year > 2100 ||
      !exams.has(exam)) {
    return res.status(400).json({ success: false, error: 'Enter a valid class, roll, academic year and exam.' });
  }
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  const rest = url + '/rest/v1';
  const parse = async response => { try { return await response.json(); } catch { return null; } };
  const filter = value => encodeURIComponent(String(value));
  try {
    const [classResponse, yearResponse] = await Promise.all([
      fetch(rest + '/classes?class_number=eq.' + filter(classNumber) + '&status=eq.true&select=id,class_number,name&limit=1', { headers }),
      fetch(rest + '/academic_years?year=eq.' + filter(year) + '&select=id,year,name&limit=1', { headers })
    ]);
    const classes = await parse(classResponse), years = await parse(yearResponse);
    if (!classResponse.ok || !yearResponse.ok) return res.status(500).json({ success: false, error: 'Could not search published results.' });
    if (!classes?.[0] || !years?.[0]) return res.status(200).json({ success: true, result: null });
    const studentResponse = await fetch(
      rest + '/students?class_id=eq.' + filter(classes[0].id) +
      '&academic_year_id=eq.' + filter(years[0].id) +
      '&roll=eq.' + filter(roll) + '&status=eq.true&select=id,student_id,name,roll&limit=2',
      { headers }
    );
    const students = await parse(studentResponse);
    if (!studentResponse.ok) return res.status(500).json({ success: false, error: 'Could not look up the student.' });
    if (!students?.length) return res.status(200).json({ success: true, result: null });
    if (students.length > 1) return res.status(409).json({ success: false, error: 'More than one active student has this class, roll and year. Contact the school office.' });
    const student = students[0];
    const resultResponse = await fetch(
      rest + '/results?student_id=eq.' + filter(student.id) +
      '&academic_year_id=eq.' + filter(years[0].id) +
      '&exam_name=eq.' + filter(exam) +
      '&status=eq.published&select=id,class_subject_id,marks,grade,grade_point&order=created_at.asc',
      { headers }
    );
    const rows = await parse(resultResponse);
    if (!resultResponse.ok) return res.status(500).json({ success: false, error: 'Could not load published marks.' });
    if (!rows?.length) return res.status(200).json({ success: true, result: null });
    const ids = [...new Set(rows.map(row => row.class_subject_id).filter(Boolean))];
    const subjectResponse = await fetch(
      rest + '/class_subjects?id=in.(' + ids.map(filter).join(',') + ')&select=id,subjects(name)',
      { headers }
    );
    const subjectRows = await parse(subjectResponse);
    if (!subjectResponse.ok) return res.status(500).json({ success: false, error: 'Could not load subject names.' });
    const subjectMap = new Map((subjectRows || []).map(row => [row.id, row.subjects?.name || 'Subject']));
    const subjects = rows.map(row => ({
      subject: subjectMap.get(row.class_subject_id) || 'Subject',
      marks: Number(row.marks || 0),
      grade: row.grade || '',
      point: Number(row.grade_point || 0)
    }));
    const total = subjects.reduce((sum, subject) => sum + subject.marks, 0);
    const average = subjects.length ? total / subjects.length : 0;
    const gpa = subjects.length ? subjects.reduce((sum, subject) => sum + subject.point, 0) / subjects.length : 0;
    return res.status(200).json({
      success: true,
      result: {
        studentId: student.student_id,
        name: student.name,
        class: classNumber,
        roll: student.roll,
        year,
        exam,
        subjects,
        total,
        average: Number(average.toFixed(2)),
        gpa: Number(gpa.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Public result lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Could not search published results right now.' });
  }
};

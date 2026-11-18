module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(500).json({error:'Server database configuration is missing.'});
  const cls=String(req.query.class||'').trim(),roll=String(req.query.roll||'').trim(),year=String(req.query.year||'').trim(),exam=String(req.query.exam||'').trim();
  if(!/^(6|7|8|9|10)$/.test(cls)||! /^\d{1,6}$/.test(roll)||!/^20\d{2}$/.test(year)||!exam||exam.length>80)return res.status(400).json({error:'Enter a valid class, roll, academic year, and exam.'});
  const headers={apikey:key,Authorization:'Bearer '+key},base=url.replace(/\/$/,'')+'/rest/v1';
  async function get(path){const r=await fetch(base+path,{headers});const body=await r.json().catch(()=>null);if(!r.ok)throw new Error('Database request failed.');return body;}
  try{
    const years=await get('/academic_years?select=id,year&year=eq.'+encodeURIComponent(year)+'&limit=1');
    if(!years?.length)return res.status(404).json({error:'No published result found for the supplied details.'});
    const yearId=years[0].id;
    // Search the historic enrollment (class, roll, year) so promotions don't break old results.
    const classRows=await get('/classes?select=id,class_number&class_number=eq.'+encodeURIComponent(cls)+'&limit=10');
    if(!classRows?.length)return res.status(404).json({error:'No published result found for the supplied details.'});
    const classIds=classRows.map(x=>x.id);
    const classFilter='in.('+classIds.map(id=>encodeURIComponent(id)).join(',')+')';
    const enrollments=await get('/student_enrollments?select=student_id,academic_year_id,class_id,roll,enrollment_status&academic_year_id=eq.'+encodeURIComponent(yearId)+'&roll=eq.'+encodeURIComponent(roll)+'&class_id='+classFilter+'&limit=10');
    const enrollment=(enrollments||[]).find(x=>['active','completed','promoted','repeated'].includes(String(x.enrollment_status||'').toLowerCase()));
    if(!enrollment)return res.status(404).json({error:'No published result found for the supplied details.'});
    const classId=enrollment.class_id,studentId=enrollment.student_id;
    const students=await get('/students?select=id,name,student_id&id=eq.'+encodeURIComponent(studentId)+'&limit=1');
    if(!students?.length)return res.status(404).json({error:'No published result found for the supplied details.'});
    const student=students[0];
    const [rows,required,selected]=await Promise.all([
      get('/results?select=id,class_subject_id,marks,grade,grade_point,exam_name,status,class_subjects(subject_id,subjects(name))&student_id=eq.'+encodeURIComponent(studentId)+'&academic_year_id=eq.'+encodeURIComponent(yearId)+'&status=eq.published&exam_name=eq.'+encodeURIComponent(exam)),
      get('/class_subjects?select=id,is_compulsory&class_id=eq.'+encodeURIComponent(classId)+'&academic_year_id=eq.'+encodeURIComponent(yearId)),
      get('/student_subjects?select=class_subject_id&student_id=eq.'+encodeURIComponent(studentId))
    ]);
    const selectedIds=new Set((selected||[]).map(x=>x.class_subject_id));
    const requiredIds=(required||[]).filter(x=>x.is_compulsory||selectedIds.has(x.id)).map(x=>x.id);
    const eligibleRows=(rows||[]).filter(r=>requiredIds.includes(r.class_subject_id));
    const subjects=eligibleRows.map(r=>({subject:r.class_subjects?.subjects?.name||'Subject',marks:Number(r.marks||0),grade:r.grade||'',point:Number(r.grade_point||0),class_subject_id:r.class_subject_id}));
    if(!subjects.length)return res.status(404).json({error:'No published result found for the supplied details.'});
    const publishedIds=new Set(eligibleRows.map(r=>r.class_subject_id));
    const complete=requiredIds.length>0&&requiredIds.every(id=>publishedIds.has(id));
    const total=subjects.reduce((sum,row)=>sum+row.marks,0),average=subjects.length?total/subjects.length:0;
    const gpa=complete?(requiredIds.some(id=>{const row=subjects.find(x=>x.class_subject_id===id);return !row||row.point===0;})?0:Math.min(5,requiredIds.reduce((sum,id)=>sum+subjects.find(x=>x.class_subject_id===id).point,0)/requiredIds.length)):null;
    const roundedGpa=gpa===null?null:Number(gpa.toFixed(2));
    const overallGrade=gpa===null?null:gpa>=5?'A+':gpa>=4?'A':gpa>=3.5?'A-':gpa>=3?'B':gpa>=2?'C':gpa>=1?'D':'F';
    return res.status(200).json({result:{name:student.name,class:cls,roll,year,exam,subjects,total,average,gpa:roundedGpa,overall_grade:overallGrade,gpa_pending:!complete,published_subject_count:subjects.length,required_subject_count:requiredIds.length}});
  }catch(error){console.error('Public result lookup failed:',error);return res.status(500).json({error:'Unable to retrieve the published result right now.'});}
};

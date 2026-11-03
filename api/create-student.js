const { randomBytes } = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
  const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  async function rest(path,options={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.details||'Database request failed.'));return d;}
  let studentId=null,userId=null;
  try{
    const { authorizeAdmin } = require('./_lib/admin-auth');
    const authz = await authorizeAdmin(req, res, 'students');
    if (!authz) return;
    const admin = authz.user;
    const b=req.body||{};const name=String(b.name||'').trim(),password=String(b.password||'');
    if(!name)return res.status(400).json({success:false,error:'Student name is required.'});
    if(password.length<8)return res.status(400).json({success:false,error:'Password must be at least 8 characters.'});
    if(!b.classId||!b.academicYearId||!Number.isInteger(Number(b.roll))||Number(b.roll)<1)return res.status(400).json({success:false,error:'Class, academic year and valid roll are required.'});
    const classRows=await rest('classes?id=eq.'+encodeURIComponent(b.classId)+'&select=class_number');
    const yearRows=await rest('academic_years?id=eq.'+encodeURIComponent(b.academicYearId)+'&select=year');
    if(!classRows.length||!yearRows.length)throw new Error('Selected class or academic year was not found.');
    // New student IDs use a numeric sequence starting at 10001; legacy IDs stay unchanged.
    const existingIds=await rest('students?select=student_id&limit=10000');
    let nextNumericId=Math.max(10000,...(existingIds||[]).map(x=>/^\d+$/.test(String(x.student_id||''))?Number(x.student_id):10000))+1;
    let login=null,inserted=null,lastInsertError=null;
    for(let attempt=0;attempt<8;attempt++){
      login=String(nextNumericId++);
      try{
        inserted=await rest('students',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({student_id:login,admission_number:login,name,father_name:String(b.fatherName||'').trim()||null,mother_name:String(b.motherName||'').trim()||null,class_id:b.classId,academic_year_id:b.academicYearId,roll:Number(b.roll),mobile:String(b.mobile||'').trim()||null,status:true})});
        break;
      }catch(error){
        lastInsertError=error;
        if(!/duplicate|unique/i.test(error.message))throw error;
        const latest=await rest('students?select=student_id&limit=10000');
        nextNumericId=Math.max(nextNumericId,...(latest||[]).map(x=>/^\d+$/.test(String(x.student_id||''))?Number(x.student_id)+1:10001));
      }
    }
    if(!inserted?.length)throw lastInsertError||new Error('Could not generate a unique Student ID. Please retry.');
    studentId=inserted[0].id;if(!studentId)throw new Error('Student record was not created.');
    const feeTemplates=await rest('fee_templates?class_id=eq.'+encodeURIComponent(b.classId)+'&academic_year_id=eq.'+encodeURIComponent(b.academicYearId)+'&is_active=eq.true&select=id,fee_name,description,amount,due_date');
    if(feeTemplates.length){
      const feeRows=feeTemplates.map(f=>({student_id:studentId,academic_year_id:b.academicYearId,fee_template_id:f.id,fee_type:f.fee_name,description:f.description||null,amount:Number(f.amount),paid_amount:0,payment_status:'unpaid',due_date:f.due_date||null}));
      await rest('student_fees',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(feeRows)});
    }
    const email='student-'+studentId+'@mhs-login.invalid';
    const cr=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{role:'student',student_id:studentId,display_name:name}})});
    const cu=await cr.json();if(!cr.ok)throw new Error(cu.message||cu.msg||'Could not create the student authentication account.');userId=cu.id;
    await rest('user_profiles',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:userId,role:'student',student_id:studentId,display_name:name,is_active:true})});
    return res.status(201).json({success:true,student:{id:studentId,student_id:login,login_id:login,name,fee_templates_attached:true}});
  }catch(e){console.error('Student creation failed:',e);if(userId){await fetch(base+'/auth/v1/admin/users/'+userId,{method:'DELETE',headers}).catch(()=>{});}if(studentId){try{await rest('student_fees?student_id=eq.'+encodeURIComponent(studentId),{method:'DELETE'});}catch{}try{await rest('students?id=eq.'+encodeURIComponent(studentId),{method:'DELETE'});}catch{}}return res.status(400).json({success:false,error:e.message||'Could not create student.'});}
};
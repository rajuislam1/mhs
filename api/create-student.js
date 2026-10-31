module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
  const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  async function rest(path,options={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.details||'Database request failed.'));return d;}
  let studentId=null,userId=null;
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({success:false,error:'Admin login required.'});
    const ar=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});if(!ar.ok)return res.status(401).json({success:false,error:'Admin session expired.'});const admin=await ar.json();
    const profiles=await rest('user_profiles?id=eq.'+encodeURIComponent(admin.id)+'&select=role,is_active');
    if(!profiles[0]||profiles[0].role!=='super_admin'||profiles[0].is_active!==true)return res.status(403).json({success:false,error:'Active Super Admin permission required.'});
    const b=req.body||{};const name=String(b.name||'').trim(),login=String(b.studentId||'').trim(),password=String(b.password||'');
    if(!name||!login||!/^[A-Za-z0-9._-]{2,40}$/.test(login))return res.status(400).json({success:false,error:'Student name and a valid Student ID are required.'});
    if(password.length<8)return res.status(400).json({success:false,error:'Password must be at least 8 characters.'});
    if(!b.classId||!b.academicYearId||!Number.isInteger(Number(b.roll))||Number(b.roll)<1)return res.status(400).json({success:false,error:'Class, academic year and valid roll are required.'});
    const existing=await rest('students?student_id=eq.'+encodeURIComponent(login)+'&select=id');
    if(existing.length)return res.status(409).json({success:false,error:'This Student ID is already in use.'});
    const inserted=await rest('students',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({student_id:login,admission_number:login,name,father_name:String(b.fatherName||'').trim()||null,mother_name:String(b.motherName||'').trim()||null,class_id:b.classId,academic_year_id:b.academicYearId,roll:Number(b.roll),mobile:String(b.mobile||'').trim()||null,status:true})});
    studentId=inserted?.[0]?.id;if(!studentId)throw new Error('Student record was not created.');
    const email='student-'+studentId+'@mhs-login.invalid';
    const cr=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{role:'student',student_id:studentId,display_name:name}})});
    const cu=await cr.json();if(!cr.ok)throw new Error(cu.message||cu.msg||'Could not create the student authentication account.');userId=cu.id;
    await rest('user_profiles',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:userId,role:'student',student_id:studentId,display_name:name,is_active:true})});
    return res.status(201).json({success:true,student:{id:studentId,student_id:login,name}});
  }catch(e){console.error('Student creation failed:',e);if(userId){await fetch(base+'/auth/v1/admin/users/'+userId,{method:'DELETE',headers}).catch(()=>{});}if(studentId){try{await rest('students?id=eq.'+encodeURIComponent(studentId),{method:'DELETE'});}catch{}}return res.status(400).json({success:false,error:e.message||'Could not create student.'});}
};
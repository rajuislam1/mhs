module.exports = async (req,res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
  const base=url.endsWith('/')?url.slice(0,-1):url;const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  async function rest(path,options={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.details||'Database request failed.');return d;}
  let authId=null,studentUuid=null,profileMade=false,enrollmentMade=false;
  try{
    const token=(req.headers.authorization||'').replace('Bearer ','');if(!token)return res.status(401).json({success:false,error:'Admin login required.'});
    const ar=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});if(!ar.ok)return res.status(401).json({success:false,error:'Admin session expired.'});const admin=await ar.json();
    const profiles=await rest('user_profiles?id=eq.'+encodeURIComponent(admin.id)+'&select=role,is_active');
    if(!profiles[0]||profiles[0].role!=='super_admin'||profiles[0].is_active!==true)return res.status(403).json({success:false,error:'Active Super Admin permission required.'});
    const b=req.body||{},applicationId=String(b.applicationId||''),classId=String(b.classId||''),yearId=String(b.academicYearId||''),roll=Number(b.roll),password=String(b.password||'');
    if(!/^[0-9a-f-]{36}$/i.test(applicationId)||!/^[0-9a-f-]{36}$/i.test(classId)||!/^[0-9a-f-]{36}$/i.test(yearId))return res.status(400).json({success:false,error:'Select a valid application, class and academic year.'});
    if(!Number.isInteger(roll)||roll<1)return res.status(400).json({success:false,error:'Enter a valid roll number.'});
    if(password.length<8)return res.status(400).json({success:false,error:'Password must be at least 8 characters.'});
    const apps=await rest('admission_applications?id=eq.'+encodeURIComponent(applicationId)+'&select=*');
    const app=apps[0];if(!app)return res.status(404).json({success:false,error:'Admission application not found.'});
    if(app.application_status!=='pending')return res.status(409).json({success:false,error:'This application has already been reviewed.'});
    const [classes,years,rollDup,idDup]=await Promise.all([
      rest('classes?id=eq.'+encodeURIComponent(classId)+'&status=eq.true&select=id'),
      rest('academic_years?id=eq.'+encodeURIComponent(yearId)+'&select=id,is_active'),
      rest('students?class_id=eq.'+encodeURIComponent(classId)+'&academic_year_id=eq.'+encodeURIComponent(yearId)+'&roll=eq.'+roll+'&status=eq.true&select=id'),
      rest('students?student_id=eq.'+encodeURIComponent(app.application_no)+'&select=id')
    ]);
    if(!classes.length||!years.length)return res.status(400).json({success:false,error:'Selected class or academic year is invalid.'});
    if(rollDup.length)return res.status(409).json({success:false,error:'This roll number is already assigned in the selected class and year.'});
    if(idDup.length)return res.status(409).json({success:false,error:'A student already exists with this application number.'});
    const inserted=await rest('students',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
      student_id:app.application_no,admission_number:app.application_no,name:app.student_name,
      father_name:app.father_name||null,mother_name:app.mother_name||null,date_of_birth:app.date_of_birth||null,
      gender:app.gender||null,class_id:classId,academic_year_id:yearId,roll,mobile:app.mobile||app.guardian_mobile||null,
      guardian:app.guardian_mobile||null,address:app.address||null,admission_date:new Date().toISOString().slice(0,10),status:true
    })});
    studentUuid=inserted?.[0]?.id;if(!studentUuid)throw new Error('Student record was not created.');
    const email='student-'+studentUuid+'@mhs-login.invalid';
    const cr=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{role:'student',student_id:studentUuid,student_code:app.application_no,display_name:app.student_name}})});
    const cu=await cr.json();if(!cr.ok)throw new Error(cu.message||cu.msg||'Could not create student login account.');authId=cu.id;
    await rest('user_profiles',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:authId,role:'student',student_id:studentUuid,display_name:app.student_name,is_active:true})});profileMade=true;
    await rest('student_enrollments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({student_id:studentUuid,academic_year_id:yearId,class_id:classId,roll,enrollment_status:'active',remarks:'Created from admission application '+app.application_no})});enrollmentMade=true;
    const reviewed=await rest('admission_applications?id=eq.'+encodeURIComponent(applicationId)+'&application_status=eq.pending',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({application_status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:admin.id})});
    if(!reviewed.length)throw new Error('Application status was not updated; please contact the administrator.');
    return res.status(201).json({success:true,student:{id:studentUuid,student_id:app.application_no,name:app.student_name,roll}});
  }catch(e){
    console.error('Admission approval failed:',e);
    if(studentUuid){if(enrollmentMade)await rest('student_enrollments?student_id=eq.'+encodeURIComponent(studentUuid),{method:'DELETE'}).catch(()=>{});if(profileMade)await rest('user_profiles?id=eq.'+encodeURIComponent(authId),{method:'DELETE'}).catch(()=>{});if(authId)await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(authId),{method:'DELETE',headers}).catch(()=>{});await rest('students?id=eq.'+encodeURIComponent(studentUuid),{method:'DELETE'}).catch(()=>{});}
    return res.status(400).json({success:false,error:e.message||'Could not approve admission.'});
  }
};

module.exports = async (req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(500).json({success:false,error:'Student login is not configured on the server.'});
 const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function rest(path){const r=await fetch(base+'/rest/v1/'+path,{headers});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error('Could not verify student account.');return d;}
 try{
  const login=String(req.body?.login||'').trim(),password=String(req.body?.password||'');if(!login||!password)return res.status(400).json({success:false,error:'Enter Student ID and password.'});
  const encoded=encodeURIComponent(login);let students=await rest('students?select=id,student_id,admission_number,name,status&student_id=eq.'+encoded+'&limit=1');if(!students.length)students=await rest('students?select=id,student_id,admission_number,name,status&admission_number=eq.'+encoded+'&limit=1');
  const student=students[0];if(!student||student.status!==true)return res.status(401).json({success:false,error:'Student account is not active or the login details are incorrect.'});
  const profiles=await rest('user_profiles?select=id,is_active,role&student_id=eq.'+encodeURIComponent(student.id)+'&role=eq.student&limit=1');const profile=profiles[0];if(!profile||profile.is_active!==true)return res.status(401).json({success:false,error:'Student account is not active or the login details are incorrect.'});
  const email='student-'+student.id+'@mhs-login.invalid';
  const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});const session=await r.json().catch(()=>null);if(!r.ok)return res.status(401).json({success:false,error:'Invalid Student ID or password.'});
  return res.status(200).json({success:true,session});
 }catch(e){console.error('Student login failed:',e);return res.status(500).json({success:false,error:'Unable to sign in right now. Please try again.'});}
};
module.exports = async (req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='PATCH'){res.setHeader('Allow','PATCH');return res.status(405).json({success:false,error:'Method not allowed.'});}
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
 const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function rest(path,options={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||'Database request failed.');return d;}
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({success:false,error:'Admin login required.'});
  const ar=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});if(!ar.ok)return res.status(401).json({success:false,error:'Admin session expired.'});const admin=await ar.json();
  const p=await rest('user_profiles?id=eq.'+encodeURIComponent(admin.id)+'&select=role,is_active');if(!p[0]||p[0].role!=='super_admin'||p[0].is_active!==true)return res.status(403).json({success:false,error:'Active Super Admin permission required.'});
  const id=String(req.body?.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({success:false,error:'Valid student ID is required.'});
  const now=new Date().toISOString();
  if(req.body?.profile&&typeof req.body.profile==='object'){
   const allowed=['name','father_name','mother_name','roll','mobile'];const patch={};for(const field of allowed)if(Object.prototype.hasOwnProperty.call(req.body.profile,field))patch[field]=req.body.profile[field];
   if(typeof patch.name!=='string'||!patch.name.trim()||!Number.isInteger(patch.roll)||patch.roll<1)return res.status(400).json({success:false,error:'Student name and a valid roll number are required.'});
   patch.updated_at=now;const updated=await rest('students?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});if(!updated.length)return res.status(404).json({success:false,error:'Student not found.'});return res.status(200).json({success:true,student:updated[0]});
  }
  if(typeof req.body?.status!=='boolean')return res.status(400).json({success:false,error:'A valid status or profile update is required.'});
  const updated=await rest('students?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:req.body.status,updated_at:now})});if(!updated.length)return res.status(404).json({success:false,error:'Student not found.'});
  const links=await rest('user_profiles?student_id=eq.'+encodeURIComponent(id)+'&role=eq.student&select=id');for(const x of links)await rest('user_profiles?id=eq.'+encodeURIComponent(x.id),{method:'PATCH',body:JSON.stringify({is_active:req.body.status,updated_at:now})});
  return res.status(200).json({success:true});
 }catch(e){console.error('Student status update failed:',e);return res.status(400).json({success:false,error:e.message||'Could not update student.'});}
};
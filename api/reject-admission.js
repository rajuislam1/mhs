module.exports = async (req,res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
  const base=url.endsWith('/')?url.slice(0,-1):url;const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  try{
    const { authorizeAdmin } = require('./_lib/admin-auth');
    const authz = await authorizeAdmin(req, res, 'admissions');
    if (!authz) return;
    const admin = authz.user;
    const id=String(req.body?.applicationId||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({success:false,error:'Valid application is required.'});
    const r=await fetch(base+'/rest/v1/admission_applications?id=eq.'+encodeURIComponent(id)+'&application_status=eq.pending',{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({application_status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by:admin.id})});
    const rows=await r.json();if(!r.ok)throw new Error(rows?.message||'Could not reject application.');if(!rows.length)return res.status(409).json({success:false,error:'Application not found or already reviewed.'});
    return res.status(200).json({success:true});
  }catch(e){console.error('Admission rejection failed:',e);return res.status(400).json({success:false,error:e.message||'Could not reject application.'});}
};

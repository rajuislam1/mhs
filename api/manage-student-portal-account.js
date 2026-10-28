module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const allowed = ['GET', 'POST', 'PATCH'];
  if (!allowed.includes(req.method)) { res.setHeader('Allow', allowed.join(', ')); return res.status(405).json({success:false,error:'Method not allowed.'}); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({success:false,error:'Supabase server configuration is missing.'});
  const headers = { apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json' };
  const rest = url + '/rest/v1';
  const parse = async r => { try { return await r.json(); } catch { return null; } };

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i,'');
    if (!token) return res.status(401).json({success:false,error:'Super Admin login required.'});
    const au = await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
    if (!au.ok) return res.status(401).json({success:false,error:'Session invalid. Sign in again.'});
    const authUser = await au.json();
    const pr = await fetch(rest+'/user_profiles?id=eq.'+encodeURIComponent(authUser.id)+'&select=id,role,is_active', {headers});
    const profiles = await parse(pr);
    if (!pr.ok) return res.status(500).json({success:false,error:'Could not verify administrator.'});
    if (!profiles?.[0] || profiles[0].role!=='super_admin' || profiles[0].is_active!==true) return res.status(403).json({success:false,error:'Active Super Admin permission required.'});

    if (req.method === 'GET') {
      const [sr, ur] = await Promise.all([
        fetch(rest+'/students?select=id,student_id,name,admission_number,class_id,academic_year_id,status&order=created_at.desc',{headers}),
        fetch(rest+'/user_profiles?role=eq.student&select=id,student_id,display_name,is_active,created_at',{headers})
      ]);
      const students = await parse(sr), studentProfiles = await parse(ur);
      if (!sr.ok || !ur.ok) return res.status(500).json({success:false,error:'Could not load student accounts.'});
      return res.status(200).json({success:true,students:students.map(s=>({...s,account:(studentProfiles||[]).find(p=>p.student_id===s.id)||null}))});
    }

    const body = req.body || {};
    if (req.method === 'POST') {
      const studentId = String(body.student_id||'').trim();
      const email = ''; // Student portal credentials use roll number; internal Auth email is never shown.
      const password = String(body.password||'');
      if (!studentId || password.length < 8) return res.status(400).json({success:false,error:'Choose a student and enter a password of at least 8 characters.'});
      const sr = await fetch(rest+'/students?id=eq.'+encodeURIComponent(studentId)+'&select=id,student_id,name,roll,status',{headers});
      const students = await parse(sr);
      const student = students?.[0];
      if (!sr.ok) return res.status(500).json({success:false,error:'Could not verify student record.'});
      if (!student) return res.status(404).json({success:false,error:'Student record not found.'});
      if (student.status === false) return res.status(400).json({success:false,error:'Student record is inactive. Activate the student record first.'});
      const existing = await fetch(rest+'/user_profiles?student_id=eq.'+encodeURIComponent(student.id)+'&select=id,role',{headers});
      const existingProfiles = await parse(existing);
      if (!existing.ok) return res.status(500).json({success:false,error:'Could not check existing student login.'});
      if (existingProfiles?.some(p=>p.role==='student')) return res.status(409).json({success:false,error:'This student already has a login profile. Use Activate/Deactivate instead.'});

      const authEmail = 'student.' + student.id + '@login.mokhleshpur-high-school.edu.bd';
      const cr = await fetch(url+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:authEmail,password,email_confirm:true,user_metadata:{role:'student',student_id:student.id,student_number:student.student_id,roll:student.roll,display_name:student.name}})});
      const created = await parse(cr);
      if (!cr.ok || !created?.id) return res.status(400).json({success:false,error:created?.msg||created?.message||created?.error_description||'Could not create Supabase Auth account. Check duplicate email and password rules.'});

      const profileResponse = await fetch(rest+'/user_profiles',{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({id:created.id,role:'student',student_id:student.id,display_name:student.name,is_active:true})});
      const profileResult = await parse(profileResponse);
      if (!profileResponse.ok) {
        await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(created.id),{method:'DELETE',headers});
        return res.status(500).json({success:false,error:'Auth user was created but profile linking failed; rollback was attempted. '+(profileResult?.message||'Please inspect Supabase Auth users.')});
      }
      return res.status(201).json({success:true,message:'Student login account created and activated. Sign in using Roll Number and the password you set.',student:{id:student.id,student_id:student.student_id,name:student.name,roll:student.roll}});
    }

    // Password reset for an existing Supabase-linked student, identified by the school Student ID.
    if (typeof body.password === 'string') {
      const studentNumber = String(body.student_id || '').trim();
      if (!studentNumber || body.password.length < 8) {
        return res.status(400).json({success:false,error:'Student ID and a password of at least 8 characters are required.'});
      }
      const studentResponse = await fetch(rest+'/students?student_id=eq.'+encodeURIComponent(studentNumber)+'&select=id',{headers});
      const studentRows = await parse(studentResponse);
      if (!studentResponse.ok) return res.status(500).json({success:false,error:'Could not look up the student.'});
      if (!studentRows?.[0]) return res.status(404).json({success:false,error:'No Supabase student record found for this Student ID.'});
      const profileResponse = await fetch(rest+'/user_profiles?student_id=eq.'+encodeURIComponent(studentRows[0].id)+'&role=eq.student&select=id,is_active',{headers});
      const profileRows = await parse(profileResponse);
      if (!profileResponse.ok) return res.status(500).json({success:false,error:'Could not look up the student login profile.'});
      if (!profileRows?.[0]) return res.status(404).json({success:false,error:'This student does not have a Supabase portal login yet.'});
      const passwordResponse = await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(profileRows[0].id),{
        method:'PUT',headers,body:JSON.stringify({password:body.password})
      });
      const passwordResult = await parse(passwordResponse);
      if (!passwordResponse.ok) return res.status(400).json({success:false,error:passwordResult?.message||'Could not reset the student portal password.'});
      return res.status(200).json({success:true,message:'Student portal password reset successfully.'});
    }

    if (req.method === 'PATCH' && typeof body.display_name === 'string') {
      const profileId = String(body.profile_id || '').trim();
      const displayName = body.display_name.trim();
      if (!profileId || !displayName) return res.status(400).json({success:false,error:'Student profile ID and display name are required.'});
      const updateResponse = await fetch(rest+'/user_profiles?id=eq.'+encodeURIComponent(profileId)+'&role=eq.student', {
        method:'PATCH',
        headers:{...headers,Prefer:'return=representation'},
        body:JSON.stringify({display_name:displayName,updated_at:new Date().toISOString()})
      });
      const updated = await parse(updateResponse);
      if (!updateResponse.ok || !updated?.length) return res.status(400).json({success:false,error:'Could not update the student portal display name.'});
      return res.status(200).json({success:true,message:'Student portal display name updated.'});
    }

    const profileId = String(body.profile_id||'').trim();
    const isActive = body.is_active;
    if (!profileId || typeof isActive !== 'boolean') return res.status(400).json({success:false,error:'Profile ID and boolean is_active are required.'});
    const targetResponse = await fetch(rest+'/user_profiles?id=eq.'+encodeURIComponent(profileId)+'&role=eq.student&select=id,student_id,is_active',{headers});
    const targetRows = await parse(targetResponse);
    if (!targetResponse.ok) return res.status(500).json({success:false,error:'Could not find student login.'});
    const target = targetRows?.[0];
    if (!target) return res.status(404).json({success:false,error:'Student login profile not found.'});
    const updateResponse = await fetch(rest+'/user_profiles?id=eq.'+encodeURIComponent(profileId),{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({is_active:isActive,updated_at:new Date().toISOString()})});
    const updated = await parse(updateResponse);
    if (!updateResponse.ok || !updated?.length) return res.status(500).json({success:false,error:'Could not update student account status.'});
    // Account activation is independent of the underlying student record status.
    return res.status(200).json({success:true,message:isActive?'Student account activated.':'Student account deactivated.',is_active:isActive});
  } catch (error) {
    console.error('Manage student portal account error:',error);
    return res.status(500).json({success:false,error:'Unexpected server error.'});
  }
};

const opts=a=>a.map(x=>`<option>${x}</option>`).join(''),CLS=['6','7','8','9','10'];
const HERO_DEF=['assets/images/hero/1.jpg','assets/images/hero/2.jpg'],heroGet=()=>{const h=mhsGet('mhs_hero',null);return h===null?HERO_DEF.map(u=>({url:u})):h};
function generateStudentId(list){let max=100000;(list||[]).forEach(x=>{const id=String(x.studentId||'');if(/^\d+$/.test(id))max=Math.max(max,Number(id))});return String(max+1)}
function ensureStudentIds(){let s=mhsGet('mhs_students',[]),changed=false;const used=new Set(),old=[];for(const x of s){const id=String(x.studentId||'');if(/^\d+$/.test(id)&&!used.has(id)){used.add(id)}else old.push(x)}let next=100001;for(const x of old){while(used.has(String(next)))next++;x.studentId=String(next++);used.add(x.studentId);changed=true}if(changed)mhsSet('mhs_students',s);let results=mhsGet('mhs_results',[]),rChanged=false;results.forEach(r=>{let st=s.find(x=>String(x.studentId)===String(r.studentId));if(!st)st=s.find(x=>String(x.class)===String(r.class)&&String(x.roll)===String(r.roll)&&(String(x.name||'').trim().toLowerCase()===String(r.name||'').trim().toLowerCase()||!r.name));if(st&&String(r.studentId)!==String(st.studentId)){r.studentId=st.studentId;r.name=st.name;r.class=st.class;r.roll=st.roll;rChanged=true}});if(rChanged)mhsSet('mhs_results',results);return s}
function saveClassSubjects(cls,year){const checks=[...document.querySelectorAll(`.class-sub[data-class="${cls}"]`)];let all=mhsGet('mhs_class_subjects',[]).filter(x=>!(String(x.year)===String(year)&&String(x.class)===String(cls)));checks.filter(x=>x.checked).forEach(x=>{const cat=mhsGetSubjectCatalog().find(c=>c.id===x.dataset.id);all.push({year:String(year),class:String(cls),subjectId:x.dataset.id,subject:cat?.name||x.dataset.id,required:cat?.type!=='Optional'});});mhsSet('mhs_class_subjects',all);mhsToast(`Class ${cls} subjects saved`);render()}
function deleteSubject(id){if(!confirm('Delete this custom subject?'))return;mhsSet('mhs_subject_catalog',mhsGetSubjectCatalog().filter(x=>x.id!==id));mhsSet('mhs_class_subjects',mhsGet('mhs_class_subjects',[]).filter(x=>x.subjectId!==id));render()}
function editStudentSubjects(i){const students=ensureStudentIds(),st=students[i],year=Number(window.__subjectYear||new Date().getFullYear()),master=mhsClassSubjects(year,st.class),cat=mhsGetSubjectCatalog();if(!master.length)return alert(`Class ${st.class} has no subject structure for ${year}. Configure Academic Subjects first.`);const current=new Set(mhsStudentSubjects(st,year));const o=document.createElement('div');o.className='mhsM';o.innerHTML=`<form><h3>Subjects · ${esc(st.name)} · Class ${esc(st.class)}</h3><div class="subject-grid">${master.map(m=>{const c=cat.find(x=>x.id===m.subjectId)||{name:m.subjectId,type:'Compulsory'};return `<label class="subject-row"><input type="checkbox" class="stu-sub" data-id="${esc(m.subjectId)}" ${current.has(m.subjectId)?'checked':''}><span><b>${esc(c.name)}</b><small>${esc(c.type)}</small></span></label>`}).join('')}</div><div class="b"><button type="button" class="x">Cancel</button><button>Save Changes</button></div></form>`;document.body.appendChild(o);o.querySelector('.x').onclick=()=>o.remove();o.querySelector('form').onsubmit=e=>{e.preventDefault();const ids=[...o.querySelectorAll('.stu-sub:checked')].map(x=>x.dataset.id);if(!ids.length)return alert('Select at least one subject.');st.subjectSelections=Array.isArray(st.subjectSelections)?st.subjectSelections.filter(x=>String(x.year)!==String(year)):[];st.subjectSelections.push({year,class:String(st.class),subjects:ids,updatedAt:new Date().toISOString()});mhsSet('mhs_students',students);o.remove();mhsToast('Student subjects saved');render()}}

window.MHS_EXTRA={
async subjects(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Academic Subjects</h2><p class="hint">Loading academic structure from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{data:classes,error:classError},{data:years,error:yearError},{data:subjects,error:subjectError},{data:classSubjects,error:csError}]=await Promise.all([
   sb.from('classes').select('id,name,class_number,status').eq('status',true).order('class_number'),
   sb.from('academic_years').select('id,year,name,is_active').order('year',{ascending:false}),
   sb.from('subjects').select('id,name,code,status').order('name'),
   sb.from('class_subjects').select('id,class_id,subject_id,academic_year_id,is_compulsory')
  ]);
  if(classError)throw classError;if(yearError)throw yearError;if(subjectError)throw subjectError;if(csError)throw csError;
  const currentYear=(years||[]).find(y=>Number(y.year)===new Date().getFullYear())||(years||[])[0];
  const activeSubjects=(subjects||[]).filter(s=>s.status!==false);
  box.innerHTML=`<div class="panel"><div class="box"><h2>Academic Subject Catalog</h2><p class="hint">Subjects and class-wise subject structures are stored in Supabase. Existing result or teacher-assignment references are protected from accidental deletion.</p>
   <form class="form" id="sbSubjectForm"><label>Subject Name<input name="name" required maxlength="100"></label><label>Subject Code<input name="code" maxlength="20" placeholder="Optional"></label><button type="submit">Add Subject</button></form>
   <div class="table-wrap"><table class="table"><tr><th>Code</th><th>Subject</th><th>Status</th></tr>${(subjects||[]).map(s=>`<tr><td>${AESC(s.code||'—')}</td><td>${AESC(s.name)}</td><td><span class="badge">${s.status?'Active':'Inactive'}</span></td></tr>`).join('')||'<tr><td colspan="3">No subjects configured.</td></tr>'}</table></div>
  </div><div class="box"><h2>Class-wise Subject Structure</h2><div class="form"><label>Academic Year<select id="sbCsYear">${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${y.id===currentYear?.id?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label><label>Class<select id="sbCsClass">${(classes||[]).map(cl=>`<option value="${AESC(cl.id)}">${AESC(cl.name||('Class '+cl.class_number))}</option>`).join('')}</select></label></div><div id="sbClassSubjectEditor"></div></div></div>`;
  const editor=document.getElementById('sbClassSubjectEditor'),yearSelect=document.getElementById('sbCsYear'),classSelect=document.getElementById('sbCsClass');
  const draw=()=>{
   const yearId=yearSelect.value,classId=classSelect.value;
   const existing=(classSubjects||[]).filter(cs=>cs.academic_year_id===yearId&&cs.class_id===classId);
   editor.innerHTML=`<div class="subject-grid">${activeSubjects.map(s=>{const row=existing.find(cs=>cs.subject_id===s.id);return `<label class="subject-row"><input type="checkbox" class="sb-class-sub" data-subject-id="${AESC(s.id)}" ${row?'checked':''} data-compulsory="${row?.is_compulsory?'1':'0'}"><span><b>${AESC(s.name)}</b><small>${AESC(s.code||'No code')} · ${row?(row.is_compulsory?'Compulsory':'Optional'):'Not assigned'}</small></span><select class="sb-sub-type" aria-label="Subject type"><option value="1" ${row?.is_compulsory!==false?'selected':''}>Compulsory</option><option value="0" ${row?.is_compulsory===false?'selected':''}>Optional</option></select></label>`}).join('')}</div><p class="hint">Unchecking an existing subject removes the class mapping only when no result, student-subject or teacher-assignment record depends on it.</p><button type="button" id="sbSaveClassSubjects">Save Class Subject Structure</button><p id="sbCsMessage" class="hint"></p>`;
   document.getElementById('sbSaveClassSubjects').onclick=async()=>{
    const button=document.getElementById('sbSaveClassSubjects');button.disabled=true;
    const msg=document.getElementById('sbCsMessage');
    try{
     const selected=[...editor.querySelectorAll('.sb-class-sub:checked')].map(ch=>({subject_id:ch.dataset.subjectId,is_compulsory:ch.closest('.subject-row').querySelector('.sb-sub-type').value==='1'}));
     const old=existing.slice();const selectedIds=new Set(selected.map(x=>x.subject_id));
     const toInsert=selected.filter(s=>!old.some(o=>o.subject_id===s.subject_id)).map(s=>({class_id:classId,subject_id:s.subject_id,academic_year_id:yearId,is_compulsory:s.is_compulsory}));
     if(toInsert.length){const {error}=await sb.from('class_subjects').insert(toInsert);if(error)throw error;}
     for(const item of selected.filter(s=>old.some(o=>o.subject_id===s.subject_id))){
      const row=old.find(o=>o.subject_id===item.subject_id);
      if(row.is_compulsory!==item.is_compulsory){const {error}=await sb.from('class_subjects').update({is_compulsory:item.is_compulsory}).eq('id',row.id);if(error)throw error;}
     }
     const warnings=[];
     for(const row of old.filter(o=>!selectedIds.has(o.subject_id))){
      const [r,ss,ta]=await Promise.all([
       sb.from('results').select('id',{count:'exact',head:true}).eq('class_subject_id',row.id),
       sb.from('student_subjects').select('id',{count:'exact',head:true}).eq('class_subject_id',row.id),
       sb.from('teacher_assignments').select('id',{count:'exact',head:true}).eq('class_id',classId).eq('subject_id',row.subject_id).eq('academic_year_id',yearId)
      ]);
      if(r.error)throw r.error;if(ss.error)throw ss.error;if(ta.error)throw ta.error;
      if((r.count||0)||(ss.count||0)||(ta.count||0)){warnings.push('Kept '+(subjects||[]).find(s=>s.id===row.subject_id)?.name+' because records depend on it.');continue;}
      const {error}=await sb.from('class_subjects').delete().eq('id',row.id);if(error)throw error;
     }
     msg.textContent=warnings.length?'Saved. '+warnings.join(' '):'Class subject structure saved successfully.';
     mhsToast('Academic subject structure saved');
     await window.MHS_EXTRA.subjects();
    }catch(error){msg.textContent='Could not save: '+(error.message||String(error));}
    finally{button.disabled=false;}
   };
  };
  document.getElementById('sbSubjectForm').onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(event.currentTarget),name=String(fd.get('name')||'').trim();
   if((subjects||[]).some(s=>s.name.toLowerCase()===name.toLowerCase()))return alert('This subject already exists.');
   const rawCode=String(fd.get('code')||'').trim();const code=rawCode||name.split(/\s+/).map(w=>w[0]).join('').slice(0,8).toUpperCase();
   const button=event.currentTarget.querySelector('button');button.disabled=true;
   try{const {error}=await sb.from('subjects').insert({name,code,status:true});if(error)throw error;mhsToast('Subject added to Supabase');await window.MHS_EXTRA.subjects();}
   catch(error){alert('Could not add subject: '+(error.message||String(error)));button.disabled=false;}
  };
  yearSelect.addEventListener('change',draw);classSelect.addEventListener('change',draw);draw();
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Academic Subjects</h2><p class="hint">Could not load academic structure: ${AESC(error.message||String(error))}</p></div></div>`;}
},
studentSubjects(){return window.studentSubjects();},
studentSubjects(){const year=Number(window.__subjectYear||new Date().getFullYear()),students=ensureStudentIds(),cat=mhsGetSubjectCatalog();mhsEnsureAcademicStructure(year);app.innerHTML=`<div class="panel"><div class="box"><h2>Student Subject Selection</h2><p class="hint">Select a student to assign the subjects they actually study in the running academic year. Compulsory class subjects are pre-selected; optional subjects are selected by the Admin.</p><label style="display:block;margin-bottom:12px">Academic Year<select id="ssYear"><option ${year===new Date().getFullYear()?'selected':''}>${new Date().getFullYear()}</option><option ${year===new Date().getFullYear()+1?'selected':''}>${new Date().getFullYear()+1}</option><option ${year===new Date().getFullYear()-1?'selected':''}>${new Date().getFullYear()-1}</option></select></label><div class="table-wrap"><table class="table"><tr><th>Student ID</th><th>Student</th><th>Class</th><th>Roll</th><th>Selected Subjects</th><th>Action</th></tr>${students.map((x,i)=>{const ids=mhsStudentSubjects(x,year);return `<tr><td><b>${esc(x.studentId)}</b></td><td>${esc(x.name)}</td><td>${esc(x.class)}</td><td>${esc(x.roll)}</td><td>${ids.length?ids.map(id=>esc((cat.find(c=>c.id===id)||{name:id}).name)).join(', '):'Not configured'}</td><td><button class="btn-small" onclick="editStudentSubjects(${i})">Select Subjects</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty-admin">No students.</td></tr>'}</table></div></div></div>`;window.__subjectYear=year;ssYear.onchange=()=>{window.__subjectYear=Number(ssYear.value);render()}},

async hero(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Hero Images</h2><p class="hint">Loading homepage hero images from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const {data:images,error}=await sb.from('gallery').select('id,title,image_url,is_published,display_order,created_at').eq('category','hero').order('display_order').order('created_at',{ascending:false});
  if(error)throw error;
  box.innerHTML=`<div class="panel"><div class="box"><h2>Homepage Hero Images</h2><p class="hint">Add a public image URL. Published hero images rotate automatically on the homepage. Existing localStorage images are not imported.</p>
   <form class="form" id="sbHeroForm"><label>Image Title<input name="title" maxlength="180"></label><label class="full">Image URL<input name="url" type="url" required placeholder="https://…"></label><button type="submit">Add Hero Image</button></form></div>
   <div class="box"><div class="toolbar"><h2>Current Hero Images</h2><span>${(images||[]).length} image(s)</span></div><div class="preview">${(images||[]).map(img=>`<div><img src="${AESC(img.image_url)}" alt="${AESC(img.title||'Hero image')}" style="max-width:220px"><small>${AESC(img.title||'Hero image')}</small><p>${img.is_published?'Published':'Draft'}</p><button type="button" class="btn-small" data-hero-toggle="${AESC(img.id)}" data-published="${img.is_published?'1':'0'}">${img.is_published?'Unpublish':'Publish'}</button> <button type="button" class="btn-small danger" data-hero-delete="${AESC(img.id)}">Remove</button></div>`).join('')||'<div class="empty-admin">No hero images configured. The default school photos will display.</div>'}</div></div></div>`;
  document.getElementById('sbHeroForm').onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(event.currentTarget),button=event.currentTarget.querySelector('button');
   button.disabled=true;try{const {error}=await sb.from('gallery').insert({title:String(fd.get('title')||'').trim()||null,image_url:String(fd.get('url')||'').trim(),category:'hero',is_published:true,display_order:(images||[]).length});if(error)throw error;mhsToast('Hero image saved to Supabase');await window.MHS_EXTRA.hero();}
   catch(error){alert('Could not add hero image: '+(error.message||String(error)));button.disabled=false;}
  };
  box.querySelectorAll('[data-hero-toggle]').forEach(button=>button.addEventListener('click',async()=>{
   button.disabled=true;try{const {error}=await sb.from('gallery').update({is_published:button.dataset.published!=='1',updated_at:new Date().toISOString()}).eq('id',button.dataset.heroToggle);if(error)throw error;await window.MHS_EXTRA.hero();}
   catch(error){alert('Could not update hero image: '+(error.message||String(error)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-hero-delete]').forEach(button=>button.addEventListener('click',async()=>{
   if(!confirm('Remove this hero image from Supabase?'))return;button.disabled=true;
   try{const {error}=await sb.from('gallery').delete().eq('id',button.dataset.heroDelete);if(error)throw error;mhsToast('Hero image removed');await window.MHS_EXTRA.hero();}
   catch(error){alert('Could not remove hero image: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Hero Images</h2><p class="hint">Could not load hero images: ${AESC(error.message||String(error))}</p></div></div>`;}
},
async students(){
 const box=app;
 box.innerHTML='<div class="panel"><div class="box"><h2>Student Database</h2><p class="hint">Loading students from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:sessionData,error:sessionError}=await sb.auth.getSession();
  if(sessionError||!sessionData?.session?.user)throw new Error('Admin session expired. Sign in again.');
  const adminUser=sessionData.session.user;
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',adminUser.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access is required.');
  const [{data:students,error:studentsError},{data:classes,error:classesError},{data:years,error:yearsError},{data:profiles,error:profilesError}]=await Promise.all([
   sb.from('students').select('id,student_id,admission_number,name,date_of_birth,gender,class_id,academic_year_id,roll,section,guardian,mobile,address,photo,status,classes(name,class_number),academic_years(year,name)').order('created_at',{ascending:false}),
   sb.from('classes').select('id,name,class_number,status').eq('status',true).order('class_number'),
   sb.from('academic_years').select('id,year,name').order('year',{ascending:false}),
   sb.from('user_profiles').select('id,student_id,is_active,role').eq('role','student')
  ]);
  if(studentsError)throw studentsError;if(classesError)throw classesError;if(yearsError)throw yearsError;if(profilesError)throw profilesError;
  const profileMap=new Map((profiles||[]).map(p=>[p.student_id,p]));
  const currentYear=(years||[]).find(y=>Number(y.year)===new Date().getFullYear())||(years||[])[0];
  box.innerHTML=`<div class="panel"><div class="box"><h2>Add Student & Portal Account</h2><p class="hint">New students are saved directly to Supabase. No legacy localStorage records are imported.</p>
   <form class="form" id="sbStudentForm">
    <label>Admission No.<input name="admission" required maxlength="80"></label><label>Student Name<input name="name" required maxlength="160"></label>
    <label>Date of Birth<input name="dob" type="date"></label><label>Class<select name="class" required>${(classes||[]).map(cl=>`<option value="${AESC(cl.class_number)}">${AESC(cl.name||('Class '+cl.class_number))}</option>`).join('')}</select></label>
    <label>Gender<select name="gender"><option>Male</option><option>Female</option><option>Other</option></select></label><label>Section<input name="section" maxlength="20"></label>
    <label>Roll Number<input name="roll" required inputmode="numeric" pattern="[0-9]{1,4}"></label><label>Guardian Name<input name="guardian" maxlength="160"></label>
    <label>Guardian Phone<input name="phone" inputmode="tel" pattern="01[0-9]{9}" placeholder="01XXXXXXXXX"></label><label>Academic Year<select name="year" required>${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${y.id===currentYear?.id?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label>
    <label class="full">Photo URL (optional)<input name="photo" type="url" placeholder="https://…"></label><label class="full">Initial Portal Password<input name="password" type="password" minlength="8" required placeholder="At least 8 characters"></label>
    <button type="submit" ${classes?.length&&years?.length?'':'disabled'}>Create Student & Login</button>
   </form></div>
   <div class="box"><div class="toolbar"><h2>Supabase Student Records</h2><span>${(students||[]).length} total</span></div><div class="table-wrap"><table class="table"><tr><th>Student ID</th><th>Admission No.</th><th>Student</th><th>Class / Roll</th><th>Guardian</th><th>Portal</th><th>Actions</th></tr>
   ${(students||[]).map(st=>{const p=profileMap.get(st.id);return `<tr><td><b>${AESC(st.student_id)}</b></td><td>${AESC(st.admission_number||'—')}</td><td>${AESC(st.name)}<br><small>${AESC(st.gender||'')} · DOB ${AESC(st.date_of_birth||'—')}</small></td><td>${AESC(st.classes?.class_number||st.classes?.name||'—')} / ${AESC(st.roll??'—')}${st.section?'-'+AESC(st.section):''}<br><small>${AESC(st.academic_years?.year||st.academic_years?.name||'')}</small></td><td>${AESC(st.guardian||'—')}<br><small>${AESC(st.mobile||'')}</small></td><td><span class="badge">${st.status===false?'Student inactive':p?(p.is_active?'Login active':'Login inactive'):'No portal login'}</span></td><td><button type="button" class="btn-small" data-student-edit="${AESC(st.id)}">Edit</button> ${p?`<button type="button" class="btn-small" data-student-password="${AESC(st.student_id)}">Reset Password</button><button type="button" class="btn-small" data-student-toggle="${AESC(st.id)}" data-profile-id="${AESC(p.id)}" data-active="${p.is_active&&st.status!==false?'1':'0'}">${p.is_active&&st.status!==false?'Deactivate':'Activate'}</button>`:'<small>Login not linked</small>'}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty-admin">No Supabase students found.</td></tr>'}
   </table></div></div></div>`;
  const form=document.getElementById('sbStudentForm');
  form.onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(form),admission=String(fd.get('admission')||'').trim(),name=String(fd.get('name')||'').trim(),classNumber=Number(fd.get('class')),roll=String(fd.get('roll')||'').trim(),password=String(fd.get('password')||'');
   if(password.length<8)return alert('Portal password must be at least 8 characters.');
   if((students||[]).some(s=>String(s.admission_number||'').toLowerCase()===admission.toLowerCase()))return alert('Admission number already exists in Supabase.');
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   try{
    const nextId=String((students||[]).reduce((max,s)=>/^\d+$/.test(String(s.student_id||''))?Math.max(max,Number(s.student_id)):max,100000)+1);
    const response=await fetch('/api/create-student-portal-account',{method:'POST',headers:{Authorization:'Bearer '+sessionData.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({student_id:nextId,admission_number:admission,name,class:classNumber,roll,gender:String(fd.get('gender')||''),section:String(fd.get('section')||'').trim(),guardian:String(fd.get('guardian')||'').trim(),guardian_phone:String(fd.get('phone')||'').trim(),date_of_birth:String(fd.get('dob')||''),photo:String(fd.get('photo')||'').trim(),academic_year_id:String(fd.get('year')||''),password})});
    const result=await response.json().catch(()=>null);if(!response.ok||!result?.success)throw new Error(result?.error||'Could not create student account.');
    alert('Student record and portal login created.\nStudent ID: '+result.student_id+'\nLogin: roll number + the password you set.');
    await window.MHS_EXTRA.students();
   }catch(error){alert('Could not create student: '+(error.message||String(error)));button.disabled=false;}
  };
  box.querySelectorAll('[data-student-password]').forEach(button=>button.addEventListener('click',async()=>{
   const password=prompt('New portal password (minimum 8 characters):');if(password===null)return;if(password.length<8)return alert('Password must be at least 8 characters.');
   button.disabled=true;try{const response=await fetch('/api/manage-student-portal-account',{method:'PATCH',headers:{Authorization:'Bearer '+sessionData.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({student_id:button.dataset.studentPassword,password})});const result=await response.json().catch(()=>null);if(!response.ok||!result?.success)throw new Error(result?.error||'Password reset failed.');alert('Student portal password reset successfully.');}
   catch(error){alert(error.message||String(error));}finally{button.disabled=false;}
  }));
  box.querySelectorAll('[data-student-toggle]').forEach(button=>button.addEventListener('click',async()=>{
   const active=button.dataset.active!=='1';if(!confirm((active?'Activate':'Deactivate')+' this student portal account?'))return;button.disabled=true;
   try{
    const {error:studentError}=await sb.from('students').update({status:active,updated_at:new Date().toISOString()}).eq('id',button.dataset.studentToggle);if(studentError)throw studentError;
    const {error:profileUpdateError}=await sb.from('user_profiles').update({is_active:active,updated_at:new Date().toISOString()}).eq('id',button.dataset.profileId).eq('role','student');if(profileUpdateError)throw profileUpdateError;
    mhsToast(active?'Student activated':'Student deactivated');await window.MHS_EXTRA.students();
   }catch(error){alert('Could not update student status: '+(error.message||String(error)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-student-edit]').forEach(button=>button.addEventListener('click',async()=>{
   const st=(students||[]).find(s=>s.id===button.dataset.studentEdit);if(!st)return;
   const name=prompt('Student name:',st.name);if(name===null)return;if(!name.trim())return alert('Student name is required.');
   const admission=prompt('Admission number:',st.admission_number||'');if(admission===null)return;if(!admission.trim())return alert('Admission number is required.');
   const roll=prompt('Roll number:',String(st.roll??''));if(roll===null)return;if(!/^\d{1,4}$/.test(roll.trim()))return alert('Enter a numeric roll number.');
   const guardian=prompt('Guardian name:',st.guardian||'');if(guardian===null)return;
   const phone=prompt('Guardian phone:',st.mobile||'');if(phone===null)return;
   const classDefault=String(st.classes?.class_number||'');
   const classValue=prompt('Class number (6–10):',classDefault);if(classValue===null)return;
   const classRow=(classes||[]).find(cl=>String(cl.class_number)===classValue.trim());if(!classRow)return alert('Choose a configured class from 6 to 10.');
   button.disabled=true;
   try{
    const {error}=await sb.from('students').update({name:name.trim(),admission_number:admission.trim(),roll:Number(roll),guardian:guardian.trim()||null,mobile:phone.trim()||null,class_id:classRow.id,updated_at:new Date().toISOString()}).eq('id',st.id);if(error)throw error;
    const p=profileMap.get(st.id);if(p){const {error:profileErr}=await sb.from('user_profiles').update({display_name:name.trim(),updated_at:new Date().toISOString()}).eq('id',p.id);if(profileErr)throw profileErr;}
    mhsToast('Student updated');await window.MHS_EXTRA.students();
   }catch(error){alert('Could not update student: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Student Database</h2><p class="hint">Could not load Supabase students: ${AESC(error.message||String(error))}</p></div></div>`;}
},
async admissions(){
 const box=app;
 box.innerHTML='<div class="panel"><div class="box"><h2>Online Admission Applications</h2><p class="hint">Loading applications from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:sessionData,error:sessionError}=await sb.auth.getSession();
  if(sessionError||!sessionData?.session?.user)throw new Error('Admin session expired. Sign in again.');
  const adminUser=sessionData.session.user;
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',adminUser.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access is required.');
  const {data:rows,error}=await sb.from('admission_applications').select('id,application_no,student_name,date_of_birth,gender,father_name,mother_name,applying_class_id,guardian_mobile,mobile,address,previous_school,application_status,submitted_at,remarks,classes:classes(name,class_number)').order('submitted_at',{ascending:false});
  if(error)throw error;
  box.innerHTML=`<div class="panel"><div class="box"><div class="toolbar"><h2>Online Admission Applications</h2><span>${(rows||[]).filter(x=>x.application_status==='pending').length} pending</span></div>
   <p class="hint">Applications are stored in Supabase. Approving creates the student record and roll-number/password portal login; no old localStorage applications are imported.</p>
   <div class="table-wrap"><table class="table"><tr><th>Application No.</th><th>Submitted</th><th>Student</th><th>Class / DOB</th><th>Guardian / Phone</th><th>Previous School</th><th>Status / Action</th></tr>
   ${(rows||[]).map(r=>`<tr><td><b>${AESC(r.application_no)}</b></td><td>${r.submitted_at?new Date(r.submitted_at).toLocaleDateString('en-GB'):'—'}</td><td>${AESC(r.student_name)}<br><small>${AESC(r.gender||'')}</small></td><td>Class ${AESC(r.classes?.class_number||r.classes?.name||'—')}<br><small>DOB ${AESC(r.date_of_birth||'—')}</small></td><td>${AESC(r.father_name||r.mother_name||'—')}<br>${AESC(r.guardian_mobile||r.mobile||'—')}</td><td>${AESC(r.previous_school||'—')}<br><small>${AESC(r.address||'')}</small></td><td><span class="badge">${AESC(r.application_status)}</span><br>${r.application_status==='pending'?`<button class="btn-small" data-admission-approve="${AESC(r.id)}">Approve & Create Account</button> <button class="btn-small danger" data-admission-reject="${AESC(r.id)}">Reject</button>`:AESC(r.remarks||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-admin">No applications received yet.</td></tr>'}
   </table></div></div></div>`;
  box.querySelectorAll('[data-admission-approve]').forEach(button=>button.addEventListener('click',async()=>{
   const row=(rows||[]).find(r=>r.id===button.dataset.admissionApprove);
   if(!row||row.application_status!=='pending')return;
   const roll=prompt('Assign the student roll number:');
   if(roll===null||!roll.trim())return;
   if(!/^\d{1,4}$/.test(roll.trim()))return alert('Enter a numeric roll number (1–4 digits).');
   const admissionNumber='ADM-'+new Date().getFullYear()+'-'+row.application_no.replace(/[^A-Z0-9]/gi,'').slice(-8).toUpperCase();
   const temporaryPassword='MHS-'+row.application_no.replace(/[^A-Z0-9]/gi,'').slice(-8).toUpperCase()+'!';
   button.disabled=true;
   try{
    const {data:students,error:studentsError}=await sb.from('students').select('student_id');
    if(studentsError)throw studentsError;
    const nextId=String((students||[]).reduce((max,s)=>/^\d+$/.test(String(s.student_id||''))?Math.max(max,Number(s.student_id)):max,100000)+1);
    const response=await fetch('/api/create-student-portal-account',{method:'POST',headers:{Authorization:'Bearer '+sessionData.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({student_id:nextId,admission_number:admissionNumber,name:row.student_name,class:row.classes?.class_number,roll:roll.trim(),gender:row.gender||'',guardian:row.father_name||row.mother_name||'',guardian_phone:row.guardian_mobile||row.mobile||'',date_of_birth:row.date_of_birth||'',password:temporaryPassword})});
    const result=await response.json().catch(()=>null);
    if(!response.ok||!result?.success)throw new Error(result?.error||'Student account creation failed.');
    const {error:updateError}=await sb.from('admission_applications').update({application_status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:adminUser.id,remarks:'Student portal account created. Student ID: '+result.student_id,student_id:result.student_record_id||null}).eq('id',row.id).eq('application_status','pending');
    if(updateError)throw new Error('Student account was created, but application status could not be updated. Record Student ID '+result.student_id+' and review the application status manually. '+updateError.message);
    alert('Admission approved and student portal account created.\nStudent ID: '+result.student_id+'\nAdmission No.: '+admissionNumber+'\nRoll: '+roll.trim()+'\nTemporary password: '+temporaryPassword+'\nGive these login details to the guardian securely.');
    await window.MHS_EXTRA.admissions();
  }catch(error){alert('Could not approve admission: '+(error.message||String(error)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-admission-reject]').forEach(button=>button.addEventListener('click',async()=>{
   const row=(rows||[]).find(r=>r.id===button.dataset.admissionReject);if(!row||row.application_status!=='pending')return;
   const note=prompt('Reason for rejecting this application:','')||'Application rejected by school administration.';
   button.disabled=true;
   try{const {error}=await sb.from('admission_applications').update({application_status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by:sessionData.user.id,remarks:note}).eq('id',row.id).eq('application_status','pending');if(error)throw error;mhsToast('Admission application rejected');await window.MHS_EXTRA.admissions();}
   catch(error){alert('Could not reject application: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Online Admission Applications</h2><p class="hint">Could not load applications: ${AESC(error.message||String(error))}</p></div></div>`;}
},
async promotion(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Class Promotion</h2><p class="hint">Loading enrollment and published final results from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{data:students,error:studentsError},{data:classes,error:classesError},{data:years,error:yearsError},{data:classSubjects,error:csError},{data:selections,error:selectionsError},{data:results,error:resultsError},{data:enrollments,error:enrollmentsError}]=await Promise.all([
   sb.from('students').select('id,student_id,name,roll,class_id,academic_year_id,status,classes(name,class_number),academic_years(year,name)').eq('status',true),
   sb.from('classes').select('id,name,class_number,status').eq('status',true).order('class_number'),
   sb.from('academic_years').select('id,year,name').order('year',{ascending:false}),
   sb.from('class_subjects').select('id,class_id,subject_id,academic_year_id,is_compulsory,subjects(name)'),
   sb.from('student_subjects').select('id,student_id,class_subject_id,is_optional'),
   sb.from('results').select('id,student_id,class_subject_id,academic_year_id,exam_name,marks,status'),
   sb.from('student_enrollments').select('id,student_id,academic_year_id,class_id,roll,enrollment_status')
  ]);
  if(studentsError)throw studentsError;if(classesError)throw classesError;if(yearsError)throw yearsError;if(csError)throw csError;if(selectionsError)throw selectionsError;if(resultsError)throw resultsError;if(enrollmentsError)throw enrollmentsError;
  const currentYear=(years||[]).find(y=>Number(y.year)===new Date().getFullYear())||(years||[])[0];
  box.innerHTML=`<div class="panel"><div class="box"><h2>Class Promotion</h2><p class="hint">A student is eligible only when every registered subject has a published Final Exam mark of at least 33. No localStorage records are used.</p>
   <div class="form"><label>Academic Year<select id="promoYear">${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${y.id===currentYear?.id?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label><label>Current Class<select id="promoClass">${(classes||[]).map(cl=>`<option value="${AESC(cl.id)}">${AESC(cl.name||('Class '+cl.class_number))}</option>`).join('')}</select></label><label>Next Academic Year<input id="promoNextYear" readonly></label><label>Next Class<input id="promoNextClass" readonly></label></div>
   <div id="promoStatus" class="hint"></div><div id="promoList"></div></div></div>`;
  const yearSelect=document.getElementById('promoYear'),classSelect=document.getElementById('promoClass'),nextYearBox=document.getElementById('promoNextYear'),nextClassBox=document.getElementById('promoNextClass'),statusBox=document.getElementById('promoStatus'),listBox=document.getElementById('promoList');
  const draw=()=>{
   const yearId=yearSelect.value,year=years.find(y=>y.id===yearId),classId=classSelect.value,cl=classes.find(x=>x.id===classId),nextYear=years.find(y=>Number(y.year)===Number(year?.year)+1),nextClass=classes.find(x=>Number(x.class_number)===Number(cl?.class_number)+1);
   nextYearBox.value=nextYear?String(nextYear.year):'Not configured';
   nextClassBox.value=nextClass?(nextClass.name||('Class '+nextClass.class_number)):(Number(cl?.class_number)===10?'Graduation workflow required':'Not configured');
   const groupStudents=(students||[]).filter(s=>s.class_id===classId&&s.academic_year_id===yearId);
   const evaluate=st=>{
    const csRows=(classSubjects||[]).filter(cs=>cs.class_id===classId&&cs.academic_year_id===yearId);
    const selected=(selections||[]).filter(x=>x.student_id===st.id&&csRows.some(cs=>cs.id===x.class_subject_id));
    const required=selected.length?selected.map(x=>csRows.find(cs=>cs.id===x.class_subject_id)).filter(Boolean):csRows.filter(cs=>cs.is_compulsory);
    const finals=required.map(cs=>({subject:cs.subjects?.name||'Subject',result:(results||[]).find(r=>r.student_id===st.id&&r.class_subject_id===cs.id&&r.academic_year_id===yearId&&r.exam_name==='Final Exam'&&r.status==='published')}));
    const missing=finals.filter(x=>!x.result),failed=finals.filter(x=>x.result&&Number(x.result.marks)<33);
    return {required,missing,failed,eligible:required.length>0&&missing.length===0&&failed.length===0};
   };
   const evaluated=groupStudents.map(st=>({st,...evaluate(st)}));
   listBox.innerHTML=`<div class="toolbar"><h3>${AESC(cl?.name||'Class')} · ${AESC(year?.year||year?.name||'')}</h3><span>${groupStudents.length} student(s)</span></div><div class="table-wrap"><table class="table"><tr><th>Select</th><th>Student ID</th><th>Name</th><th>Roll</th><th>Subjects</th><th>Final Results</th><th>Eligibility</th></tr>${evaluated.map(x=>{const details=x.missing.length?'Missing: '+x.missing.map(y=>y.subject).join(', '):x.failed.length?'Failed: '+x.failed.map(y=>y.subject).join(', '):x.eligible?'Eligible':'No registered subjects';return `<tr><td><input class="promo-check" type="checkbox" value="${AESC(x.st.id)}" ${x.eligible&&nextYear&&nextClass?'':'disabled'}></td><td>${AESC(x.st.student_id)}</td><td>${AESC(x.st.name)}</td><td>${AESC(x.st.roll??'—')}</td><td>${x.required.length}</td><td>${x.required.length-x.missing.length} / ${x.required.length}</td><td>${AESC(details)}</td></tr>`}).join('')||'<tr><td colspan="7">No active students in this class/year.</td></tr>'}</table></div><p><button type="button" class="btn-small" id="promoSelect">Select Eligible</button> <button type="button" id="promoRun" ${nextYear&&nextClass?'':'disabled'}>Promote Selected</button></p>`;
   statusBox.textContent=nextYear&&nextClass?'Only eligible students can be promoted. Existing historical enrollment rows are preserved.':Number(cl?.class_number)===10?'Class 10 graduation is not enabled in the current database schema.':'Create the next academic year and/or next class in Supabase before promoting students.';
   document.getElementById('promoSelect').onclick=()=>listBox.querySelectorAll('.promo-check:not(:disabled)').forEach(b=>b.checked=true);
   document.getElementById('promoRun').onclick=async()=>{
    const ids=[...listBox.querySelectorAll('.promo-check:checked')].map(b=>b.value);
    if(!ids.length)return alert('Select at least one eligible student.');
    if(!confirm('Promote '+ids.length+' student(s) to '+(nextClass.name||('Class '+nextClass.class_number))+' for academic year '+nextYear.year+'?'))return;
    const button=document.getElementById('promoRun');button.disabled=true;
    try{
     for(const id of ids){
      const item=evaluated.find(x=>x.st.id===id);if(!item?.eligible)throw new Error('A selected student is no longer eligible.');
      const existing=(enrollments||[]).find(e=>e.student_id===id&&e.academic_year_id===nextYear.id);
      if(existing&&existing.class_id!==nextClass.id)throw new Error(item.st.name+' already has a different enrollment in the next academic year.');
      if(!existing){const {error}=await sb.from('student_enrollments').insert({student_id:id,academic_year_id:nextYear.id,class_id:nextClass.id,roll:item.st.roll,enrollment_status:'active',remarks:'Promoted from '+(cl.name||cl.class_number)+' for academic year '+year.year});if(error)throw error;}
      const {error:updateError}=await sb.from('students').update({class_id:nextClass.id,academic_year_id:nextYear.id,updated_at:new Date().toISOString()}).eq('id',id);if(updateError)throw updateError;
     }
     mhsToast('Student promotion saved to Supabase');await window.MHS_EXTRA.promotion();
    }catch(error){alert('Promotion stopped: '+(error.message||String(error))+'. Review the Supabase enrollment rows before retrying.');button.disabled=false;}
   };
  };
  yearSelect.addEventListener('change',draw);classSelect.addEventListener('change',draw);draw();
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Class Promotion</h2><p class="hint">Could not load promotion data: ${AESC(error.message||String(error))}</p></div></div>`;}
},
async fees(){
 const box=app;
 box.innerHTML='<div class="panel"><div class="box"><h2>Fees & Payments</h2><p class="hint">Loading fee records from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();
  if(authError||!authData?.user)throw new Error('Admin session expired. Sign in again.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{data:students,error:studentsError},{data:years,error:yearsError},{data:fees,error:feesError}]=await Promise.all([
   sb.from('students').select('id,student_id,name,roll,class_id,academic_year_id,classes(name,class_number),academic_years(year,name)').eq('status',true).order('student_id'),
   sb.from('academic_years').select('id,year,name').order('year',{ascending:false}),
   sb.from('student_fees').select('id,student_id,academic_year_id,fee_type,amount,paid_amount,payment_status,paid_at,payment_method,transaction_id,due_date,remarks,students(name,student_id,roll),academic_years(year,name)').order('created_at',{ascending:false})
  ]);
  if(studentsError)throw studentsError;if(yearsError)throw yearsError;if(feesError)throw feesError;
  const total=(fees||[]).reduce((sum,f)=>sum+Number(f.paid_amount||0),0);
  box.innerHTML=`<div class="panel"><div class="box"><h2>Record Fee Payment</h2><form class="form" id="sbFeeForm">
   <label>Student<select name="student" required><option value="">Select student</option>${(students||[]).map(s=>`<option value="${AESC(s.id)}">${AESC(s.student_id)} · ${AESC(s.name)} · Class ${AESC(s.classes?.class_number||s.classes?.name||'—')} / Roll ${AESC(s.roll??'—')}</option>`).join('')}</select></label>
   <label>Academic Year<select name="year" required><option value="">Select year</option>${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${Number(y.year)===new Date().getFullYear()?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label>
   <label>Fee Type / Purpose<input name="purpose" required maxlength="120" placeholder="e.g. Tuition fee"></label>
   <label>Amount (৳)<input name="amount" type="number" min="1" step="0.01" required></label>
   <label>Payment Method<select name="method"><option>Cash</option><option>bKash</option><option>Nagad</option><option>Bank</option><option>Other</option></select></label>
   <label>Transaction ID<input name="transaction" maxlength="120"></label>
   <label>Payment Date<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
   <label class="full">Remarks<textarea name="remarks" maxlength="500"></textarea></label><button type="submit" ${students?.length&&years?.length?'':'disabled'}>Save Payment to Supabase</button>
  </form></div>
  <div class="box"><div class="toolbar"><h2>Payments</h2><span>Total recorded paid: ৳${total.toLocaleString('en-BD',{maximumFractionDigits:2})}</span></div><div class="table-wrap"><table class="table"><tr><th>Date</th><th>Student</th><th>Year</th><th>Purpose</th><th>Amount</th><th>Paid</th><th>Method / Transaction</th><th>Action</th></tr>
  ${(fees||[]).map(f=>`<tr><td>${AESC(f.paid_at?new Date(f.paid_at).toLocaleDateString('en-GB'):'—')}</td><td>${AESC(f.students?.name||'Student')}<br><small>ID ${AESC(f.students?.student_id||'—')} · Roll ${AESC(f.students?.roll??'—')}</small></td><td>${AESC(f.academic_years?.year||f.academic_years?.name||'—')}</td><td>${AESC(f.fee_type)}</td><td>৳${AESC(f.amount)}</td><td>৳${AESC(f.paid_amount)} · ${AESC(f.payment_status)}</td><td>${AESC(f.payment_method||'—')}<br><small>${AESC(f.transaction_id||'')}</small></td><td><button type="button" class="btn-small danger" data-fee-delete="${AESC(f.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty-admin">No payments recorded.</td></tr>'}
  </table></div></div></div>`;
  const form=document.getElementById('sbFeeForm');
  form.onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(form),amount=Number(fd.get('amount')),studentId=String(fd.get('student')||''),yearId=String(fd.get('year')||'');
   if(!studentId||!yearId||!Number.isFinite(amount)||amount<=0)return alert('Select a student and academic year and enter a valid amount.');
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   try{
    const {error}=await sb.from('student_fees').insert({student_id:studentId,academic_year_id:yearId,fee_type:String(fd.get('purpose')).trim(),amount,paid_amount:amount,payment_status:'paid',paid_at:new Date(String(fd.get('date'))+'T12:00:00').toISOString(),payment_method:String(fd.get('method')||'Cash'),transaction_id:String(fd.get('transaction')||'').trim()||null,remarks:String(fd.get('remarks')||'').trim()||null});
    if(error)throw error;mhsToast('Payment saved to Supabase');await window.MHS_EXTRA.fees();
   }catch(error){alert('Could not save payment: '+(error.message||String(error)));button.disabled=false;}
  };
  box.querySelectorAll('[data-fee-delete]').forEach(button=>button.addEventListener('click',async()=>{
   if(!confirm('Delete this fee/payment record from Supabase?'))return;button.disabled=true;
   try{const {error}=await sb.from('student_fees').delete().eq('id',button.dataset.feeDelete);if(error)throw error;mhsToast('Payment deleted');await window.MHS_EXTRA.fees();}
   catch(error){alert('Could not delete payment: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Fees & Payments</h2><p class="hint">Could not load fee records: ${AESC(error.message||String(error))}</p></div></div>`;}
}

};
window.stDel=i=>{if(confirm('Delete student?')){let s=mhsGet('mhs_students',[]);s.splice(i,1);mhsSet('mhs_students',s);mhsToast('Student deleted');render()}};
window.stPass=async i=>{let p=prompt('New student portal password (minimum 8 characters)');if(!p)return;if(p.length<8)return alert('Password must be at least 8 characters.');let s=mhsGet('mhs_students',[]);try{const sb=await window.mhsSupabaseReady;const {data:{session},error}=await sb.auth.getSession();if(error||!session)throw new Error('Admin session missing. Please sign in again.');const response=await fetch('/api/manage-student-portal-account',{method:'PATCH',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({student_id:String(s[i].studentId||''),password:p})});const result=await response.json().catch(()=>null);if(!response.ok||!result?.success)throw new Error(result?.error||'Could not reset student portal password.');s[i].pass=await mhsHash(p);mhsSet('mhs_students',s);alert('Student portal password reset successfully.')}catch(error){alert(error.message||'Could not reset password.')}};
window.feeDel=i=>{if(confirm('Delete this payment?')){let f=mhsGet('mhs_fees',[]);f.splice(i,1);mhsSet('mhs_fees',f);mhsToast('Payment deleted');render()}};
window.apNo=i=>{let a=mhsGet('mhs_applications',[]);a[i].status='rejected';mhsSet('mhs_applications',a);mhsToast('Application rejected');render()};
window.apOk=async i=>{let a=mhsGet('mhs_applications',[]),x=a[i],roll=prompt('Assign roll number:');if(!roll)return;let s=mhsGet('mhs_students',[]),adm=new Date().getFullYear()+String(s.length+1).padStart(3,'0'),studentId=generateStudentId(s);s.push({id:crypto.randomUUID(),studentId,adm,name:x.name,class:x.class,gender:x.gender||"",section:'',roll,guardian:x.guardian,phone:x.phone,photo:'',academicYear:new Date().getFullYear(),classHistory:[{year:new Date().getFullYear(),class:x.class,roll, status:'active'}],pass:await mhsHash(adm)});x.status='approved';x.adm=adm;mhsSet('mhs_students',s);mhsSet('mhs_applications',a);alert('Approved. Student ID: '+studentId+' | Admission No: '+adm+' (default password = admission no.)');render()};

window.heroDel=i=>{let a=heroGet();a.splice(i,1);mhsSet('mhs_hero',a);mhsToast('Hero image removed');render()};
window.heroClear=()=>{if(confirm('Remove all hero images?')){mhsSet('mhs_hero',[]);mhsToast('All hero images removed');render()}};
window.heroReset=()=>{localStorage.removeItem('mhs_hero');mhsToast('School photos restored');render()};
window.heroRep=i=>{const f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=()=>f.files[0]&&mhsPhoto(f.files[0],u=>{let a=heroGet();a[i]={url:u};try{mhsSet('mhs_hero',a);mhsToast('Hero image replaced')}catch{alert('Storage full.')}render()},1600);f.click()};

window.stEdit=i=>{const s=mhsGet('mhs_students',[]),x=s[i];mhsModal('Edit Student',[{id:'studentId',label:'Student ID',value:x.studentId||generateStudentId(s),readonly:true},{id:'adm',label:'Admission No.',value:x.adm,req:1},{id:'name',label:'Name',value:x.name,req:1},{id:'class',label:'Class',type:'select',options:CLS,value:String(x.class)},{id:'section',label:'Section',value:x.section||''},{id:'roll',label:'Roll',value:x.roll,req:1},{id:'gender',label:'Gender',type:'select',options:['Male','Female','Other'],value:x.gender||'Male'},{id:'guardian',label:'Guardian',value:x.guardian||''},{id:'phone',label:'Guardian Phone',value:x.phone||''},{id:'photo',label:'New Photo (optional)',type:'file'},{id:'pw',label:'New Password (optional)',type:'password'}],async v=>{if(s.some((y,k)=>k!==i&&y.adm===v.adm)){alert('Admission no. already exists.');return false}if(v.pw&&v.pw.length<4){alert('Password must be at least 4 characters.');return false}Object.assign(x,{studentId:x.studentId||v.studentId||generateStudentId(s),adm:v.adm,name:v.name,class:v.class,section:v.section,roll:v.roll,gender:v.gender,guardian:v.guardian,phone:v.phone});if(v.photo)x.photo=v.photo;if(v.pw)x.pass=await mhsHash(v.pw);mhsSet('mhs_students',s);const f=mhsGet('mhs_fees',[]);f.forEach(p=>{if(p.sid===x.id)p.name=x.name});mhsSet('mhs_fees',f);alert('Student information updated successfully.');render()})};
window.editTeacherAcc=i=>{const a=mhsGet('mhs_teacher_accounts',[]),x=a[i],old=x.username;mhsModal('Edit Teacher Account',[{id:'name',label:'Name',value:x.name,req:1},{id:'designation',label:'Designation',value:x.designation||'Teacher'},{id:'subject',label:'Subject',value:x.subject||''},{id:'qualification',label:'Qualification',value:x.qualification||''},{id:'username',label:'Username',value:x.username,req:1},{id:'photo',label:'Photo URL',value:x.photo||''},{id:'pw',label:'New Password (optional)',type:'password'}],async v=>{if(a.some((y,k)=>k!==i&&String(y.username).toLowerCase()===v.username.toLowerCase())){alert('Username already exists.');return false}if(v.pw&&v.pw.length<4){alert('Password must be at least 4 characters.');return false}Object.assign(x,{name:v.name,designation:v.designation||'Teacher',subject:v.subject,qualification:v.qualification,username:v.username,photo:v.photo});if(v.pw)x.password=await mhsHash(v.pw);if(v.username!==old){['mhs_teacher_classes','mhs_routines','mhs_result_edit_requests'].forEach(k=>{const l=mhsGet(k,[]);l.forEach(r=>{if(r.teacher===old)r.teacher=v.username});mhsSet(k,l)});const R=mhsGet('mhs_results',[]);R.forEach(r=>{if(r.teacher===old)r.teacher=v.username;(r.subjects||[]).forEach(s=>{if(s.teacher===old)s.teacher=v.username})});mhsSet('mhs_results',R)}const rt=mhsGet('mhs_routines',[]);rt.forEach(r=>{if(r.teacher===x.username)r.teacherName=x.name});mhsSet('mhs_routines',rt);mhsSet('mhs_teacher_accounts',a);alert('Teacher account updated successfully.');render()})};
window.editPubTeacher=i=>{const t=mhsGet('mhs_teachers',TEACHERS),x=t[i];mhsModal('Edit Website Teacher Profile',[{id:'name',label:'Name',value:x.name,req:1},{id:'designation',label:'Designation',value:x.designation||'Teacher'},{id:'subject',label:'Subject',value:x.subject||''},{id:'qualification',label:'Qualification',value:x.qualification||''},{id:'photo',label:'Photo URL',value:x.photo||''}],v=>{Object.assign(x,{...v,designation:v.designation||'Teacher'});mhsSet('mhs_teachers',t);alert('Teacher profile updated successfully.');render()})};

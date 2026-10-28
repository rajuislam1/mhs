const app=document.getElementById('app'),title=document.getElementById('title');
const get=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let tab='overview';
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()});
logout.onclick=()=>{sessionStorage.removeItem('mhs_admin');location.href='login.html'};
adminLang.onclick=()=>{document.documentElement.classList.toggle('bn-admin');adminLang.textContent=document.documentElement.classList.contains('bn-admin')?'English':'বাংলা'};
function render(){title.textContent={overview:'Dashboard',notices:'Notice Management',teachers:'Teachers & Accounts',results:'Student Results',editrequests:'Result Edit Requests',gallery:'Achievements & Gallery',settings:'School Settings',students:'Student Database',subjects:'Academic Subjects',studentSubjects:'Student Subject Selection',accountAccess:'Student Portal Accounts',promotion:'Class Promotion',admissions:'Admission Applications',fees:'Fees & Payments',hero:'Hero Images'}[tab];if(tab==='teachers'&&typeof window.teachers==='function'){window.teachers();return;}({overview,notices,teachers,results,editrequests,gallery,settings,...MHS_EXTRA}[tab])()}
async function overview(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Super Admin Dashboard</h2><p class="hint">Loading live Supabase totals…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{count:noticesCount,error:nError},{count:teacherCount,error:tError},{count:resultCount,error:rError},{count:studentCount,error:sError},{count:galleryCount,error:gError}]=await Promise.all([
   sb.from('notices').select('id',{count:'exact',head:true}),
   sb.from('teachers').select('id',{count:'exact',head:true}),
   sb.from('results').select('id',{count:'exact',head:true}),
   sb.from('students').select('id',{count:'exact',head:true}),
   sb.from('gallery').select('id',{count:'exact',head:true})
  ]);
  if(nError)throw nError;if(tError)throw tError;if(rError)throw rError;if(sError)throw sError;if(gError)throw gError;
  box.innerHTML=`<div class="panel"><div class="cards4"><div class="stat"><b>${noticesCount||0}</b><span>Notices</span></div><div class="stat"><b>${teacherCount||0}</b><span>Teachers</span></div><div class="stat"><b>${studentCount||0}</b><span>Students</span></div><div class="stat"><b>${resultCount||0}</b><span>Result Records</span></div></div><div class="box"><h2>Super Administrator</h2><p>Live counts from Supabase. Student records, results, admissions, subject selections, fees and public content are managed centrally.</p><div class="quick-grid"><button onclick="tab='notices';render()">Manage Notices</button><button onclick="tab='teachers';render()">Teachers & Accounts</button><button onclick="tab='results';render()">Manage Results</button><button onclick="tab='students';render()">Student Database</button><button onclick="tab='subjects';render()">Academic Subjects</button><button onclick="tab='admissions';render()">Admission Applications</button><button onclick="tab='fees';render()">Fees & Payments</button><button onclick="tab='settings';render()">School Settings</button></div><p class="hint">Gallery items: ${galleryCount||0}. No legacy localStorage records are imported.</p></div></div>`;
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Super Admin Dashboard</h2><p class="hint">Could not load live totals: ${esc(error.message||String(error))}</p></div></div>`;}
}
function notices(){let n=get('mhs_notices',NOTICES),ticker=get('mhs_ticker_notice',{text:n[0]?.title||'School notice'});app.innerHTML=`<div class="panel"><div class="box"><h2>Hero Notice Ticker</h2><p class="hint">This single message appears above the hero and continuously slides from right to left.</p><form class="form" id="tickerForm"><label class="full">Ticker Notice Text<input id="tickerText" value="${esc(ticker.text||'')}" required></label><button>Save Ticker Notice</button></form></div><div class="box"><h2>Add / Edit Notice</h2><form class="form" id="nf"><input type="hidden" id="nid"><label class="full">Notice Title<input id="nt" required></label><label>Posting Date & Time<input id="nd" type="datetime-local" required></label><label>Attachment URL<input id="nfurl" placeholder="Optional URL or relative file path"></label><label class="full">Description<textarea id="ndesc" required></textarea></label><button>Save Notice</button></form></div><div class="box"><div class="toolbar"><h2>All Notices</h2><span>${n.length} total</span></div><div class="table-wrap"><table class="table"><tr><th>Title</th><th>Posted</th><th>Attachment</th><th>Actions</th></tr>${n.map((x,i)=>`<tr><td>${esc(x.title)}</td><td>${new Date(x.date).toLocaleString()}</td><td>${x.file?`<a href="${esc(x.file)}" target="_blank">Open</a>`:'—'}</td><td><button class="btn-small" onclick="editNotice(${i})">Edit</button> <button class="btn-small danger" onclick="delNotice(${i})">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty-admin">No notices.</td></tr>'}</table></div></div></div>`;
tickerForm.onsubmit=e=>{e.preventDefault();set('mhs_ticker_notice',{text:tickerText.value.trim(),updatedAt:new Date().toISOString()});alert('Hero notice ticker updated.');render()};
nf.onsubmit=e=>{e.preventDefault();let arr=get('mhs_notices',NOTICES),obj={title:nt.value.trim(),date:new Date(nd.value).toISOString(),description:ndesc.value.trim(),file:nfurl.value.trim()};let i=Number(nid.value);if(nid.value!=='')arr[i]=obj;else arr.unshift(obj);set('mhs_notices',arr);mhsToast('Notice saved successfully');render()}}
window.editNotice=i=>{let n=get('mhs_notices',NOTICES)[i];nid.value=i;nt.value=n.title;nd.value=new Date(n.date).toISOString().slice(0,16);nfurl.value=n.file||'';ndesc.value=n.description;window.scrollTo({top:0,behavior:'smooth'})};
window.delNotice=i=>{if(confirm('Delete this notice?')){let n=get('mhs_notices',NOTICES);n.splice(i,1);set('mhs_notices',n);mhsToast('Notice deleted');render()}};
function teachers(){let a=get('mhs_teacher_accounts',[]),t=get('mhs_teachers',TEACHERS);app.innerHTML=`<div class="panel"><div class="box"><h2>Create Teacher Login Account (portal access only)</h2><form class="form" id="tf"><label>Name<input id="tn" required></label><label>Designation<input id="td" value="Teacher"></label><label>Subject<input id="ts" placeholder="e.g. Biology"></label><label>Qualification<input id="tq" placeholder="Optional"></label><label>Username<input id="tu" required></label><label>Password<input id="tp" type="password" required minlength="4"></label><label class="full">Photo URL<input id="tphoto" placeholder="Optional image URL"></label><button>Create Teacher Account</button></form></div><div class="box"><h2>Teacher Accounts</h2><div class="table-wrap"><table class="table"><tr><th>Teacher</th><th>Subject</th><th>Username</th><th>Action</th></tr>${a.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.subject)}</td><td>${esc(x.username)}</td><td><button class="btn-small" onclick="editTeacherAcc(${i})">Edit</button> <button class="btn-small danger" onclick="delTeacher(${i})">Delete Account</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty-admin">No teacher accounts.</td></tr>'}</table></div></div><div class="box"><div class="toolbar"><h2>Website Teacher Profiles</h2><span>${t.length} teachers</span></div><p class="hint">These profiles appear on the public Teachers page. You can add or remove them independently from login accounts.</p><form class="form" id="pf"><label>Name<input id="pn" required></label><label>Designation<input id="pd" value="Teacher"></label><label>Subject<input id="ps"></label><label>Qualification<input id="pq"></label><label class="full">Photo URL<input id="pphoto"></label><button>Add Teacher to Website</button></form><div class="table-wrap"><table class="table"><tr><th>Name</th><th>Designation</th><th>Subject</th><th>Action</th></tr>${t.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.designation)}</td><td>${esc(x.subject)}</td><td><button class="btn-small" onclick="editPubTeacher(${i})">Edit</button> <button class="btn-small danger" onclick="delPublicTeacher(${i})">Remove</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty-admin">No public teacher profiles.</td></tr>'}</table></div></div></div>`;
 tf.onsubmit=async e=>{e.preventDefault();let accounts=get('mhs_teacher_accounts',[]),teachers=get('mhs_teachers',TEACHERS),username=tu.value.trim();if(accounts.some(x=>x.username.toLowerCase()===username.toLowerCase()))return alert('Username already exists.');let obj={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:tn.value.trim(),designation:td.value.trim()||'Teacher',subject:ts.value.trim(),qualification:tq.value.trim(),username,password:await mhsHash(tp.value),photo:tphoto.value.trim(),createdAt:new Date().toISOString()};accounts.push(obj);set('mhs_teacher_accounts',accounts);alert('Teacher login account created. It is NOT shown on the website; add the public profile below if needed.');render()};
 pf.onsubmit=e=>{e.preventDefault();let teachers=get('mhs_teachers',TEACHERS);teachers.push({name:pn.value.trim(),designation:pd.value.trim()||'Teacher',subject:ps.value.trim(),qualification:pq.value.trim(),photo:pphoto.value.trim()});set('mhs_teachers',teachers);alert('Teacher added to website.');render()}}
window.delTeacher=i=>{if(confirm('Delete this teacher account?')){let a=get('mhs_teacher_accounts',[]),x=a[i];a.splice(i,1);set('mhs_teacher_accounts',a);mhsToast('Teacher account deleted');render()}};
window.delPublicTeacher=i=>{if(confirm('Remove this teacher from the website?')){let t=get('mhs_teachers',TEACHERS);t.splice(i,1);set('mhs_teachers',t);mhsToast('Teacher removed from website');render()}};
async function results(){
 const box=app;
 box.innerHTML='<div class="panel"><div class="box"><h2>Student Results</h2><p class="hint">Loading Supabase results…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();
  if(authError||!authData?.user)throw new Error('Admin session expired. Sign in again.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access is required.');
  const [{data:rows,error},{data:teachers,error:teacherError}]=await Promise.all([
   sb.from('results').select('id,student_id,class_subject_id,academic_year_id,exam_name,marks,grade,grade_point,status,published_at,created_at,students(student_id,name,roll),class_subjects(class_id,subject_id,academic_year_id,classes(name,class_number),subjects(name),academic_years(year,name))').order('created_at',{ascending:false}),
   sb.from('teachers').select('id,name')
  ]);
  if(error)throw error;if(teacherError)throw teacherError;
  const teacherMap=new Map((teachers||[]).map(t=>[t.id,t.name]));
  box.innerHTML=`<div class="panel"><div class="box"><div class="toolbar"><h2>Supabase Student Results</h2><span>${(rows||[]).length} record(s)</span></div>
  <p class="hint">Teachers submit results as drafts. Students can see only published results. Publish or unpublish results here; all changes are stored in Supabase.</p>
  <div class="table-wrap"><table class="table"><tr><th>Student</th><th>Class / Roll</th><th>Year / Exam</th><th>Subject</th><th>Marks / Grade</th><th>Status</th><th>Action</th></tr>
  ${(rows||[]).map(r=>{const st=r.students||{},cs=r.class_subjects||{};return `<tr><td>${esc(st.name||st.student_id||'Student')}<br><small>ID ${esc(st.student_id||'—')}</small></td><td>${esc(cs.classes?.name||cs.classes?.class_number||'—')} / ${esc(st.roll??'—')}</td><td>${esc(cs.academic_years?.year||cs.academic_years?.name||'—')} · ${esc(r.exam_name)}</td><td>${esc(cs.subjects?.name||'—')}</td><td>${esc(r.marks??'—')} · ${esc(r.grade||'—')} (${esc(r.grade_point??'—')})</td><td><span class="badge">${esc(r.status)}</span></td><td>${r.status==='published'?`<button class="btn-small" data-unpublish="${esc(r.id)}">Unpublish</button>`:`<button class="btn-small" data-publish="${esc(r.id)}">Publish</button>`} <button class="btn-small danger" data-delete-result="${esc(r.id)}">Delete</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty-admin">No Supabase results yet.</td></tr>'}
  </table></div></div>
  <div class="box"><h2>Result Edit Requests</h2><div id="sbAdminEditRequests"><p class="hint">Loading requests…</p></div></div></div>`;
  async function changeStatus(id,status){
   const payload={status,published_at:status==='published'?new Date().toISOString():null,published_by:status==='published'?(profile.teacher_id||null):null};
   const {error}=await sb.from('results').update(payload).eq('id',id);
   if(error)throw error;
  }
  box.querySelectorAll('[data-publish],[data-unpublish]').forEach(button=>button.addEventListener('click',async()=>{
   button.disabled=true;
   try{
    const id=button.dataset.publish||button.dataset.unpublish;
    const status=button.dataset.publish?'published':'draft';
    const payload={status,published_at:status==='published'?new Date().toISOString():null,published_by:status==='published'?null:null,published_by_user_id:status==='published'?authData.user.id:null};
    const {error}=await sb.from('results').update(payload).eq('id',id);
    if(error)throw error;
    mhsToast(status==='published'?'Result published to Student Portal':'Result returned to Draft');
    await results();
   }catch(e){alert('Could not update result: '+(e.message||String(e)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-delete-result]').forEach(button=>button.addEventListener('click',async()=>{
   if(!confirm('Delete this result permanently from Supabase?'))return;
   button.disabled=true;
   try{const {error}=await sb.from('results').delete().eq('id',button.dataset.deleteResult);if(error)throw error;mhsToast('Result deleted');await results();}
   catch(e){alert('Could not delete result: '+(e.message||String(e)));button.disabled=false;}
  }));
  const {data:requests,error:requestError}=await sb.from('result_edit_requests').select('id,result_id,teacher_id,reason,status,requested_at,response_note,results:results(exam_name,marks,student_id,students(name,student_id,roll),class_subjects(classes(name),subjects(name),academic_years(year)))').order('requested_at',{ascending:false});
  const rq=document.getElementById('sbAdminEditRequests');
  if(requestError)throw requestError;
  rq.innerHTML=(requests||[]).length?`<div class="table-wrap"><table class="table"><tr><th>Date</th><th>Teacher</th><th>Student / Result</th><th>Reason</th><th>Status</th><th>Review</th></tr>${requests.map(q=>{const r=q.results||{},st=r.students||{},cs=r.class_subjects||{};return `<tr><td>${esc(q.requested_at?new Date(q.requested_at).toLocaleString():'—')}</td><td>${esc(teacherMap.get(q.teacher_id)||'Teacher')}</td><td>${esc(st.name||'Student')} · ${esc(cs.subjects?.name||'Subject')} · ${esc(r.exam_name||'')}</td><td>${esc(q.reason||'')}</td><td>${esc(q.status)}</td><td>${q.status==='pending'?`<button class="btn-small" data-approve-request="${esc(q.id)}">Approve</button> <button class="btn-small danger" data-reject-request="${esc(q.id)}">Reject</button>`:'—'}</td></tr>`}).join('')}</table></div>`:'<p>No Supabase edit requests.</p>';
  rq.querySelectorAll('[data-approve-request],[data-reject-request]').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.dataset.approveRequest||button.dataset.rejectRequest,status=button.dataset.approveRequest?'approved':'rejected';
   const note=prompt(status==='approved'?'Optional approval note:':'Reason for rejecting this correction request:','')||null;
   button.disabled=true;
   try{const {error}=await sb.from('result_edit_requests').update({status,response_note:note,responded_at:new Date().toISOString(),reviewed_by:authData.user.id}).eq('id',id).eq('status','pending');if(error)throw error;mhsToast('Edit request '+status);await results();}
   catch(e){alert('Could not review request: '+(e.message||String(e)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Student Results</h2><p class="hint">Could not load Supabase results: ${esc(error.message||String(error))}</p></div></div>`;}
}
async function editrequests(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Result Edit Requests</h2><p class="hint">Loading Supabase requests…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{data:requests,error},{data:teachers,error:teacherError}]=await Promise.all([
   sb.from('result_edit_requests').select('id,result_id,teacher_id,reason,status,requested_at,responded_at,response_note,results(exam_name,marks,students(name,student_id,roll),class_subjects(classes(name,class_number),subjects(name),academic_years(year,name)))').order('requested_at',{ascending:false}),
   sb.from('teachers').select('id,name')
  ]);
  if(error)throw error;if(teacherError)throw teacherError;
  const names=new Map((teachers||[]).map(t=>[t.id,t.name]));
  box.innerHTML=`<div class="panel"><div class="box"><div class="toolbar"><h2>Supabase Result Edit Requests</h2><span>${(requests||[]).filter(r=>r.status==='pending').length} pending</span></div><p class="hint">Approve a request to allow the assigned teacher to correct a published result, or reject it with a note.</p><div class="table-wrap"><table class="table"><tr><th>Requested</th><th>Teacher</th><th>Student</th><th>Class / Subject / Exam</th><th>Current Marks</th><th>Reason</th><th>Status</th><th>Review</th></tr>
  ${(requests||[]).map(q=>{const r=q.results||{},st=r.students||{},cs=r.class_subjects||{};return `<tr><td>${esc(q.requested_at?new Date(q.requested_at).toLocaleString():'—')}</td><td>${esc(names.get(q.teacher_id)||'Teacher')}</td><td>${esc(st.name||'Student')}<br><small>ID ${esc(st.student_id||'—')} · Roll ${esc(st.roll??'—')}</small></td><td>${esc(cs.classes?.name||cs.classes?.class_number||'—')} · ${esc(cs.subjects?.name||'—')}<br>${esc(cs.academic_years?.year||cs.academic_years?.name||'')} · ${esc(r.exam_name||'')}</td><td>${esc(r.marks??'—')}</td><td>${esc(q.reason||'')}</td><td><span class="badge">${esc(q.status)}</span>${q.response_note?'<br>'+esc(q.response_note):''}</td><td>${q.status==='pending'?`<button type="button" class="btn-small" data-edit-approve="${esc(q.id)}">Approve</button> <button type="button" class="btn-small danger" data-edit-reject="${esc(q.id)}">Reject</button>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="8">No edit requests found.</td></tr>'}
  </table></div></div></div>`;
  box.querySelectorAll('[data-edit-approve],[data-edit-reject]').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.dataset.editApprove||button.dataset.editReject,status=button.dataset.editApprove?'approved':'rejected';
   const note=prompt(status==='approved'?'Optional approval note:':'Reason for rejecting this request:','')||null;button.disabled=true;
   try{const {error}=await sb.from('result_edit_requests').update({status,response_note:note,responded_at:new Date().toISOString()}).eq('id',id).eq('status','pending');if(error)throw error;mhsToast('Edit request '+status);await editrequests();}
   catch(error){alert('Could not review request: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Result Edit Requests</h2><p class="hint">Could not load requests: ${esc(error.message||String(error))}</p></div></div>`;}
}
async function gallery(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>Achievements & Gallery</h2><p class="hint">Loading public content from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const [{data:achievements,error:aError},{data:images,error:gError}]=await Promise.all([
   sb.from('achievements').select('id,title,description,achievement_date,image_url,category,is_published,display_order,created_at').order('display_order').order('created_at',{ascending:false}),
   sb.from('gallery').select('id,title,description,image_url,category,is_published,display_order,created_at').order('display_order').order('created_at',{ascending:false})
  ]);
  if(aError)throw aError;if(gError)throw gError;
  box.innerHTML=`<div class="panel">
   <div class="box"><h2>Add Achievement</h2><form class="form" id="sbAchievementForm"><label>Title<input name="title" required maxlength="180"></label><label>Date<input name="date" type="date"></label><label>Category<select name="category"><option value="general">General</option><option value="academic">Academic</option><option value="sports">Sports</option><option value="cultural">Cultural</option></select></label><label>Image URL (optional)<input name="image" type="url" placeholder="https://…"></label><label class="full">Description<textarea name="description" maxlength="2000"></textarea></label><button type="submit">Save Achievement to Supabase</button></form></div>
   <div class="box"><h2>Achievements</h2><div class="table-wrap"><table class="table"><tr><th>Date</th><th>Title</th><th>Description</th><th>Status</th><th>Actions</th></tr>${(achievements||[]).map(a=>`<tr><td>${esc(a.achievement_date||'—')}</td><td>${esc(a.title)}</td><td>${esc(a.description||'')}</td><td>${a.is_published?'Published':'Draft'}</td><td><button class="btn-small" data-ach-toggle="${esc(a.id)}" data-published="${a.is_published?'1':'0'}">${a.is_published?'Unpublish':'Publish'}</button> <button class="btn-small" data-ach-edit="${esc(a.id)}">Edit</button> <button class="btn-small danger" data-ach-delete="${esc(a.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No achievements in Supabase yet.</td></tr>'}</table></div></div>
   <div class="box"><h2>Add Gallery Image</h2><form class="form" id="sbGalleryForm"><label>Title / Caption<input name="title" maxlength="180"></label><label>Category<select name="category"><option value="general">General</option><option value="campus">Campus</option><option value="events">Events</option><option value="sports">Sports</option><option value="cultural">Cultural</option></select></label><label class="full">Image URL<input name="image" type="url" required placeholder="Paste a publicly accessible image URL"></label><label class="full">Description<input name="description" maxlength="500"></label><button type="submit">Save Gallery Image</button></form><p class="hint">Images must be hosted at a publicly accessible URL; this form does not store large image files in the database.</p></div>
   <div class="box"><h2>Gallery Images</h2><div class="preview">${(images||[]).map(g=>`<div><img src="${esc(g.image_url)}" alt="${esc(g.title||'School gallery image')}" style="max-width:180px"><small>${esc(g.title||g.category)}</small><p>${g.is_published?'Published':'Draft'}</p><button class="btn-small" data-gallery-toggle="${esc(g.id)}" data-published="${g.is_published?'1':'0'}">${g.is_published?'Unpublish':'Publish'}</button> <button class="btn-small danger" data-gallery-delete="${esc(g.id)}">Delete</button></div>`).join('')||'<p>No gallery images in Supabase yet.</p>'}</div></div>
  </div>`;
  document.getElementById('sbAchievementForm').onsubmit=async e=>{
   e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;
   try{const {error}=await sb.from('achievements').insert({title:String(fd.get('title')).trim(),description:String(fd.get('description')||'').trim()||null,achievement_date:String(fd.get('date')||'')||null,image_url:String(fd.get('image')||'').trim()||null,category:String(fd.get('category')||'general'),is_published:true,display_order:0});if(error)throw error;mhsToast('Achievement saved');await gallery();}
   catch(error){alert('Could not save achievement: '+(error.message||String(error)));button.disabled=false;}
  };
  document.getElementById('sbGalleryForm').onsubmit=async e=>{
   e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;
   try{const {error}=await sb.from('gallery').insert({title:String(fd.get('title')||'').trim()||null,description:String(fd.get('description')||'').trim()||null,image_url:String(fd.get('image')||'').trim(),category:String(fd.get('category')||'general'),is_published:true,display_order:0});if(error)throw error;mhsToast('Gallery image saved');await gallery();}
   catch(error){alert('Could not save gallery image: '+(error.message||String(error)));button.disabled=false;}
  };
  box.querySelectorAll('[data-ach-toggle],[data-gallery-toggle]').forEach(button=>button.addEventListener('click',async()=>{
   const achievement=button.hasAttribute('data-ach-toggle'),id=achievement?button.dataset.achToggle:button.dataset.galleryToggle,was=button.dataset.published==='1',table=achievement?'achievements':'gallery';button.disabled=true;
   try{const {error}=await sb.from(table).update({is_published:!was,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await gallery();}
   catch(error){alert('Could not change publish status: '+(error.message||String(error)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-ach-edit]').forEach(button=>button.addEventListener('click',async()=>{
   const a=(achievements||[]).find(x=>x.id===button.dataset.achEdit);if(!a)return;
   const title=prompt('Achievement title:',a.title);if(title===null)return;if(!title.trim())return alert('Title is required.');
   const description=prompt('Description:',a.description||'');if(description===null)return;
   const date=prompt('Date (YYYY-MM-DD; blank if none):',a.achievement_date||'');if(date===null)return;
   button.disabled=true;try{const {error}=await sb.from('achievements').update({title:title.trim(),description:description.trim()||null,achievement_date:date.trim()||null,updated_at:new Date().toISOString()}).eq('id',a.id);if(error)throw error;await gallery();}
   catch(error){alert('Could not update achievement: '+(error.message||String(error)));button.disabled=false;}
  }));
  box.querySelectorAll('[data-ach-delete],[data-gallery-delete]').forEach(button=>button.addEventListener('click',async()=>{
   if(!confirm('Delete this content from Supabase?'))return;const achievement=button.hasAttribute('data-ach-delete'),id=achievement?button.dataset.achDelete:button.dataset.galleryDelete;button.disabled=true;
   try{const {error}=await sb.from(achievement?'achievements':'gallery').delete().eq('id',id);if(error)throw error;mhsToast('Content deleted');await gallery();}
   catch(error){alert('Could not delete content: '+(error.message||String(error)));button.disabled=false;}
  }));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Achievements & Gallery</h2><p class="hint">Could not load content: ${esc(error.message||String(error))}</p></div></div>`;}
}
async function settings(){
 const box=app;box.innerHTML='<div class="panel"><div class="box"><h2>School Settings</h2><p class="hint">Loading settings from Supabase…</p></div></div>';
 try{
  const sb=await window.mhsSupabaseReady;
  const {data:authData,error:authError}=await sb.auth.getUser();if(authError||!authData?.user)throw new Error('Admin session expired.');
  const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
  if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access required.');
  const {data:rows,error}=await sb.from('school_settings').select('*').order('updated_at',{ascending:false}).limit(1);
  if(error)throw error;
  const saved=rows?.[0]||null,base={
   school_name:saved?.school_name??SITE.nameBn??'মোখলেশপুর উচ্চ বিদ্যালয়',
   school_name_en:saved?.school_name_en??SITE.nameEn??'Mokhleshpur High School',
   eiin:saved?.eiin??SITE.eiin??'120140',
   established_year:saved?.established_year??SITE.estd??1962,
   education_board:saved?.education_board??SITE.board??'Dinajpur',
   phone:saved?.phone??SITE.phone??'',
   email:saved?.email??SITE.email??'',
   website_url:saved?.website_url??SITE.website??'',
   headmaster_name:saved?.headmaster_name??SITE.headmaster??'',
   student_count:saved?.student_count??SITE.students??120,
   teacher_count:saved?.teacher_count??SITE.teachers??9,
   service_years:saved?.service_years??SITE.serviceYears??64,
   ssc_pass_rate:saved?.ssc_pass_rate??SITE.passRate??'87%',
   address:saved?.address??SITE.address??'Mokhleshpur, Birol, Dinajpur',
   slogan:saved?.slogan??'সবার জন্য শিক্ষা',
   facebook_url:saved?.facebook_url??'',map_url:saved?.map_url??'',
   about_text:saved?.about_text??SITE.about??'',
   history_text:saved?.history_text??SITE.history??'',
   mission_text:saved?.mission_text??SITE.mission??'',
   vision_text:saved?.vision_text??SITE.vision??'',
   logo_url:saved?.logo_url??'',favicon_url:saved?.favicon_url??''
  };
  box.innerHTML=`<div class="panel"><div class="box"><h2>School Information</h2><p class="hint">Settings are saved centrally in Supabase. No existing localStorage settings are imported automatically.</p><form class="form" id="sbSettingsForm">
   <label>Bangla Name<input name="school_name" value="${esc(base.school_name)}" required></label><label>English Name<input name="school_name_en" value="${esc(base.school_name_en)}"></label>
   <label>EIIN<input name="eiin" value="${esc(base.eiin)}"></label><label>Established Year<input name="established_year" type="number" value="${esc(base.established_year)}"></label>
   <label>Education Board<input name="education_board" value="${esc(base.education_board)}"></label><label>Headmaster<input name="headmaster_name" value="${esc(base.headmaster_name)}"></label>
   <label>Phone<input name="phone" value="${esc(base.phone)}"></label><label>Email<input name="email" type="email" value="${esc(base.email)}"></label>
   <label>Website URL<input name="website_url" type="url" value="${esc(base.website_url)}"></label><label>Facebook URL<input name="facebook_url" type="url" value="${esc(base.facebook_url)}"></label>
   <label>Students<input name="student_count" type="number" min="0" value="${esc(base.student_count)}"></label><label>Teachers<input name="teacher_count" type="number" min="0" value="${esc(base.teacher_count)}"></label>
   <label>Service Years<input name="service_years" type="number" min="0" value="${esc(base.service_years)}"></label><label>SSC Pass Rate<input name="ssc_pass_rate" value="${esc(base.ssc_pass_rate)}"></label>
   <label>School Slogan<input name="slogan" value="${esc(base.slogan)}"></label><label>Map URL<input name="map_url" type="url" value="${esc(base.map_url)}"></label>
   <label class="full">Address<input name="address" value="${esc(base.address)}"></label><label class="full">Logo URL<input name="logo_url" type="url" value="${esc(base.logo_url)}"></label><label class="full">Favicon URL<input name="favicon_url" type="url" value="${esc(base.favicon_url)}"></label>
   <label class="full">About<textarea name="about_text">${esc(base.about_text)}</textarea></label><label class="full">History<textarea name="history_text">${esc(base.history_text)}</textarea></label><label class="full">Mission<textarea name="mission_text">${esc(base.mission_text)}</textarea></label><label class="full">Vision<textarea name="vision_text">${esc(base.vision_text)}</textarea></label>
   <button type="submit">Save School Settings to Supabase</button></form></div></div>`;
  document.getElementById('sbSettingsForm').onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(event.currentTarget),payload={};
   for(const key of ['school_name','school_name_en','eiin','education_board','phone','email','website_url','headmaster_name','ssc_pass_rate','address','slogan','facebook_url','map_url','about_text','history_text','mission_text','vision_text','logo_url','favicon_url'])payload[key]=String(fd.get(key)||'').trim()||null;
   for(const key of ['established_year','student_count','teacher_count','service_years'])payload[key]=String(fd.get(key)||'').trim()===''?null:Number(fd.get(key));
   payload.updated_at=new Date().toISOString();
   const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
   try{
    const response=saved?await sb.from('school_settings').update(payload).eq('id',saved.id):await sb.from('school_settings').insert(payload);
    if(response.error)throw response.error;mhsToast('School settings saved to Supabase');alert('School settings saved successfully.');
   }catch(error){alert('Could not save settings: '+(error.message||String(error)));}
   finally{button.disabled=false;}
  };
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>School Settings</h2><p class="hint">Could not load settings: ${esc(error.message||String(error))}</p></div></div>`;}
}

render();


/* ============================================================
   SUPABASE NOTICE MANAGEMENT
   Supabase client is loaded by admin/index.html before this file.
   Other admin modules remain unchanged and continue to use their
   existing storage until they are migrated separately.
   ============================================================ */
let mhsNoticeRows = [];
let mhsNoticeTickerText = '';
let mhsNoticeTickerRow = null;

async function mhsGetNoticeClient() {
  if (!window.mhsSupabaseReady) {
    throw new Error('Supabase script is missing. Check admin/index.html script links.');
  }
  return await window.mhsSupabaseReady;
}

function mhsNoticeFromDb(row) {
  return {
    id: row.id,
    title: row.title || '',
    date: row.published_at || row.created_at || new Date().toISOString(),
    description: row.content || '',
    file: row.attachment_url || '',
    is_published: row.is_published !== false
  };
}

function mhsNoticeMessage(message, isError = false) {
  if (typeof window.mhsToast === 'function') window.mhsToast(message);
  else alert(message);
  if (isError) console.error('[MHS notices]', message);
}

async function notices() {
  app.innerHTML = '<div class="panel"><div class="box">Loading notices from Supabase…</div></div>';
  try {
    const sb = await mhsGetNoticeClient();
    const { data, error } = await sb
      .from('notices')
      .select('id,title,content,notice_type,attachment_url,is_published,published_at,created_at,updated_at')
      .order('published_at', { ascending: false });
    if (error) throw error;
    mhsNoticeRows = (data || []).map(mhsNoticeFromDb);
    const tickerResult = await sb.from('notice_tickers').select('id,message,link_url,is_active,display_order').eq('is_active', true).order('display_order').limit(1);
    if (tickerResult.error) throw tickerResult.error;
    mhsNoticeTickerRow = tickerResult.data?.[0] || null;
  } catch (error) {
    console.error('Could not load notices from Supabase:', error);
    app.innerHTML = `<div class="panel"><div class="box"><h2>Could not load notices</h2><p>${esc(error?.message || 'Supabase request failed.')}</p><p class="hint">Check that you are signed in as an active Super Admin and the notices policies are enabled. No local-only save has been performed.</p><button type="button" onclick="notices()">Retry</button></div></div>`;
    return;
  }

  mhsNoticeTickerText = mhsNoticeTickerRow?.message || mhsNoticeRows[0]?.title || 'School notice';
  app.innerHTML = `<div class="panel">
    <div class="box"><h2>Hero Notice Ticker</h2><p class="hint">This message is saved centrally in Supabase and appears in the public website header.</p>
      <form class="form" id="mhsTickerForm"><label class="full">Ticker Notice Text<input id="mhsTickerText" value="${esc(mhsNoticeTickerText)}" required></label><button type="submit">Save Ticker Notice</button></form>
    </div>
    <div class="box"><h2>Add / Edit Notice</h2><form class="form" id="mhsNoticeForm"><input type="hidden" id="mhsNoticeId">
      <label class="full">Notice Title<input id="mhsNoticeTitle" required maxlength="250"></label>
      <label>Posting Date &amp; Time<input id="mhsNoticeDate" type="datetime-local" required></label>
      <label>Attachment URL<input id="mhsNoticeFile" placeholder="Optional URL or relative file path"></label>
      <label class="full">Description<textarea id="mhsNoticeDescription" required></textarea></label>
      <button type="submit">Save Notice to Supabase</button><button type="button" class="btn-small" id="mhsNoticeCancel">Clear Form</button>
    </form></div>
    <div class="box"><div class="toolbar"><h2>All Notices</h2><span>${mhsNoticeRows.length} total</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Posted</th><th>Attachment</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${mhsNoticeRows.map((x,i)=>`<tr><td>${esc(x.title)}</td><td>${new Date(x.date).toLocaleString()}</td><td>${x.file?`<a href="${esc(x.file)}" target="_blank" rel="noopener noreferrer">Open</a>`:'—'}</td><td>${x.is_published?'Published':'Draft'}</td><td><button type="button" class="btn-small" onclick="editNotice(${i})">Edit</button> <button type="button" class="btn-small danger" onclick="delNotice(${i})">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-admin">No notices in Supabase yet.</td></tr>'}
      </tbody></table></div>
    </div></div>`;

  document.getElementById('mhsTickerForm').onsubmit = async e => {
    e.preventDefault();
    const button=e.currentTarget.querySelector('button[type="submit"]');
    const message=document.getElementById('mhsTickerText').value.trim();
    if(!message)return mhsNoticeMessage('Ticker message is required.',true);
    button.disabled=true;
    try{
      const sb=await mhsGetNoticeClient();
      const payload={message,is_active:true,display_order:0,updated_at:new Date().toISOString()};
      const result=mhsNoticeTickerRow
        ? await sb.from('notice_tickers').update(payload).eq('id',mhsNoticeTickerRow.id).select('id,message,link_url,is_active,display_order').single()
        : await sb.from('notice_tickers').insert(payload).select('id,message,link_url,is_active,display_order').single();
      if(result.error)throw result.error;
      mhsNoticeTickerRow=result.data;mhsNoticeTickerText=result.data.message;
      mhsNoticeMessage('Ticker message saved to Supabase.');
    }catch(error){mhsNoticeMessage('Could not save ticker: '+(error.message||String(error)),true);}
    finally{button.disabled=false;}
  };

  document.getElementById('mhsNoticeCancel').onclick = () => {
    document.getElementById('mhsNoticeForm').reset();
    document.getElementById('mhsNoticeId').value = '';
    const date = document.getElementById('mhsNoticeDate');
    date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  };

  document.getElementById('mhsNoticeDate').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  document.getElementById('mhsNoticeForm').onsubmit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const saveButton = form.querySelector('button[type="submit"]');
    const id = document.getElementById('mhsNoticeId').value.trim();
    const titleValue = document.getElementById('mhsNoticeTitle').value.trim();
    const dateValue = document.getElementById('mhsNoticeDate').value;
    const contentValue = document.getElementById('mhsNoticeDescription').value.trim();
    const attachmentValue = document.getElementById('mhsNoticeFile').value.trim();
    if (!titleValue || !dateValue || !contentValue) return mhsNoticeMessage('Title, date and description are required.', true);
    const payload = {
      title: titleValue,
      content: contentValue,
      attachment_url: attachmentValue || null,
      published_at: new Date(dateValue).toISOString(),
      notice_type: 'general',
      is_published: true,
      updated_at: new Date().toISOString()
    };
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    try {
      const sb = await mhsGetNoticeClient();
      let result;
      if (id) {
        result = await sb.from('notices').update(payload).eq('id', id).select('id').maybeSingle();
      } else {
        result = await sb.from('notices').insert(payload).select('id').single();
      }
      if (result.error) throw result.error;
      if (id && !result.data) throw new Error('No notice row was updated. Check your admin access and row-level security policies.');
      mhsNoticeMessage(id ? 'Notice updated in Supabase.' : 'Notice saved to Supabase.');
      await notices();
    } catch (error) {
      console.error('Supabase notice save failed:', error);
      mhsNoticeMessage('Notice was NOT saved: ' + (error?.message || 'Supabase request failed.'), true);
      saveButton.disabled = false;
      saveButton.textContent = 'Save Notice to Supabase';
    }
  };
}

window.editNotice = i => {
  const n = mhsNoticeRows[i];
  if (!n) return;
  document.getElementById('mhsNoticeId').value = n.id;
  document.getElementById('mhsNoticeTitle').value = n.title;
  document.getElementById('mhsNoticeDate').value = new Date(new Date(n.date).getTime() - new Date(n.date).getTimezoneOffset() * 60000).toISOString().slice(0,16);
  document.getElementById('mhsNoticeFile').value = n.file || '';
  document.getElementById('mhsNoticeDescription').value = n.description || '';
  document.querySelector('#mhsNoticeForm button[type="submit"]').textContent = 'Update Notice in Supabase';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.delNotice = async i => {
  const n = mhsNoticeRows[i];
  if (!n || !confirm(`Delete notice "${n.title}" from Supabase? This cannot be undone.`)) return;
  try {
    const sb = await mhsGetNoticeClient();
    const { data, error } = await sb.from('notices').delete().eq('id', n.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No notice row was deleted. Check your admin access and row-level security policies.');
    mhsNoticeMessage('Notice deleted from Supabase.');
    await notices();
  } catch (error) {
    console.error('Supabase notice delete failed:', error);
    mhsNoticeMessage('Notice was NOT deleted: ' + (error?.message || 'Supabase request failed.'), true);
  }
};

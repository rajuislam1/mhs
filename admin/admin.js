if(sessionStorage.getItem('mhs_admin')!=='1') location.href='login.html';
const app=document.getElementById('app'),title=document.getElementById('title');
const get=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let tab='overview';
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()});
logout.onclick=async()=>{try{const sb=await window.mhsSupabaseReady;await sb.auth.signOut()}catch(e){console.error('Admin sign out failed:',e)}finally{sessionStorage.removeItem('mhs_admin');location.href='login.html'}};
adminLang.onclick=()=>{document.documentElement.classList.toggle('bn-admin');adminLang.textContent=document.documentElement.classList.contains('bn-admin')?'English':'বাংলা'};
function render(){title.textContent={overview:'Dashboard',notices:'Notice Management',teachers:'Teachers & Accounts',results:'Student Results',editrequests:'Result Edit Requests',gallery:'Achievements & Gallery',settings:'School Settings',students:'Student Database',subjects:'Academic Subjects',studentSubjects:'Student Subject Selection',promotion:'Class Promotion',admissions:'Admission Applications',fees:'Fees & Payments',hero:'Hero Images'}[tab];({overview,notices,teachers,results,editrequests,gallery,settings,...MHS_EXTRA}[tab])()}
function overview(){let n=get('mhs_notices',NOTICES),t=get('mhs_teacher_accounts',[]),r=get('mhs_results',[]),g=get('mhs_gallery',[]);app.innerHTML=`<div class="panel"><div class="cards4"><div class="stat"><b>${n.length}</b><span>Notices</span></div><div class="stat"><b>${t.length}</b><span>Teacher Accounts</span></div><div class="stat"><b>${r.length}</b><span>Student Results</span></div><div class="stat"><b>${g.length}</b><span>Gallery Items</span></div></div><div class="box"><h2>Super Administrator</h2><p>Full control over notices, teachers, teacher accounts, results, achievements, gallery and school settings.</p><div class="quick-grid"><button onclick="tab='notices';render()">Manage Notices</button><button onclick="tab='teachers';render()">Teachers & Accounts</button><button onclick="tab='results';render()">Manage Results</button><button onclick="tab='gallery';render()">Manage Gallery</button><button onclick="tab='settings';render()">Edit School Information</button></div><p class="hint">This static version stores data in this browser. A central school-wide system across different devices needs a database/API later.</p></div></div>`}
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
function results(){let r=get('mhs_results',RESULTS),accounts=get('mhs_teacher_accounts',[]);const teacherForSubject=(x,subject)=>{const hit=(x.subjects||[]).find(s=>String(s.subject).toLowerCase()===String(subject).toLowerCase());return hit?.teacher||''};app.innerHTML=`<div class="panel"><div class="box"><h2>Published Student Results</h2><p class="hint">Teachers publish subject-wise marks. Select a specific subject below if the teacher needs to edit or correct it.</p><div class="table-wrap"><table class="table"><tr><th>Student</th><th>Class</th><th>Roll</th><th>Year</th><th>Subjects</th><th>Average</th><th>GPA</th><th>Action</th></tr>${r.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.class)}</td><td>${esc(x.roll)}</td><td>${esc(x.year)} · ${esc(x.exam||"—")}</td><td>${(x.subjects||[]).map(s=>`${esc(s.subject)} (${s.marks}, ${s.grade})`).join('<br>')}</td><td>${Number(x.average||0).toFixed(2)}</td><td><b>${Number(x.gpa||0).toFixed(2)}</b></td><td><button class="btn-small" onclick="mhsPrintMarksheet(get('mhs_results',[])[${i}])">Print</button> <button class="btn-small" onclick="requestEdit(${i})">Request Edit</button> <button class="btn-small danger" onclick="delResult(${i})">Delete</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty-admin">No results published.</td></tr>'}</table></div></div><div class="box"><h2>Send Subject-Specific Edit Request</h2><form class="form" id="editRequestForm"><label>Student Result<select id="erResult" required><option value="">Select student result</option>${r.map((x,i)=>`<option value="${i}">${esc(x.name)} · Class ${esc(x.class)} · Roll ${esc(x.roll)} · ${esc(x.year)}</option>`).join('')}</select></label><label>Teacher<select id="erTeacher" required><option value="">Select teacher</option>${accounts.map(x=>`<option value="${esc(x.username)}">${esc(x.name)} (${esc(x.username)})</option>`).join('')}</select></label><label>Specific Subject<select id="erSubject" required><option value="">Select result first</option></select></label><label class="full">Message / Correction Request<textarea id="erReason" required placeholder="Example: Please correct the Biology mark from 62 to 68."></textarea></label><button>Send Edit Request</button></form></div></div>`;document.getElementById('erResult').onchange=()=>{let x=r[Number(erResult.value)];erSubject.innerHTML=x?`<option value="">Select subject</option>${(x.subjects||[]).map(s=>`<option value="${esc(s.subject)}">${esc(s.subject)} · Current Mark ${s.marks} · ${esc(s.grade)}</option>`).join('')}`:'<option value="">Select result first</option>';erTeacher.value=''};document.getElementById('erSubject').onchange=()=>{let x=r[Number(erResult.value)],u=x?teacherForSubject(x,erSubject.value):'';if(u&&accounts.some(a=>a.username===u))erTeacher.value=u;};document.getElementById('editRequestForm').onsubmit=e=>{e.preventDefault();let x=r[Number(erResult.value)],q=get('mhs_result_edit_requests',[]);if(!x)return;let teacher=accounts.find(a=>a.username===erTeacher.value);q.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),teacher:erTeacher.value,teacherName:teacher?.name||erTeacher.value,student:x.name,class:x.class,roll:x.roll,year:x.year,exam:x.exam||"",subject:erSubject.value,reason:erReason.value.trim(),status:'pending',createdAt:new Date().toISOString(),admin:'Super Admin'});set('mhs_result_edit_requests',q);alert('Edit request sent to the selected teacher.');render()}}

window.requestEdit=i=>{let r=get('mhs_results',RESULTS),x=r[i],accounts=get('mhs_teacher_accounts',[]);if(!x)return;let subject=prompt('Specific subject to edit:\n'+(x.subjects||[]).map((a,n)=>`${n+1}. ${a.subject}`).join('\n'));if(subject===null)return;let n=Number(subject)-1;let chosen=(x.subjects||[])[n]||(x.subjects||[]).find(a=>a.subject.toLowerCase()===subject.trim().toLowerCase());if(!chosen)return alert('Invalid subject selection.');let teacher=prompt('Teacher username:',x.teacher||accounts[0]?.username||'');if(!teacher)return;let reason=prompt('Correction request:',`Please review and correct ${chosen.subject} for ${x.name}.`);if(reason===null)return;let q=get('mhs_result_edit_requests',[]);q.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),teacher,student:x.name,class:x.class,roll:x.roll,year:x.year,exam:x.exam||"",subject:chosen.subject,reason,status:'pending',createdAt:new Date().toISOString(),admin:'Super Admin'});set('mhs_result_edit_requests',q);alert('Subject-specific edit request sent.');render()};
function editrequests(){let q=get('mhs_result_edit_requests',[]);app.innerHTML=`<div class="panel"><div class="box"><div class="toolbar"><h2>Result Edit Requests</h2><span>${q.filter(x=>x.status==='pending').length} pending</span></div><div class="table-wrap"><table class="table"><tr><th>Date</th><th>Teacher</th><th>Student</th><th>Class/Roll</th><th>Subject</th><th>Message</th><th>Status</th></tr>${q.slice().reverse().map(x=>`<tr><td>${new Date(x.createdAt).toLocaleString()}</td><td>${esc(x.teacherName||x.teacher)}</td><td>${esc(x.student)}</td><td>${esc(x.class)} / ${esc(x.roll)}</td><td><b>${esc(x.subject)}</b></td><td>${esc(x.reason)}</td><td>${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-admin">No edit requests yet.</td></tr>'}</table></div></div></div>`}
window.delResult=i=>{if(confirm('Delete this complete student result?')){let r=get('mhs_results',RESULTS);r.splice(i,1);set('mhs_results',r);mhsToast('Result deleted');render()}};
function gallery(){let a=get('mhs_achievements',[]),g=get('mhs_gallery',[]);app.innerHTML=`<div class="panel"><div class="box"><h2>Add Achievement</h2><form class="form" id="af"><label>Title<input id="at" required></label><label>Year<input id="ay"></label><label class="full">Description<textarea id="ad"></textarea></label><button>Save Achievement</button></form></div><div class="box"><h2>Achievements</h2>${a.map((x,i)=>`<div class="notice-admin box"><b>${esc(x.title)}</b> · ${esc(x.year)}<p>${esc(x.description)}</p><button class="btn-small" onclick="editAch(${i})">Edit</button> <button class="btn-small danger" onclick="delAch(${i})">Delete</button></div>`).join('')||'<div class="empty-admin">No achievements.</div>'}</div><div class="box"><h2>Gallery Image Upload</h2><form class="form" id="gf"><label class="full">Select Image<input id="gfile" type="file" accept="image/*" required></label><label class="full">Caption<input id="gc"></label><button>Add Image</button></form><div class="preview">${g.map((x,i)=>`<div><img src="${x.url}" alt=""><small>${esc(x.caption||'')}</small><button class="btn-small danger" onclick="delGal(${i})">Delete</button></div>`).join('')||'<div class="empty-admin">No gallery images.</div>'}</div></div></div>`;af.onsubmit=e=>{e.preventDefault();let x=get('mhs_achievements',[]);x.unshift({title:at.value.trim(),year:ay.value.trim(),description:ad.value.trim()});set('mhs_achievements',x);mhsToast('Achievement saved');render()};gf.onsubmit=e=>{e.preventDefault();let file=gfile.files[0];if(!file)return;let rd=new FileReader();rd.onload=()=>{let x=get('mhs_gallery',[]);x.unshift({url:rd.result,caption:gc.value.trim(),name:file.name});set('mhs_gallery',x);mhsToast('Image added to gallery');render()};rd.readAsDataURL(file)}}
window.editAch=i=>{let a=get('mhs_achievements',[]),x=a[i],title=prompt('Achievement title',x.title),year=prompt('Year',x.year),desc=prompt('Description',x.description);if(title!==null){a[i]={title,year:year??x.year,description:desc??x.description};set('mhs_achievements',a);mhsToast('Achievement updated');render()}};window.delAch=i=>{let a=get('mhs_achievements',[]);a.splice(i,1);set('mhs_achievements',a);mhsToast('Achievement updated');render()};window.delGal=i=>{let g=get('mhs_gallery',[]);g.splice(i,1);set('mhs_gallery',g);mhsToast('Image deleted');render()};
function settings(){let s=get('mhs_site_settings',SITE);app.innerHTML=`<div class="panel"><div class="box"><h2>Edit School Information</h2><form class="form" id="sf"><label>Bangla Name<input id="sbn" value="${esc(s.nameBn)}"></label><label>English Name<input id="sen" value="${esc(s.nameEn)}"></label><label>EIIN<input id="sei" value="${esc(s.eiin)}"></label><label>Established<input id="ses" value="${esc(s.estd)}"></label><label>Board<input id="sbo" value="${esc(s.board)}"></label><label>Phone<input id="sph" value="${esc(s.phone)}"></label><label>Email<input id="sem" value="${esc(s.email)}"></label><label>Website<input id="sweb" value="${esc(s.website)}"></label><label>Headmaster<input id="shm" value="${esc(s.headmaster)}"></label><label>Students<input id="sst" type="number" value="${esc(s.students)}"></label><label>Teachers<input id="ste" type="number" value="${esc(s.teachers)}"></label><label>Service Years<input id="ssv" type="number" value="${esc(s.serviceYears)}"></label><label>SSC Pass Rate<input id="spr" value="${esc(s.passRate)}"></label><label class="full">Address<input id="sad" value="${esc(s.address)}"></label><label class="full">About<textarea id="sab">${esc(s.about)}</textarea></label><label class="full">History<textarea id="shi">${esc(s.history)}</textarea></label><label class="full">Mission<textarea id="smi">${esc(s.mission)}</textarea></label><label class="full">Vision<textarea id="svi">${esc(s.vision)}</textarea></label><button>Save School Information</button></form></div></div>`;sf.onsubmit=e=>{e.preventDefault();let x={...SITE,nameBn:sbn.value,nameEn:sen.value,eiin:sei.value,estd:ses.value,board:sbo.value,phone:sph.value,email:sem.value,website:sweb.value,headmaster:shm.value,students:Number(sst.value),teachers:Number(ste.value),serviceYears:Number(ssv.value),passRate:spr.value,address:sad.value,about:sab.value,history:shi.value,mission:smi.value,vision:svi.value};set('mhs_site_settings',x);alert('School information saved.');render()}}
render();


/* ============================================================
   SUPABASE NOTICE MANAGEMENT
   Supabase client is loaded by admin/index.html before this file.
   Other admin modules remain unchanged and continue to use their
   existing storage until they are migrated separately.
   ============================================================ */
let mhsNoticeRows = [];
let mhsNoticeTickerText = '';

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
  } catch (error) {
    console.error('Could not load notices from Supabase:', error);
    app.innerHTML = `<div class="panel"><div class="box"><h2>Could not load notices</h2><p>${esc(error?.message || 'Supabase request failed.')}</p><p class="hint">Check that you are signed in as an active Super Admin and the notices policies are enabled. No local-only save has been performed.</p><button type="button" onclick="notices()">Retry</button></div></div>`;
    return;
  }

  let ticker = get('mhs_ticker_notice', { text: mhsNoticeRows[0]?.title || 'School notice' });
  mhsNoticeTickerText = ticker.text || mhsNoticeRows[0]?.title || 'School notice';
  app.innerHTML = `<div class="panel">
    <div class="box"><h2>Hero Notice Ticker</h2><p class="hint">This message appears above the hero and slides from right to left. Ticker settings remain saved in this browser in this version.</p>
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

  document.getElementById('mhsTickerForm').onsubmit = e => {
    e.preventDefault();
    set('mhs_ticker_notice', { text: document.getElementById('mhsTickerText').value.trim(), updatedAt: new Date().toISOString() });
    mhsNoticeMessage('Ticker text saved in this browser. Ticker database sync is not part of this update.');
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

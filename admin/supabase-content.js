/* MHS Admin — Supabase-backed public content management.
 * This module intentionally does not read or write localStorage for school content.
 */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const getSb = async () => {
    if (!window.mhsSupabaseReady) throw new Error('Supabase is not configured.');
    const sb = await window.mhsSupabaseReady;
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) throw new Error('Admin session expired. Please sign in again.');
    const { data: profile, error } = await sb.from('user_profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!profile || profile.role !== 'super_admin' || profile.is_active !== true) throw new Error('Active Super Admin access is required.');
    return sb;
  };
  const fail = (where, error) => {
    console.error(where, error);
    const box = document.getElementById('app');
    if (box) box.innerHTML = '<div class="panel"><div class="box"><h2>Could not load data</h2><p class="hint">' + esc(error?.message || 'Supabase request failed.') + '</p><button type="button" onclick="location.reload()">Retry</button></div></div>';
  };
  const toast = msg => window.mhsToast ? window.mhsToast(msg) : alert(msg);
  const dateInput = value => value ? new Date(value).toISOString().slice(0,16) : new Date().toISOString().slice(0,16);

  window.overview = async function () {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="panel"><div class="box">Loading school records…</div></div>';
    try {
      const sb = await getSb();
      const [n,t,r,g,a,s] = await Promise.all([
        sb.from('notices').select('id',{count:'exact',head:true}),
        sb.from('teachers').select('id',{count:'exact',head:true}),
        sb.from('results').select('id',{count:'exact',head:true}),
        sb.from('gallery').select('id',{count:'exact',head:true}),
        sb.from('achievements').select('id',{count:'exact',head:true}),
        sb.from('students').select('id',{count:'exact',head:true})
      ]);
      for (const q of [n,t,r,g,a,s]) if(q.error) throw q.error;
      app.innerHTML = '<div class="panel"><div class="cards4"><div class="stat"><b>'+(n.count||0)+'</b><span>Notices</span></div><div class="stat"><b>'+(t.count||0)+'</b><span>Teachers</span></div><div class="stat"><b>'+(r.count||0)+'</b><span>Result rows</span></div><div class="stat"><b>'+(s.count||0)+'</b><span>Students</span></div></div><div class="box"><h2>Supabase Connected</h2><p>Dashboard counts are read from the central database, not this browser.</p><p>Gallery items: '+(g.count||0)+' · Achievements: '+(a.count||0)+'</p><div class="quick-grid"><button onclick="tab=\'notices\';render()">Manage Notices</button><button onclick="tab=\'gallery\';render()">Manage Gallery</button><button onclick="tab=\'settings\';render()">School Settings</button><button onclick="tab=\'teachers\';render()">Teachers & Accounts</button></div></div></div>';
    } catch(e) { fail('Admin dashboard load failed',e); }
  };

  window.notices = async function () {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="panel"><div class="box">Loading notices…</div></div>';
    try {
      const sb = await getSb();
      const [nr,tr] = await Promise.all([
        sb.from('notices').select('id,title,content,notice_type,attachment_url,is_published,published_at,created_at').order('created_at',{ascending:false}),
        sb.from('notice_tickers').select('id,message,link_url,is_active,display_order').order('display_order')
      ]);
      if(nr.error) throw nr.error; if(tr.error) throw tr.error;
      const tickers = tr.data||[], n = nr.data||[];
      app.innerHTML = '<div class="panel"><div class="box"><h2>Notice Ticker</h2><form class="form" id="tickerForm"><input type="hidden" id="tickerId"><label class="full">Ticker message<input id="tickerMessage" required maxlength="500"></label><label>Link URL<input id="tickerLink" type="url" placeholder="Optional"></label><label><input id="tickerActive" type="checkbox" checked> Active</label><button>Save ticker</button></form><div class="table-wrap"><table class="table"><tr><th>Message</th><th>Status</th><th>Action</th></tr>'+tickers.map((x,i)=>'<tr><td>'+esc(x.message)+'</td><td>'+(x.is_active?'Active':'Hidden')+'</td><td><button type="button" class="btn-small" onclick="editMhsTicker('+i+')">Edit</button> <button type="button" class="btn-small danger" onclick="deleteMhsTicker(\''+esc(x.id)+'\')">Delete</button></td></tr>').join('')+'</table></div></div><div class="box"><h2>Add / Edit Notice</h2><form class="form" id="noticeForm"><input type="hidden" id="noticeId"><label class="full">Title<input id="noticeTitle" required maxlength="250"></label><label>Type<select id="noticeType"><option value="general">General</option><option value="exam">Exam</option><option value="admission">Admission</option><option value="urgent">Urgent</option></select></label><label>Publish date/time<input id="noticeDate" type="datetime-local" required></label><label class="full">Attachment URL<input id="noticeAttachment" type="url" placeholder="Optional"></label><label class="full">Content<textarea id="noticeContent" rows="4"></textarea></label><label><input id="noticePublished" type="checkbox" checked> Published publicly</label><button>Save notice</button><button type="button" class="btn-small" id="noticeClear">Clear form</button></form></div><div class="box"><h2>Notices ('+n.length+')</h2><div class="table-wrap"><table class="table"><tr><th>Title</th><th>Date</th><th>Published</th><th>Actions</th></tr>'+n.map((x,i)=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(new Date(x.published_at||x.created_at).toLocaleString())+'</td><td>'+(x.is_published?'Yes':'No')+'</td><td><button type="button" class="btn-small" onclick="editMhsNotice('+i+')">Edit</button> <button type="button" class="btn-small danger" onclick="deleteMhsNotice(\''+esc(x.id)+'\')">Delete</button></td></tr>').join('')+'</table></div></div></div>';
      window.__mhsNoticeRows=n; window.__mhsTickerRows=tickers;
      document.getElementById('noticeDate').value=dateInput();
      document.getElementById('tickerForm').onsubmit=async e=>{e.preventDefault();try{const id=document.getElementById('tickerId').value;const payload={message:document.getElementById('tickerMessage').value.trim(),link_url:document.getElementById('tickerLink').value.trim()||null,is_active:document.getElementById('tickerActive').checked};const q=id?await sb.from('notice_tickers').update({...payload,updated_at:new Date().toISOString()}).eq('id',id):await sb.from('notice_tickers').insert(payload);if(q.error)throw q.error;toast('Ticker saved to Supabase.');window.notices()}catch(err){alert(err.message||'Could not save ticker.')}};
      document.getElementById('noticeForm').onsubmit=async e=>{e.preventDefault();try{const id=document.getElementById('noticeId').value;const payload={title:document.getElementById('noticeTitle').value.trim(),content:document.getElementById('noticeContent').value.trim()||null,notice_type:document.getElementById('noticeType').value,attachment_url:document.getElementById('noticeAttachment').value.trim()||null,is_published:document.getElementById('noticePublished').checked,published_at:new Date(document.getElementById('noticeDate').value).toISOString(),updated_at:new Date().toISOString()};const q=id?await sb.from('notices').update(payload).eq('id',id):await sb.from('notices').insert(payload);if(q.error)throw q.error;toast('Notice saved to Supabase.');window.notices()}catch(err){alert(err.message||'Could not save notice.')}};
      document.getElementById('noticeClear').onclick=()=>{document.getElementById('noticeForm').reset();document.getElementById('noticeId').value='';document.getElementById('noticeDate').value=dateInput()};
      window.editMhsNotice=i=>{const x=window.__mhsNoticeRows[i];if(!x)return;document.getElementById('noticeId').value=x.id;document.getElementById('noticeTitle').value=x.title||'';document.getElementById('noticeType').value=x.notice_type||'general';document.getElementById('noticeDate').value=dateInput(x.published_at||x.created_at);document.getElementById('noticeAttachment').value=x.attachment_url||'';document.getElementById('noticeContent').value=x.content||'';document.getElementById('noticePublished').checked=!!x.is_published;document.getElementById('noticeForm').scrollIntoView({behavior:'smooth'})};
      window.deleteMhsNotice=async id=>{if(!confirm('Delete this notice permanently?'))return;try{const q=await sb.from('notices').delete().eq('id',id);if(q.error)throw q.error;toast('Notice deleted.');window.notices()}catch(err){alert(err.message||'Could not delete notice.')}};
      window.editMhsTicker=i=>{const x=window.__mhsTickerRows[i];if(!x)return;document.getElementById('tickerId').value=x.id;document.getElementById('tickerMessage').value=x.message||'';document.getElementById('tickerLink').value=x.link_url||'';document.getElementById('tickerActive').checked=!!x.is_active};
      window.deleteMhsTicker=async id=>{if(!confirm('Delete this ticker?'))return;try{const q=await sb.from('notice_tickers').delete().eq('id',id);if(q.error)throw q.error;toast('Ticker deleted.');window.notices()}catch(err){alert(err.message||'Could not delete ticker.')}};
    } catch(e) { fail('Notice management failed',e); }
  };

  window.gallery = async function () {
    const app=document.getElementById('app');app.innerHTML='<div class="panel"><div class="box">Loading gallery and achievements…</div></div>';
    try{
      const sb=await getSb();
      const [gr,ar]=await Promise.all([
        sb.from('gallery').select('id,title,description,image_url,category,is_published,display_order').order('display_order'),
        sb.from('achievements').select('id,title,description,achievement_date,image_url,category,is_published,display_order').order('display_order')
      ]);
      if(gr.error)throw gr.error;if(ar.error)throw ar.error;
      const gs=gr.data||[],as=ar.data||[];window.__mhsGalleryRows=gs;window.__mhsAchievementRows=as;
      app.innerHTML='<div class="panel"><div class="box"><h2>Gallery Images</h2><form class="form" id="galleryForm"><input type="hidden" id="galleryId"><label>Title<input id="galleryTitle" required></label><label>Category<select id="galleryCategory"><option value="general">General</option><option value="hero">Hero slide</option><option value="event">Event</option><option value="campus">Campus</option></select></label><label class="full">Image URL<input id="galleryUrl" type="url" required></label><label class="full">Description<textarea id="galleryDescription"></textarea></label><label><input type="checkbox" id="galleryPublished" checked> Published</label><label>Display order<input type="number" id="galleryOrder" value="0"></label><button>Save image</button><button type="button" class="btn-small" id="galleryClear">Clear</button></form><div class="table-wrap"><table class="table"><tr><th>Image</th><th>Title</th><th>Category</th><th>Published</th><th>Actions</th></tr>'+gs.map((x,i)=>'<tr><td><img src="'+esc(x.image_url)+'" alt="" width="64"></td><td>'+esc(x.title)+'</td><td>'+esc(x.category)+'</td><td>'+(x.is_published?'Yes':'No')+'</td><td><button type="button" class="btn-small" onclick="editMhsGallery('+i+')">Edit</button> <button type="button" class="btn-small danger" onclick="deleteMhsGallery(\''+esc(x.id)+'\')">Delete</button></td></tr>').join('')+'</table></div></div><div class="box"><h2>Achievements</h2><form class="form" id="achievementForm"><input type="hidden" id="achievementId"><label>Title<input id="achievementTitle" required></label><label>Category<input id="achievementCategory" value="general"></label><label>Date<input id="achievementDate" type="date"></label><label class="full">Image URL<input id="achievementImage" type="url"></label><label class="full">Description<textarea id="achievementDescription"></textarea></label><label><input id="achievementPublished" type="checkbox" checked> Published</label><label>Display order<input id="achievementOrder" type="number" value="0"></label><button>Save achievement</button></form><div class="table-wrap"><table class="table"><tr><th>Title</th><th>Date</th><th>Published</th><th>Action</th></tr>'+as.map((x,i)=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.achievement_date||'—')+'</td><td>'+(x.is_published?'Yes':'No')+'</td><td><button type="button" class="btn-small" onclick="editMhsAchievement('+i+')">Edit</button> <button type="button" class="btn-small danger" onclick="deleteMhsAchievement(\''+esc(x.id)+'\')">Delete</button></td></tr>').join('')+'</table></div></div></div>';
      document.getElementById('galleryForm').onsubmit=async e=>{e.preventDefault();try{const id=document.getElementById('galleryId').value,p={title:document.getElementById('galleryTitle').value.trim(),category:document.getElementById('galleryCategory').value,image_url:document.getElementById('galleryUrl').value.trim(),description:document.getElementById('galleryDescription').value.trim()||null,is_published:document.getElementById('galleryPublished').checked,display_order:Number(document.getElementById('galleryOrder').value)||0,updated_at:new Date().toISOString()};const q=id?await sb.from('gallery').update(p).eq('id',id):await sb.from('gallery').insert(p);if(q.error)throw q.error;toast('Gallery item saved.');window.gallery()}catch(err){alert(err.message||'Could not save gallery item.')}};
      document.getElementById('galleryClear').onclick=()=>{document.getElementById('galleryForm').reset();document.getElementById('galleryId').value=''};
      document.getElementById('achievementForm').onsubmit=async e=>{e.preventDefault();try{const id=document.getElementById('achievementId').value,p={title:document.getElementById('achievementTitle').value.trim(),category:document.getElementById('achievementCategory').value.trim()||'general',achievement_date:document.getElementById('achievementDate').value||null,image_url:document.getElementById('achievementImage').value.trim()||null,description:document.getElementById('achievementDescription').value.trim()||null,is_published:document.getElementById('achievementPublished').checked,display_order:Number(document.getElementById('achievementOrder').value)||0,updated_at:new Date().toISOString()};const q=id?await sb.from('achievements').update(p).eq('id',id):await sb.from('achievements').insert(p);if(q.error)throw q.error;toast('Achievement saved.');window.gallery()}catch(err){alert(err.message||'Could not save achievement.')}};
      window.editMhsGallery=i=>{const x=window.__mhsGalleryRows[i];if(!x)return;document.getElementById('galleryId').value=x.id;document.getElementById('galleryTitle').value=x.title||'';document.getElementById('galleryCategory').value=x.category||'general';document.getElementById('galleryUrl').value=x.image_url||'';document.getElementById('galleryDescription').value=x.description||'';document.getElementById('galleryPublished').checked=!!x.is_published;document.getElementById('galleryOrder').value=x.display_order||0};
      window.deleteMhsGallery=async id=>{if(!confirm('Delete this image?'))return;try{const q=await sb.from('gallery').delete().eq('id',id);if(q.error)throw q.error;toast('Gallery item deleted.');window.gallery()}catch(err){alert(err.message||'Could not delete image.')}};
      window.editMhsAchievement=i=>{const x=window.__mhsAchievementRows[i];if(!x)return;document.getElementById('achievementId').value=x.id;document.getElementById('achievementTitle').value=x.title||'';document.getElementById('achievementCategory').value=x.category||'general';document.getElementById('achievementDate').value=x.achievement_date||'';document.getElementById('achievementImage').value=x.image_url||'';document.getElementById('achievementDescription').value=x.description||'';document.getElementById('achievementPublished').checked=!!x.is_published;document.getElementById('achievementOrder').value=x.display_order||0};
      window.deleteMhsAchievement=async id=>{if(!confirm('Delete this achievement?'))return;try{const q=await sb.from('achievements').delete().eq('id',id);if(q.error)throw q.error;toast('Achievement deleted.');window.gallery()}catch(err){alert(err.message||'Could not delete achievement.')}};
    }catch(e){fail('Gallery management failed',e)}
  };

  window.settings = async function () {
    const app=document.getElementById('app');app.innerHTML='<div class="panel"><div class="box">Loading school settings…</div></div>';
    try{
      const sb=await getSb();
      const {data,error}=await sb.from('school_settings').select('*').limit(1).maybeSingle();if(error)throw error;
      const s=data||{};
      const fields=[['school_name','School name (Bangla)'],['school_name_en','School name (English)'],['established_year','Established year'],['slogan','Slogan'],['eiin','EIIN'],['education_board','Education board'],['headmaster_name','Head teacher / Headmaster'],['phone','Phone'],['email','Email'],['address','Address'],['website_url','Website URL'],['facebook_url','Facebook URL'],['map_url','Map URL'],['logo_url','Logo URL'],['favicon_url','Favicon URL'],['student_count','Student count'],['teacher_count','Teacher count'],['service_years','Years of service'],['ssc_pass_rate','SSC pass rate'],['about_text','About text'],['history_text','History'],['mission_text','Mission'],['vision_text','Vision']];
      app.innerHTML='<div class="panel"><div class="box"><h2>School Settings</h2><p class="hint">Saved values are shared through Supabase. Leave optional fields blank if not used.</p><form id="settingsForm" class="form">'+fields.map(([key,label])=>'<label class="'+(['about_text','history_text','mission_text','vision_text'].includes(key)?'full':'')+'">'+esc(label)+(key.endsWith('_text')?'<textarea id="set_'+key+'" rows="3">'+esc(s[key]||'')+'</textarea>':'<input id="set_'+key+'" '+(['phone','email','website_url','facebook_url','map_url','logo_url','favicon_url'].includes(key)?'type="text"':'')+' value="'+esc(s[key]??'')+'" '+(['school_name','established_year'].includes(key)?'required':'')+'>')+'</label>').join('')+'<button type="submit">Save School Settings</button></form></div></div>';
      document.getElementById('settingsForm').onsubmit=async e=>{e.preventDefault();try{const payload={};for(const [key] of fields){let value=document.getElementById('set_'+key).value.trim();if(['established_year','student_count','teacher_count','service_years'].includes(key))value=value===''?null:Number(value);else value=value||null;payload[key]=value;}payload.updated_at=new Date().toISOString();const q=s.id?await sb.from('school_settings').update(payload).eq('id',s.id):await sb.from('school_settings').insert(payload);if(q.error)throw q.error;toast('School settings saved to Supabase.');window.settings()}catch(err){alert(err.message||'Could not save settings.')}};
    }catch(e){fail('School settings load failed',e)}
  };
})();
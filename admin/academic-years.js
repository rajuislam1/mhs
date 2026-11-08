(() => {
  'use strict';
  const app = document.getElementById('app');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify = (s,bad=false) => window.mhsNotify ? window.mhsNotify(s,bad) : alert(s);
  async function getClient(){ return await window.mhsSupabaseReady; }
  async function adminClient(){
    const sb=await getClient(),{data:{user},error}=await sb.auth.getUser();
    if(error)throw error;if(!user)throw new Error('Please sign in again.');
    const {data:p,error:pe}=await sb.from('user_profiles').select('role,is_active').eq('id',user.id).maybeSingle();
    if(pe)throw pe;if(!p||p.role!=='super_admin'||!p.is_active)throw new Error('Only an active Super Admin can manage academic years and promotion.');
    return sb;
  }
  const panel=s=>{app.innerHTML='<div class="panel">'+s+'</div>';};
  window.MHS_EXTRA.academicYears = async function(){
    panel('<div class="box">Loading academic years…</div>');
    try{
      const sb=await adminClient(),{data:years,error}=await sb.from('academic_years').select('id,year,name,is_active').order('year',{ascending:false});
      if(error)throw error;
      const {data:enrollments,error:ee}=await sb.from('student_enrollments').select('academic_year_id,enrollment_status');
      if(ee)throw ee;
      const {data:students,error:se}=await sb.from('students').select('id,academic_year_id').eq('status',true);
      if(se)throw se;
      panel('<div class="box"><div class="toolbar"><div><h2>Academic Year Management</h2><p class="hint">Create a new session, configure its subjects, teachers and routines, then activate it when ready.</p></div><span class="badge">One active year</span></div><form id="mhsYearForm" class="form"><label>Academic Year<input id="mhsYearNumber" type="number" min="2000" max="2200" required placeholder="e.g. 2027"></label><label>Display Name<input id="mhsYearName" placeholder="Academic Year 2027"></label><button type="submit">Create Academic Year</button></form><p class="hint">Creating a year does not automatically change student or teacher data. Activate the year only after configuring its academic structure.</p></div><div class="box"><h2>Academic Year Records</h2><div class="table-wrap"><table class="table"><thead><tr><th>Year</th><th>Name</th><th>Students</th><th>Enrollments</th><th>Status</th><th>Action</th></tr></thead><tbody>'+years.map(y=>'<tr><td><b>'+esc(y.year)+'</b></td><td>'+esc(y.name||('Academic Year '+y.year))+'</td><td>'+students.filter(x=>x.academic_year_id===y.id).length+'</td><td>'+enrollments.filter(x=>x.academic_year_id===y.id).length+'</td><td>'+(y.is_active?'<span class="badge">Active</span>':'Archived / Inactive')+'</td><td>'+(y.is_active?'Current year': '<button type="button" class="btn-small" data-activate-year="'+y.id+'">Set Active</button>')+'</td></tr>').join('')+'</tbody></table></div></div>');
      document.getElementById('mhsYearForm').onsubmit=async e=>{
        e.preventDefault();const year=Number(document.getElementById('mhsYearNumber').value),name=document.getElementById('mhsYearName').value.trim()||('Academic Year '+year);
        if(!Number.isInteger(year)||year<2000||year>2200)return notify('Enter a valid academic year.',true);
        if(years.some(y=>Number(y.year)===year))return notify('This academic year already exists.',true);
        const {error}=await sb.from('academic_years').insert({year,name,is_active:false});
        if(error)throw error;notify('Academic year created. Configure subjects, assignments and routines before activation.');await window.MHS_EXTRA.academicYears();
      };
      app.querySelectorAll('[data-activate-year]').forEach(b=>b.onclick=async()=>{
        const y=years.find(x=>x.id===b.dataset.activateYear);if(!y)return;
        if(!confirm('Set '+y.year+' as the active academic year? This changes the current session used by admin, teacher and student portals.'))return;
        b.disabled=true;
        try{const {error}=await sb.rpc('mhs_set_active_academic_year',{p_year_id:y.id});if(error)throw error;notify(y.year+' is now the active academic year.');await window.MHS_EXTRA.academicYears();}
        catch(e){notify(e.message,true);b.disabled=false;}
      });
    }catch(e){panel('<div class="box"><h2>Academic Year Management unavailable</h2><p>'+esc(e.message)+'</p></div>');}
  };

  window.MHS_EXTRA.subjects = async function(){
    panel('<div class="box">Loading year-specific subjects…</div>');
    try{
      const sb=await adminClient();
      const [{data:years,error:ye},{data:classes,error:ce},{data:subjects,error:se},{data:links,error:le}]=await Promise.all([
        sb.from('academic_years').select('id,year,is_active').order('year',{ascending:false}),
        sb.from('classes').select('id,name,class_number,status').eq('status',true).order('class_number'),
        sb.from('subjects').select('id,name,code,status').order('name'),
        sb.from('class_subjects').select('id,academic_year_id,class_id,subject_id,is_compulsory')
      ]);
      for(const x of [{error:ye},{error:ce},{error:se},{error:le}])if(x.error)throw x.error;
      const active=years.find(y=>y.is_active)||years[0];if(!active)throw new Error('Create an academic year first.');
      const render=yearId=>{
        const y=years.find(x=>x.id===yearId)||active;
        const isPastYear=Number(y.year)<Number(active.year);
        panel('<div class="box"><h2>Academic Subjects</h2><p class="hint">Each academic year has its own class-wise subject structure. Updating one year never changes another year. '+(isPastYear?'Past academic-year subject structures are read-only to protect historical results.':'')+'</p><div class="form"><label>Academic Year<select id="mhsSubjectYear">'+years.map(x=>'<option value="'+x.id+'" '+(x.id===y.id?'selected':'')+'>'+esc(x.year)+(x.is_active?' · Active':'')+'</option>').join('')+'</select></label><div><b>Selected Session</b><p>'+esc(y.year)+' · '+(y.is_active?'Active':'Inactive / Planning')+'</p></div></div><h3>Subject Catalog</h3><form id="mhsSubjectCatalogForm" class="form"><label>Subject Name<input id="mhsSubjectName" required></label><label>Subject Code<input id="mhsSubjectCode"></label><button type="submit">Add Subject</button></form><div class="table-wrap"><table class="table"><thead><tr><th>Subject</th><th>Code</th><th>Status</th></tr></thead><tbody>'+subjects.map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(s.code||'—')+'</td><td>'+(s.status?'Active':'Inactive')+'</td></tr>').join('')+'</tbody></table></div></div>'+classes.map(cl=>{
          const assigned=links.filter(l=>l.class_id===cl.id&&l.academic_year_id===y.id);
          return '<div class="box"><div class="toolbar"><h3>Class '+esc(cl.class_number)+' — '+esc(cl.name)+'</h3><span>'+assigned.length+' configured subject(s)</span></div><div class="subject-grid">'+subjects.filter(s=>s.status).map(s=>{
            const link=assigned.find(l=>l.subject_id===s.id);
            return '<label class="subject-row"><input type="checkbox" data-year-class="'+cl.id+'" data-year-subject="'+s.id+'" '+(link?'checked':'')+(isPastYear?' disabled':'')+'><span>'+esc(s.name)+'</span><select data-year-required="'+cl.id+'-'+s.id+'" '+(isPastYear?'disabled':'')+'><option value="true" '+(link?.is_compulsory!==false?'selected':'')+'>Compulsory</option><option value="false" '+(link?.is_compulsory===false?'selected':'')+'>Optional</option></select></label>';
          }).join('')+'</div><button type="button" data-save-year-class="'+cl.id+'" '+(isPastYear?'disabled':'')+'>Save Class '+esc(cl.class_number)+' Subjects</button></div>';
        }).join(''));
        document.getElementById('mhsSubjectYear').onchange=e=>render(e.target.value);
        document.getElementById('mhsSubjectCatalogForm').onsubmit=async e=>{
          e.preventDefault();const name=document.getElementById('mhsSubjectName').value.trim(),code=document.getElementById('mhsSubjectCode').value.trim()||null;
          if(subjects.some(s=>s.name.toLowerCase()===name.toLowerCase()))return notify('Subject already exists in the catalog.',true);
          try{const {data,error}=await sb.from('subjects').insert({name,code,status:true}).select('id,name,code,status').single();if(error)throw error;subjects.push(data);notify('Subject added to catalog. Now assign it to classes for the selected year.');render(y.id);}catch(err){notify(err.message,true);}
        };
        app.querySelectorAll('[data-save-year-class]').forEach(btn=>btn.onclick=async()=>{
          const classId=btn.dataset.saveYearClass,checked=[...app.querySelectorAll('[data-year-class="'+classId+'"]:checked')],existing=links.filter(l=>l.class_id===classId&&l.academic_year_id===y.id);
          btn.disabled=true;
          try{
            for(const old of existing)if(!checked.some(c=>c.dataset.yearSubject===old.subject_id)){const {error}=await sb.from('class_subjects').delete().eq('id',old.id);if(error)throw error;}
            for(const box of checked){
              const subjectId=box.dataset.yearSubject,required=document.querySelector('[data-year-required="'+classId+'-'+subjectId+'"]').value==='true',old=existing.find(l=>l.subject_id===subjectId);
              if(old){if(old.is_compulsory!==required){const {error}=await sb.from('class_subjects').update({is_compulsory:required}).eq('id',old.id);if(error)throw error;}}
              else {const {error}=await sb.from('class_subjects').insert({academic_year_id:y.id,class_id:classId,subject_id:subjectId,is_compulsory:required});if(error)throw error;}
            }
            const fresh=await sb.from('class_subjects').select('id,academic_year_id,class_id,subject_id,is_compulsory');if(fresh.error)throw fresh.error;links.splice(0,links.length,...fresh.data);notify('Class '+classes.find(c=>c.id===classId)?.class_number+' subjects saved for '+y.year+'.');render(y.id);
          }catch(err){notify(err.message,true);btn.disabled=false;}
        });
      };
      render(active.id);
    }catch(e){panel('<div class="box"><h2>Academic subjects unavailable</h2><p>'+esc(e.message)+'</p></div>');}
  };

  window.MHS_EXTRA.promotion = async function(){
    panel('<div class="box">Loading student promotion workspace…</div>');
    try{
      const sb=await adminClient();
      const [{data:students,error:se},{data:classes,error:ce},{data:years,error:ye},{data:history,error:he},{data:enrollments,error:ee}]=await Promise.all([
        sb.from('students').select('id,student_id,name,roll,class_id,academic_year_id,status,classes(class_number)').eq('status',true).order('name'),
        sb.from('classes').select('id,name,class_number').eq('status',true).order('class_number'),
        sb.from('academic_years').select('id,year,is_active').order('year',{ascending:false}),
        sb.from('student_promotions').select('id,student_id,academic_year_id,from_class_id,to_class_id,promotion_status,promoted_at,remarks,students(name,student_id),from_class:classes!student_promotions_from_class_id_fkey(class_number),to_class:classes!student_promotions_to_class_id_fkey(class_number),academic_years(year)').order('promoted_at',{ascending:false}).limit(300),
        sb.from('student_enrollments').select('student_id,academic_year_id,class_id,roll,enrollment_status')
      ]);
      for(const x of [{error:se},{error:ce},{error:ye},{error:he},{error:ee}])if(x.error)throw x.error;
      const active=years.find(y=>y.is_active);if(!active)throw new Error('Create and activate the destination academic year first.');
      const sources=years.filter(y=>y.year<active.year);
      panel('<div class="box"><h2>Student Promotion & Academic Rollover</h2><p class="hint">Promotion creates a new year enrollment. Previous year enrollment and results remain unchanged.</p><form id="mhsPromotionForm" class="form"><label>Source Academic Year<select id="mhsPromoSource" required>'+sources.map(y=>'<option value="'+y.id+'">'+esc(y.year)+'</option>').join('')+'</select></label><label>Destination Academic Year<input value="'+esc(active.year)+' (Active)'+'" disabled></label><label>Current Class<select id="mhsPromoSourceClass" required>'+classes.map(c=>'<option value="'+c.id+'">Class '+esc(c.class_number)+'</option>').join('')+'</select></label><label>New Class<select id="mhsPromoTargetClass" required>'+classes.map(c=>'<option value="'+c.id+'">Class '+esc(c.class_number)+'</option>').join('')+'</select></label><label class="full">Remarks<input id="mhsPromoRemarks" placeholder="Optional promotion note"></label></form><div class="toolbar"><input id="mhsPromoSearch" type="search" placeholder="Search name, Student ID or roll" style="max-width:340px"><label><input type="checkbox" id="mhsPromoAll"> Select all visible</label><span id="mhsPromoCount">0 selected</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Select</th><th>Student ID</th><th>Name</th><th>Source Class</th><th>Roll</th><th>Destination Status</th></tr></thead><tbody id="mhsPromoRows"></tbody></table></div><button type="button" id="mhsPromoteNow">Confirm Promotion</button><p class="hint" id="mhsPromoMessage"></p></div><div class="box"><h2>Promotion History</h2><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>From</th><th>To</th><th>Academic Year</th><th>Date</th><th>Remarks</th></tr></thead><tbody>'+history.map(h=>'<tr><td>'+esc(h.students?.name)+' · '+esc(h.students?.student_id)+'</td><td>'+esc(h.from_class?.class_number)+'</td><td>'+esc(h.to_class?.class_number)+'</td><td>'+esc(h.academic_years?.year)+'</td><td>'+esc(h.promoted_at?new Date(h.promoted_at).toLocaleDateString():'—')+'</td><td>'+esc(h.remarks||'')+'</td></tr>').join('')+'</tbody></table></div></div>');
      const $=id=>document.getElementById(id),selected=()=>[...app.querySelectorAll('.mhs-promo-row:checked')].map(x=>x.value);
      const eligible=()=>students.filter(s=>s.academic_year_id===$('mhsPromoSource').value&&s.class_id===$('mhsPromoSourceClass').value&&!enrollments.some(e=>e.student_id===s.id&&e.academic_year_id===active.id));
      const draw=()=>{const list=eligible(),term=$('mhsPromoSearch').value.trim().toLowerCase(),visible=list.filter(s=>[s.name,s.student_id,s.roll].some(v=>String(v??'').toLowerCase().includes(term)));$('mhsPromoRows').innerHTML=visible.map(s=>'<tr><td><input type="checkbox" class="mhs-promo-row" value="'+s.id+'"></td><td>'+esc(s.student_id)+'</td><td>'+esc(s.name)+'</td><td>'+esc(classes.find(c=>c.id===s.class_id)?.class_number)+'</td><td>'+esc(s.roll||'—')+'</td><td>Not enrolled in '+esc(active.year)+'</td></tr>').join('')||'<tr><td colspan="6">No eligible students found.</td></tr>';$('mhsPromoCount').textContent='0 selected';$('mhsPromoAll').checked=false;app.querySelectorAll('.mhs-promo-row').forEach(x=>x.onchange=()=>{$('mhsPromoCount').textContent=selected().length+' selected';});};
      ['mhsPromoSource','mhsPromoSourceClass','mhsPromoSearch'].forEach(id=>$(id).addEventListener(id==='mhsPromoSearch'?'input':'change',draw));
      $('mhsPromoAll').onchange=e=>{app.querySelectorAll('.mhs-promo-row').forEach(x=>x.checked=e.target.checked);$('mhsPromoCount').textContent=selected().length+' selected';};
      $('mhsPromoteNow').onclick=async()=>{
        const ids=selected(),source=$('mhsPromoSource').value,targetClass=$('mhsPromoTargetClass').value,sourceClass=$('mhsPromoSourceClass').value;
        if(!ids.length)return notify('Select at least one student.',true);
        if(!source||!sourceClass||!targetClass)return notify('Choose source year, source class and destination class.',true);
        if(sourceClass===targetClass)return notify('Choose a different destination class, or use the repeat workflow.',true);
        if(!confirm('Promote '+ids.length+' student(s) from '+years.find(y=>y.id===source)?.year+' to '+active.year+'? Previous-year records will be retained.'))return;
        const btn=$('mhsPromoteNow');btn.disabled=true;
        try{const {data,error}=await sb.rpc('mhs_promote_students',{p_student_ids:ids,p_source_year_id:source,p_target_year_id:active.id,p_target_class_id:targetClass,p_remarks:$('mhsPromoRemarks').value.trim()||null});if(error)throw error;notify((data||ids.length)+' student(s) promoted successfully.');await window.MHS_EXTRA.promotion();}
        catch(e){notify(e.message,true);btn.disabled=false;}
      };
      if(!sources.length){$('mhsPromoRows').innerHTML='<tr><td colspan="6">Create a new academic year and activate it before promotion.</td></tr>';$('mhsPromoteNow').disabled=true;}else draw();
    }catch(e){panel('<div class="box"><h2>Promotion management unavailable</h2><p>'+esc(e.message)+'</p></div>');}
  };
})();
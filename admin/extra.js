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
  </div><div class="box"><h2>Academic Year Management</h2><form class="form" id="sbYearForm"><label>Year<input name="year" type="number" min="2000" max="2100" required placeholder="2027"></label><label>Year Name<input name="name" maxlength="80" placeholder="Academic Year 2027"></label><button type="submit">Add Academic Year</button></form><div class="table-wrap"><table class="table"><tr><th>Year</th><th>Name</th><th>Status</th><th>Action</th></tr>${(years||[]).map(y=>`<tr><td>${AESC(y.year)}</td><td>${AESC(y.name)}</td><td>${y.is_active?'Active':'Inactive'}</td><td><button type="button" class="btn-small" data-year-active="${AESC(y.id)}" data-active="${y.is_active?'1':'0'}">${y.is_active?'Active Year':'Set Active'}</button></td></tr>`).join('')}</table></div></div>
  <div class="box"><h2>Class-wise Subject Structure</h2><div class="form"><label>Academic Year<select id="sbCsYear">${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${y.id===currentYear?.id?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label><label>Class<select id="sbCsClass">${(classes||[]).map(cl=>`<option value="${AESC(cl.id)}">${AESC(cl.name||('Class '+cl.class_number))}</option>`).join('')}</select></label></div><div id="sbClassSubjectEditor"></div></div></div>`;
  document.getElementById('sbYearForm').onsubmit=async event=>{
   event.preventDefault();const fd=new FormData(event.currentTarget),year=Number(fd.get('year')),name=String(fd.get('name')||'').trim()||'Academic Year '+year;
   if(!Number.isInteger(year)||year<2000||year>2100)return alert('Enter a valid academic year.');
   if((years||[]).some(y=>Number(y.year)===year))return alert('This academic year already exists.');
   const button=event.currentTarget.querySelector('button');button.disabled=true;
   try{const {error}=await sb.from('academic_years').insert({year,name,is_active:false});if(error)throw error;mhsToast('Academic year created');await window.MHS_EXTRA.subjects();}
   catch(error){alert('Could not create academic year: '+(error.message||String(error)));button.disabled=false;}
  };
  box.querySelectorAll('[data-year-active]').forEach(button=>button.addEventListener('click',async()=>{
   if(button.dataset.active==='1')return;
   if(!confirm('Set this as the active academic year? Other years will be marked inactive.'))return;
   button.disabled=true;
   try{
    const {error:offError}=await sb.from('academic_years').update({is_active:false}).neq('id',button.dataset.yearActive);if(offError)throw offError;
    const {error:onError}=await sb.from('academic_years').update({is_active:true}).eq('id',button.dataset.yearActive);if(onError)throw onError;
    mhsToast('Active academic year updated');await window.MHS_EXTRA.subjects();
   }catch(error){alert('Could not change active year: '+(error.message||String(error)));button.disabled=false;}
  }));
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
studentSubjects(){app.innerHTML='<div class="panel"><div class="box"><h2>Student Subject Selection</h2><p class="hint">Loading the Supabase-backed subject selection module… If this message remains, refresh the page.</p></div></div>';},
promotion(){
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

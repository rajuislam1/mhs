const me=JSON.parse(sessionStorage.getItem('mhs_teacher')||'null');
if(!me)location.href='login.html';

const app=document.getElementById('app');
const title=document.getElementById('title');
const teacherName=document.getElementById('teacherName');

teacherName.textContent=me?.name||'Teacher';

const get=(k,f=[])=>{
    try{return JSON.parse(localStorage.getItem(k)||'null')??f}
    catch{return f}
};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

let tab='dash';

document.querySelectorAll('nav button').forEach(b=>{
    b.onclick=()=>{
        tab=b.dataset.tab;
        document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        render();
    };
});

document.getElementById('logout').onclick=()=>{
    sessionStorage.removeItem('mhs_teacher');
    location.href='login.html';
};

function esc(s){
    return String(s??'').replace(/[&<>"']/g,m=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
    }[m]));
}

function notifications(){
    let q=get('mhs_result_edit_requests',[])
        .filter(x=>x.teacher===me.username&&x.status==='pending');

    return q.length
        ? `<div class="teacher-notice-bar">
            <b>🔔 Super Admin Result Edit Request</b>
            <span>${q.length} pending request${q.length>1?'s':''} — ${q.map(x=>`${esc(x.subject)} | Class ${esc(x.class)} | Roll ${esc(x.roll)}`).join(' · ')}</span>
            <button onclick="tab='notifications';document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab==='notifications'));render()">View</button>
          </div>`
        :'';
}

function render(){
    title.textContent={
        dash:'Dashboard',
        routine:'Class Routine',
        classes:'My Classes',
        results:'Publish Results',
        students:'Students',
        notifications:'Result Edit Requests',
        classstudents:'Class Students'
    }[tab]||'Dashboard';

    app.innerHTML=notifications()+'<div id="view"></div>';
    window.view=document.getElementById('view');

    if(tab==='notifications'){
        supabaseEditRequestsPage();
    }else{
        ({
            dash,
            routine,
            classes,
            results,
            students,
            classstudents:classStudents
        }[tab]||dash)();
    }
}

async function dash(){
 const box=document.getElementById('view');
 box.innerHTML='<div class="panel"><div class="box"><h2>Teacher Dashboard</h2><p class="hint">Loading Supabase summary…</p></div></div>';
 try{
  const ctx=await loadAssignedStudentContext();
  const [{count:resultCount,error:resultError},{count:routineCount,error:routineError}]=await Promise.all([
   ctx.sb.from('results').select('id',{count:'exact',head:true}),
   ctx.sb.from('class_routines').select('id',{count:'exact',head:true}).eq('teacher_id',ctx.profile.teacher_id)
  ]);
  if(resultError)throw resultError;if(routineError)throw routineError;
  const subjects=[...new Set(ctx.choices.map(x=>x.subjectName))];
  box.innerHTML=`<div class="panel"><div class="cards4"><div class="stat"><b>${resultCount||0}</b><span>My Result Records</span></div><div class="stat"><b>${ctx.assignments.length}</b><span>Active Assignments</span></div><div class="stat"><b>${routineCount||0}</b><span>Routine Entries</span></div><div class="stat"><b>${ctx.students.length}</b><span>Assigned Students</span></div></div><div class="box"><h2>Welcome, ${esc(me?.name||'Teacher')}</h2><p>Manage your assigned classes, routines, student marks and result correction requests.</p><p class="hint">Assigned subjects: ${subjects.map(esc).join(', ')||'No active subject assignment'}.</p><p class="hint">New results are saved as drafts and become visible to students only after the Super Admin publishes them.</p></div></div>`;
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Teacher Dashboard</h2><p class="hint">Could not load dashboard: ${esc(error.message||String(error))}</p></div></div>`;}
}

async function routine(){
    const box = document.getElementById('view');
    box.innerHTML = '<div class="panel"><div class="box"><h2>Class Routine</h2><p class="hint">Loading your Supabase assignments…</p></div></div>';
    try {
        const sb = await window.mhsSupabaseReady;
        const { data: authData, error: authError } = await sb.auth.getUser();
        if (authError || !authData?.user) throw new Error('Teacher session expired. Sign in again.');
        const { data: profile, error: profileError } = await sb.from('user_profiles')
            .select('teacher_id,role,is_active').eq('id', authData.user.id).single();
        if (profileError || profile?.role !== 'teacher' || profile?.is_active !== true || !profile.teacher_id)
            throw new Error('An active teacher profile was not found.');
        const { data: assignments, error: assignmentError } = await sb.from('teacher_assignments')
            .select('id,class_id,subject_id,academic_year_id')
            .eq('teacher_id', profile.teacher_id).eq('status', true);
        if (assignmentError) throw assignmentError;
        const ids = [...new Set((assignments || []).flatMap(a => [a.class_id, a.subject_id, a.academic_year_id]).filter(Boolean))];
        const [{data: classesData,error: classesError},{data: subjectsData,error: subjectsError},{data: yearsData,error: yearsError}] = await Promise.all([
            sb.from('classes').select('id,name,class_number'),
            sb.from('subjects').select('id,name'),
            sb.from('academic_years').select('id,year')
        ]);
        if (classesError) throw classesError;
        if (subjectsError) throw subjectsError;
        if (yearsError) throw yearsError;
        const classMap = new Map((classesData || []).map(x => [x.id, x]));
        const subjectMap = new Map((subjectsData || []).map(x => [x.id, x]));
        const yearMap = new Map((yearsData || []).map(x => [x.id, x]));
        const {data: routinesData,error: routineError} = await sb.from('class_routines')
            .select('id,day_of_week,start_time,end_time,room,class_id,subject_id,academic_year_id')
            .eq('teacher_id', profile.teacher_id).order('day_of_week').order('start_time');
        if (routineError) throw routineError;
        box.innerHTML = `<div class="panel">
            <div class="box"><h2>Add Class Routine</h2>
                <p class="hint">Only classes and subjects assigned by the school administrator can be selected.</p>
                <form class="form" id="sbRoutineForm">
                    <label>Assigned Class & Subject
                        <select name="assignment" required>
                            <option value="">Choose assignment</option>
                            ${(assignments || []).map(a => {
                                const cl=classMap.get(a.class_id), sub=subjectMap.get(a.subject_id), year=yearMap.get(a.academic_year_id);
                                return `<option value="${esc(a.id)}">${esc(cl?.name || cl?.class_number || 'Class')} · ${esc(sub?.name || 'Subject')} · ${esc(year?.year || '')}</option>`;
                            }).join('')}
                        </select>
                    </label>
                    <label>Day<select name="day" required>
                        <option>Sunday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option>
                    </select></label>
                    <label>Start Time<input type="time" name="start" required></label>
                    <label>End Time<input type="time" name="end" required></label>
                    <label>Room (optional)<input name="room" maxlength="80" placeholder="Room number"></label>
                    <button type="submit" ${assignments?.length ? '' : 'disabled'}>Save Routine</button>
                </form>
                ${assignments?.length ? '' : '<p class="hint">No active class/subject assignments were found. Ask the administrator to assign your classes first.</p>'}
            </div>
            <div class="box"><h2>My Routine</h2>
                <div class="table-wrap"><table class="table"><tr><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Year</th><th>Room</th><th></th></tr>
                ${(routinesData || []).map(r => `<tr><td>${esc(r.day_of_week)}</td><td>${esc(String(r.start_time).slice(0,5))}–${esc(String(r.end_time).slice(0,5))}</td><td>${esc(classMap.get(r.class_id)?.name || classMap.get(r.class_id)?.class_number || '—')}</td><td>${esc(subjectMap.get(r.subject_id)?.name || '—')}</td><td>${esc(yearMap.get(r.academic_year_id)?.year || '—')}</td><td>${esc(r.room || '—')}</td><td><button class="btn-small danger" onclick="deleteSupabaseRoutine('${esc(r.id)}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-admin">No routines saved.</td></tr>'}
                </table></div>
            </div>
        </div>`;
        document.getElementById('sbRoutineForm').onsubmit = async event => {
            event.preventDefault();
            const form=event.currentTarget, button=form.querySelector('button');
            const assignment=(assignments || []).find(a => a.id === form.elements.assignment.value);
            if (!assignment) return alert('Choose one of your assigned classes and subjects.');
            if (form.elements.end.value <= form.elements.start.value) return alert('End time must be later than start time.');
            button.disabled=true;
            try {
                const {error} = await sb.from('class_routines').insert({
                    teacher_id: profile.teacher_id,
                    class_id: assignment.class_id,
                    subject_id: assignment.subject_id,
                    academic_year_id: assignment.academic_year_id,
                    day_of_week: form.elements.day.value,
                    start_time: form.elements.start.value,
                    end_time: form.elements.end.value,
                    room: form.elements.room.value.trim() || null,
                    routine_status: true
                });
                if (error) throw error;
                mhsToast('Routine saved to Supabase');
                await routine();
            } catch (error) {
                alert('Could not save routine: ' + (error.message || String(error)));
                button.disabled=false;
            }
        };
    } catch(error) {
        box.innerHTML = `<div class="panel"><div class="box"><h2>Class Routine</h2><p class="hint">Could not load routines: ${esc(error.message || String(error))}</p></div></div>`;
    }
}

window.deleteSupabaseRoutine = async id => {
    if (!confirm('Delete this routine?')) return;
    try {
        const sb=await window.mhsSupabaseReady;
        const {data:authData,error:authError}=await sb.auth.getUser();
        if(authError || !authData?.user) throw new Error('Please sign in again.');
        const {data:profile,error:profileError}=await sb.from('user_profiles').select('teacher_id,role,is_active').eq('id',authData.user.id).single();
        if(profileError || profile?.role!=='teacher' || profile?.is_active!==true || !profile.teacher_id) throw new Error('Active teacher profile required.');
        const {error}=await sb.from('class_routines').delete().eq('id',id).eq('teacher_id',profile.teacher_id);
        if(error) throw error;
        mhsToast('Routine deleted');
        await routine();
    } catch(error) {
        alert('Could not delete routine: '+(error.message||String(error)));
    }
};

async function classes(){
    const box=document.getElementById('view');
    box.innerHTML='<div class="panel"><div class="box"><h2>My Classes & Subjects</h2><p class="hint">Loading your official assignments from Supabase…</p></div></div>';
    try {
        const sb=await window.mhsSupabaseReady;
        const {data:authData,error:authError}=await sb.auth.getUser();
        if(authError || !authData?.user) throw new Error('Teacher session expired. Sign in again.');
        const {data:profile,error:profileError}=await sb.from('user_profiles').select('teacher_id,role,is_active').eq('id',authData.user.id).single();
        if(profileError || profile?.role!=='teacher' || profile?.is_active!==true || !profile.teacher_id) throw new Error('An active teacher profile was not found.');
        const {data:assignments,error:assignmentError}=await sb.from('teacher_assignments').select('id,class_id,subject_id,academic_year_id,status,assigned_at').eq('teacher_id',profile.teacher_id).eq('status',true).order('assigned_at',{ascending:false});
        if(assignmentError) throw assignmentError;
        const [{data:classesData,error:classesError},{data:subjectsData,error:subjectsError},{data:yearsData,error:yearsError}]=await Promise.all([
            sb.from('classes').select('id,name,class_number'),
            sb.from('subjects').select('id,name'),
            sb.from('academic_years').select('id,year')
        ]);
        if(classesError) throw classesError;
        if(subjectsError) throw subjectsError;
        if(yearsError) throw yearsError;
        const classMap=new Map((classesData||[]).map(x=>[x.id,x]));
        const subjectMap=new Map((subjectsData||[]).map(x=>[x.id,x]));
        const yearMap=new Map((yearsData||[]).map(x=>[x.id,x]));
        box.innerHTML=`<div class="panel"><div class="box"><h2>My Classes & Subjects</h2>
            <p class="hint">Assignments are managed by the school administrator. Teachers cannot self-assign classes or subjects.</p>
            <div class="table-wrap"><table class="table"><tr><th>Class</th><th>Subject</th><th>Academic Year</th><th>Status</th></tr>
            ${(assignments||[]).map(a=>`<tr><td>${esc(classMap.get(a.class_id)?.name||classMap.get(a.class_id)?.class_number||'—')}</td><td>${esc(subjectMap.get(a.subject_id)?.name||'—')}</td><td>${esc(yearMap.get(a.academic_year_id)?.year||'—')}</td><td><span class="badge">Assigned</span></td></tr>`).join('')||'<tr><td colspan="4" class="empty-admin">No active assignments. Contact the school administrator.</td></tr>'}
            </table></div>
        </div></div>`;
    } catch(error) {
        box.innerHTML=`<div class="panel"><div class="box"><h2>My Classes & Subjects</h2><p class="hint">Could not load assignments: ${esc(error.message||String(error))}</p></div></div>`;
    }
}

async function results(){
    const box=document.getElementById('view');
    box.innerHTML='<div class="panel"><div class="box"><h2>Publish Results</h2><p class="hint">Loading your assigned classes and students from Supabase…</p></div></div>';
    try{
        const sb=await window.mhsSupabaseReady;
        const {data:authData,error:authError}=await sb.auth.getUser();
        if(authError||!authData?.user)throw new Error('Teacher session expired. Sign in again.');
        const {data:profile,error:profileError}=await sb.from('user_profiles').select('teacher_id,role,is_active').eq('id',authData.user.id).single();
        if(profileError||profile?.role!=='teacher'||profile?.is_active!==true||!profile.teacher_id)throw new Error('Active teacher profile required.');
        const {data:assignments,error:assignmentError}=await sb.from('teacher_assignments').select('id,class_id,subject_id,academic_year_id').eq('teacher_id',profile.teacher_id).eq('status',true);
        if(assignmentError)throw assignmentError;
        const [{data:classesData,error:classesError},{data:subjectsData,error:subjectsError},{data:yearsData,error:yearsError},{data:allResults,error:resultsError},{data:requests,error:requestsError}] = await Promise.all([
            sb.from('classes').select('id,name,class_number'),
            sb.from('subjects').select('id,name'),
            sb.from('academic_years').select('id,year,name'),
            sb.from('results').select('id,student_id,class_subject_id,academic_year_id,exam_name,marks,grade,grade_point,status,published_at,published_by,created_at'),
            sb.from('result_edit_requests').select('id,result_id,status').eq('teacher_id',profile.teacher_id).eq('status','approved')
        ]);
        if(classesError)throw classesError;if(subjectsError)throw subjectsError;if(yearsError)throw yearsError;if(resultsError)throw resultsError;if(requestsError)throw requestsError;
        const classMap=new Map((classesData||[]).map(x=>[x.id,x]));
        const subjectMap=new Map((subjectsData||[]).map(x=>[x.id,x]));
        const yearMap=new Map((yearsData||[]).map(x=>[x.id,x]));
        const approvedResultIds=new Set((requests||[]).map(x=>x.result_id));
        const choices=[];
        for(const a of assignments||[]){
            const {data:csRows,error:csError}=await sb.from('class_subjects').select('id,class_id,subject_id,academic_year_id').eq('class_id',a.class_id).eq('subject_id',a.subject_id).eq('academic_year_id',a.academic_year_id);
            if(csError)throw csError;
            for(const cs of csRows||[]){
                const {data:studentsData,error:studentsError}=await sb.from('students').select('id,student_id,name,roll,section,class_id,academic_year_id').eq('class_id',a.class_id).eq('academic_year_id',a.academic_year_id).eq('status',true).order('roll');
                if(studentsError)throw studentsError;
                const {data:selected,error:selectedError}=await sb.from('student_subjects').select('student_id').eq('class_subject_id',cs.id);
                if(selectedError)throw selectedError;
                const selectedIds=new Set((selected||[]).map(x=>x.student_id));
                choices.push({assignment:a,cs,students:(studentsData||[]).filter(st=>selectedIds.size===0||selectedIds.has(st.id)),className:classMap.get(a.class_id)?.name||classMap.get(a.class_id)?.class_number||'Class',subjectName:subjectMap.get(a.subject_id)?.name||'Subject',year:yearMap.get(a.academic_year_id)?.year||yearMap.get(a.academic_year_id)?.name||''});
            }
        }
        const studentMap=new Map();
        for(const choice of choices)for(const st of choice.students)studentMap.set(st.id,st);
        const examOptions=['Half Yearly','Final Exam','Class Test','Lab Test'];
        box.innerHTML=`<div class="panel">
          <div class="box"><h2>Enter Student Marks</h2><p class="hint">New marks are saved as Draft. The school administrator must publish them before students can see them. Published marks can be corrected only after an Admin approves an edit request.</p>
            <form class="form" id="sbResultForm">
              <label>Assigned Class / Subject / Year<select name="choice" required><option value="">Select assignment</option>${choices.map((x,i)=>`<option value="${i}">${esc(x.className)} · ${esc(x.subjectName)} · ${esc(x.year)}</option>`).join('')}</select></label>
              <label>Student<select name="student" required><option value="">Select class/subject first</option></select></label>
              <label>Exam<select name="exam" required>${examOptions.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
              <label>Marks (0–100)<input name="marks" type="number" min="0" max="100" step="0.01" required></label>
              <button type="submit" ${choices.length?'':'disabled'}>Save Result Draft</button>
            </form>
            ${choices.length?'':'<p class="hint">No active assignments were found. Ask the administrator to assign your class and subject first.</p>'}
          </div>
          <div class="box"><h2>My Results</h2><div class="table-wrap"><table class="table"><tr><th>Student</th><th>Class / Subject</th><th>Year / Exam</th><th>Marks</th><th>Status</th><th>Action</th></tr>
          ${(allResults||[]).map(r=>{
            const choice=choices.find(x=>x.cs.id===r.class_subject_id&&x.assignment.academic_year_id===r.academic_year_id);
            if(!choice)return '';
            const st=studentMap.get(r.student_id);
            const editable=r.status==='draft'||approvedResultIds.has(r.id);
            return `<tr><td>${esc(st?.name||'Student')} · Roll ${esc(st?.roll??'—')}</td><td>${esc(choice.className)} · ${esc(choice.subjectName)}</td><td>${esc(choice.year)} · ${esc(r.exam_name)}</td><td>${esc(r.marks??'—')}</td><td><span class="badge">${esc(r.status)}</span></td><td>${editable?`<button type="button" class="btn-small" data-edit-result="${esc(r.id)}">Load</button>`:'Waiting for Admin-approved correction'}</td></tr>`;
          }).join('')||'<tr><td colspan="6" class="empty-admin">No results found for your assigned subjects.</td></tr>'}
          </table></div></div>
        </div>`;
        const form=document.getElementById('sbResultForm');
        const fillStudents=()=>{
            const choice=choices[Number(form.elements.choice.value)];
            form.elements.student.innerHTML=choice?`<option value="">Select student</option>${choice.students.map(st=>`<option value="${esc(st.id)}">${esc(st.student_id)} · ${esc(st.name)} · Roll ${esc(st.roll??'—')}</option>`).join('')}`:'<option value="">Select class/subject first</option>';
        };
        form.elements.choice.addEventListener('change',fillStudents);
        form.addEventListener('submit',async event=>{
            event.preventDefault();
            const choice=choices[Number(form.elements.choice.value)],student=studentMap.get(form.elements.student.value),marks=Number(form.elements.marks.value);
            if(!choice||!student)return alert('Choose an assigned class/subject and student.');
            if(!Number.isFinite(marks)||marks<0||marks>100)return alert('Marks must be between 0 and 100.');
            const existing=(allResults||[]).find(r=>r.student_id===student.id&&r.class_subject_id===choice.cs.id&&r.academic_year_id===choice.assignment.academic_year_id&&r.exam_name===form.elements.exam.value);
            if(existing&&existing.status!=='draft'&&!approvedResultIds.has(existing.id))return alert('This result is already published. Ask the administrator to approve a correction request first.');
            const grade=marks>=80?'A+':marks>=70?'A':marks>=60?'A-':marks>=50?'B':marks>=40?'C':marks>=33?'D':'F';
            const point=marks>=80?5:marks>=70?4:marks>=60?3.5:marks>=50?3:marks>=40?2:marks>=33?1:0;
            const button=form.querySelector('button[type="submit"]');button.disabled=true;
            try{
                const row={student_id:student.id,class_subject_id:choice.cs.id,academic_year_id:choice.assignment.academic_year_id,exam_name:form.elements.exam.value,marks,grade,grade_point:point,status:existing?.status==='published'?'published':'draft',published_at:existing?.published_at||null,published_by:existing?.published_by||null};
                const {error}=await sb.from('results').upsert(row,{onConflict:'student_id,class_subject_id,academic_year_id,exam_name'});
                if(error)throw error;
                alert(existing?.status==='published'?'Approved correction saved. Published result updated.':'Result saved as Draft. Admin must publish it.');
                await results();
            }catch(error){alert('Could not save result: '+(error.message||String(error)));button.disabled=false;}
        });
        box.querySelectorAll('[data-edit-result]').forEach(button=>button.addEventListener('click',()=>{
            const r=(allResults||[]).find(x=>x.id===button.dataset.editResult);
            const choice=r&&choices.find(x=>x.cs.id===r.class_subject_id&&x.assignment.academic_year_id===r.academic_year_id);
            if(!r||!choice)return;
            if(r.status!=='draft'&&!approvedResultIds.has(r.id))return alert('Published result edits require Admin approval.');
            form.elements.choice.value=String(choices.indexOf(choice));fillStudents();form.elements.student.value=r.student_id;form.elements.exam.value=r.exam_name;form.elements.marks.value=r.marks??'';
            form.querySelector('button[type="submit"]').textContent='Save Result';
            form.scrollIntoView({behavior:'smooth',block:'start'});
        }));
    }catch(error){
        box.innerHTML=`<div class="panel"><div class="box"><h2>Publish Results</h2><p class="hint">Could not load results: ${esc(error.message||String(error))}</p></div></div>`;
    }
}

async function loadAssignedStudentContext(){
 const sb=await window.mhsSupabaseReady;
 const {data:authData,error:authError}=await sb.auth.getUser();
 if(authError||!authData?.user)throw new Error('Teacher session expired. Sign in again.');
 const {data:profile,error:profileError}=await sb.from('user_profiles').select('teacher_id,role,is_active').eq('id',authData.user.id).single();
 if(profileError||profile?.role!=='teacher'||profile?.is_active!==true||!profile.teacher_id)throw new Error('Active teacher profile required.');
 const {data:assignments,error:assignmentError}=await sb.from('teacher_assignments').select('class_id,subject_id,academic_year_id').eq('teacher_id',profile.teacher_id).eq('status',true);
 if(assignmentError)throw assignmentError;
 const [{data:classesData,error:classesError},{data:subjectsData,error:subjectsError},{data:studentsData,error:studentsError}]=await Promise.all([
  sb.from('classes').select('id,name,class_number'),
  sb.from('subjects').select('id,name'),
  sb.from('students').select('id,student_id,name,roll,section,gender,guardian,mobile,status,class_id,academic_year_id,classes(name,class_number),academic_years(year,name)').eq('status',true).order('roll')
 ]);
 if(classesError)throw classesError;if(subjectsError)throw subjectsError;if(studentsError)throw studentsError;
 const allowed=new Set((assignments||[]).map(a=>a.class_id+'|'+a.academic_year_id));
 const students=(studentsData||[]).filter(st=>allowed.has(st.class_id+'|'+st.academic_year_id));
 const classMap=new Map((classesData||[]).map(x=>[x.id,x]));
 const subjectMap=new Map((subjectsData||[]).map(x=>[x.id,x]));
 const choices=(assignments||[]).map(a=>({class_id:a.class_id,academic_year_id:a.academic_year_id,subject_id:a.subject_id,className:classMap.get(a.class_id)?.name||classMap.get(a.class_id)?.class_number||'Class',subjectName:subjectMap.get(a.subject_id)?.name||'Subject'}));
 return {sb,profile,assignments:assignments||[],students,classMap,subjectMap,choices};
}

async function students(){
 const box=document.getElementById('view');
 box.innerHTML='<div class="panel"><div class="box"><h2>My Students</h2><p class="hint">Loading your assigned students from Supabase…</p></div></div>';
 try{
  const ctx=await loadAssignedStudentContext();
  box.innerHTML=`<div class="panel"><div class="box"><div class="toolbar"><h2>Students in My Assigned Classes</h2><span>${ctx.students.length} student(s)</span></div><p class="hint">Student records are read directly from Supabase and limited to your assigned class/academic-year combinations.</p><div class="table-wrap"><table class="table"><tr><th>Student ID</th><th>Name</th><th>Class / Roll</th><th>Year</th><th>Gender</th><th>Guardian / Phone</th><th>My Subjects</th></tr>
  ${ctx.students.map(st=>{const subs=ctx.choices.filter(a=>a.class_id===st.class_id&&a.academic_year_id===st.academic_year_id).map(a=>a.subjectName);return `<tr><td>${esc(st.student_id)}</td><td>${esc(st.name)}</td><td>${esc(st.classes?.class_number||st.classes?.name||'—')} / ${esc(st.roll??'—')}${st.section?'-'+esc(st.section):''}</td><td>${esc(st.academic_years?.year||st.academic_years?.name||'—')}</td><td>${esc(st.gender||'—')}</td><td>${esc(st.guardian||'—')}<br><small>${esc(st.mobile||'')}</small></td><td>${subs.map(esc).join(', ')||'—'}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty-admin">No active students found in your assigned classes.</td></tr>'}
  </table></div></div></div>`;
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>My Students</h2><p class="hint">Could not load students: ${esc(error.message||String(error))}</p></div></div>`;}
}

function notificationsPage(){
    let q=get('mhs_result_edit_requests',[]).filter(x=>x.teacher===me.username);

    view.innerHTML=`<div class="panel"><div class="box">
        <h2>Super Admin Notifications</h2>
        <p class="hint">These are older requests saved in this browser.</p>
        ${q.length?q.slice().reverse().map(x=>`<div class="teacher-request ${x.status==='resolved'?'done':'pending'}">
            <div><b>${esc(x.subject)}</b> · ${esc(x.student)} · Class ${esc(x.class)} · Roll ${esc(x.roll)} · Year ${esc(x.year)}</div>
            <p>${esc(x.reason||'Please review and update the requested result.')}</p>
            <small>${new Date(x.createdAt).toLocaleString()} · ${esc(x.status)}</small>
        </div>`).join(''):'<div class="empty-admin">No legacy notifications.</div>'}
    </div></div>`;
}

window.editMark=id=>{
    let x=get('mhs_result_edit_requests',[]).find(a=>a.id===id&&a.teacher===me.username);
    if(!x)return;

    let all=get('mhs_results',[]);
    let match=r=>String(r.class)===String(x.class)&&String(r.roll)===String(x.roll)&&String(r.year)===String(x.year);
    let i=all.findIndex(r=>match(r)&&String(r.exam||'')===String(x.exam||''));
    if(i<0)i=all.findIndex(match);
    if(i<0)return alert('Result for this student was not found.');

    editRes(i,x.subject);
};

const mhsNow=()=>new Date().toISOString();
const nrm=s=>String(s||'').trim().toLowerCase();

window.editRes=(i,sub)=>{
    let all=get('mhs_results',[]);
    let r=all[i];
    if(!r)return alert('Result not found.');

    let mine=(r.subjects||[]).filter(s=>!s.teacher||s.teacher===me.username);
    if(!mine.length)return alert('You have no subject in this result.');

    let s;

    if(sub){
        s=mine.find(a=>nrm(a.subject)===nrm(sub));
    }else{
        let c=mine.length===1?'1':prompt('Which subject? Enter number:\n'+mine.map((a,k)=>(k+1)+'. '+a.subject+' ('+a.marks+')').join('\n'));
        if(c===null)return;
        s=mine[Number(c)-1];
    }

    if(!s)return alert('Subject not found among your subjects.');

    let v=prompt(s.subject+' - '+r.name+'\nCurrent mark: '+s.marks+'\nEnter corrected mark (0-100):',s.marks);
    if(v===null)return;

    let n=Number(v);
    if(v.trim()===''||isNaN(n)||n<0||n>100)return alert('Enter a valid mark from 0 to 100.');

    s.marks=n;
    s.teacher=me.username;

    Object.assign(r,mhsBuildResult(r.subjects),{publishedAt:mhsNow()});

    let q=get('mhs_result_edit_requests',[]);
    q.forEach(x=>{
        if(x.teacher===me.username&&x.status!=='resolved'&&
            String(x.class)===String(r.class)&&
            String(x.roll)===String(r.roll)&&
            String(x.year)===String(r.year)&&
            nrm(x.subject)===nrm(s.subject)){
            x.status='resolved';
            x.resolvedAt=mhsNow();
            x.newMark=n;
        }
    });

    set('mhs_results',all);
    set('mhs_result_edit_requests',q);
    alert('Mark updated.');
    render();
};

// Supabase Result Edit Requests
async function supabaseEditRequestsPage(){
    const box=window.view||document.getElementById('view');
    if(!box)return;

    box.innerHTML=`<div class="panel">
        <div class="box">
            <h2>Supabase Result Edit Requests</h2>
            <p class="hint">Loading results assigned to your teacher account…</p>
            <div id="sbEditResults"></div>
            <h3>My Supabase Request History</h3>
            <div id="sbEditHistory"></div>
            <div class="box">
                <h3>Legacy Portal Notifications</h3>
                <p class="hint">Older requests saved in this browser only.</p>
                <div id="legacyEditRequests"></div>
            </div>
        </div>
    </div>`;

    const resultsBox=document.getElementById('sbEditResults');
    const historyBox=document.getElementById('sbEditHistory');

    try{
        if(!window.mhsSupabaseReady){
            throw new Error('Supabase client was not initialized. Check that ../js/supabase.js loads before teacher.js.');
        }

        const sb=await window.mhsSupabaseReady;
        const {data:authData,error:authError}=await sb.auth.getUser();

        if(authError)throw authError;
        if(!authData?.user){
            throw new Error('Supabase login session not found. Please log out and sign in again using your teacher account.');
        }

        const {data:profile,error:profileError}=await sb
            .from('user_profiles')
            .select('teacher_id,role,is_active')
            .eq('id',authData.user.id)
            .single();

        if(profileError)throw profileError;

        if(profile.role!=='teacher'||profile.is_active!==true||!profile.teacher_id){
            throw new Error('An active teacher profile was not found for this login.');
        }

        const {data:assignments,error:assignmentError}=await sb
            .from('teacher_assignments')
            .select('class_id,subject_id,academic_year_id')
            .eq('teacher_id',profile.teacher_id)
            .eq('status',true);

        if(assignmentError)throw assignmentError;

        const classSubjectIds=[];

        for(const a of assignments||[]){
            const {data:cs,error:csError}=await sb
                .from('class_subjects')
                .select('id')
                .eq('class_id',a.class_id)
                .eq('subject_id',a.subject_id)
                .eq('academic_year_id',a.academic_year_id);

            if(csError)throw csError;
            (cs||[]).forEach(x=>classSubjectIds.push(x.id));
        }

        const uniqueIds=[...new Set(classSubjectIds)];
        let results=[];

        if(uniqueIds.length){
            const {data,error}=await sb
                .from('results')
                .select(`
                    id,exam_name,marks,status,created_at,
                    student:students(student_id,name,roll),
                    class_subject:class_subjects(
                        class_id,
                        class:classes(name),
                        subject:subjects(name),
                        academic_year:academic_years(year)
                    )
                `)
                .in('class_subject_id',uniqueIds)
                .order('created_at',{ascending:false});

            if(error)throw error;
            results=data||[];
        }

        resultsBox.innerHTML=results.length
            ? results.map(r=>{
                const st=r.student||{};
                const cs=r.class_subject||{};
                const subject=cs.subject?.name||'Subject';
                const cl=cs.class?.name||cs.class_id||'—';
                const year=cs.academic_year?.year||'—';

                return `<div class="teacher-request pending">
                    <b>${esc(st.name||'Student')}</b>
                    · Class ${esc(cl)}
                    · Roll ${esc(st.roll??'—')}
                    <p>${esc(subject)} · ${esc(r.exam_name)} · Year ${esc(year)}</p>
                    <p>Current marks: <b>${esc(r.marks??'—')}</b></p>
                    <form class="sb-request-form" data-result-id="${esc(r.id)}">
                        <label>Reason for correction
                            <input name="reason" required maxlength="1000" placeholder="Explain why these marks need correction">
                        </label>
                        <button type="submit" class="btn-small">Request Edit</button>
                    </form>
                </div>`;
            }).join('')
            : '<p>No Supabase results were found for your assigned subjects. Check the Supabase result and teacher assignment.</p>';

        resultsBox.querySelectorAll('.sb-request-form').forEach(form=>{
            form.onsubmit=async event=>{
                event.preventDefault();

                const button=form.querySelector('button');
                button.disabled=true;

                try{
                    const reason=String(new FormData(form).get('reason')||'').trim();
                    if(!reason)throw new Error('Please enter a reason.');

                    const {error}=await sb
                        .from('result_edit_requests')
                        .insert({
                            result_id:form.dataset.resultId,
                            teacher_id:profile.teacher_id,
                            requested_by:authData.user.id,
                            reason,
                            status:'pending'
                        });

                    if(error)throw error;

                    alert('Result edit request submitted successfully.');
                    await supabaseEditRequestsPage();
                }catch(error){
                    alert('Request failed: '+(error.message||String(error)));
                    button.disabled=false;
                }
            };
        });

        const {data:requests,error:requestError}=await sb
            .from('result_edit_requests')
            .select('id,reason,status,requested_at,responded_at,response_note,result:results(exam_name,marks)')
            .eq('teacher_id',profile.teacher_id)
            .order('requested_at',{ascending:false});

        if(requestError)throw requestError;

        historyBox.innerHTML=requests?.length
            ? requests.map(q=>`<div class="teacher-request ${q.status==='approved'?'done':'pending'}">
                <b>${esc(q.result?.exam_name||'Result Edit Request')}</b>
                <p>${esc(q.reason||'')}</p>
                <p>Status: <b>${esc(q.status)}</b></p>
                <small>Submitted: ${q.requested_at?new Date(q.requested_at).toLocaleString():'—'}</small>
                ${q.responded_at?`<p>Reviewed: ${new Date(q.responded_at).toLocaleString()}</p>`:''}
                ${q.response_note?`<p>Admin note: ${esc(q.response_note)}</p>`:''}
            </div>`).join('')
            : '<p>No Supabase requests submitted yet.</p>';

        const legacy=get('mhs_result_edit_requests',[])
            .filter(x=>x.teacher===me.username);

        document.getElementById('legacyEditRequests').innerHTML=legacy.length
            ? legacy.slice().reverse().map(x=>`<div class="teacher-request ${x.status==='resolved'?'done':'pending'}">
                <b>${esc(x.subject||'Result request')}</b>
                · ${esc(x.student||'Student')}
                · Class ${esc(x.class)}
                · Roll ${esc(x.roll)}
                <p>${esc(x.reason||'')}</p>
                <small>${esc(x.status||'pending')}</small>
            </div>`).join('')
            : '<p>No legacy notifications.</p>';

    }catch(error){
        resultsBox.innerHTML=`<p class="hint">Could not load Supabase results: ${esc(error.message||String(error))}</p>`;
        historyBox.innerHTML='<p>Request history could not be loaded.</p>';
    }
}

async function classStudents(){
 const box=document.getElementById('view');
 box.innerHTML='<div class="panel"><div class="box"><h2>Class Students</h2><p class="hint">Loading assigned classes from Supabase…</p></div></div>';
 try{
  const ctx=await loadAssignedStudentContext();
  const classOptions=[...new Map(ctx.students.map(st=>[st.class_id+'|'+st.academic_year_id,{class_id:st.class_id,academic_year_id:st.academic_year_id,className:st.classes?.name||('Class '+st.classes?.class_number),classNumber:String(st.classes?.class_number??st.classes?.name??'').replace(/^class\s*/i,'').trim(),year:st.academic_years?.year||st.academic_years?.name||''}])).values()];
  const cur=window.__cs||classOptions[0]?.classNumber||'6';
  const yearSelected=window.__csYear||classOptions.find(x=>x.classNumber===String(cur))?.year||'';
  const list=ctx.students.filter(st=>String(st.classes?.class_number??String(st.classes?.name||'').replace(/^class\s*/i,''))===String(cur)&&String(st.academic_years?.year||st.academic_years?.name||'')===String(yearSelected)).sort((a,b)=>Number(a.roll)-Number(b.roll));
  const count=gender=>list.filter(st=>st.gender===gender).length;
  box.innerHTML=`<div class="panel"><div class="cards4">${classOptions.map(x=>`<div class="stat" style="cursor:pointer;${x.classNumber===String(cur)&&String(x.year)===String(yearSelected)?'outline:2px solid #0b6b4a':''}" data-class-choice="${esc(x.classNumber)}" data-year-choice="${esc(x.year)}"><b>${ctx.students.filter(st=>st.class_id===x.class_id&&st.academic_year_id===x.academic_year_id).length}</b><span>${esc(x.className)} · ${esc(x.year)}</span></div>`).join('')}</div><div class="box"><h2>${esc(list[0]?.classes?.name||('Class '+cur))} — ${esc(yearSelected)} · ${list.length} students</h2><p class="hint">Boys: ${count('Male')} · Girls: ${count('Female')} · Other: ${count('Other')}</p><div class="table-wrap"><table class="table"><tr><th>Roll</th><th>Student ID</th><th>Name</th><th>Section</th><th>Gender</th><th>Guardian Phone</th></tr>${list.map(st=>`<tr><td>${esc(st.roll??'—')}</td><td>${esc(st.student_id)}</td><td>${esc(st.name)}</td><td>${esc(st.section||'—')}</td><td>${esc(st.gender||'—')}</td><td>${esc(st.mobile||'—')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty-admin">No students in this class/year.</td></tr>'}</table></div></div></div>`;
  box.querySelectorAll('[data-class-choice]').forEach(button=>button.addEventListener('click',()=>{window.__cs=button.dataset.classChoice;window.__csYear=button.dataset.yearChoice;classStudents();}));
 }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Class Students</h2><p class="hint">Could not load class students: ${esc(error.message||String(error))}</p></div></div>`;}
}


render();

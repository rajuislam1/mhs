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

document.getElementById('logout').onclick=async()=>{
    try{const sb=await window.mhsSupabaseReady;await sb.auth.signOut();}catch(e){console.error('Teacher sign out failed:',e)}
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

function dash(){
    let r=get('mhs_results',[]).filter(x=>mhsOwn(x,me.username));
    let c=get('mhs_teacher_classes',[]).filter(x=>x.teacher===me.username);
    let rt=get('mhs_routines',[]).filter(x=>x.teacher===me.username);

    view.innerHTML=`<div class="panel">
        <div class="cards4">
            <div class="stat"><b>${r.length}</b><span>My Results</span></div>
            <div class="stat"><b>${c.length}</b><span>My Classes</span></div>
            <div class="stat"><b>${rt.length}</b><span>Routine Entries</span></div>
            <div class="stat"><b>${esc(me.subject||'—')}</b><span>Subject</span></div>
        </div>
        <div class="box">
            <h2>Welcome, ${esc(me.name)}</h2>
            <p>You can manage assigned classes, routine and subject-wise student results.</p>
            <p class="hint">When you publish another subject for the same student, the system combines it automatically by Class + Roll + Year.</p>
        </div>
    </div>`;
}

function routine(){
    let a=get('mhs_routines',[]).filter(x=>x.teacher===me.username);

    view.innerHTML=`<div class="panel">
        <div class="box">
            <h2>Add Class Routine</h2>
            <form class="form" id="rf">
                <label>Day
                    <select id="day">
                        <option>Sunday</option><option>Monday</option>
                        <option>Tuesday</option><option>Wednesday</option>
                        <option>Thursday</option><option>Friday</option>
                        <option>Saturday</option>
                    </select>
                </label>
                <label>Time<input id="time" placeholder="10:00–10:45" required></label>
                <label>Class
                    <select id="cl">
                        <option>6</option><option>7</option><option>8</option>
                        <option>9</option><option>10</option>
                    </select>
                </label>
                <label>Section<input id="sec" placeholder="A"></label>
                <label>Subject<input id="sub" value="${esc(me.subject||'')}" required></label>
                <button>Save Routine</button>
            </form>
        </div>
        <div class="box">
            <h2>My Routine</h2>
            <table class="table">
                <tr><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th></th></tr>
                ${a.map((x,i)=>`<tr>
                    <td>${esc(x.day)}</td><td>${esc(x.time)}</td>
                    <td>${esc(x.class)}-${esc(x.section||'')}</td>
                    <td>${esc(x.subject)}</td>
                    <td><button class="btn-small danger" onclick="dr(${i})">Delete</button></td>
                </tr>`).join('')||'<tr><td colspan="5" class="empty-admin">No routine added.</td></tr>'}
            </table>
        </div>
    </div>`;

    document.getElementById('rf').onsubmit=e=>{
        e.preventDefault();
        let all=get('mhs_routines',[]);
        all.push({
            teacher:me.username,
            teacherName:me.name,
            day:document.getElementById('day').value,
            time:document.getElementById('time').value,
            class:document.getElementById('cl').value,
            section:document.getElementById('sec').value,
            subject:document.getElementById('sub').value
        });
        set('mhs_routines',all);
        mhsToast('Routine updated');
        render();
    };
}

window.dr=i=>{
    let all=get('mhs_routines',[]);
    let ix=all.map((x,k)=>x.teacher===me.username?k:-1).filter(k=>k>-1)[i];
    if(ix!==undefined){
        all.splice(ix,1);
        set('mhs_routines',all);
        mhsToast('Routine updated');
        render();
    }
};

function classes(){
    let a=get('mhs_teacher_classes',[]).filter(x=>x.teacher===me.username);

    view.innerHTML=`<div class="panel">
        <div class="box">
            <h2>My Classes & Subjects</h2>
            <p class="hint">Add every class/subject you teach. These assignments become selectable subjects in Publish Results.</p>
            <form class="form" id="cf">
                <label>Class
                    <select id="cc">
                        <option value="6">6</option><option value="7">7</option>
                        <option value="8">8</option><option value="9">9</option>
                        <option value="10">10</option>
                    </select>
                </label>
                <label>Section<input id="cs" placeholder="A"></label>
                <label>Subject<input id="cx" value="${esc(me.subject||'')}" required placeholder="e.g. Biology"></label>
                <button>Add Class & Subject</button>
            </form>
        </div>
        <div class="box">
            <table class="table">
                <tr><th>Class</th><th>Section</th><th>Subject</th><th></th></tr>
                ${a.map((x,i)=>`<tr>
                    <td>${esc(x.class)}</td><td>${esc(x.section||'')}</td>
                    <td>${esc(x.subject)}</td>
                    <td><button class="btn-small danger" onclick="dc(${i})">Delete</button></td>
                </tr>`).join('')||'<tr><td colspan="4" class="empty-admin">No classes added.</td></tr>'}
            </table>
        </div>
    </div>`;

    document.getElementById('cf').onsubmit=e=>{
        e.preventDefault();
        let all=get('mhs_teacher_classes',[]);
        const cls=document.getElementById('cc').value;
        const subject=document.getElementById('cx').value.trim();

        if(all.some(x=>x.teacher===me.username&&String(x.class)===String(cls)&&String(x.subject).toLowerCase()===subject.toLowerCase())){
            return alert('This class and subject are already assigned.');
        }

        all.push({
            teacher:me.username,
            class:cls,
            section:document.getElementById('cs').value,
            subject
        });
        set('mhs_teacher_classes',all);
        mhsToast('Class list updated');
        render();
    };
}

window.dc=i=>{
    let all=get('mhs_teacher_classes',[]);
    let ix=all.map((x,k)=>x.teacher===me.username?k:-1).filter(k=>k>-1)[i];
    if(ix!==undefined){
        all.splice(ix,1);
        set('mhs_teacher_classes',all);
        mhsToast('Class list updated');
        render();
    }
};

function results(){
    mhsEnsureAcademicStructure(new Date().getFullYear());

    let own=get('mhs_results',[])
        .map((x,i)=>({...x,_i:i}))
        .filter(x=>mhsOwn(x,me.username));

    let assignments=get('mhs_teacher_classes',[])
        .filter(x=>x.teacher===me.username);

    view.innerHTML=`<div class="panel">
        <div class="box">
            <h2>Publish Student Result</h2>
            <p class="hint">Enter the registered Student ID first. Name, Class and Roll will automatically load from the Student Database.</p>
            <form class="form" id="resultForm">
                <label>Student ID<input id="rsid" inputmode="numeric" pattern="[0-9]+" maxlength="12" placeholder="Enter numeric Student ID" required></label>
                <label>Student Name<input id="rn" readonly></label>
                <label>Class<select id="rc" disabled required><option value="">Auto-loaded</option></select></label>
                <label>Roll<input id="rr" readonly></label>
                <label>Year<select id="ry"><option>2026</option><option>2027</option><option>2025</option><option>2024</option><option>2023</option></select></label>
                <label>Exam<select id="rx"><option>Half Yearly</option><option>Final Exam</option><option>Class Test</option><option>Lab Test</option></select></label>
                <div class="full" id="studentStatus"></div>
                <div class="full" id="subjectArea"><div class="subject-empty">Enter a valid Student ID to load assigned subjects.</div></div>
                <div class="full result-live" id="liveSummary"></div>
                <button id="publishBtn">Publish Result</button>
            </form>
        </div>
        <div class="box">
            <h2>My Published Results</h2>
            <div class="table-wrap">
                <table class="table">
                    <tr><th>Student ID</th><th>Student</th><th>Class</th><th>Roll</th><th>Year</th><th>Subjects</th><th>GPA</th><th>Action</th></tr>
                    ${own.map(x=>`<tr>
                        <td>${esc(x.studentId||'—')}</td><td>${esc(x.name)}</td>
                        <td>${esc(x.class)}</td><td>${esc(x.roll)}</td>
                        <td>${esc(x.year)} · ${esc(x.exam||'—')}</td>
                        <td>${(x.subjects||[]).map(s=>`${esc(s.subject)}: ${esc(s.marks)} (${esc(s.grade)})`).join('<br>')}</td>
                        <td><b>${Number(x.gpa||0).toFixed(2)}</b></td>
                        <td><button class="btn-small" onclick="mhsPrintMarksheet(get('mhs_results',[])[${x._i}])">Print</button> <button class="btn-small" onclick="editRes(${x._i})">Edit</button> <button class="btn-small danger" onclick="delRes(${x._i})">Delete</button></td>
                    </tr>`).join('')||'<tr><td colspan="8" class="empty-admin">No results published.</td></tr>'}
                </table>
            </div>
        </div>
    </div>`;

    const rc=document.getElementById('rc');
    const subjectArea=document.getElementById('subjectArea');
    const summary=document.getElementById('liveSummary');
    const status=document.getElementById('studentStatus');
    const rsid=document.getElementById('rsid');
    const rn=document.getElementById('rn');
    const rr=document.getElementById('rr');
    const ry=document.getElementById('ry');
    const rx=document.getElementById('rx');

    function loadStudent(){
        const id=rsid.value.trim();

        if(!/^\d+$/.test(id)){
            rn.value='';
            rr.value='';
            rc.innerHTML='<option value="">Auto-loaded</option>';
            subjectArea.innerHTML='<div class="subject-empty">Enter numeric Student ID.</div>';
            status.innerHTML='';
            return;
        }

        const st=get('mhs_students',[]).find(x=>String(x.studentId)===id);

        if(!st){
            rn.value='';
            rr.value='';
            rc.innerHTML='<option value="">Not found</option>';
            subjectArea.innerHTML='<div class="subject-empty">No registered student found with this Student ID.</div>';
            status.innerHTML='<span class="pill-status">Student not found</span>';
            return;
        }

        rn.value=st.name;
        rr.value=st.roll;
        rc.innerHTML='<option value="'+esc(st.class)+'">Class '+esc(st.class)+(st.section?' · '+esc(st.section):'')+'</option>';
        status.innerHTML='<span class="pill-status">Registered student loaded successfully</span>';
        loadSubjects(st);
    }

    function loadSubjects(st){
        const year=Number(ry.value||new Date().getFullYear());
        mhsEnsureAcademicStructure(year);

        const selectedIds=new Set(mhsStudentSubjects(st,year));
        const selectedNames=mhsSubjectNames([...selectedIds]);

        const mine=assignments.filter(x=>
            String(x.class)===String(st.class)&&
            selectedNames.some(n=>String(n.name).toLowerCase()===String(x.subject).toLowerCase())
        );

        subjectArea.innerHTML=mine.length
            ? `<div class="subject-grid">${mine.map(x=>{
                const existing=get('mhs_results',[]).find(r=>
                    String(r.studentId)===String(st.studentId)&&
                    String(r.year)===String(year)&&
                    String(r.exam||'')===String(rx.value)
                );
                const old=(existing?.subjects||[]).find(s=>String(s.subject).toLowerCase()===String(x.subject).toLowerCase());

                return `<label class="subject-row">
                    <input type="checkbox" class="subject-check" value="${esc(x.subject)}" ${old?'checked':''}>
                    <span><b>${esc(x.subject)}</b><small>Registered subject</small></span>
                    <input class="mark-input" type="number" min="0" max="100" placeholder="Marks" value="${old?esc(old.marks):''}" ${old?'':'disabled'}>
                </label>`;
            }).join('')}</div>`
            : '<div class="subject-empty">No subject assigned to you for this student. The Admin must assign the class subject and you must have that subject in My Classes.</div>';

        document.querySelectorAll('.subject-check').forEach(ch=>{
            ch.onchange=()=>{
                ch.closest('.subject-row').querySelector('.mark-input').disabled=!ch.checked;
                updateSummary();
            };
        });

        document.querySelectorAll('.mark-input').forEach(m=>m.oninput=updateSummary);
        updateSummary();
    }

    function updateSummary(){
        let rows=[...document.querySelectorAll('.subject-row')]
            .filter(r=>r.querySelector('.subject-check')?.checked);

        let subjects=rows.map(r=>({
            subject:r.querySelector('.subject-check').value,
            marks:r.querySelector('.mark-input').value
        })).filter(x=>x.marks!=='');

        let c=mhsBuildResult(subjects);

        summary.innerHTML=subjects.length
            ? `<b>Selected:</b> ${subjects.map(x=>`${esc(x.subject)} — ${esc(x.marks)} (${mhsGrade(x.marks).grade})`).join(' · ')}<br><b>Total:</b> ${c.total} &nbsp; <b>Average:</b> ${c.average.toFixed(2)} &nbsp; <b>GPA:</b> ${c.gpa.toFixed(2)}`
            :'';
    }

    rsid.addEventListener('input',loadStudent);
    ry.addEventListener('change',()=>{
        const st=get('mhs_students',[]).find(x=>String(x.studentId)===rsid.value.trim());
        if(st)loadSubjects(st);
    });
    rx.addEventListener('change',()=>{
        const st=get('mhs_students',[]).find(x=>String(x.studentId)===rsid.value.trim());
        if(st)loadSubjects(st);
    });

    document.getElementById('resultForm').onsubmit=e=>{
        e.preventDefault();

        const st=get('mhs_students',[]).find(x=>String(x.studentId)===rsid.value.trim());
        if(!st)return alert('Enter a valid registered numeric Student ID.');

        let rows=[...document.querySelectorAll('.subject-row')]
            .filter(r=>r.querySelector('.subject-check')?.checked);

        let subjects=rows.map(r=>({
            subject:r.querySelector('.subject-check').value,
            marks:r.querySelector('.mark-input').value
        }));

        if(!subjects.length)return alert('Select at least one subject and enter marks.');
        if(subjects.some(x=>x.marks===''||Number(x.marks)<0||Number(x.marks)>100)){
            return alert('Enter valid marks from 0 to 100 for every selected subject.');
        }

        try{
            mhsSaveStudentResult({
                studentId:st.studentId,
                year:ry.value,
                exam:rx.value,
                subjects
            },me.username);
            alert('Result published successfully.');
            render();
        }catch(err){
            alert(err.message);
        }
    };
}

window.delRes=i=>{
    if(!confirm('Delete your published subject marks for this student?'))return;

    let all=get('mhs_results',[]);
    let x=all[i];
    if(!x)return;

    x.subjects=(x.subjects||[]).filter(s=>s.teacher!==me.username);

    if(x.subjects.length)Object.assign(x,mhsBuildResult(x.subjects));
    else all.splice(i,1);

    set('mhs_results',all);
    render();
};

function students(){
    let c=get('mhs_teacher_classes',[]).filter(x=>x.teacher===me.username);
    let r=get('mhs_results',[]).filter(x=>mhsOwn(x,me.username));

    view.innerHTML=`<div class="panel">
        <div class="box">
            <h2>Student Result Records</h2>
            <table class="table">
                <tr><th>Student</th><th>Class</th><th>Roll</th><th>Year</th><th>Subjects</th><th>GPA</th></tr>
                ${r.map(x=>`<tr>
                    <td>${esc(x.name)}</td><td>${esc(x.class)}</td><td>${esc(x.roll)}</td>
                    <td>${esc(x.year)} · ${esc(x.exam||'—')}</td>
                    <td>${(x.subjects||[]).map(s=>`${esc(s.subject)}: ${esc(s.marks)} (${esc(s.grade)})`).join('<br>')}</td>
                    <td>${Number(x.gpa||0).toFixed(2)}</td>
                </tr>`).join('')||'<tr><td colspan="6" class="empty-admin">No student result records.</td></tr>'}
            </table>
        </div>
        <div class="box">
            <h2>Assigned Classes & Subjects</h2>
            ${c.map(x=>`<span class="pill-status">Class ${esc(x.class)}${x.section?' - '+esc(x.section):''} · ${esc(x.subject)}</span> `).join('')||'No classes assigned.'}
        </div>
    </div>`;
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

function classStudents(){
    const S=get('mhs_students',[]);
    const R=get('mhs_results',[]);
    const cur=window.__cs||'6';
    const list=S.filter(x=>String(x.class)===cur).sort((a,b)=>Number(a.roll)-Number(b.roll));
    const cnt=g=>list.filter(x=>x.gender===g).length;

    view.innerHTML=`<div class="panel">
        <div class="cards4">
            ${['6','7','8','9','10'].map(c=>`<div class="stat" style="cursor:pointer;${c===cur?'outline:2px solid #0b6b4a':''}" onclick="window.__cs='${c}';render()">
                <b>${S.filter(x=>String(x.class)===c).length}</b><span>Class ${c} students</span>
            </div>`).join('')}
        </div>
        <div class="box">
            <h2>Class ${esc(cur)} — ${list.length} students</h2>
            <p class="hint">Boys: ${cnt('Male')} · Girls: ${cnt('Female')} · Other: ${cnt('Other')}. Students are added by the Super Admin (Students tab).</p>
            <div class="table-wrap">
                <table class="table">
                    <tr><th>Roll</th><th>Name</th><th>Class</th><th>Section</th><th>Gender</th><th>Guardian Phone</th><th>Marks</th></tr>
                    ${list.map(x=>`<tr>
                        <td>${esc(x.roll)}</td><td>${esc(x.name)}</td><td>${esc(x.class)}</td>
                        <td>${esc(x.section||'—')}</td><td>${esc(x.gender||'—')}</td>
                        <td>${esc(x.phone||'—')}</td>
                        <td>${R.filter(r=>String(r.class)===String(x.class)&&String(r.roll)===String(x.roll)&&nrm(r.name)===nrm(x.name)).map(r=>esc(r.exam||'')+' '+esc(r.year)+': '+r.total+' (GPA '+Number(r.gpa).toFixed(2)+')').join('<br>')||'—'}</td>
                    </tr>`).join('')||'<tr><td colspan="7" class="empty-admin">No students in this class yet.</td></tr>'}
                </table>
            </div>
        </div>
    </div>`;
}

render();

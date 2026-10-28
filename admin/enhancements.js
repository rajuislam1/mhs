
/* MHS v15 Admin Enhancements - Supabase Teacher Assignments */
(function () {
  'use strict';

  const AGET = (k, f = []) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null') ?? f;
    } catch {
      return f;
    }
  };

  const ASET = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const AESC = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);

  const ACLS = ['6', '7', '8', '9', '10'];

  function searchTables() {
    document.querySelectorAll('.table-wrap').forEach(w => {
      const table = w.querySelector('table.table');

      if (!table || w.querySelector('.record-search')) return;

      const input = document.createElement('input');
      input.className = 'record-search';
      input.placeholder = 'Search records…';
      input.type = 'search';
      input.style.cssText =
        'width:100%;max-width:360px;margin:0 0 12px;padding:10px 12px;border:1px solid #d9dee5;border-radius:9px;font:inherit;box-sizing:border-box;background:#fff;';

      w.insertBefore(input, table);

      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();

        [...table.querySelectorAll('tr')].slice(1).forEach(r => {
          r.style.display =
            !q || r.innerText.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    });
  }

  window.MHS_ADMIN_SEARCH = searchTables;

  const originalRender = window.render;

  window.render = function () {
    if (typeof originalRender === 'function') originalRender();
    setTimeout(searchTables, 0);
  };

  /* =========================================================
     STUDENT SUBJECT SELECTION
     ========================================================= */

  window.studentSubjects = async function () {
  const box=app;
  box.innerHTML='<div class="panel"><div class="box"><h2>Student Subject Selection</h2><p class="hint">Loading students and academic subjects from Supabase…</p></div></div>';
  try {
    const sb=await window.mhsSupabaseReady;
    const {data:authData,error:authError}=await sb.auth.getUser();
    if(authError||!authData?.user)throw new Error('Admin session expired. Sign in again.');
    const {data:profile,error:profileError}=await sb.from('user_profiles').select('role,is_active').eq('id',authData.user.id).single();
    if(profileError||profile?.role!=='super_admin'||profile?.is_active!==true)throw new Error('Active Super Admin access is required.');
    const [{data:students,error:studentsError},{data:years,error:yearsError},{data:classesSubjects,error:csError},{data:selections,error:selectionError}] = await Promise.all([
      sb.from('students').select('id,student_id,name,roll,class_id,academic_year_id,classes(name,class_number),academic_years(year,name)').order('student_id'),
      sb.from('academic_years').select('id,year,name').order('year',{ascending:false}),
      sb.from('class_subjects').select('id,class_id,subject_id,academic_year_id,is_compulsory,classes(name,class_number),subjects(name,code),academic_years(year,name)'),
      sb.from('student_subjects').select('id,student_id,class_subject_id,is_optional')
    ]);
    if(studentsError)throw studentsError;if(yearsError)throw yearsError;if(csError)throw csError;if(selectionError)throw selectionError;
    box.innerHTML=`<div class="panel"><div class="box"><h2>Student Subject Selection</h2>
      <p class="hint">Choose the registered subjects a student studies in a selected academic year. Changes are saved to Supabase and shown in the Student Portal.</p>
      <div class="form">
       <label>Academic Year<select id="ssYear" required>${(years||[]).map(y=>`<option value="${AESC(y.id)}" ${Number(y.year)===new Date().getFullYear()?'selected':''}>${AESC(y.year||y.name)}</option>`).join('')}</select></label>
       <label>Student<select id="ssStudent" required><option value="">Select student</option>${(students||[]).map(s=>`<option value="${AESC(s.id)}">${AESC(s.student_id)} · ${AESC(s.name)} · Class ${AESC(s.classes?.class_number||s.classes?.name||'—')} / Roll ${AESC(s.roll??'—')}</option>`).join('')}</select></label>
      </div>
      <div id="ssStudentBox" style="margin-top:16px"><p class="hint">Select a student to load their class subjects.</p></div>
    </div></div>`;
    const studentSelect=document.getElementById('ssStudent'),yearSelect=document.getElementById('ssYear'),studentBox=document.getElementById('ssStudentBox');
    let selectedStudent=null;
    const load=()=>{
      const student=(students||[]).find(s=>s.id===studentSelect.value);
      const yearId=yearSelect.value;
      selectedStudent=student||null;
      if(!student){studentBox.innerHTML='<p class="hint">Select a student first.</p>';return;}
      const rows=(classesSubjects||[]).filter(cs=>cs.class_id===student.class_id&&cs.academic_year_id===yearId);
      if(!rows.length){studentBox.innerHTML='<div class="subject-empty">No subjects are configured for this student’s class in the selected academic year. Configure Academic Subjects first.</div>';return;}
      const existing=(selections||[]).filter(s=>s.student_id===student.id&&rows.some(cs=>cs.id===s.class_subject_id));
      const current=new Set(existing.map(s=>s.class_subject_id));
      studentBox.innerHTML=`<div class="box"><div class="toolbar"><div><h3>${AESC(student.name)}</h3><span>Student ID ${AESC(student.student_id)} · Class ${AESC(student.classes?.class_number||student.classes?.name||'—')} · Roll ${AESC(student.roll??'—')}</span></div><span id="ssCount">${current.size} selected</span></div>
       <div class="subject-grid">${rows.map(cs=>`<label class="subject-row"><input class="ss-sub" type="checkbox" data-id="${AESC(cs.id)}" ${current.has(cs.id)?'checked':''}><span><b>${AESC(cs.subjects?.name||cs.subjects?.code||'Subject')}</b><small>${cs.is_compulsory?'Compulsory':'Optional'} · ${AESC(cs.academic_years?.year||cs.academic_years?.name||'')}</small></span></label>`).join('')}</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" class="btn-small" id="ssComp">Select Compulsory</button><button type="button" class="btn-small" id="ssAll">Select All</button><button type="button" class="btn-small" id="ssClearOpt">Clear Optional</button><button type="button" id="ssSave">Save Subject Selection</button></div><p class="hint" id="ssState">Selections will be saved to Supabase.</p></div>`;
      const boxes=()=>[...studentBox.querySelectorAll('.ss-sub')];
      const update=()=>{document.getElementById('ssCount').textContent=boxes().filter(b=>b.checked).length+' selected';};
      boxes().forEach(b=>b.addEventListener('change',update));
      document.getElementById('ssComp').onclick=()=>{boxes().forEach(b=>{const row=rows.find(x=>x.id===b.dataset.id);if(row?.is_compulsory)b.checked=true;});update();};
      document.getElementById('ssAll').onclick=()=>{boxes().forEach(b=>b.checked=true);update();};
      document.getElementById('ssClearOpt').onclick=()=>{boxes().forEach(b=>{const row=rows.find(x=>x.id===b.dataset.id);if(row&&!row.is_compulsory)b.checked=false;});update();};
      document.getElementById('ssSave').onclick=async()=>{
        const saveButton=document.getElementById('ssSave'),ids=boxes().filter(b=>b.checked).map(b=>b.dataset.id);
        if(!ids.length)return alert('Select at least one subject.');
        saveButton.disabled=true;
        try{
          const old=existing.filter(x=>!ids.includes(x.class_subject_id));
          const newRows=ids.filter(id=>!existing.some(x=>x.class_subject_id===id)).map(id=>({student_id:student.id,class_subject_id:id,is_optional:!rows.find(cs=>cs.id===id)?.is_compulsory}));
          if(newRows.length){const {error}=await sb.from('student_subjects').insert(newRows);if(error)throw error;}
          if(old.length){const {error}=await sb.from('student_subjects').delete().in('id',old.map(x=>x.id));if(error)throw error;}
          const state=document.getElementById('ssState');state.textContent='Subject selection saved successfully to Supabase.';state.style.fontWeight='700';
          mhsToast('Student subjects saved');
        }catch(error){alert('Could not save subject selection: '+(error.message||String(error)));}
        finally{saveButton.disabled=false;}
      };
    };
    studentSelect.addEventListener('change',load);yearSelect.addEventListener('change',load);
    setTimeout(searchTables,0);
  }catch(error){box.innerHTML=`<div class="panel"><div class="box"><h2>Student Subject Selection</h2><p class="hint">Could not load subject selection: ${AESC(error.message||String(error))}</p></div></div>`;}
};

/* =========================================================
     SUPABASE HELPERS FOR TEACHER ASSIGNMENTS
     ========================================================= */

  async function getSupabaseClient() {
    const sb = window.mhsSupabase;

    if (!sb) {
      throw new Error(
        'Supabase client is not initialized. Check js/supabase.js.'
      );
    }

    if (window.mhsSupabaseReady === false) {
      throw new Error(
        'Supabase is not ready. Reload the page and try again.'
      );
    }

    return sb;
  }

  async function findUniqueRow(sb, table, columns, field, value) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .ilike(field, String(value).trim());

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        `${table}: expected exactly one match for "${value}", found ${data?.length || 0}.`
      );
    }

    return data[0];
  }

  async function resolveAssignmentIds(sb, account, classValue, subjectValue, yearValue) {
    const teacher = await findUniqueRow(
      sb, 'teachers', 'id,name', 'name', account.name
    );

    const { data: profiles, error: profileError } = await sb
      .from('user_profiles')
      .select('id,role,is_active')
      .eq('teacher_id', teacher.id)
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (profileError) throw profileError;

    if (!profiles || profiles.length !== 1) {
      throw new Error(
        'The teacher must have exactly one active Teacher Portal profile linked in Supabase.'
      );
    }

    const classRow = await findUniqueRow(
      sb, 'classes', 'id,name', 'name', `class ${classValue}`
    );

    const subjectRow = await findUniqueRow(
      sb, 'subjects', 'id,name', 'name', subjectValue
    );

    const { data: years, error: yearError } = await sb
      .from('academic_years')
      .select('id,year')
      .eq('year', Number(yearValue));

    if (yearError) throw yearError;

    if (!years || years.length !== 1) {
      throw new Error(
        `Academic Year ${yearValue} was not found uniquely in Supabase.`
      );
    }

    return {
      teacher,
      classRow,
      subjectRow,
      yearRow: years[0]
    };
  }

  /* =========================================================
     TEACHERS AND TEACHING ASSIGNMENTS
     ========================================================= */

  window.teachers = function () {
    const accounts = AGET('mhs_teacher_accounts', []);
    const profiles = AGET(
      'mhs_teachers',
      typeof TEACHERS !== 'undefined' ? TEACHERS : []
    );
    const assignments = AGET('mhs_teacher_classes', []);
    const year = new Date().getFullYear();

    if (window.mhsEnsureAcademicStructure) {
      mhsEnsureAcademicStructure(year);
    }

    const cat = AGET('mhs_subject_catalog', []);
    const classSubjects = AGET('mhs_class_subjects', []);

    const summary = u => {
      const a = assignments.filter(x => x.teacher === u);

      return a.length
        ? a.map(x =>
            `Class ${AESC(x.class)}${x.section ? '-' + AESC(x.section) : ''}: ${AESC(x.subject)}`
          ).join('<br>')
        : '<span class="hint">No teaching assignment</span>';
    };

    app.innerHTML = `
      <div class="panel">

        <div class="box">
          <h2>Create Teacher Login Account</h2>
          <p class="hint">
            Create the account first. Teaching assignments can then include
            multiple classes and multiple subjects.
          </p>

          <form class="form" id="tf">
            <label>Name<input id="tn" required></label>
            <label>Designation<input id="td" value="Teacher"></label>
            <label>Primary Subject<input id="ts" placeholder="Optional"></label>
            <label>Qualification<input id="tq"></label>
            <label>Username<input id="tu" required></label>
            <label>Password<input id="tp" type="password" required minlength="4"></label>
            <label class="full">Photo URL<input id="tphoto"></label>
            <button type="submit">Create Teacher Account</button>
          </form>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Teacher Accounts & Teaching Assignments</h2>
            <span>${accounts.length} accounts</span>
          </div>

          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Teacher</th>
                <th>Username</th>
                <th>Teaching Assignments</th>
                <th>Action</th>
              </tr>

              ${accounts.map((x, i) => `
                <tr>
                  <td>${AESC(x.name)}</td>
                  <td>${AESC(x.username)}</td>
                  <td>${summary(x.username)}</td>
                  <td>
                    <button class="btn-small" onclick="editTeacherAcc(${i})">Edit Account</button>
                    <button class="btn-small" onclick="manageTeacherAssignments(${i})">Manage Classes & Subjects</button>
                    <button class="btn-small danger" onclick="delTeacher(${i})">Delete</button>
                  </td>
                </tr>
              `).join('') || `
                <tr><td colspan="4" class="empty-admin">No teacher accounts.</td></tr>
              `}
            </table>
          </div>
        </div>

        <div class="box">
          <h2>Assign Teacher to Classes & Subjects</h2>

          <form class="form" id="assignForm">
            <label>Teacher
              <select id="atTeacher" required>
                <option value="">Select teacher</option>
                ${accounts.map(x => `
                  <option value="${AESC(x.username)}">
                    ${AESC(x.name)} · ${AESC(x.username)}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>Academic Year
              <select id="atYear">
                <option>${year}</option>
                <option>${year + 1}</option>
              </select>
            </label>

            <label>Class
              <select id="atClass">
                ${ACLS.map(c => `<option>${c}</option>`).join('')}
              </select>
            </label>

            <label>Section
              <input id="atSection" placeholder="A (optional)">
            </label>

            <label>Subject
              <select id="atSubject" required></select>
            </label>

            <button type="submit">Add Teaching Assignment</button>
          </form>

          <div id="assignmentList" style="margin-top:14px"></div>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Website Teacher Profiles</h2>
            <span>${profiles.length} teachers</span>
          </div>

          <form class="form" id="pf">
            <label>Name<input id="pn" required></label>
            <label>Designation<input id="pd" value="Teacher"></label>
            <label>Subject<input id="ps"></label>
            <label>Qualification<input id="pq"></label>
            <label class="full">Photo URL<input id="pphoto"></label>
            <button type="submit">Add Teacher to Website</button>
          </form>

          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Name</th><th>Designation</th><th>Subject</th><th>Action</th>
              </tr>

              ${profiles.map((x, i) => `
                <tr>
                  <td>${AESC(x.name)}</td>
                  <td>${AESC(x.designation)}</td>
                  <td>${AESC(x.subject)}</td>
                  <td>
                    <button class="btn-small" onclick="editPubTeacher(${i})">Edit</button>
                    <button class="btn-small danger" onclick="delPublicTeacher(${i})">Remove</button>
                  </td>
                </tr>
              `).join('') || `
                <tr><td colspan="4" class="empty-admin">No public teacher profiles.</td></tr>
              `}
            </table>
          </div>
        </div>

      </div>`;

    const updateSubjects = () => {
      const y = Number(atYear.value);
      const c = atClass.value;

      const ids = classSubjects.filter(x =>
        String(x.year) === String(y) &&
        String(x.class).replace(/^class\s*/i, '') === c
      );

      atSubject.innerHTML = ids.map(x => `
        <option value="${AESC(x.subject)}">
          ${AESC(x.subject)}${x.required === false ? ' · Optional' : ''}
        </option>
      `).join('') || '<option value="">No subjects configured</option>';
    };

    const updateAssignments = () => {
      const u = atTeacher.value;

      assignmentList.innerHTML = u
        ? `<div class="table-wrap">
            <table class="table">
              <tr><th>Class</th><th>Section</th><th>Subject</th><th></th></tr>
              ${assignments.filter(x => x.teacher === u).map((x, i) => `
                <tr>
                  <td>${AESC(x.class)}</td>
                  <td>${AESC(x.section || '—')}</td>
                  <td>${AESC(x.subject)}</td>
                  <td>
                    <button class="btn-small danger"
                      onclick="removeTeacherAssignment('${AESC(x.teacher)}',${i})">
                      Remove
                    </button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4">No assignments yet.</td></tr>'}
            </table>
          </div>`
        : '';
    };

    atTeacher.onchange = updateAssignments;
    atYear.onchange = updateSubjects;
    atClass.onchange = updateSubjects;

    updateSubjects();

    /* Supabase-backed assignment creation */
    assignForm.onsubmit = async e => {
      e.preventDefault();

      const u = atTeacher.value;
      const subject = atSubject.value;
      const cls = String(atClass.value).trim();
      const section = atSection.value.trim();
      const y = Number(atYear.value);

      if (!u || !subject) {
        alert('Select teacher and subject.');
        return;
      }

      const account = accounts.find(x => x.username === u);

      if (!account) {
        alert('Teacher account not found.');
        return;
      }

      const btn = assignForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      try {
        btn.disabled = true;
        btn.textContent = 'Saving assignment...';

        const sb = await getSupabaseClient();

        const { teacher, classRow, subjectRow, yearRow } =
          await resolveAssignmentIds(sb, account, cls, subject, y);

        /* Check duplicates without removing existing assignments. */
        const { data: existing, error: checkError } = await sb
          .from('teacher_assignments')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('class_id', classRow.id)
          .eq('subject_id', subjectRow.id)
          .eq('academic_year_id', yearRow.id)
          .eq('status', true);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
          throw new Error(
            'This teacher, class, subject and academic year are already assigned in Supabase.'
          );
        }

        const { data: inserted, error: insertError } = await sb
          .from('teacher_assignments')
          .insert({
            teacher_id: teacher.id,
            class_id: classRow.id,
            subject_id: subjectRow.id,
            academic_year_id: yearRow.id,
            status: true
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        if (!inserted?.id) {
          throw new Error('Supabase did not confirm the assignment.');
        }

        /* Update the local compatibility cache only after DB success. */
        const all = AGET('mhs_teacher_classes', []);

        const localDuplicate = all.some(x =>
          x.teacher === u &&
          String(x.class).replace(/^class\s*/i, '') === cls &&
          String(x.subject).toLowerCase() === subject.toLowerCase() &&
          Number(x.year) === y
        );

        if (!localDuplicate) {
          all.push({
            teacher: u,
            teacherName: account.name,
            class: cls,
            section,
            subject,
            year: y,
            supabaseAssignmentId: inserted.id
          });

          ASET('mhs_teacher_classes', all);
        }

        alert(
          'Teaching assignment saved successfully!\n\n' +
          'Teacher: ' + account.name + '\n' +
          'Class: ' + cls + '\n' +
          'Subject: ' + subject + '\n' +
          'Academic Year: ' + y
        );

        location.reload();

      } catch (err) {
        console.error('Teacher assignment save failed:', err);

        let message = err?.message || 'Unknown error';

        if (
          err?.code === '42501' ||
          /row-level security|permission denied/i.test(message)
        ) {
          message +=
            '\n\nSupabase rejected the insert. Check the authenticated admin session and the teacher_assignments RLS INSERT policy.';
        }

        alert('Assignment could not be saved.\n\n' + message);

      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };

    /* Create teacher account: existing localStorage workflow retained. */
    tf.onsubmit = async e => {
      e.preventDefault();

      const a = AGET('mhs_teacher_accounts', []);
      const u = tu.value.trim();

      if (a.some(x => x.username.toLowerCase() === u.toLowerCase())) {
        return alert('Username already exists.');
      }

      a.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: tn.value.trim(),
        designation: td.value.trim() || 'Teacher',
        subject: ts.value.trim(),
        qualification: tq.value.trim(),
        username: u,
        password: await mhsHash(tp.value),
        photo: tphoto.value.trim(),
        createdAt: new Date().toISOString()
      });

      ASET('mhs_teacher_accounts', a);

      alert(
        'Teacher account created. Now assign all classes and subjects from the section below.'
      );

      render();
    };

    /* Public teacher profiles: existing workflow retained. */
    pf.onsubmit = e => {
      e.preventDefault();

      const t = AGET('mhs_teachers', profiles);

      t.push({
        name: pn.value.trim(),
        designation: pd.value.trim() || 'Teacher',
        subject: ps.value.trim(),
        qualification: pq.value.trim(),
        photo: pphoto.value.trim()
      });

      ASET('mhs_teachers', t);

      alert('Teacher added to website.');
      render();
    };

    setTimeout(searchTables, 0);
  };

  /* Select a teacher in the assignment form. */
  window.manageTeacherAssignments = i => {
    const a = AGET('mhs_teacher_accounts', []);
    const x = a[i];

    if (x) {
      const sel = document.getElementById('atTeacher');

      if (sel) {
        sel.value = x.username;
        sel.dispatchEvent(new Event('change'));
        sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  /*
   * Remove only from the local compatibility register.
   * This deliberately does not delete Supabase assignments.
   */
  window.removeTeacherAssignment = (u, localIndex) => {
    const all = AGET('mhs_teacher_classes', []);
    const own = all.filter(x => x.teacher === u);
    const item = own[localIndex];
    const idx = all.indexOf(item);

    if (idx < 0) return;

    if (confirm(
      'Remove this assignment from the local register only?\n\n' +
      'This will NOT deactivate the assignment in Supabase.'
    )) {
      all.splice(idx, 1);
      ASET('mhs_teacher_classes', all);
      render();
    }
  };

})();

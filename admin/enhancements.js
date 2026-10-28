
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

  window.studentSubjects = function () {
    const year = Number(window.__subjectYear || new Date().getFullYear());

    if (window.mhsEnsureAcademicStructure) {
      mhsEnsureAcademicStructure(year);
    }

    const cat = AGET('mhs_subject_catalog', []);
    const students = window.ensureStudentIds
      ? ensureStudentIds()
      : AGET('mhs_students', []);

    app.innerHTML = `
      <div class="panel">
        <div class="box">
          <h2>Student Subject Selection</h2>
          <p class="hint">
            Search by Student ID, load the registered student, review
            the class subject structure, then select the exact subjects
            this student will study for the academic year.
          </p>

          <div class="form">
            <label>Academic Year
              <select id="ssYear">
                <option>${year}</option>
                <option>${year + 1}</option>
                <option>${year - 1}</option>
              </select>
            </label>

            <label>Student ID
              <input id="ssStudentId" inputmode="numeric"
                pattern="[0-9]+" placeholder="e.g. 100001">
            </label>

            <button type="button" id="ssSearch">Search Student</button>
          </div>

          <div id="ssStudentBox" style="margin-top:16px"></div>
        </div>
      </div>`;

    const load = () => {
      const y = Number(ssYear.value);
      const id = ssStudentId.value.trim();

      window.__subjectYear = y;

      if (!/^\d+$/.test(id)) {
        ssStudentBox.innerHTML =
          '<div class="subject-empty">Enter a numeric Student ID.</div>';
        return;
      }

      const st = students.find(x => String(x.studentId) === id);

      if (!st) {
        ssStudentBox.innerHTML =
          '<div class="subject-empty">No registered student found with this Student ID.</div>';
        return;
      }

      const master = mhsClassSubjects(y, st.class);
      const current = new Set(mhsStudentSubjects(st, y));

      if (!master.length) {
        ssStudentBox.innerHTML =
          '<div class="subject-empty">No subject structure is configured for Class ' +
          AESC(st.class) + ' in ' + y +
          '. Go to Academic Subjects first.</div>';
        return;
      }

      const selectedCount = () =>
        document.querySelectorAll('.ss-sub:checked').length;

      ssStudentBox.innerHTML = `
        <div class="box" style="margin-top:0">
          <div class="toolbar">
            <div>
              <h3>${AESC(st.name)}</h3>
              <span>Student ID: <b>${AESC(st.studentId)}</b>
              · Class ${AESC(st.class)} · Roll ${AESC(st.roll)}</span>
            </div>
            <span id="ssCount">${current.size} selected</span>
          </div>

          <div class="subject-grid">
            ${master.map(m => {
              const c = cat.find(x => x.id === m.subjectId) || {
                name: m.subjectId,
                type: m.required === false ? 'Optional' : 'Compulsory'
              };

              return `
                <label class="subject-row">
                  <input class="ss-sub" type="checkbox"
                    data-id="${AESC(m.subjectId)}"
                    ${current.has(m.subjectId) ? 'checked' : ''}>
                  <span>
                    <b>${AESC(c.name)}</b>
                    <small>${AESC(c.type || 'Compulsory')}</small>
                  </span>
                </label>`;
            }).join('')}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <button type="button" class="btn-small" id="ssComp">
              Select Compulsory
            </button>
            <button type="button" class="btn-small" id="ssAll">
              Select All
            </button>
            <button type="button" class="btn-small" id="ssClearOpt">
              Clear Optional
            </button>
            <button type="button" id="ssSave">
              Save Subject Selection
            </button>
          </div>

          <p class="hint" id="ssState" style="margin-top:10px">
            Selected subjects become the student's registered subjects for ${y}.
          </p>
        </div>`;

      const boxes = () => [...document.querySelectorAll('.ss-sub')];

      const update = () => {
        ssCount.textContent = selectedCount() + ' selected';
      };

      boxes().forEach(b => b.onchange = update);

      ssComp.onclick = () => {
        boxes().forEach(b => {
          const m = master.find(x => x.subjectId === b.dataset.id);
          if (m?.required !== false) b.checked = true;
        });
        update();
      };

      ssAll.onclick = () => {
        boxes().forEach(b => b.checked = true);
        update();
      };

      ssClearOpt.onclick = () => {
        boxes().forEach(b => {
          const m = master.find(x => x.subjectId === b.dataset.id);
          if (m?.required === false) b.checked = false;
        });
        update();
      };

      ssSave.onclick = () => {
        const ids = boxes().filter(b => b.checked).map(b => b.dataset.id);

        if (!ids.length) return alert('Select at least one subject.');

        const all = AGET('mhs_students', []);
        const target = all.find(x => String(x.studentId) === id);

        if (!target) return;

        target.subjectSelections =
          Array.isArray(target.subjectSelections)
            ? target.subjectSelections.filter(x => String(x.year) !== String(y))
            : [];

        target.subjectSelections.push({
          year: y,
          class: String(target.class),
          subjects: ids,
          updatedAt: new Date().toISOString()
        });

        ASET('mhs_students', all);

        ssState.textContent = '✓ Subject selection saved successfully.';
        ssState.style.fontWeight = '700';

        alert('Student subject selection saved.');
      };
    };

    ssSearch.onclick = load;

    ssStudentId.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        load();
      }
    };

    ssYear.onchange = () => {
      window.__subjectYear = Number(ssYear.value);
      if (ssStudentId.value.trim()) load();
    };

    setTimeout(searchTables, 0);
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

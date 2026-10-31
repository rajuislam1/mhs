```javascript
/* MHS V17 — Supabase Teacher Accounts, Public Profiles & Assignments */
(function () {
  'use strict';

  // Legacy browser cache intentionally disabled. Supabase is the only source of truth.
  const read = (_key, fallback = []) => fallback;
  const write = (_key, _value) => {};

  const escTeacher = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[ch]);

  const getSupabase = async () => {
    if (!window.mhsSupabaseReady) {
      throw new Error('Supabase connection is not configured.');
    }

    const sb = await window.mhsSupabaseReady;

    if (!sb) {
      throw new Error('Supabase client is unavailable.');
    }

    return sb;
  };

  async function getAdminToken() {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    const token = data.session?.access_token;

    if (!token) {
      throw new Error('Please sign in again.');
    }

    return token;
  }

  async function apiRequest(url, method = 'GET', body = null) {
    const token = await getAdminToken();

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body !== null) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('Invalid server response. Check the Vercel deployment.');
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Request failed.');
    }

    return result;
  }

  const teacherApi = (method, body) =>
    apiRequest('/api/manage-teacher', method, body);

  const publicTeacherApi = (method, body) =>
    apiRequest('/api/manage-public-teacher', method, body);

  function showError(message, error) {
    console.error(message, error);
    alert(error?.message || message);
  }

  function findAccount(id) {
    return (window.mhsSupabaseTeachers || []).find(x => x.id === id);
  }

  // --------------------------------------------------
  // Edit teacher login account
  // --------------------------------------------------
  window.editSupabaseTeacher = async function (id) {
    const teacher = findAccount(id);

    if (!teacher) {
      alert('Teacher record not found. Reload and try again.');
      return;
    }

    const name = prompt('Teacher Name:', teacher.name || '');
    if (name === null) return;
    if (!name.trim()) return alert('Teacher name cannot be empty.');

    const designation = prompt('Designation:', teacher.designation || 'Teacher');
    if (designation === null) return;

    const subject = prompt('Primary Subject:', teacher.subject || '');
    if (subject === null) return;

    const qualification = prompt('Qualification:', teacher.qualification || '');
    if (qualification === null) return;

    const mobile = prompt('Mobile Number:', teacher.mobile || '');
    if (mobile === null) return;

    const photo = prompt('Photo URL:', teacher.photo || '');
    if (photo === null) return;

    try {
      await teacherApi('PATCH', {
        id,
        name: name.trim(),
        designation: designation.trim(),
        subject: subject.trim(),
        qualification: qualification.trim(),
        mobile: mobile.trim(),
        photo: photo.trim()
      });

      alert('Teacher details updated successfully.');
      await window.teachers();
    } catch (error) {
      showError('Could not update teacher.', error);
    }
  };

  // --------------------------------------------------
  // Deactivate teacher account
  // --------------------------------------------------
  window.activateSupabaseTeacher = async function (id) {
    const teacher = findAccount(id);
    if (!teacher) return alert('Teacher record not found. Reload and try again.');
    if (!confirm('Reactivate ' + teacher.name + ' account?')) return;
    try { await teacherApi('PATCH', { id, status: true }); alert('Teacher account reactivated.'); await window.teachers(); }
    catch (error) { showError('Could not reactivate teacher.', error); }
  };

  window.deactivateSupabaseTeacher = async function (id) {
    const teacher = findAccount(id);

    if (!teacher) {
      alert('Teacher record not found. Reload and try again.');
      return;
    }

    if (!confirm(
      `Deactivate ${teacher.name}?\n\n` +
      'This disables the teacher account without permanently deleting it.'
    )) return;

    try {
      await teacherApi('DELETE', { id });
      alert('Teacher account deactivated successfully.');
      await window.teachers();
    } catch (error) {
      showError('Could not deactivate teacher.', error);
    }
  };

  // --------------------------------------------------
  // Edit public teacher profile
  // --------------------------------------------------
  window.editSupabasePublicTeacher = async function (id) {
    const teacher = (window.mhsPublicTeachers || []).find(x => x.id === id);

    if (!teacher) {
      alert('Public teacher profile not found. Reload and try again.');
      return;
    }

    const name = prompt('Teacher Name:', teacher.name || '');
    if (name === null) return;
    if (!name.trim()) return alert('Teacher name cannot be empty.');

    const designation = prompt('Designation:', teacher.designation || 'Teacher');
    if (designation === null) return;

    const subject = prompt('Subject:', teacher.subject || '');
    if (subject === null) return;

    const qualification = prompt('Qualification:', teacher.qualification || '');
    if (qualification === null) return;

    const photo = prompt('Photo URL:', teacher.photo || '');
    if (photo === null) return;

    try {
      await publicTeacherApi('PATCH', {
        id,
        name: name.trim(),
        designation: designation.trim() || 'Teacher',
        subject: subject.trim(),
        qualification: qualification.trim(),
        photo: photo.trim()
      });

      alert('Public teacher profile updated successfully.');
      await window.teachers();
    } catch (error) {
      showError('Could not update public teacher profile.', error);
    }
  };

  window.removeSupabasePublicTeacher = async function (id) {
    const teacher = (window.mhsPublicTeachers || []).find(x => x.id === id);

    if (!teacher) {
      alert('Public teacher profile not found. Reload and try again.');
      return;
    }

    if (!confirm(
      `Remove ${teacher.name} from the public website?\n\n` +
      'The record will be unpublished, not permanently deleted.'
    )) return;

    try {
      await publicTeacherApi('DELETE', { id });
      alert('Teacher profile removed from the public website.');
      await window.teachers();
    } catch (error) {
      showError('Could not remove public teacher profile.', error);
    }
  };

  // --------------------------------------------------
  // Supabase helpers for assignments
  // --------------------------------------------------
  async function getActiveAdmin(sb) {
    const { data: authData, error: authError } = await sb.auth.getUser();

    if (authError) throw authError;

    const user = authData?.user;

    if (!user) {
      throw new Error('Please sign in again.');
    }

    const { data: profile, error } = await sb
      .from('user_profiles')
      .select('id,role,is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (
      !profile ||
      profile.role !== 'super_admin' ||
      profile.is_active !== true
    ) {
      throw new Error(
        'Active Super Admin permission required to manage assignments.'
      );
    }

    return user;
  }

  async function getAssignmentOptions(sb) {
    const [
      teachersResult,
      classesResult,
      subjectsResult,
      yearsResult
    ] = await Promise.all([
      sb.from('teachers')
        .select('id,teacher_id,name,username,status')
        .order('name'),
      sb.from('classes')
        .select('id,name')
        .order('name'),
      sb.from('subjects')
        .select('id,name')
        .order('name'),
      sb.from('academic_years')
        .select('id,year')
        .order('year', { ascending: false })
    ]);

    for (const result of [
      teachersResult, classesResult, subjectsResult, yearsResult
    ]) {
      if (result.error) throw result.error;
    }

    return {
      teachers: teachersResult.data || [],
      classes: classesResult.data || [],
      subjects: subjectsResult.data || [],
      years: yearsResult.data || []
    };
  }

  async function getAssignments(sb, teacherId = null) {
    let query = sb
      .from('teacher_assignments')
      .select(`
        id,
        teacher_id,
        class_id,
        subject_id,
        academic_year_id,
        status
      `)
      .order('id', { ascending: false });

    if (teacherId) query = query.eq('teacher_id', teacherId);

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  function assignmentLabel(row, options) {
    const teacher = options.teachers.find(x => x.id === row.teacher_id);
    const classRow = options.classes.find(x => x.id === row.class_id);
    const subject = options.subjects.find(x => x.id === row.subject_id);
    const year = options.years.find(x => x.id === row.academic_year_id);

    return {
      id: row.id,
      teacher: teacher?.username || teacher?.name || row.teacher_id,
      teacherName: teacher?.name || 'Teacher',
      class: classRow?.name || 'Unknown class',
      subject: subject?.name || 'Unknown subject',
      year: year?.year ?? '',
      status: row.status
    };
  }

  async function refreshAssignmentCache(sb, options) {
    const rows = await getAssignments(sb);
    const cache = rows.map(row => assignmentLabel(row, options));

    write('mhs_teacher_classes', cache);
    return rows;
  }

  // --------------------------------------------------
  // Main Teacher Management screen
  // --------------------------------------------------
  window.teachers = async function () {
    let accounts = read('mhs_teacher_accounts');
    let profiles = [];

    let accountLoadError = '';
    let publicProfileLoadError = '';
    let assignmentLoadError = '';

    const year = new Date().getFullYear();
    let options = {
      teachers: [],
      classes: [],
      subjects: [],
      years: []
    };

    let assignmentRows = [];

    if (window.mhsEnsureAcademicStructure) {
      window.mhsEnsureAcademicStructure(year);
    }

    // Load teacher login accounts.
    try {
      const result = await teacherApi('GET');

      accounts = Array.isArray(result.teachers) ? result.teachers : [];
      window.mhsSupabaseTeachers = accounts;

      write('mhs_teacher_accounts', accounts.map(x => ({
        id: x.id,
        name: x.name,
        designation: x.designation,
        subject: x.subject,
        qualification: x.qualification,
        username: x.username,
        email: x.email,
        photo: x.photo,
        status: x.status
      })));
    } catch (error) {
      console.error('Teacher account load error:', error);
      accountLoadError = error.message || 'Could not load teacher accounts.';
      accounts = read('mhs_teacher_accounts');
      window.mhsSupabaseTeachers = [];
    }

    // Load public profiles.
    try {
      const result = await publicTeacherApi('GET');
      profiles = Array.isArray(result.teachers) ? result.teachers : [];
      window.mhsPublicTeachers = profiles;
    } catch (error) {
      console.error('Public teacher profile load error:', error);
      publicProfileLoadError = error.message || 'Could not load public profiles.';
      profiles = [];
      window.mhsPublicTeachers = [];
    }

    // Load assignment data from Supabase.
    let sb = null;

    try {
      sb = await getSupabase();
      await getActiveAdmin(sb);
      options = await getAssignmentOptions(sb);
      assignmentRows = await getAssignments(sb);
    } catch (error) {
      console.error('Assignment load error:', error);
      assignmentLoadError = error.message || 'Could not load assignments.';
    }

    const legacyAssignments = [];

    const publicProfileRows = profiles.map(x => {
      const isDatabaseProfile = Boolean(
        x.id && window.mhsPublicTeachers?.some(t => t.id === x.id)
      );

      const action = isDatabaseProfile
        ? `
          <button type="button" class="btn-small"
            onclick="editSupabasePublicTeacher('${escTeacher(x.id)}')">Edit</button>
          <button type="button" class="btn-small danger"
            onclick="removeSupabasePublicTeacher('${escTeacher(x.id)}')">Remove</button>
        `
        : '<span class="hint">Legacy browser-only profile</span>';

      return `
        <tr>
          <td>${escTeacher(x.name)}</td>
          <td>${escTeacher(x.designation || 'Teacher')}</td>
          <td>${escTeacher(x.subject || '—')}</td>
          <td>${action}</td>
        </tr>
      `;
    }).join('');

    const assignmentSummary = username => {
      const account = accounts.find(x => x.username === username);
      const teacherId = account?.teacher_id ||
        options.teachers.find(x => x.username === username)?.teacher_id ||
        options.teachers.find(x => x.username === username)?.id;

      const rows = assignmentRows.filter(x =>
        x.teacher_id === teacherId
      );

      if (rows.length) {
        return rows.map(row => {
          const label = assignmentLabel(row, options);
          return `Class ${escTeacher(label.class)}: ${escTeacher(label.subject)} (${escTeacher(label.year)})`;
        }).join('<br>');
      }

      // Display legacy assignments only when Supabase could not load.
      if (assignmentLoadError) {
        const oldRows = legacyAssignments.filter(x => x.teacher === username);
        if (oldRows.length) {
          return oldRows.map(x =>
            `Class ${escTeacher(x.class)}: ${escTeacher(x.subject)}`
          ).join('<br>');
        }
      }

      return '<span class="hint">No teaching assignment</span>';
    };

    app.innerHTML = `
      <div class="panel">

        <div class="box">
          <h2>Create Teacher Login Account</h2>
          <p class="hint">
            Login accounts are created in Supabase Auth.
            Passwords are not stored in browser localStorage.
          </p>

          <form class="form" id="tf">
            <label>Teacher Name
              <input id="tn" required>
            </label>
            <label>Designation
              <input id="td" value="Teacher">
            </label>
            <label>Primary Subject
              <input id="ts" placeholder="e.g. Mathematics">
            </label>
            <label>Qualification
              <input id="tq" placeholder="Optional">
            </label>
            <label>Username
              <input id="tu" required minlength="3" maxlength="40"
                pattern="[A-Za-z0-9._-]{3,40}">
            </label>
            <label>Personal Email
              <input id="te" type="email" required>
            </label>
            <label>Password
              <input id="tp" type="password" required minlength="8"
                autocomplete="new-password">
            </label>
            <label>Mobile Number
              <input id="tmobile" type="tel" placeholder="Optional">
            </label>
            <label>Photo URL
              <input id="tphoto" placeholder="Optional">
            </label>
            <button type="submit" id="createTeacherBtn">Create Teacher Account</button>
            <p id="teacherCreateMessage" class="hint" role="status" aria-live="polite"></p>
          </form>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Teacher Accounts & Teaching Assignments</h2>
            <span>${accounts.length} accounts</span>
          </div>

          ${accountLoadError ? `
            <p class="hint">Could not refresh accounts: ${escTeacher(accountLoadError)}</p>
          ` : ''}

          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Teacher</th><th>Username</th><th>Email</th>
                <th>Status</th><th>Teaching Assignments</th><th>Action</th>
              </tr>
              ${accounts.map((x, i) => {
                const isActive = x.status === true;
                const isDatabaseAccount = Boolean(
                  x.id && window.mhsSupabaseTeachers?.some(t => t.id === x.id)
                );

                return `
                  <tr>
                    <td>${escTeacher(x.name)}</td>
                    <td>${escTeacher(x.username)}</td>
                    <td>${escTeacher(x.email || '—')}</td>
                    <td>${isActive ? 'Active' : 'Inactive'}</td>
                    <td>${assignmentSummary(x.username)}</td>
                    <td>
                      ${isDatabaseAccount ? `
                        <button type="button" class="btn-small"
                          onclick="editSupabaseTeacher('${escTeacher(x.id)}')">Edit</button>
                        ${isActive ? `
                          <button type="button" class="btn-small danger"
                            onclick="deactivateSupabaseTeacher('${escTeacher(x.id)}')">Deactivate</button>
                        ` : `
                          <button type="button" class="btn-small"
                            onclick="activateSupabaseTeacher('${escTeacher(x.id)}')">Reactivate</button>
                        `}
                      ` : '<span class="hint">Legacy account</span>'}
                      <button type="button" class="btn-small"
                        onclick="manageTeacherAssignments(${i})">Manage Classes & Subjects</button>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="6">No teacher accounts.</td></tr>'}
            </table>
          </div>
          <p class="hint">Deactivated accounts remain in the database.</p>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Assign Teacher to Classes & Subjects</h2>
          </div>

          ${assignmentLoadError ? `
            <p class="hint" role="alert">
              Supabase assignment load error: ${escTeacher(assignmentLoadError)}
            </p>
          ` : ''}

          <form class="form" id="assignForm">
            <label>Teacher
              <select id="atTeacher" required>
                <option value="">Select teacher</option>
                ${options.teachers.filter(t => t.status !== false).map(t => `
                  <option value="${escTeacher(t.id)}">
                    ${escTeacher(t.name)}${t.username ? ' · ' + escTeacher(t.username) : ''}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>Academic Year
              <select id="atYear" required>
                ${options.years.map(y => `
                  <option value="${escTeacher(y.id)}"
                    ${Number(y.year) === year ? 'selected' : ''}>
                    ${escTeacher(y.year)}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>Class
              <select id="atClass" required>
                ${options.classes.map(c => `
                  <option value="${escTeacher(c.id)}">${escTeacher(c.name)}</option>
                `).join('')}
              </select>
            </label>

            <label>Subject
              <select id="atSubject" required>
                <option value="">Select subject</option>
                ${options.subjects.map(s => `
                  <option value="${escTeacher(s.id)}">${escTeacher(s.name)}</option>
                `).join('')}
              </select>
            </label>

            <button type="submit" id="saveAssignmentBtn">Save Teaching Assignment</button>
            <p id="assignmentMessage" class="hint" role="status" aria-live="polite"></p>
          </form>

          <div id="assignmentList" style="margin-top:14px"></div>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Website Teacher Profiles</h2>
            <span>${profiles.length} teachers</span>
          </div>

          <p class="hint">
            Public website profiles are separate from teacher login accounts.
          </p>

          ${publicProfileLoadError ? `
            <p class="hint">Could not load Supabase profiles: ${escTeacher(publicProfileLoadError)}</p>
          ` : ''}

          <form class="form" id="pf">
            <label>Name<input id="pn" required></label>
            <label>Designation<input id="pd" value="Teacher"></label>
            <label>Subject<input id="ps"></label>
            <label>Qualification<input id="pq"></label>
            <label class="full">Photo URL<input id="pphoto" placeholder="Optional"></label>
            <button type="submit" id="addPublicTeacherBtn">Add Teacher to Website</button>
          </form>

          <div class="table-wrap">
            <table class="table">
              <tr><th>Name</th><th>Designation</th><th>Subject</th><th>Action</th></tr>
              ${publicProfileRows || '<tr><td colspan="4">No public teacher profiles.</td></tr>'}
            </table>
          </div>
        </div>

      </div>
    `;

    // Create teacher login account.
    const form = document.getElementById('tf');
    const message = document.getElementById('teacherCreateMessage');
    const createButton = document.getElementById('createTeacherBtn');

    form.onsubmit = async event => {
      event.preventDefault();

      const payload = {
        name: document.getElementById('tn').value.trim(),
        designation: document.getElementById('td').value.trim() || 'Teacher',
        subject: document.getElementById('ts').value.trim(),
        qualification: document.getElementById('tq').value.trim(),
        username: document.getElementById('tu').value.trim(),
        email: document.getElementById('te').value.trim().toLowerCase(),
        password: document.getElementById('tp').value,
        mobile: document.getElementById('tmobile').value.trim(),
        photo: document.getElementById('tphoto').value.trim()
      };

      if (payload.password.length < 8) {
        message.textContent = 'Password must contain at least 8 characters.';
        return;
      }

      createButton.disabled = true;
      message.textContent = 'Creating teacher account...';

      try {
        const token = await getAdminToken();
        const response = await fetch('/api/create-teacher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Could not create teacher account.');
        }

        document.getElementById('tp').value = '';
        alert('Teacher account created successfully.');
        await window.teachers();
      } catch (error) {
        console.error('Teacher account creation error:', error);
        message.textContent = error.message || 'Account creation failed.';
      } finally {
        createButton.disabled = false;
      }
    };

    // Add public profile.
    const publicForm = document.getElementById('pf');
    const publicButton = document.getElementById('addPublicTeacherBtn');

    publicForm.onsubmit = async event => {
      event.preventDefault();

      const payload = {
        name: document.getElementById('pn').value.trim(),
        designation: document.getElementById('pd').value.trim() || 'Teacher',
        subject: document.getElementById('ps').value.trim(),
        qualification: document.getElementById('pq').value.trim(),
        photo: document.getElementById('pphoto').value.trim()
      };

      if (!payload.name) return alert('Teacher name is required.');

      publicButton.disabled = true;
      publicButton.textContent = 'Saving...';

      try {
        await publicTeacherApi('POST', payload);
        alert('Teacher profile saved to Supabase successfully.');
        await window.teachers();
      } catch (error) {
        showError('Could not save public teacher profile.', error);
      } finally {
        publicButton.disabled = false;
        publicButton.textContent = 'Add Teacher to Website';
      }
    };

    // Render assignments from Supabase.
    const renderAssignmentList = () => {
      const username = document.getElementById('atTeacher').value;
      const target = document.getElementById('assignmentList');

      if (!username) {
        target.innerHTML = '';
        return;
      }

      const list = assignmentRows
        .filter(row => row.teacher_id === username)
        .map(row => assignmentLabel(row, options));

      target.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <tr><th>Academic Year</th><th>Class</th><th>Subject</th><th>Status</th></tr>
            ${list.map(row => `
              <tr>
                <td>${escTeacher(row.year)}</td>
                <td>${escTeacher(row.class)}</td>
                <td>${escTeacher(row.subject)}</td>
                <td>${row.status === true ? 'Active' : 'Inactive'}</td>
              </tr>
            `).join('') ||
              '<tr><td colspan="4">No assignments yet.</td></tr>'}
          </table>
        </div>
      `;
    };

    // SAVE ASSIGNMENT TO SUPABASE.
    const assignForm = document.getElementById('assignForm');
    const saveButton = document.getElementById('saveAssignmentBtn');
    const assignMessage = document.getElementById('assignmentMessage');

    assignForm.onsubmit = async event => {
      event.preventDefault();

      saveButton.disabled = true;
      assignMessage.textContent = 'Saving assignment to Supabase...';

      try {
        const client = await getSupabase();
        await getActiveAdmin(client);

        const teacherId = document.getElementById('atTeacher').value;
        const classId = document.getElementById('atClass').value;
        const subjectId = document.getElementById('atSubject').value;
        const yearId = document.getElementById('atYear').value;

        if (!teacherId || !classId || !subjectId || !yearId) {
          throw new Error('Select teacher, academic year, class and subject.');
        }

        // Ensure the teacher account is linked to an active teacher profile.
        const teacher = options.teachers.find(t => t.id === teacherId);

        if (!teacher) {
          throw new Error('Selected teacher was not found in Supabase.');
        }

        const linkedTeacherId = teacher.teacher_id || teacher.id;

        const { data: profile, error: profileError } = await client
          .from('user_profiles')
          .select('id,role,is_active,teacher_id')
          .eq('teacher_id', linkedTeacherId)
          .eq('role', 'teacher')
          .eq('is_active', true)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          throw new Error(
            'This teacher has no active linked login profile. ' +
            'Check the teachers.teacher_id and user_profiles.teacher_id values.'
          );
        }

        // Check duplicate in Supabase.
        const { data: duplicates, error: duplicateError } = await client
          .from('teacher_assignments')
          .select('id')
          .eq('teacher_id', linkedTeacherId)
          .eq('class_id', classId)
          .eq('subject_id', subjectId)
          .eq('academic_year_id', yearId);

        if (duplicateError) throw duplicateError;

        if (duplicates?.length) {
          throw new Error('This teacher assignment already exists in Supabase.');
        }

        const { data: insertedRows, error: insertError } = await client
          .from('teacher_assignments')
          .insert([{
            teacher_id: linkedTeacherId,
            class_id: classId,
            subject_id: subjectId,
            academic_year_id: yearId,
            status: true
          }])
          .select('id,teacher_id,class_id,subject_id,academic_year_id,status');

        if (insertError) throw insertError;

        if (!insertedRows?.length) {
          throw new Error(
            'Supabase did not confirm the assignment. Check table permissions.'
          );
        }

        assignmentRows = await getAssignments(client);
        await refreshAssignmentCache(client, options);

        assignMessage.textContent =
          'Assignment saved successfully to Supabase.';

        alert('Teaching assignment saved successfully to Supabase.');
        renderAssignmentList();

        // Refresh summary and list without losing the selected form values.
        const selectedTeacher = document.getElementById('atTeacher').value;
        await window.teachers();

        const teacherSelect = document.getElementById('atTeacher');
        if (teacherSelect) {
          teacherSelect.value = selectedTeacher;
          teacherSelect.dispatchEvent(new Event('change'));
        }
      } catch (error) {
        console.error('Supabase assignment save error:', error);
        assignMessage.textContent = error.message || 'Could not save assignment.';
        alert('Assignment was not saved:\n' + (
          error.message || 'Unknown Supabase error.'
        ));
      } finally {
        saveButton.disabled = false;
      }
    };

    document.getElementById('atTeacher').addEventListener(
      'change',
      renderAssignmentList
    );

    renderAssignmentList();

    if (window.MHS_ADMIN_SEARCH) {
      setTimeout(window.MHS_ADMIN_SEARCH, 0);
    }
  };
})();
```

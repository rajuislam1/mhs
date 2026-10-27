
/* MHS V15 — Supabase Teacher Account Management */
(function () {
  'use strict';

  const read = (key, fallback = []) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  const escTeacher = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[ch]);

  async function getAdminToken() {
    if (!window.mhsSupabaseReady) {
      throw new Error('Supabase connection is not configured.');
    }

    const supabase = await window.mhsSupabaseReady;
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    const token = data.session?.access_token;

    if (!token) {
      throw new Error('Admin session expired. Please sign in again.');
    }

    return token;
  }

  async function teacherApi(method, body) {
    const token = await getAdminToken();

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch('/api/manage-teacher', options);

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('Invalid server response. Check the Vercel deployment.');
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Teacher operation failed.');
    }

    return result;
  }

  window.editSupabaseTeacher = async function (id) {
    const accounts = window.mhsSupabaseTeachers || [];
    const teacher = accounts.find(x => x.id === id);

    if (!teacher) {
      alert('Teacher record not found. Reload the page and try again.');
      return;
    }

    const name = prompt('Teacher Name:', teacher.name || '');
    if (name === null) return;

    if (!name.trim()) {
      alert('Teacher name cannot be empty.');
      return;
    }

    const designation = prompt(
      'Designation:',
      teacher.designation || 'Teacher'
    );
    if (designation === null) return;

    const subject = prompt('Primary Subject:', teacher.subject || '');
    if (subject === null) return;

    const qualification = prompt(
      'Qualification:',
      teacher.qualification || ''
    );
    if (qualification === null) return;

    const mobile = prompt('Mobile Number:', teacher.mobile || '');
    if (mobile === null) return;

    const photo = prompt('Photo URL:', teacher.photo || '');
    if (photo === null) return;

    try {
      await teacherApi('PATCH', {
        id: teacher.id,
        name: name.trim(),
        designation: designation.trim(),
        subject: subject.trim(),
        qualification: qualification.trim(),
        mobile: mobile.trim(),
        photo: photo.trim()
      });

      alert('Teacher details updated successfully.');
      render();
    } catch (error) {
      console.error('Teacher edit error:', error);
      alert(error.message || 'Could not update teacher.');
    }
  };

  window.deactivateSupabaseTeacher = async function (id) {
    const teacher = (window.mhsSupabaseTeachers || [])
      .find(x => x.id === id);

    if (!teacher) {
      alert('Teacher record not found. Reload the page and try again.');
      return;
    }

    if (!confirm(
      `Deactivate ${teacher.name}?\n\n` +
      'This will disable the teacher profile. The record will not be permanently deleted.'
    )) {
      return;
    }

    try {
      await teacherApi('DELETE', { id: teacher.id });
      alert('Teacher account deactivated successfully.');
      render();
    } catch (error) {
      console.error('Teacher deactivation error:', error);
      alert(error.message || 'Could not deactivate teacher.');
    }
  };

  window.teachers = async function () {
    let accounts = read('mhs_teacher_accounts');
    let accountLoadError = '';

    const profiles = read(
      'mhs_teachers',
      typeof TEACHERS !== 'undefined' ? TEACHERS : []
    );

    const assignments = read('mhs_teacher_classes');
    const year = new Date().getFullYear();
    const classes = ['6', '7', '8', '9', '10'];

    if (window.mhsEnsureAcademicStructure) {
      window.mhsEnsureAcademicStructure(year);
    }

    const subjects = read('mhs_class_subjects');

    // Load the authoritative teacher account list from Supabase.
    try {
      const result = await teacherApi('GET');
      accounts = Array.isArray(result.teachers)
        ? result.teachers
        : [];

      window.mhsSupabaseTeachers = accounts;

      // Keep the legacy local cache for existing assignment features.
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
      console.error('Teacher list load error:', error);
      accountLoadError = error.message || 'Could not load teacher accounts.';
      accounts = read('mhs_teacher_accounts');
      window.mhsSupabaseTeachers = [];
    }

    const assignmentSummary = username => {
      const list = assignments.filter(x => x.teacher === username);

      return list.length
        ? list.map(x =>
            `Class ${escTeacher(x.class)}` +
            `${x.section ? '-' + escTeacher(x.section) : ''}: ` +
            `${escTeacher(x.subject)}`
          ).join('<br>')
        : '<span class="hint">No teaching assignment</span>';
    };

    app.innerHTML = `
      <div class="panel">
        <div class="box">
          <h2>Create Teacher Login Account</h2>
          <p class="hint">
            Teacher login accounts are created in Supabase Auth.
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
              <input id="tu" required minlength="3"
                maxlength="40" pattern="[A-Za-z0-9._-]{3,40}">
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
            <button type="submit" id="createTeacherBtn">
              Create Teacher Account
            </button>
            <p id="teacherCreateMessage" class="hint"
              role="status" aria-live="polite"></p>
          </form>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Teacher Accounts & Teaching Assignments</h2>
            <span>${accounts.length} accounts</span>
          </div>

          ${accountLoadError ? `
            <p class="hint" role="status">
              Could not refresh accounts from Supabase:
              ${escTeacher(accountLoadError)}
              The displayed legacy list may be outdated.
            </p>
          ` : ''}

          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Teacher</th>
                <th>Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>Teaching Assignments</th>
                <th>Action</th>
              </tr>
              ${accounts.map(x => {
                const isActive = x.status === true;

                return `
                  <tr>
                    <td>${escTeacher(x.name)}</td>
                    <td>${escTeacher(x.username)}</td>
                    <td>${escTeacher(x.email || '—')}</td>
                    <td>${isActive ? 'Active' : 'Inactive'}</td>
                    <td>${assignmentSummary(x.username)}</td>
                    <td>
                      ${x.id && window.mhsSupabaseTeachers?.some(t => t.id === x.id) ? `
                        <button type="button" class="btn-small"
                          onclick="editSupabaseTeacher('${escTeacher(x.id)}')">
                          Edit
                        </button>
                        ${isActive ? `
                          <button type="button" class="btn-small danger"
                            onclick="deactivateSupabaseTeacher('${escTeacher(x.id)}')">
                            Deactivate
                          </button>
                        ` : ''}
                      ` : '<span class="hint">Legacy account</span>'}
                      <button type="button" class="btn-small"
                        onclick="manageTeacherAssignments(${accounts.indexOf(x)})">
                        Manage Classes & Subjects
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') ||
                '<tr><td colspan="6" class="empty-admin">No teacher accounts.</td></tr>'}
            </table>
          </div>

          <p class="hint">
            Deactivate disables the teacher account without permanently
            deleting the database record. Login email and username are
            not changed by the profile editor.
          </p>
        </div>

        <div class="box">
          <h2>Assign Teacher to Classes & Subjects</h2>
          <form class="form" id="assignForm">
            <label>Teacher
              <select id="atTeacher" required>
                <option value="">Select teacher</option>
                ${accounts.filter(x => x.status !== false).map(x => `
                  <option value="${escTeacher(x.username)}">
                    ${escTeacher(x.name)} · ${escTeacher(x.username)}
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
                ${classes.map(c => `<option>${c}</option>`).join('')}
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
          <p class="hint">
            These profiles appear on the public website and are separate
            from teacher login accounts. They remain browser-local for now.
          </p>
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
                <th>Name</th><th>Designation</th>
                <th>Subject</th><th>Action</th>
              </tr>
              ${profiles.map((x, i) => `
                <tr>
                  <td>${escTeacher(x.name)}</td>
                  <td>${escTeacher(x.designation)}</td>
                  <td>${escTeacher(x.subject)}</td>
                  <td>
                    <button type="button" class="btn-small"
                      onclick="editPubTeacher(${i})">Edit</button>
                    <button type="button" class="btn-small danger"
                      onclick="delPublicTeacher(${i})">Remove</button>
                  </td>
                </tr>
              `).join('') ||
                '<tr><td colspan="4" class="empty-admin">No public teacher profiles.</td></tr>'}
            </table>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('tf');
    const message = document.getElementById('teacherCreateMessage');
    const submitButton = document.getElementById('createTeacherBtn');

    form.onsubmit = async event => {
      event.preventDefault();

      const name = document.getElementById('tn').value.trim();
      const designation =
        document.getElementById('td').value.trim() || 'Teacher';
      const subject = document.getElementById('ts').value.trim();
      const qualification = document.getElementById('tq').value.trim();
      const username = document.getElementById('tu').value.trim();
      const email = document.getElementById('te').value.trim().toLowerCase();
      const password = document.getElementById('tp').value;
      const mobile = document.getElementById('tmobile').value.trim();
      const photo = document.getElementById('tphoto').value.trim();

      if (password.length < 8) {
        message.textContent = 'Password must contain at least 8 characters.';
        return;
      }

      submitButton.disabled = true;
      message.textContent = 'Creating teacher account...';

      try {
        const token = await getAdminToken();

        const response = await fetch('/api/create-teacher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name,
            designation,
            subject,
            qualification,
            username,
            email,
            password,
            mobile,
            photo
          })
        });

        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('Invalid server response. Check the deployment.');
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Could not create teacher account.');
        }

        // Refresh from Supabase so the real database ID is used.
        message.textContent = 'Account created. Refreshing teacher list...';
        document.getElementById('tp').value = '';

        alert(
          'Teacher account created successfully. ' +
          'The teacher can sign in using their email and password.'
        );

        render();
      } catch (error) {
        console.error('Teacher account creation error:', error);
        message.textContent = error.message || 'Account creation failed.';
      } finally {
        submitButton.disabled = false;
      }
    };

    document.getElementById('assignForm').onsubmit = event => {
      event.preventDefault();

      const username = document.getElementById('atTeacher').value;
      const className = document.getElementById('atClass').value;
      const section = document.getElementById('atSection').value.trim();
      const subject = document.getElementById('atSubject').value;
      const academicYear = Number(
        document.getElementById('atYear').value
      );

      if (!username || !subject) {
        alert('Select a teacher and a configured subject.');
        return;
      }

      const all = read('mhs_teacher_classes');

      if (all.some(x =>
        x.teacher === username &&
        String(x.class) === String(className) &&
        String(x.section || '') === section &&
        String(x.subject).toLowerCase() === subject.toLowerCase() &&
        Number(x.year) === academicYear
      )) {
        alert('This assignment already exists.');
        return;
      }

      all.push({
        teacher: username,
        teacherName:
          accounts.find(x => x.username === username)?.name || username,
        class: className,
        section,
        subject,
        year: academicYear
      });

      write('mhs_teacher_classes', all);
      alert('Teaching assignment added.');
      render();
    };

    const updateSubjects = () => {
      const academicYear = Number(
        document.getElementById('atYear').value
      );
      const className = document.getElementById('atClass').value;

      const available = subjects.filter(x =>
        String(x.year) === String(academicYear) &&
        String(x.class) === String(className)
      );

      document.getElementById('atSubject').innerHTML =
        available.map(x => `
          <option value="${escTeacher(x.subject)}">
            ${escTeacher(x.subject)}
            ${x.required === false ? ' · Optional' : ''}
          </option>
        `).join('') || '<option value="">No subjects configured</option>';
    };

    const updateAssignments = () => {
      const username = document.getElementById('atTeacher').value;
      const target = document.getElementById('assignmentList');

      if (!username) {
        target.innerHTML = '';
        return;
      }

      const list = read('mhs_teacher_classes').filter(x =>
        x.teacher === username
      );

      target.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <tr>
              <th>Year</th><th>Class</th>
              <th>Section</th><th>Subject</th>
            </tr>
            ${list.map(x => `
              <tr>
                <td>${escTeacher(x.year)}</td>
                <td>${escTeacher(x.class)}</td>
                <td>${escTeacher(x.section || '—')}</td>
                <td>${escTeacher(x.subject)}</td>
              </tr>
            `).join('') ||
              '<tr><td colspan="4">No assignments yet.</td></tr>'}
          </table>
        </div>
      `;
    };

    document.getElementById('atTeacher').onchange = updateAssignments;
    document.getElementById('atYear').onchange = updateSubjects;
    document.getElementById('atClass').onchange = updateSubjects;

    updateSubjects();
    updateAssignments();

    document.getElementById('pf').onsubmit = event => {
      event.preventDefault();

      const list = read(
        'mhs_teachers',
        typeof TEACHERS !== 'undefined' ? TEACHERS : []
      );

      list.push({
        name: document.getElementById('pn').value.trim(),
        designation:
          document.getElementById('pd').value.trim() || 'Teacher',
        subject: document.getElementById('ps').value.trim(),
        qualification: document.getElementById('pq').value.trim(),
        photo: document.getElementById('pphoto').value.trim()
      });

      write('mhs_teachers', list);
      alert('Teacher added to website.');
      render();
    };

    if (window.MHS_ADMIN_SEARCH) {
      setTimeout(window.MHS_ADMIN_SEARCH, 0);
    }
  };
})();

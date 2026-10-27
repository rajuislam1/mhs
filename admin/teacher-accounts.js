
/* MHS V16 — Supabase Teacher Accounts & Public Profiles */
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

  async function teacherApi(method, body) {
    return apiRequest('/api/manage-teacher', method, body);
  }

  async function publicTeacherApi(method, body) {
    return apiRequest('/api/manage-public-teacher', method, body);
  }

  function showError(message, error) {
    console.error(message, error);
    alert(error?.message || message);
  }

  // --------------------------------------------------
  // Edit teacher login account
  // --------------------------------------------------
  window.editSupabaseTeacher = async function (id) {
    const teacher = (window.mhsSupabaseTeachers || [])
      .find(x => x.id === id);

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
  // Deactivate teacher login account
  // --------------------------------------------------
  window.deactivateSupabaseTeacher = async function (id) {
    const teacher = (window.mhsSupabaseTeachers || [])
      .find(x => x.id === id);

    if (!teacher) {
      alert('Teacher record not found. Reload the page and try again.');
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
  // Edit public website teacher profile
  // --------------------------------------------------
  window.editSupabasePublicTeacher = async function (id) {
    const teacher = (window.mhsPublicTeachers || [])
      .find(x => x.id === id);

    if (!teacher) {
      alert('Public teacher profile not found. Reload and try again.');
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

    const subject = prompt('Subject:', teacher.subject || '');
    if (subject === null) return;

    const qualification = prompt(
      'Qualification:',
      teacher.qualification || ''
    );
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

  // --------------------------------------------------
  // Remove public teacher profile from the website
  // --------------------------------------------------
  window.removeSupabasePublicTeacher = async function (id) {
    const teacher = (window.mhsPublicTeachers || [])
      .find(x => x.id === id);

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
  // Main Teacher Management screen
  // --------------------------------------------------
  window.teachers = async function () {
    let accounts = read('mhs_teacher_accounts');
    let accountLoadError = '';

    let profiles = read(
      'mhs_teachers',
      typeof TEACHERS !== 'undefined' ? TEACHERS : []
    );

    let publicProfileLoadError = '';

    const assignments = read('mhs_teacher_classes');
    const year = new Date().getFullYear();
    const classes = ['6', '7', '8', '9', '10'];

    if (window.mhsEnsureAcademicStructure) {
      window.mhsEnsureAcademicStructure(year);
    }

    const subjects = read('mhs_class_subjects');

    // Load login accounts from Supabase.
    try {
      const result = await teacherApi('GET');

      accounts = Array.isArray(result.teachers)
        ? result.teachers
        : [];

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

    // Load public website profiles from Supabase.
    try {
      const result = await publicTeacherApi('GET');

      profiles = Array.isArray(result.teachers)
        ? result.teachers
        : [];

      window.mhsPublicTeachers = profiles;
    } catch (error) {
      console.error('Public teacher profile load error:', error);
      publicProfileLoadError =
        error.message || 'Could not load public teacher profiles.';

      // Keep existing browser-local profiles visible if the API fails.
      profiles = read(
        'mhs_teachers',
        typeof TEACHERS !== 'undefined' ? TEACHERS : []
      );

      window.mhsPublicTeachers = [];
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

    const publicProfileRows = profiles.map((x, i) => {
      const isDatabaseProfile = Boolean(
        x.id && window.mhsPublicTeachers?.some(t => t.id === x.id)
      );

      const action = isDatabaseProfile
        ? `
          <button type="button" class="btn-small"
            onclick="editSupabasePublicTeacher('${escTeacher(x.id)}')">
            Edit
          </button>
          <button type="button" class="btn-small danger"
            onclick="removeSupabasePublicTeacher('${escTeacher(x.id)}')">
            Remove
          </button>
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
                        onclick="manageTeacherAssignments(${i})">
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
            Deactivated accounts remain in the database.
            Login email and username are not changed by the profile editor.
          </p>
        </div>

        <div class="box">
          <div class="toolbar">
            <h2>Assign Teacher to Classes & Subjects</h2>
          </div>

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
            These profiles are stored in Supabase and can be loaded
            across browsers. They are separate from teacher login accounts.
          </p>

          ${publicProfileLoadError ? `
            <p class="hint" role="status">
              Could not load Supabase profiles:
              ${escTeacher(publicProfileLoadError)}
              The displayed legacy profiles may be browser-local only.
            </p>
          ` : ''}

          <form class="form" id="pf">
            <label>Name
              <input id="pn" required>
            </label>

            <label>Designation
              <input id="pd" value="Teacher">
            </label>

            <label>Subject
              <input id="ps">
            </label>

            <label>Qualification
              <input id="pq">
            </label>

            <label class="full">Photo URL
              <input id="pphoto" placeholder="Optional">
            </label>

            <button type="submit" id="addPublicTeacherBtn">
              Add Teacher to Website
            </button>
          </form>

          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Subject</th>
                <th>Action</th>
              </tr>

              ${publicProfileRows ||
                '<tr><td colspan="4" class="empty-admin">No public teacher profiles.</td></tr>'}
            </table>
          </div>
        </div>

      </div>
    `;

    // Create teacher login account.
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

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.error || 'Could not create teacher account.'
          );
        }

        document.getElementById('tp').value = '';
        alert(
          'Teacher account created successfully. ' +
          'The teacher can sign in using their email and password.'
        );

        await window.teachers();
      } catch (error) {
        console.error('Teacher account creation error:', error);
        message.textContent = error.message || 'Account creation failed.';
      } finally {
        submitButton.disabled = false;
      }
    };

    // Add public website teacher profile to Supabase.
    const publicForm = document.getElementById('pf');
    const publicSubmit = document.getElementById('addPublicTeacherBtn');

    publicForm.onsubmit = async event => {
      event.preventDefault();

      const name = document.getElementById('pn').value.trim();
      const designation =
        document.getElementById('pd').value.trim() || 'Teacher';
      const subject = document.getElementById('ps').value.trim();
      const qualification = document.getElementById('pq').value.trim();
      const photo = document.getElementById('pphoto').value.trim();

      if (!name) {
        alert('Teacher name is required.');
        return;
      }

      publicSubmit.disabled = true;
      publicSubmit.textContent = 'Saving...';

      try {
        await publicTeacherApi('POST', {
          name,
          designation,
          subject,
          qualification,
          photo
        });

        alert('Teacher profile saved to Supabase successfully.');

        publicForm.reset();
        document.getElementById('pd').value = 'Teacher';

        await window.teachers();
      } catch (error) {
        showError('Could not save public teacher profile.', error);
      } finally {
        publicSubmit.disabled = false;
        publicSubmit.textContent = 'Add Teacher to Website';
      }
    };

    // Teaching assignments remain browser-local as before.
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
      window.teachers();
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
              <th>Year</th>
              <th>Class</th>
              <th>Section</th>
              <th>Subject</th>
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

    if (window.MHS_ADMIN_SEARCH) {
      setTimeout(window.MHS_ADMIN_SEARCH, 0);
    }
  };
})();

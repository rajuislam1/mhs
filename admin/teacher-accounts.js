
/* MHS V14 — Supabase Teacher Account Creation */
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

  window.teachers = function () {
    const accounts = read('mhs_teacher_accounts');
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

    const assignmentSummary = username => {
      const list = assignments.filter(x => x.teacher === username);
      return list.length
        ? list.map(x =>
            `Class ${escTeacher(x.class)}${x.section ? '-' + escTeacher(x.section) : ''}: ${escTeacher(x.subject)}`
          ).join('<br>')
        : '<span class="hint">No teaching assignment</span>';
    };

    app.innerHTML = `
      <div class="panel">
        <div class="box">
          <h2>Create Teacher Login Account</h2>
          <p class="hint">
            Create an account using the teacher's email. The password is
            securely handled by Supabase Auth, not saved in this browser.
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
                pattern="[A-Za-z0-9._-]{3,40}">
            </label>
            <label>Personal Email
              <input id="te" type="email" required>
            </label>
            <label>Password
              <input id="tp" type="password" required minlength="8"
                autocomplete="new-password">
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
          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Teacher</th>
                <th>Username</th>
                <th>Email</th>
                <th>Teaching Assignments</th>
                <th>Action</th>
              </tr>
              ${accounts.map((x, i) => `
                <tr>
                  <td>${escTeacher(x.name)}</td>
                  <td>${escTeacher(x.username)}</td>
                  <td>${escTeacher(x.email || 'Legacy account')}</td>
                  <td>${assignmentSummary(x.username)}</td>
                  <td>
                    <button type="button" class="btn-small"
                      onclick="manageTeacherAssignments(${i})">
                      Manage Classes & Subjects
                    </button>
                  </td>
                </tr>
              `).join('') ||
                '<tr><td colspan="5" class="empty-admin">No teacher accounts.</td></tr>'}
            </table>
          </div>
          <p class="hint">
            Account editing, deactivation and password reset must be
            connected to Supabase separately; removing a row from this
            browser does not delete the Auth account.
          </p>
        </div>

        <div class="box">
          <h2>Assign Teacher to Classes & Subjects</h2>
          <form class="form" id="assignForm">
            <label>Teacher
              <select id="atTeacher" required>
                <option value="">Select teacher</option>
                ${accounts.map(x => `
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
            These profiles appear on the public website. They are
            separate from teacher login accounts.
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
                <th>Name</th><th>Designation</th><th>Subject</th><th>Action</th>
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
      const designation = document.getElementById('td').value.trim() || 'Teacher';
      const subject = document.getElementById('ts').value.trim();
      const qualification = document.getElementById('tq').value.trim();
      const username = document.getElementById('tu').value.trim();
      const email = document.getElementById('te').value.trim().toLowerCase();
      const password = document.getElementById('tp').value;
      const photo = document.getElementById('tphoto').value.trim();

      if (accounts.some(x =>
        String(x.username || '').toLowerCase() === username.toLowerCase()
      )) {
        message.textContent = 'This username already exists.';
        return;
      }

      if (password.length < 8) {
        message.textContent = 'Password must contain at least 8 characters.';
        return;
      }

      submitButton.disabled = true;
      message.textContent = 'Creating teacher account...';

      try {
        if (!window.mhsSupabaseReady) {
          throw new Error('Supabase connection is not configured.');
        }

        const supabase = await window.mhsSupabaseReady;
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const token = sessionData.session?.access_token;
        if (!token) {
          throw new Error('Admin session expired. Please sign in again.');
        }

        const response = await fetch('/api/create-teacher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name, email, username, password, subject })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Could not create teacher account.');
        }

        // Keep non-secret teacher details locally for existing V14
        // class, subject and result assignment features.
        const updatedAccounts = read('mhs_teacher_accounts');
        updatedAccounts.push({
          id: result.teacher.id,
          authId: result.teacher.id,
          name,
          designation,
          subject,
          qualification,
          username,
          email,
          photo,
          createdAt: new Date().toISOString()
        });

        write('mhs_teacher_accounts', updatedAccounts);

        message.textContent = 'Teacher account created successfully.';
        alert('Teacher account created successfully. The teacher can now sign in using their email and password.');

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
      const academicYear = Number(document.getElementById('atYear').value);

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
        teacherName: accounts.find(x => x.username === username)?.name || username,
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
      const academicYear = Number(document.getElementById('atYear').value);
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
            <tr><th>Year</th><th>Class</th><th>Section</th><th>Subject</th></tr>
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
        designation: document.getElementById('pd').value.trim() || 'Teacher',
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

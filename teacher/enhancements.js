
/* MHS Teacher Portal Enhancements v15
   Admin assignments: Supabase
   Existing unrelated features: preserved
*/
(function () {
  'use strict';

  const TGET = (key, fallback = []) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  };

  const TSET = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  const TESC = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[ch]);

  let assignmentState = {
    loading: true,
    error: '',
    assignments: []
  };

  function searchTables() {
    document.querySelectorAll('.table-wrap').forEach(wrapper => {
      const table = wrapper.querySelector('table.table');

      if (!table || wrapper.querySelector('.record-search')) return;

      const input = document.createElement('input');
      input.className = 'record-search';
      input.type = 'search';
      input.placeholder = 'Search records…';
      input.style.cssText =
        'width:100%;max-width:360px;margin:0 0 12px;padding:10px 12px;border:1px solid #d9dee5;border-radius:9px;font:inherit;box-sizing:border-box;background:#fff;';

      wrapper.insertBefore(input, table);

      input.oninput = () => {
        const query = input.value.toLowerCase().trim();

        [...table.querySelectorAll('tr')].slice(1).forEach(row => {
          row.style.display =
            !query || row.innerText.toLowerCase().includes(query)
              ? ''
              : 'none';
        });
      };
    });
  }

  function getMyAssignments() {
    return assignmentState.assignments;
  }

  function assignmentMessage() {
    if (assignmentState.loading) {
      return '<p class="hint">Loading your assignments from Supabase...</p>';
    }

    if (assignmentState.error) {
      return `<p class="hint">Could not load assignments: ${
        TESC(assignmentState.error)
      }</p>`;
    }

    return '';
  }

  /*
   * Load the logged-in teacher's assignments from Supabase.
   * The authenticated user must have an active teacher profile.
   */
  async function loadAdminAssignments() {
    assignmentState.loading = true;
    assignmentState.error = '';

    try {
      if (!window.mhsSupabaseReady) {
        throw new Error('Supabase client is not initialized.');
      }

      const sb = await window.mhsSupabaseReady;

      const { data: authData, error: authError } =
        await sb.auth.getUser();

      if (authError) throw authError;

      if (!authData?.user) {
        throw new Error(
          'Teacher Supabase session not found. Please log out and log in again.'
        );
      }

      const { data: profile, error: profileError } = await sb
        .from('user_profiles')
        .select('teacher_id, role, is_active')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      if (
        profile.role !== 'teacher' ||
        profile.is_active !== true ||
        !profile.teacher_id
      ) {
        throw new Error(
          'This login is not linked to an active teacher profile.'
        );
      }

      const { data: rows, error: assignmentError } = await sb
        .from('teacher_assignments')
        .select('id, class_id, subject_id, academic_year_id, status')
        .eq('teacher_id', profile.teacher_id)
        .eq('status', true);

      if (assignmentError) throw assignmentError;

      const assignments = [];

      for (const row of rows || []) {
        const [
          { data: classRow, error: classError },
          { data: subjectRow, error: subjectError },
          { data: yearRow, error: yearError }
        ] = await Promise.all([
          sb.from('classes')
            .select('id, name')
            .eq('id', row.class_id)
            .maybeSingle(),

          sb.from('subjects')
            .select('id, name')
            .eq('id', row.subject_id)
            .maybeSingle(),

          sb.from('academic_years')
            .select('id, year')
            .eq('id', row.academic_year_id)
            .maybeSingle()
        ]);

        if (classError) throw classError;
        if (subjectError) throw subjectError;
        if (yearError) throw yearError;

        assignments.push({
          id: row.id,
          class_id: row.class_id,
          subject_id: row.subject_id,
          academic_year_id: row.academic_year_id,
          class: classRow?.name || 'Unknown class',
          subject: subjectRow?.name || 'Unknown subject',
          academic_year: yearRow?.year ?? '',
          section: ''
        });
      }

      assignmentState.assignments = assignments;

      /*
       * Compatibility bridge:
       * Existing Publish Results code reads mhs_teacher_classes.
       * Populate it from the authenticated Supabase assignments.
       * This is a local cache, not the authoritative database.
       */
      const legacy = TGET('mhs_teacher_classes', []);
      const username = me?.username;

      if (username) {
        const otherTeachers = legacy.filter(
          item => item.teacher !== username
        );

        const compatibilityRows = assignments.map(item => ({
          teacher: username,
          class: item.class,
          section: item.section,
          subject: item.subject,
          academicYear: item.academic_year,
          assignmentId: item.id,
          classId: item.class_id,
          subjectId: item.subject_id,
          academicYearId: item.academic_year_id
        }));

        TSET(
          'mhs_teacher_classes',
          [...otherTeachers, ...compatibilityRows]
        );
      }

    } catch (error) {
      console.error('Teacher assignments could not be loaded:', error);
      assignmentState.error = error.message || String(error);
    } finally {
      assignmentState.loading = false;
    }
  }

  /*
   * Dashboard: display assignments from Supabase.
   * Results and routines continue using their existing storage.
   */
  window.dash = function () {
    const assignments = getMyAssignments();

    const results = TGET('mhs_results', [])
      .filter(item => mhsOwn(item, me.username));

    const routines = TGET('mhs_routines', [])
      .filter(item => item.teacher === me.username);

    const classes = [
      ...new Set(assignments.map(item => item.class))
    ];

    const subjects = [
      ...new Set(assignments.map(item => item.subject))
    ];

    view.innerHTML = `
      <div class="panel">
        <div class="cards4">
          <div class="stat">
            <b>${assignmentState.loading ? '…' : assignments.length}</b>
            <span>Teaching Assignments</span>
          </div>
          <div class="stat">
            <b>${assignmentState.loading ? '…' : classes.length}</b>
            <span>Classes</span>
          </div>
          <div class="stat">
            <b>${assignmentState.loading ? '…' : subjects.length}</b>
            <span>Subjects</span>
          </div>
          <div class="stat">
            <b>${results.length}</b>
            <span>My Result Records</span>
          </div>
        </div>

        <div class="box">
          <h2>Welcome, ${TESC(me.name)}</h2>
          <p>Your class and subject assignments are managed by the Super Admin.</p>

          ${assignmentMessage()}

          <h3>Assigned Classes</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${classes.map(item =>
              `<span class="pill-status">${TESC(item)}</span>`
            ).join('') || (
              assignmentState.loading || assignmentState.error
                ? ''
                : '<span class="hint">No active class assignments.</span>'
            )}
          </div>

          <h3 style="margin-top:20px">Assigned Subjects</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${subjects.map(item =>
              `<span class="pill-status">${TESC(item)}</span>`
            ).join('') || (
              assignmentState.loading || assignmentState.error
                ? ''
                : '<span class="hint">No active subject assignments.</span>'
            )}
          </div>

          <h3 style="margin-top:20px">Assignment Details</h3>
          <div class="table-wrap">
            <table class="table">
              <tr>
                <th>Class</th>
                <th>Subject</th>
                <th>Academic Year</th>
              </tr>
              ${assignments.map(item => `
                <tr>
                  <td>${TESC(item.class)}</td>
                  <td>${TESC(item.subject)}</td>
                  <td>${TESC(item.academic_year || '—')}</td>
                </tr>
              `).join('') || (
                assignmentState.loading || assignmentState.error
                  ? ''
                  : '<tr><td colspan="3">No assignments found.</td></tr>'
              )}
            </table>
          </div>
        </div>

        <div class="box">
          <h3>Quick Access</h3>
          <div class="quick-grid">
            <button onclick="tab='classes';render()">My Classes</button>
            <button onclick="tab='results';render()">Publish Results</button>
            <button onclick="tab='classstudents';render()">Class Students</button>
            <button onclick="tab='students';render()">Student Results</button>
          </div>
        </div>
      </div>
    `;
  };

  /*
   * My Classes: read-only view.
   * Teachers cannot add or delete Admin assignments here.
   */
  window.classes = function () {
    const assignments = getMyAssignments();
    const grouped = {};

    assignments.forEach(item => {
      const key = item.class;
      (grouped[key] ||= []).push(item);
    });

    view.innerHTML = `
      <div class="panel">
        <div class="box">
          <h2>My Classes & Subjects</h2>
          <p class="hint">
            This list is controlled by the Super Admin.
            Assignments are loaded from Supabase.
          </p>

          ${assignmentMessage()}

          ${Object.keys(grouped).sort().map(className => `
            <div class="box" style="margin-top:12px">
              <div class="toolbar">
                <h3>${TESC(className)}</h3>
                <span>${grouped[className].length} assignment(s)</span>
              </div>

              <div class="table-wrap">
                <table class="table">
                  <tr>
                    <th>Subject</th>
                    <th>Academic Year</th>
                  </tr>
                  ${grouped[className].map(item => `
                    <tr>
                      <td>${TESC(item.subject)}</td>
                      <td>${TESC(item.academic_year || '—')}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            </div>
          `).join('') || (
            assignmentState.loading || assignmentState.error
              ? ''
              : '<div class="empty-admin">No classes have been assigned to this teacher yet.</div>'
          )}
        </div>
      </div>
    `;
  };

  const nav = document.querySelector('nav');

  if (nav && !nav.querySelector('[data-tab="notifications"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'notifications';
    button.textContent = 'Result Edit Requests';

    button.onclick = () => {
      tab = 'notifications';
      nav.querySelectorAll('button').forEach(item => {
        item.classList.toggle(
          'active',
          item.dataset.tab === 'notifications'
        );
      });
      render();
    };

    nav.appendChild(button);
  }

  const originalRender = window.render;

  window.render = function () {
    try {
      originalRender();
    } catch (error) {
      console.error(error);

      if (window.view) {
        window.view.innerHTML =
          '<div class="panel"><div class="box"><h2>Teacher Portal</h2><p class="hint">Please reload the page and try again.</p></div></div>';
      }
    }

    setTimeout(searchTables, 0);
  };

  /*
   * Load assignments first, then redraw the current tab.
   */
  loadAdminAssignments().finally(() => {
    if (typeof window.render === 'function') {
      window.render();
    }
  });

  setTimeout(searchTables, 0);
})();
